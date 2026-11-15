---
order: 4
---

# 多租户权限模型：公司 → 应用 → 角色 → 菜单，四层怎么串起来

对应归档里的 `sso/pkg/model/`、`sso/pkg/middleware/sess.go`、`sso/pkg/server/api/controller/permission.go`。

## 一、需求：一套账号体系，服务多家企业、多个应用

认证中心面对的不是「一个系统的用户表」，而是：

- **多家企业（租户）**，每家有自己的员工、自己的菜单、自己的可用应用；
- **多个应用（App X / Y / Z）**，每个应用有自己的一棵菜单权限树；
- **同一批人可能同时属于多角色**，权限取并集，但不能超过「超级管理员」；
- 还有一类特殊账号：企业管理员，拥有该企业的全部权限，且不受 IP 白名单限制。

这个模型决定了设计不能只是「用户-角色-权限」三张表，还要插入 **company** 和 **app** 两个维度。

## 二、表结构：五张核心表 + 两张辅助表

从 `design.md` 与实际 model 代码合并出来的模型：

```
company（公司/租户）
  ├─ id, code, name, email, status, admin_user_id
  │
user（账号）
  ├─ id, company_id, account, password, email, enabled, is_admin
  │
role（角色）
  ├─ id, company_id, name, description, is_admin
  │
user_role（谁有什么角色）
  ├─ user_id, role_id
  │
role_permission（角色在某个应用下有哪些权限）
  ├─ role_id, company_id, app_id, permission(JSON 数组)
  │
app_permission（应用自己的权限树，也就是「菜单/按钮」清单）
  ├─ app_id, permission_id, parent_id, name, route_name, order
  │
oauth_app（应用注册表）
  └─ client_id, client_secret, redirect_url, white_list, scopes, status
```

三个设计细节值得展开：

**细节 1：权限是「应用维度」的。** `role_permission` 同时带 `app_id` 和 `company_id`，意味着「同一个角色在不同应用里是不同的权限集合」。这解决了「一个人在客服平台是管理员、在知识库只是普通用户」的问题。代价是权限表行数 = 角色数 × 应用数，写入时要做增量维护。

**细节 2：`permission` 是 JSON 数组，不是关联表。** 存的是 `app_permission.permission_id` 的集合：

```json
["1", "2", "7", "12", "13"]
```

好处是读一次就拿到全部权限，省掉一次 join；坏处是**数据库层面无法做完整性约束**——删了某个菜单忘了清引用，就会出现「幽灵权限」。实操中的兜底手段是：渲染权限树时用 `app_permission` 做过滤，不存在的 id 自然被丢掉（代码里 `GetAppPermissionByRolePermission` 就是这么兜的）。

**细节 3：权限树用 `permission_id` + `parent_id` 扁平存储，服务层拼树。**

```go
type AppPermission struct {
    BaseModel
    AppID        uint   `gorm:"not null;default:0"`
    Name         string `gorm:"not null;size:32"`
    ParentID     string `gorm:"not null;size:32"`
    PermissionID string `gorm:"not null;size:32"`
    RouteName    string `gorm:"not null;size:128"`
    Order        uint   `gorm:"not null;default:0"`
}
```

`service.GetPermissionsByPermissionID` 把「查出来的行」转成 `PermissionTree`，最后 `ToTree()` 一次成型。**扁平存储 + 服务层拼树**是菜单权限最主流的做法，改层级不用动表结构。

## 三、「权限模板」接口：前端配置角色权限页时调它

管理后台要给角色勾选权限，前端需要一棵**完整的、带层级、带应用状态**的树。`GET /api/permission/template` 的输出结构是：

```go
for _, oAuthApp := range allOAuthApps {
    tmp["app_id"]     = oAuthApp.ID
    tmp["app_name"]   = oAuthApp.Name
    tmp["permission"] = emptyPermission
    tmp["app_status"] = -1        // -1 未开通 / 0 已开通
    tmp["is_expired"] = true
    if companyApp, ok := userCompanyAppMap[int(oAuthApp.ID)]; ok {
        if companyApp.Status == 1 {
            tmp["app_status"] = 0
            if expiredAt >= now || oAuthApp.IsDefault {
                tmp["is_expired"] = false
                appPermissionTree, _ := service.GetPermissionsByPermissionID(oAuthApp.ID, role_permission_map[oAuthApp.ID])
                if len(appPermissionTree) == 1 {
                    tmp["permission"] = appPermissionTree[0]
                }
            }
        }
    }
}
```

注意三个业务规则被编码在接口里，而不是在文档里：

1. **未开通的应用也返回**，只是 `app_status = -1`，前端置灰；
2. **过期应用不给权限树**（除了 `is_default` 的默认应用），防止用户去配置一个已经过期的功能；
3. **`len(appPermissionTree) == 1` 才当成一棵合法树**——因为 `ToTree()` 返回的是森林（切片），根节点只有一个才算正常。这是个隐式约定，建议加注释，否则后来者看不懂为什么要判长度。

> 同时这段代码底部有 `TODO(xzg): 加入用户缓存`，且返回码用了 `http.StatusAccepted (202)` 而不是 200。这类「半成品痕迹」在真实项目里很常见：**202 表示「我收到了但还没完全处理」，如果前端按 200 判断成功，改天就会被绊一下。**

## 四、接口级鉴权：用「最长前缀匹配」把 URL 映射到菜单

这是整套设计里最值得单独讲的部分。`middleware/sess.go` 每请求做四件事：

```go
token := utils.GetSession(c, "user_token")
if token == "" { 403 请重新登录 }

if status := service.GetCacheSessionToken(token); !status {   // 是否被挤下线
    403 账号在其他地方登录
}

userInfo, _ := service.GetCacheUserInfo(userID)               // 用户 + 公司是否有效
_, err := service.GetCacheCompanyInfo(userInfo.CompanyID)
if code != e.SUCCESS { 403 }

if status := check_url(c.Request.URL.Path, userID, userInfo.CompanyID); !status {
    403 无权限访问
}
```

核心在 `check_url`：

```go
// 路由 → 需要的菜单名
var MenuPermission = map[string][]string{
    "/api/company/setting":   {"安全设置"},
    "/api/whitelist/list":    {"安全设置"},
    "/api/customer/list":     {"客户中心"},
    "/api/role/list":         {"角色设置"},
    ...
}

// 正则前缀匹配，收集所有命中的前缀
for uri := range e.MenuPermission {
    isHit, _ := regexp.MatchString("^"+uri+".*", path)
    if isHit { uriMenuMap[uri] = len(uri) }
}
// 未匹配到的路由不限制
if len(uriMenuMap) == 0 { return true }

// 取最长前缀
for uri, uriLen := range uriMenuMap {
    if uriLen > max { max, maxLenUri = uriLen, uri }
}
// 该前缀要求的任一菜单，用户拥有即放行
for _, menuName := range e.MenuPermission[maxLenUri] {
    for _, ownerMenu := range appPermissionList {
        if menuName == ownerMenu.Name { return true }
    }
}
return false
```

### 4.1 为什么用最长前缀

如果只做「包含匹配」，`/api/customer/list` 会同时命中 `/api/customer` 和 `/api/customer/list` 两条规则，取谁就说不清了。取**最长前缀**是唯一稳定的答案：越具体的路由优先级越高，语义上等价于「子资源可以给自己更细的权限要求」。

### 4.2 一个必须承认的缺陷：未匹配即放行

```go
if len(uriMenuMap) == 0 { return true }   // 未匹配到的路由不限制
```

这是典型的 **default allow**。它带来两个后果：

- 新增接口忘了登记到 `MenuPermission`，就自动对所有登录用户开放；
- 权限表是「字符串常量 map」，与路由注册（`routers.go`）**两处维护**，必然漂移。

现实中仓库里的实验脚本就是在做这件事的验证——把整套映射抄到测试代码里跑一遍，看看打印出的菜单名对不对。**这说明作者自己也知道这张表容易错。**

### 4.3 建议的改造路径（三步，可渐进）

**第一步：把「路由 → 权限」变成显式声明，放在路由注册处。**

```go
func InitRouters() *gin.Engine {
    ...
    user := r.Group("/api/user", middleware.Sess(), middleware.Require("所有用户"))
    role := r.Group("/api/role", middleware.Sess(), middleware.Require("角色设置"))
}
```

权限跟着路由走，删路由必然删权限，物理上消除漂移。

**第二步：白名单显式列出「无需权限」的接口，其余默认拒绝。**

```go
var publicPrefixes = []string{"/api/oauth", "/api/_internal", "/api/captcha"}
```

从 default allow 改成 default deny，才是权限系统的正确默认值。迁移期可以先「照旧放行 + 打标记录未登记路由」，灰度一段时间再收紧。

**第三步：把权限树缓存起来。**

现在每次请求都要：查用户角色（1 次 join 查询）→ 查角色权限（1 次）→ 查权限清单（1 次）→ 再内存匹配。也就是**每个受保护接口每个请求 3 次 SQL**。正确做法是把 `user_id → []permissionName` 的展开结果缓存到 Redis，写角色/权限时主动失效。这份代码里已经有 `GetCacheUserInfo` 这类缓存基建，缺的只是把权限一起缓存。

## 五、两个容易被忽略的边界

**边界 1：企业管理员绕过 IP 白名单，但没绕过菜单鉴权。**

```go
if ok := model.CheckAdminUserByCompanyID(user.CompanyID, user.ID); ok == false {
    // 只有非管理员才校验 IP 白名单
}
```

管理员能在任意 IP 登录，这是刻意的运维便利。但注意 `sess.go` 的菜单鉴权对管理员**没有特判**——管理员之所以能进所有页面，是因为他的角色 `is_admin=1` 且权限集合覆盖全部菜单，而不是因为有绕过逻辑。这种「用数据表达特权，而不是用 if 表达」的做法是对的，可审计。

**边界 2：权限不能超过「企业管理员」。**

`GetOAuthUserPermission` 里有一段过滤逻辑：

```go
// 过滤超级管理员权限，各角色权限<=超级管理员
role_permissions, _ := model.GetCompanyAdminRoleByCompanyID(companyID)
admin_role_permission_map := make(map[string]bool)
for _, app_permission_id := range admin_role_permission {
    admin_role_permission_map[app_permission_id] = true
}
var filter_role_permission []string
for _, id := range rolePermissionStringList {
    if _, ok := admin_role_permission_map[id]; ok {
        filter_role_permission = append(filter_role_permission, id)
    }
}
```

也就是：**普通角色即使在数据库里被误配了超出管理员的权限，发给子应用的权限也会被裁掉**。这是「纵深防御」的典型写法——不信任上游配置的正确性，在出口处再收一次口。

## 六、可以直接复用的结论

1. **权限表一定要带 `app_id` 和 `tenant_id`**。少任何一个，后面都得重做。
2. **权限存 JSON 数组**适合读多写少的场景，但必须有服务层过滤兜底，不能依赖数据库约束。
3. **权限树扁平存储 + 服务层拼树**，改层级零成本。
4. **接口鉴权用最长前缀匹配**，语义清晰，实现只要 20 行。
5. **默认值必须是 deny**。default allow 一时省事，长期是漏权限的根源。
6. **出口处再裁一次权限**（不超过管理员），能兜住配置错误。
7. **鉴权路径上的 SQL 必须缓存**，否则每个请求 3 次查询，扛不住并发。

---
