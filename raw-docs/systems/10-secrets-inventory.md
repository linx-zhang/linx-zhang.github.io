---
order: 11
---

# 代码仓库里的敏感信息：一次完整盘点和治理方案

## 一、先说结论

盘点这 7 个目录时，在 **6 个**目录里都发现了不该出现在代码里的凭据。它们不是「示例值」，而是**看起来可以直接用的真实值**：数据库口令、对象存储 AK/SK、第三方 AppID/Secret、会话密钥、初始密码常量、前端 AES 密钥。

这类问题在内部项目里极其普遍，原因也很朴素：**为了能跑起来，先把值写进 `config.py`，想着「以后再改成环境变量」，然后就没有以后了。**

这篇文章的价值不在于指责，而在于给出一套**可执行的分级处置方案**：哪些必须今天轮换、哪些可以配置外置、哪些属于架构问题必须改设计。

## 二、盘点：风险分成六类

下表是本次盘点发现的风险类型分布（**位置只到文件级，值为空**）：

| 类别 | 典型变量名 | 出现位置 | 危险等级 |
| --- | --- | --- | --- |
| **数据库凭据** | `db_password`、`DB_USER` | `sso/app.yaml`、`webot3/monarch/config.py` | 极高 |
| **对象存储密钥** | `access_oss_key`、`access_oss_secret` | `sso/app.yaml`、`config.py` | 极高 |
| **第三方平台密钥** | `WECHAT_APP_SECRET`、`CRM_APPSECRET`、`CRM_APPID` | `config.py` | 高 |
| **本系统内部密钥** | `SECRET_KEY`、`session_key`、`CENTRIFUGO_SECRET`、`SSO_CLIENT_SECRET`、`APP_SECRET_MAP` | `config.py`、`app.yaml` | 高 |
| **业务常量口令** | `DEFAULT_PASSWORD`、`API_TOKEN_KEY`、`COMPANY_TOKEN_KEY`、`TASKBOT_DEPLOY_KEY` | `exc/consts.py` | 高 |
| **前端对称密钥** | AES `key`、固定 `IV` | `jsjsjsj/*`、`sso_pwd/pkg/e/const.go` | 中（认知误区类） |

> 补充：还有一类**不带 `PASSWORD` 字样但同样是凭据**的：`REDIS_URL`（内嵌密码）、带鉴权信息的内部服务地址、私有化镜像仓库地址、内网 IP + 端口。这类最容易被扫描规则漏掉。

## 三、为什么必须在「今天」处理，而不是排进下个迭代

三个放大效应，决定了这件事不能拖：

### 3.1 Git 历史不会因为「后来删了」而消失

```bash
# 任何人拿到仓库，一条命令就能挖出历史里的所有 password
git log -p --all -S "password" -- '*.py' | less
```

**删掉当前文件里的值，等于什么都没做。** 值仍躺在历史提交里，且已经同步到了所有克隆、CI 缓存、镜像层、某人的本地备份。

### 3.2 镜像层会固化密钥

```dockerfile
COPY . /app      # config.py 连同明文密钥一起打进镜像
```

即使后来修改了 config，**已推送的镜像 tag 里仍然是旧值**。生产环境跑的就是那个镜像。所以「改代码 + 重新部署」只是止住了新的泄露，历史镜像是另一个泄露面。

### 3.3 日志会把密钥再抄一份

第 5 篇提到 `_request_log` 会把 `request.json` 全量打印；第 7 篇提到 `signature.py` 里有一行 `print(param_splicing_str)` ——**那一行打印的字符串里就带着 secret**。于是密钥不仅存在于代码仓库，还存在于日志平台、容器 stdout、以及所有导出的日志文件里。

**这是「泄露面扩散」最典型的路径：代码 → 日志 → 日志平台 → 更多人可见。**

## 四、分级处置：三类动作，不同优先级

### 4.1 第一优先级：立即轮换（P0，当天）

**只要一个凭据曾经以明文进入过 Git，就必须假设它已经泄露，唯一正确的处理是「作废 + 换新」。**

| 凭据 | 轮换动作 | 备注 |
| --- | --- | --- |
| 数据库口令 | 改密 → 更新配置 → 确认无旧连接 | 若是 root 账号，顺便降权到业务账号 |
| OSS AK/SK | 在云控制台禁用旧 AK、新建 AK | 检查该 AK 的历史访问日志，确认无异常下载 |
| 微信/CRM 等第三方 Secret | 平台后台重置 | 重置后旧 token 立即失效，需同步刷新缓存 |
| `SECRET_KEY` / `session_key` | 更换 | **更换会导致所有已登录会话失效**，安排低峰期 |
| `DEFAULT_PASSWORD`（初始密码常量） | 改为随机生成 + 首登强制修改 | 常量本身不该存在 |
| 前端 AES key / 固定 IV | 换 key 并同步改 IV 策略 | 见第 2 篇：这套方案本身要重构 |

**顺序很重要：先轮换，后清理代码。** 反过来做（先把代码里的值删了，再慢慢轮换）会在中间留出一段「配置缺失导致服务不可用」的窗口，很容易被人为了恢复服务而把旧值又贴回去。

### 4.2 第二优先级：配置外置（P1，本迭代）

**目标：仓库里不允许出现任何真实凭据，只允许出现「有默认值的安全占位」或「从环境读取」。**

最小可行做法（Python 项目通用）：

```python
# config.py —— 仓库里的版本
class Config:
    # 所有敏感项一律从环境变量取，且不设默认值
    SQLALCHEMY_DATABASE_URI = os.environ["DATABASE_URI"]
    SECRET_KEY = os.environ["APP_SECRET_KEY"]
    REDIS_URL = os.environ["REDIS_URL"]

    # 可选：启动时做一次「必须存在」的校验，缺失就 fail fast
    @classmethod
    def validate(cls):
        required = ["DATABASE_URI", "APP_SECRET_KEY", "REDIS_URL"]
        missing = [k for k in required if not os.environ.get(k)]
        if missing:
            raise RuntimeError("缺少必需的环境变量: {}".format(missing))
```

```python
# local_settings.py —— 本地开发用，必须写进 .gitignore
DATABASE_URI = "mysql+pymysql://app_user:<LOCAL_PASSWORD>@127.0.0.1:3306/dev_db"
```

```python
# local_settings.py.template —— 只有占位符，允许提交
DATABASE_URI = "mysql+pymysql://app_user:<LOCAL_PASSWORD>@127.0.0.1:3306/dev_db"
APP_SECRET_KEY = "<LOCAL_SECRET>"
```

**这份归档里其实已经存在 `local_settings.py.template`**（`webot3/`、`webot3_robot/` 都有）——说明团队是知道这套机制的。问题在于 `config.py` 里**同时仍然写着真实值**，模板成了摆设。

> 这是最值得记住的一条：**「有模板」不等于「已治理」。判断标准只有一个——仓库里搜不到真实值。** 模板机制必须配合「`config.py` 里禁止出现任何具体凭据」的硬约束才有意义。

生产环境的三种来源，按成熟度选择：

| 方式 | 适用 | 说明 |
| --- | --- | --- |
| 环境变量 / K8s Secret | 中小规模，已有 K8s | 最省事；注意 Secret 也是 etcd 里的明文，需要开加密 |
| 云厂商 KMS + SDK 拉取 | 已用云 | 启动时拉取，缓存在内存；靠 IAM 控制可读范围 |
| Vault / 配置中心 | 多环境多团队 | 动态凭据 + 审计日志，成本最高 |

### 4.3 第三优先级：架构改造（P2，需要排期）

有些问题不是「换个地方存」能解决的，必须改设计：

**① 前端持有对称密钥（第 2 篇详述）**

`sso_pwd` 把 AES key 写进 Go 常量，`jsjsjsj` 把同一个 key 写进 JS。**key 一旦进前端，就等于公开**。真实解法只有 TLS；若必须做，改成「服务端下发短时效公钥 + 前端用公钥加密」，对称密钥永不下发。

**② `signature.py` 的 `print` 与请求日志全量打印**

不是「脱敏一个字段」就够了，而是要在**日志入口处**做统一处理：

```python
SENSITIVE_KEYS = {"password", "passwd", "pwd", "token", "secret", "sign",
                  "mobile", "phone", "id_card", "idcard", "email"}
MASK = "***"

def mask(data):
    if isinstance(data, dict):
        return {k: (MASK if k.lower() in SENSITIVE_KEYS else mask(v)) for k, v in data.items()}
    if isinstance(data, list):
        return [mask(v) for v in data]
    if isinstance(data, str) and len(data) > 40:
        return data[:6] + "..." + data[-4:]      # 长串（如签名）截断
    return data
```

然后 `_request_log` / `error_500` 统一走 `mask(...)`。**在入口做一次，比在 50 个视图里各写一遍可靠。**

**③ 初始密码常量（`DEFAULT_PASSWORD`）**

常量口令意味着「所有新建账号的初始密码都一样」，一旦泄露可以批量撞库。正确做法：创建账号时随机生成、通过安全渠道下发、首次登录强制修改、7 天未登录自动失效。

**④ 单账号 root 权限**

配置里出现 root 凭据，往往是「为了省事」。至少要做读写分离账号 + 按库授权，把「泄露一个口令能拖走整个实例」降级为「泄露一个口令只能读某库」。

## 五、把它变成流程：四道闸门

治理不能靠自觉，必须靠流程卡住。

### 闸门 1：提交前（pre-commit）

```yaml
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
```

### 闸门 2：CI 里全历史扫描（关键）

```yaml
secret_scan:
  stage: test
  script:
    - gitleaks detect --source . --redact --verbose --exit-code 1
    - detect-secrets scan --baseline .secrets.baseline
  allow_failure: false       # 必须阻断合并
```

`gitleaks detect` 扫的是**整个提交历史**（不是工作区），这才是能发现历史泄露的关键；`--redact` 保证它不会把真值打到 CI 日志里造成二次泄露。

### 闸门 3：配置项白名单校验

在 CI 里加一条「`config.py` 中不允许出现长字符串字面量」的规则，例如：

```bash
# 找出 config.py 里形如 XXX_SECRET = "很长的字符串" 的行（只报行号与键名，不打印值）
grep -nE '^[A-Z0-9_]*(SECRET|PASSWORD|TOKEN|KEY|APPID)[A-Z0-9_]*\s*=\s*"[^"]{8,}"' \
     monarch/config.py && exit 1 || true
```

**注意这条命令只输出行号，不输出值**——扫描工具本身不能成为泄露渠道。

### 闸门 4：发布前镜像检查

```bash
# 检查镜像层里是否有可疑文件或明文配置
docker history --no-trunc <IMAGE> | grep -Ei 'secret|password'
trivy image --scanners secret <IMAGE>
```

## 六、一份可直接用的检查清单

发布前逐条打勾：

- [ ] 仓库当前版本里没有任何真实口令/密钥（`gitleaks detect` 无告警）
- [ ] Git 历史已评估：若历史中存在凭据，对应凭据**已全部轮换**并记录在案
- [ ] 所有敏感配置来自环境变量/密钥管理服务，缺失时**启动即失败**
- [ ] `local_settings.py` 在 `.gitignore` 中；仓库只有 `.template`
- [ ] 日志输出经过统一脱敏（password/token/sign/mobile/secret）
- [ ] 无任何 `print()` / `console.log()` 输出含密钥的中间串
- [ ] 前端 JS 里没有「被当作秘密」的对称密钥；有则登记为待重构项
- [ ] 业务常量里没有统一的初始密码；有则改为随机生成 + 强制改密
- [ ] 数据库账号按库授权，非 root；读写分离
- [ ] 第三方平台 Secret 有轮换责任人（不是「谁配的谁管」）
- [ ] 镜像扫描（trivy secret）通过
- [ ] CI 中 secret 扫描为 **blocking**，不是 warning

## 七、责任与节奏

| 事项 | 责任方 | 节奏 |
| --- | --- | --- |
| 凭据轮换 | 运维 / DBA / 各平台管理员 | 泄露后立即；常规每 6-12 个月主动轮换 |
| 配置外置改造 | 后端负责人 | 一个迭代内完成主干模块 |
| 前端密钥重构 | 前后端共同 | 随安全专项排期 |
| 扫描闸门 | DevOps | 一次配置，长期生效 |
| 泄露面复核 | 安全 | 每季度一次，含历史提交与镜像仓库 |

最后这一点尤其重要：**治理不是一次性项目，而是一个「永不回退」的闸门。** 没有 CI 阻断，任何一次「先跑起来再说」都会让所有努力归零。

---
