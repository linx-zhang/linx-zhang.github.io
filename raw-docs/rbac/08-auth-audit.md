---
order: 9
---

# 认证、审计与辅助表

## 一、账号 `_user`（39,819 条）

| 字段 | 类型 | 含义 |
|---|---|---|
| `id` | int | 主键 |
| `orgId` | int | 所属组织（无外键约束） |
| `username` | varchar(150) | 登录名（`UNIQUE ix_user_username`） |
| `password` | varchar(255) | 口令哈希 |
| `email` / `mobile` | varchar(255) | 邮箱 / 手机（各有普通索引，非唯一） |
| `displayName` | varchar(255) | 昵称 |
| `comments` | varchar(255) | 备注 |
| `avatar` | varchar(255) | 头像路径（默认 `/avatar.jpg`） |
| `isActive` | tinyint(1) | 是否激活（`_dict.active_status`） |
| `loginDate` / `updateDate` / `createDate` | datetime | 审计字段 |
| `defaultPage` | varchar(255) | 个人默认落地页 |

### 1.1 口令格式：Werkzeug 风格 pbkdf2

```text
pbkdf2:sha256:50000$iP43ZbNE$2f23ac3d5cab8954...      ← 早期账号，5 万次迭代
pbkdf2:sha256:150000$yC1YSFS1$81971b41f62fcef4...     ← 后期账号，15 万次迭代
```

格式 `pbkdf2:sha256:<迭代数>$<salt>$<hash>`，是 Flask-Werkzeug 的 `generate_password_hash` 默认输出（**推断框架为 Flask/Python，与 `_log` 里的 `/api/...` 风格、`_seq` 的 `%Y%m%d` 一致**）。

两种迭代数并存，说明**中途调过安全参数但没有全量重算**：老账号仍用 5 万次，新账号 15 万次。按 OWASP 当前建议（PBKDF2-SHA256 ≥ 60 万次，2023 版），两者都偏低；5 万次已是十几年前的标准。

### 1.2 一个账号的完整数据样例

```sql
(1,'1','admin',
 'pbkdf2:sha256:50000$iP43ZbNE$2f23ac3d...',
 'admin@example.com','13800000000','超级管理员','','/avatar.jpg',
 1,'2021-05-08 14:26:20','2021-05-08 14:26:19','2019-05-04 22:41:30','NULL')
```

### 1.3 账号池的真实构成

```text
org 14（云支付音箱）  36,593  → 92%
orgId 为空              2,907  → 7.3%（历史/迁移残留）
组织 1（平台方）            62
其余 100+ 组织合计         约 250
isActive=0                    8（几乎全部是启用状态）
```

所以这套权限体系**实际服务的是几百个后台账号**（88 个单角色 + 170 个多角色用户），其余 3.6 万是业务侧账号（走 `login_by_mobile`）。

---

## 二、开放 API 凭证 `_acl_api`（1 条）

| 字段 | 含义 |
|---|---|
| `apiKey` | 凭证 Key（uuid） |
| `apiSecret` | 凭证密钥（uuid） |
| `expireDate` | 失效时间 |
| `userId` | 关联用户（代表「以谁的身份」调用） |
| `status` | 状态 |
| `orgId` | 所属组织 |
| `createDate` / `updateDate` / `loginDate` | 审计 |

唯一一条记录：

```sql
(4, '90a392cb-fd54-4cc4-869d-28145d51b083',
    '70164848-ace1-4376-8bbe-d5c030b51c15',
    '2022-03-24 18:15:48', 40352, 1, 1, '2021-03-22 18:15:55', NULL, NULL)
```

**设计意图很清楚**：把「机器身份」映射成一个真实 `userId`，于是 **API 调用也走同一套 RBAC**（以该用户的角色去鉴权，数据范围也按该用户的 `orgId` 收敛）。这比单独的「应用白名单」更省事，但也意味着**凭证泄露 = 该用户全部权限泄露**（且 `apiSecret` 直接明文存库，没有哈希）。

---

## 三、审计日志 `_log`（91,097 条）

| 字段 | 类型 | 含义 |
|---|---|---|
| `id` | int | 主键 |
| `method` | varchar(255) | HTTP 方法（`POST` / `DELETE`） |
| `url` | varchar(255) | 日志概要：完整 URL |
| `data` | text | 请求体（**Python dict 的 repr，不是标准 JSON**） |
| `opUser` | varchar(255) | 操作账号 |
| `ip` | varchar(255) | 客户端 IP |
| `timeCost` | int | 耗时（ms） |
| `opAction` | varchar(255) | 操作类型 |
| `createTime` | datetime | 时间 |
| `orgId` | int | 所属组织 |

### 3.1 构成

```text
opAction：login 80,789（88.7%）· post 9,346 · delete 961 · delete+ 1
时间范围：2020-02-18 18:32:39 ~ 2021-12-09 11:29:40
覆盖组织：107 个 · 覆盖账号：28,880 个（含 C 端登录）
```

### 3.2 数据样本（能看出「通用引擎」的形态）

```json
{"model": "_user_role", "addData": [], "delData": [{"roleId": 54, "userId": 532}]}
{"model": "_role_acl_func", "addData": [], "delData": [{"roleId": 67, "aclFuncId": 1284}, ...]}
{"model": "_role_acl_data", "addData": [], "delData": [{"roleId": 67, "aclDataId": 88}, ...]}
{"id": 67, "orgId": None}                                     ← update/_role
{"parent.name": "无权限角色", "parentId": "67", "name": "配置管理员"}   ← create_role
```

### 3.3 URL 热点（反推出的 API 面）

```text
/api/user/login_by_mobile          70,113 + 3,795 + 586   ← C 端登录为主
/api/user/login                     2,903 + 1,985 + 683 + 323
/api/generic/relation_update        1,897 + 1,138 + 652   ← 多对多关系增量更新
/api/generic/update/_prop             599                   ← 改字段元数据
/api/generic/update/_model            237 + 96 + 91
/api/generic/info/save                453 + 406 + 99       ← 新增
/api/generic/menu                     202 + 104 + 97        ← 菜单 JSON 读写
/api/generic/menu_func_create         148                   ← 建菜单时同时建资源+功能点
/api/generic/delete/a_csm_box_materiel/<id>   185
/api/csi/base/firm                    118
```

**从日志能确认的三个设计事实**：

1. **CRUD 走统一入口**，模型名进 URL（`/api/generic/update/_prop`），说明后端有一层"按 `_model` 元数据动态执行的通用控制器"；
2. **角色配置就是改三张关系表**（`_user_role` / `_role_acl_func` / `_role_acl_data`），不做专用授权 API；
3. **批量操作很常见**（`delData` 一次几十条），说明授权页面是「勾选后整体提交」。

### 3.4 日志的三个缺陷

| 缺陷 | 证据 | 后果 |
|---|---|---|
| **删除操作不记内容** | `opAction=delete` 的 961 条，`data` 大多为空（删除动作靠 URL 里的 id 表达） | 事后无法还原「删了什么内容」 |
| `data` 不是合法 JSON | `{'model': '_user_role', ...}` 单引号、`None` 大写 | 无法直接入库查询/解析，只能当文本；审计分析得写自定义解析器 |
| 无权限判定结果 | 日志只记请求，不记"命中了哪条 `_acl_data`、被哪条 `_acl_func` 拒了「 | 无法回答」这次查询到底按哪个范围过滤的" —— 对排查越权极不利 |
| 无 traceId / 会话 ID | 只有 `opUser` + `ip` + 时间 | 一串关联操作（删边→删角色）只能靠时间戳猜 |

---

## 四、流水号 `_seq` / `_seq_value`（55 / 60 条）

已在 02 里讲过规则表，这里补使用面的观察：

```text
_seq 55 条，其中 54 条属 asset / lift / csi 等业务模块，system 只占 2 条（uuid / timestamp）
_seq_value 60 条，按 (seqId, orgId) 计数——只有 15 个组织用过（12 个有效 + 3 个孤儿 orgId）
```

说明**流水号机制主要服务于资产/电梯/工地三条重业务流程**（每张单据都要编号），而不是全平台通用。

`_seq` 里 54 条业务编号的风格相当统一：

```text
a_asset      A     %Y%m%d  5 位   → A2021111500001（资产）
a_csm_in     RK    %Y%m%d  4 位   → RK202111150001（入库）
a_csm_out    CK    %Y%m%d  4 位   → CK202111150001（出库）
a_take       LY    %Y%m%d  4 位   → LY202111150001（领用）
a_csm_box    XZ    %Y%m%d  4 位   → 箱子
d_lift       DT    %Y%m%d  4 位   → 电梯
csi_firm_code CSI  %Y%m%d  4 位   → 工地公司
```

前缀是**中文业务动词的拼音首字母**（入库 RK、出库 CK、领用 LY、调拨 DB、退库 TK、报废 BF、盘点 PD…），这套命名在单据类系统里很常见，可读性好，但**没有统一长度/分隔符**（有的 2 位、有的 3 位、有的 4 位字符），跨单据汇总时不好对齐。

---

## 五、模块表 `_module`（16 条）

```text
system 系统 · card 物联卡 · device 物联云设备 · sms 短信通道 · pay 支付 · push 消息推送
rule 监控预警 · wm 共享洗衣 · video 视频 · gps 定位 · vbox 播报音箱 · lift 智能电梯
asset 资产管理 · xf 消防员安全智能 · task 任务调度 · csi 智慧工地
```

`_module.name` 是**全局的软外键**：`_model.module`、`_dict.module`、`_resource.module`、`_seq.module` 四张表都用它做 FK（`ON DELETE RESTRICT`）。也就是说**模块是元数据的「分区键」** —— 一个模块 = 一组模型 + 一组字典 + 一组资源，删模块会因 RESTRICT 挡住。

有趣的是 `_resources` 里有 5 条 `module` 为 `NULL`（历史脏数据）。

---

## 六、小结

- 认证走 Werkzeug pbkdf2，参数中途升级过但未回填，5 万次迭代偏弱；
- 开放 API 用「凭证 → 用户 → 复用 RBAC」的方式，简单有效，但 secret 明文；
- 审计日志覆盖面很广（88.7% 是登录），但**记录粒度停在「请求」级，没有「权限判定结果」**，这对一套以 SQL 片段做行权限的系统来说是个明显缺口；
- 流水号、模块这些「轻表」设计规整，是整套元数据里最不需要改的部分。
