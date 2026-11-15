
# 统一认证中心：OAuth 2 落地时，标准之外的那些决定

对应归档里的 `sso/`，Go 1.12 + Gin + gorm + redigo，对外是一套「内部统一登录 + 给子应用发 token」的服务。

## 一、它要解决什么问题

这套系统服务的不是「一个网站一个登录页」，而是一家企业内部的一堆子系统：

- 一个账号要能登录客服平台、机器人平台、知识库、运营后台；
- 每个子系统都需要知道「你是谁（身份）」和「你能干什么（权限）」；
- 客户是多家企业（多租户），每家企业有自己的账号体系、菜单权限、可用的子应用列表；
- 还有一批内部应用，用户不应该被逐个弹授权框。

所以它本质上是一个**标准 OAuth 2 授权服务器 + 内部应用免授权白名单 + 多租户权限中心**三合一的实现。

## 二、三个端点，加一条「不合标准」的捷径

标准授权码模式需要三个接口（`design/design.md` 原文）：

1. 把客户端请求导向认证页面；
2. 用户认证通过后，把客户端导向 `redirect_uri` 并附上 code；
3. 客户端拿 code + client_secret 换 token。

代码里对应 `pkg/routers/routers.go` 的这几条：

```go
oauth := r.Group("/api/oauth")
oauth.GET("/authorize",   apiController.AuthorizeGet)   // 下发 code（含授权页跳转）
oauth.POST("/authorize",  apiController.AuthorizePost)  // 用户点「同意」后下发 code
oauth.POST("/token",      apiController.OauthToken)     // 换取/刷新 token
oauth.POST("/introspect", apiController.Introspect)     // 校验 token 是否有效
oauth.POST("/revoke",     apiController.Revoke)         // 撤销
oauth.POST("/logout",     apiController.Logout)
oauth.GET("/login",       apiController.LoginGet)
oauth.POST("/login",      apiController.LoginPost)
```

**第一个非标准点：白名单应用跳过授权页。** `AuthorizeGet` 里：

```go
// 是白名单APP
if oauthAPP.WhiteList {
    code := utils.GenToken()
    authorize, err := model.CreateAuthorizeCode(oauthAPP.ID, userID, code)
    ...
    query.Add("state", authorizeGetForm.State)
    query.Add("code", authorize.Code)
    redirectURLParse.RawQuery = query.Encode()
    c.Redirect(http.StatusFound, redirectURLParse.String())
    return
}
```

内部应用直接发 code 跳回去，用户看不到授权页。**第二个非标准点：非白名单应用也不每次都弹框**——按 `user_id + app_id` 记住「已授权」，缓存 12 小时：

```go
cacheUserAppAuthorized := fmt.Sprintf(e.CacheUserAppAuthorized, userID, oauthAPP.ID)
if cache.Exists(cacheUserAppAuthorized) {
    // 直接发 code，不再跳授权页
}
```

授权页由独立前端页面承担（配置项 `SsoAuthorizePage`），后端只负责拼参数重定向。这是个干净的切分：**后端只管协议，界面交给专门的页面**。

## 三、三种 grant_type 的实际行为

`OauthToken` 是个大的 `switch`，代码里明确支持三种、明确拒绝一种：

```go
switch oauthForm.GrantType {
case e.GrantTypeClientCredentials:
    appG.Response(http.StatusBadRequest, e.BadRequest, nil, "暂不支持此授权方式")
case e.GrantTypeRefreshToken:      // 用 refresh_token 换 access_token
case e.GrantTypePassword:          // 账号密码直接换 token（给 APP/脚本用）
case e.GrantTypeAuthorizationCode: // 标准授权码
default:
    appG.Response(http.StatusBadRequest, e.BadRequest, nil, "暂不支持此授权方式")
}
```

三个细节值得单独拎出来：

**细节 1：code 有效期 30 分钟，access_token 有效期 7 天。**

```go
// 检查code的有效时间: 30分钟
if oauthAuthorize.UpdatedAt.Before(time.Now().Add(time.Minute * time.Duration(-30))) {
    appG.Response(http.StatusBadRequest, e.BadRequest, nil, "该 Authorize code已过期")
    return
}
...
Expires: oAuthToken.UpdatedAt.AddDate(0, 0, 7).Unix(),
```

**细节 2：刷新不是「换新 token」，而是「续期」。** 这一点在 `design.md` 里写得很清楚：

> 若 access_token 未超时，refresh_token 不会改变 access_token，但超时时间会刷新，相当于续期。

代码实现是把同一份 token 重新写回缓存、TTL 重置为一周：

```go
oAuthToken, _ := model.GetOAuthTokenByRefreshToken(oauthForm.RefreshToken)
...
cacheAccessToken := fmt.Sprintf(e.CacheAccessToken, oAuthToken.AccessToken)
cache.Set(cacheAccessToken, oAuthTokenInfo, e.OneWeek)
```

**这样做的代价**是：`access_token` 字符串长期不变，一旦泄露无法靠「等它过期」止损，只能靠主动 revoke。如果哪天要升级，正确路径是**每次 refresh 轮换 token 并作废旧值**（RFC 6749 §10.4 推荐的 refresh token rotation）。

**细节 3：密码模式没有防爆破。** 授权码链路在登录时做了图形验证码 + 5 次错误锁定，但 `grant_type=password` 分支只做了 `CheckPasswordHash`，没有接入同一套限流。这是个真实缺口——攻击面从「有验证码的登录页」转移到了「无验证码的 API」。

## 四、Token 校验为什么查缓存而不查库

`Introspect` 完全不碰数据库，只读 Redis：

```go
// 用户别处登录 维持一分钟
cacheUserLoginElsewhere := fmt.Sprintf(e.CacheUserLoginElsewhere, token)
if cache.Exists(cacheUserLoginElsewhere) { ... 401 ... }

cacheAccessToken := fmt.Sprintf(e.CacheAccessToken, token)
if !cache.Exists(cacheAccessToken) { ... 401 已过期 ... }

expires, _ := cache.TTL(cacheAccessToken)   // 直接把剩余 TTL 当作 expires 返回
```

设计取舍很明确：**token 的有效期由缓存 TTL 决定，数据库里的 token 记录只是「账本」**。好处是一次校验就是一次 `EXISTS` + 一次 `TTL`，子应用每次请求都能扛住；代价是 Redis 一旦被 flush，全站瞬间登出——所以这个 Redis 必须和业务缓存分开部署、单独做持久化策略。

`GetOAuthUserInfo`（`/api/oauth/user/me`）也是同样的思路：从缓存里解出 `UserID`/`AppID`，再走用户与公司信息缓存，返回给子应用一个**包含公司、可用应用列表、过期状态**的用户档案。子应用不需要自己拼权限。

## 五、单点登录的「踢人」是怎么做的

内部系统最常见的一条产品要求：同一个账号只允许一处在线，新登录把旧的踢掉。

实现分三块：

**① 登录时检查旧 token，并给前端一次反悔机会：**

```go
oldToken := service.GetCacheUserToken(user.ID)
if len(oldToken) != 0 && service.GetCacheSessionToken(oldToken) == true {
    if loginPostForm.ForceLogin == false {
        respData["login_else_where"] = true
        appG.Response(http.StatusOK, e.SUCCESS, respData, "此账号已登录, 是否继续登录？")
        return
    } else {
        service.SetCacheSessionToken(oldToken, false)   // 作废旧会话
    }
}
```

**② 会话中间件每请求校验「我这枚 token 还活着吗」：**

```go
if status := service.GetCacheSessionToken(token); !status {
    c.JSON(http.StatusForbidden, gin.H{
        "code": e.ErrorAccessTokenLoginELseWhere,
        "msg":  e.GetMsg(e.ErrorAccessTokenLoginELseWhere),
    })
    c.Abort()
    return
}
```

**③ 给子应用一个「为什么 401」的区分**：`CacheUserLoginElsewhere` 这个 key 存在时，`Introspect` 返回的文案是「您的账号在其他地方登录」，而不是笼统的「已过期」。**错误信息的颗粒度直接决定客服工单量**，这一条值得抄。

## 六、登录页的六道闸

`LoginPost` 按顺序做了这些校验，顺序本身是有讲究的（越便宜越靠前）：

| 顺序 | 校验 | 失败文案 |
| --- | --- | --- |
| 1 | 图形验证码 | 校验图形验证码失败 / 验证码已过期 |
| 2 | 用户是否存在 | 用户不存在 |
| 3 | 用户是否被禁用 | 用户已被禁用 |
| 4 | 密码错误次数是否已达上限 | 连续5次密码输入错误，请30分钟后再进行登录 |
| 5 | 密码哈希校验 | 密码错误，请重新输入 |
| 6 | 企业是否启用 | 当前企业账号已禁用 |
| 7 | 企业 IP 白名单（非管理员才校验） | 你不在可信任的IP范围 |

第 4 步的实现是 **Redis ZSET 滑动窗口**，不是简单的计数器：

```go
func IsAchieveMaximumTimesPasswordError(userID string) (bool, int) {
    key := fmt.Sprintf(e.CacheUserPasswordErrorTimestamp, userID)
    result, _ := cache.ZRevRangeWithScores(key, 0, e.MaximumTimesPasswordError-1)
    now := time.Now().Unix()
    ...
    if ((result[0] - result[e.MaximumTimesPasswordError-1]) <= e.ErrorPasswordIntervalTime) &&
        ((now - result[0]) <= e.ProhibitedLoginTime) {
        return true, e.MaximumTimesPasswordError
    }
    ...
}
```

用 ZSET 存每次失败的**时间戳**而不是计数，好处是天然滑动窗口：只要「最近 5 次失败全部落在 30 分钟内」，且「最后一次失败距今不超过 30 分钟」，就锁定。比 `INCR + EXPIRE` 精确得多。缺点是每次登录失败要写一次 ZSET，成功要 `DEL`，属于典型的**用存储换精度**。

> 代码里的错误文案写的是「连续5次」，但判定阈值 `MaximumTimesPasswordError = 5` 与 `message` 分支存在 4/5 次的边界差异，实际可能第 4 次就提示锁定。做这类功能时，**阈值变量与文案最好由同一常量派生**，否则改一个忘一个。

**关于取真实 IP 的一段代码值得单独点评：**

```go
if _, ok := Header["X-Original-Forwarded-For"]; ok {
    ip = Header["X-Original-Forwarded-For"][0]
} else if _, ok := Header["X-Forwarded-For"]; ok {
    ip = Header["X-Forwarded-For"][0]
} else if _, ok := Header["X-Real-Ip"]; ok {
    ip = Header["X-Real-Ip"][0]
}
```

这三个头**都是客户端可伪造的**。安全性完全依赖「入口网关必须覆盖写入该头、且后端只信任网关」。如果哪天有人把服务直接暴露，IP 白名单形同虚设。更稳的做法是：只信任一层网关（如 `X-Real-IP` 由 Nginx `proxy_set_header` 强制覆盖），并在文档里把这条约束写成部署前置条件。

## 七、统一响应：HTTP 码与业务码分离

全站的响应体固定三件套：

```go
type Response struct {
    Code int         `json:"code"`
    Msg  string      `json:"msg"`
    Data interface{} `json:"data"`
}
```

规则是：**HTTP 码表示「这次请求的性质」，业务码表示「业务结果」。** 参数校验失败、未登录、无权限走 400/401/403 并带业务码；纯业务失败也可以用 200 + 业务码返回，让前端统一在 then 里处理。这套约定本身没有对错，关键是**全站只允许一套**——这份代码里 `LoginPost` 的错误全用 400，而 `Introspect` 用 401，属于按语义各自选择，还算自洽。

## 八、这套设计可以直接抄的部分

1. **白名单 + 已授权缓存的两级免授权**：内部应用零打扰，外部应用 12 小时内不重复打扰。落地成本低，体验收益高。
2. **token 校验只读缓存**：把「有效期」这个状态交给 Redis TTL 托管，数据库退化为账本。
3. **踢人三件套**（登录时确认 → 作废旧会话 → 每请求校验），并给子应用区分「他处登录 / 已过期」两类 401。
4. **ZSET 滑动窗口做失败限流**，比计数器精确，代码量也不大。
5. **`/user/me` 一次返回身份 + 公司 + 应用清单 + 过期状态**，把「拼权限」这个脏活留在认证中心。

## 九、建议加固的四处

| 位置 | 现状 | 建议 |
| --- | --- | --- |
| `grant_type=password` | 无验证码、无限流 | 复用登录的 ZSET 限流；或直接下线该模式，改用授权码 + PKCE |
| refresh 语义 | 只续期不轮换 | 改为 refresh token rotation，旧 token 立即失效 |
| code 复用 | 换到 token 后未删除 code 记录 | 换取成功后立即作废 code，防重放 |
| 真实 IP 来源 | 三个头任选其一 | 只信任网关固定头，部署文档硬约束 |

---
