
# 24 张表结构速查

> 来自 `rbac` 库的全量导出（MySQL 8.0.24）；行数为 dump 内实际数据条数，字段注释取自建表语句的 `COMMENT`。

---

## 一、主体与组织

### `_user` — 39,819 行

| 字段 | 类型 | 注释 |
|---|---|---|
| id | int | PK |
| orgId | int | |
| username | varchar(150) | `UNIQUE ix_user_username` |
| password | varchar(255) | pbkdf2 哈希 |
| email | varchar(255) | `KEY ix_user_email`（非唯一） |
| mobile | varchar(255) | `KEY ix_user_mobile` |
| displayName | varchar(255) | |
| comments | varchar(255) | |
| avatar | varchar(255) | |
| isActive | tinyint(1) | |
| loginDate / updateDate / createDate | datetime | |
| defaultPage | varchar(255) | |

### `_org` — 217 行

| 字段 | 类型 | 注释 |
|---|---|---|
| id | int | PK |
| parentId | int | 上级组织（NULL=根） |
| name | varchar(150) | `UNIQUE org_name` |
| code | varchar(150) | `UNIQUE org_code` |
| desc | varchar(255) | |
| domain | varchar(255) | 独立域名 |
| defaultPage | varchar(255) | 默认落地页 |

### `_org_owner` — 659 行

| 字段 | 类型 | 注释 |
|---|---|---|
| orgId | int | 被管理组织（`KEY roleId`，命名遗留） |
| ownerOrgId | int | 管理方组织 |

`PRIMARY KEY (ownerOrgId, orgId)`，无外键

### `_user_role` — 483 行

| 字段 | 类型 |
|---|---|
| userId | int → `_user.id`（FK，RESTRICT） |
| roleId | int → `_role.id`（FK，RESTRICT） |

`PRIMARY KEY (userId, roleId)`，`KEY (roleId)`

---

## 二、权限

### `_resource` — 1,192 行

| 字段 | 类型 | 注释 |
|---|---|---|
| id | int | PK |
| name | varchar(150) | 显示名 |
| resource | varchar(255) | 模型名 / 路由路径 |
| type | varchar(255) | model / menu / func |
| module | varchar(255) | → `_module.name`（FK，RESTRICT） |

`UNIQUE (resource, type, module)`

### `_acl_func` — 3,704 行

| 字段 | 类型 | 注释 |
|---|---|---|
| id | int | PK |
| resourceId | int | → `_resource.id`（FK，RESTRICT） |
| funcKey | varchar(255) | 功能键（`queryEnabled` 等） |
| funcValue | int | 全表为 1（预留未用） |

`UNIQUE (resourceId, funcKey)`

### `_role` — 58 行

| 字段 | 类型 |
|---|---|
| id | int | PK |
| name | varchar(150) | `UNIQUE role_name_org` |
| code | varchar(255) | 语义码 / 随机 6 位码 |

### `_role_acl_func` — 16,789 行

| 字段 | 类型 |
|---|---|
| roleId | int → `_role.id`（FK，RESTRICT） |
| aclFuncId | int → `_acl_func.id`（FK，RESTRICT） |

`PRIMARY KEY (roleId, aclFuncId)`；`UNIQUE aclFuncIdRoleId(roleId,aclFuncId)`（与主键重复）；`KEY(aclFuncId)`

### `_acl_data` — 397 行

| 字段 | 类型 | 注释 |
|---|---|---|
| id | int | PK |
| name | varchar(255) | 策略名（多为「××归属」） |
| model | varchar(255) | → `_model.model`（FK，RESTRICT） |
| cond | varchar(500) | WHERE 片段 |
| join | varchar(500) | JOIN 片段 |
| desc | varchar(255) | |
| orgId | int | 策略归属组织（182 空） |
| order | int | 383×10000 / 14×1000 |

`UNIQUE acl_data_name(name, model)`；`KEY(model)`

### `_role_acl_data` — 2,572 行

| 字段 | 类型 |
|---|---|
| roleId | int → `_role.id`（FK，RESTRICT） |
| aclDataId | int → `_acl_data.id`（FK，RESTRICT） |

`PRIMARY KEY (roleId, aclDataId)`；`KEY(aclDataId)`

### `_role_owner` — 1,713 行

| 字段 | 类型 | 注释 |
|---|---|---|
| roleId | int | 角色 |
| orgId | int | 可见组织（`KEY roleId`，命名遗留） |

`PRIMARY KEY (roleId, orgId)`，无外键

### `_role_prop` — 33 行

| 字段 | 类型 |
|---|---|
| roleId | int → `_role.id`（FK，RESTRICT） |
| propId | int → `_prop.id`（FK，RESTRICT） |
| mask | int | 全部为 0 |

`PRIMARY KEY (roleId, propId)`；`KEY(propId)`

### `_acl_api` — 1 行

| 字段 | 类型 | 注释 |
|---|---|---|
| id | int | PK |
| apiKey | varchar(2048) | |
| apiSecret | varchar(2048) | 明文 uuid |
| expireDate | datetime | 失效时间 |
| userId | int | 关联用户 |
| status | int | 状态 |
| orgId | int | 所属组织 |
| createDate / updateDate / loginDate | datetime | |

表字符集 `utf8mb3`（其余多为 utf8/utf8mb4）

---

## 三、元数据

### `_module` — 16 行

| 字段 | 类型 | 注释 |
|---|---|---|
| id | int | PK |
| name | varchar(150) | `UNIQUE ix_module_name` |
| displayName | varchar(150) | |
| createDate | datetime | |

### `_model` — 527 行

| 字段 | 类型 | 注释 |
|---|---|---|
| id | int | PK |
| model | varchar(255) | `UNIQUE _model_model` |
| table | varchar(255) | |
| displayName | varchar(255) | |
| alias | varchar(255) | 未使用 |
| columns | varchar(1023) | 139 条非空 |
| where | varchar(1023) | 默认附加条件，159 条 |
| groupBy | varchar(1023) | 50 条 |
| orderBy | varchar(1023) | 3 条 |
| sql | text | 报表模式，8 条 |
| spName | varchar(255) | 0 条 |
| spParams | varchar(1023) | 0 条 |
| distinctEnabled | tinyint(1) | 12 条 |
| module | varchar(255) | → `_module.name`（FK，RESTRICT） |
| uiData | text | 页面 UI JSON |

### `_model_table` — 472 行

| 字段 | 类型 | 注释 |
|---|---|---|
| id | int | PK |
| model | varchar(255) | → `_model.model`（FK，RESTRICT） |
| table | varchar(255) | |
| columns | varchar(1023) | |
| alias | varchar(255) | |
| join | varchar(1023) | |
| order | int | |

### `_model_relation` — 113 行

| 字段 | 类型 | 注释 |
|---|---|---|
| id | int | PK |
| model | varchar(255) | → `_model.model`（FK，RESTRICT） |
| linkModel | varchar(255) | 关联模型（FK，RESTRICT） |
| linkData | varchar(1023) | relModel/masterKey/slaveKey 或 `${id}` |
| linkType | varchar(255) | one2many / many2many / one2one |
| name | varchar(255) | |
| displayOrder | int | |

### `_prop` — 6,499 行（49 字段）

| 字段 | 类型 | 注释 |
|---|---|---|
| id | int | PK |
| model | varchar(255) | → `_model.model`（FK，RESTRICT） |
| name | varchar(255) | `UNIQUE _prop_model_name(model,name)` |
| table / column | varchar(255) | 物理表 / 列（可为 `a.b`） |
| dataType | varchar(255) | string/integer(11)/datetime/text/file/bool… |
| displayName | varchar(255) | |
| displayOrder / displayOrderView / displayOrderCreate / displayOrderUpdate | int | 四套顺序 |
| displayRow / displaySpan | int | 布局 |
| transTable / transModel / transObjectName / transColumns | varchar | 关联翻译 |
| transDict | varchar(255) | 字典域 |
| transJs | varchar(1023) | 前端格式化表达式 |
| searchEnabled / matchEnabled / filterEnabled / listEnabled / exportEnabled / batchOpEnabled | tinyint(1) | 查询与展示开关 |
| viewEnabled / createEnabled / updateEnabled | tinyint(1) | 视图/写开关 |
| updateReadonlyEnabled / createReadonlyEnabled | tinyint(1) | 显示只读 |
| orderDir / orderAsDefault / orderEnabled / uiOrderEnabled | tinyint(1) | 排序 |
| selectEnabled | tinyint(1) | 可勾选 |
| createUserEnabled / createTimeEnabled / createOrgEnabled | tinyint(1) | 审计字段自动填充 |
| updateUserEnabled / updateTimeEnabled | tinyint(1) | |
| validateEnabled | tinyint(1) | 全为 0（死字段） |
| asEnabled | tinyint(1) | SQL column AS |
| validateFailureMsg | varchar(255) | |
| validateJs | varchar(1023) | antd 规则 |
| hint | text | 控件提示（含配置说明） |
| autoGen | varchar(255) | uuid / timestamp / `_seq.name` |
| defaultValue | varchar(1023) | |
| style | varchar(255) | JSON |
| placeHolder | varchar(255) | |

### `_dict` — 855 行

| 字段 | 类型 | 注释 |
|---|---|---|
| id | int | PK |
| domain | varchar(255) | `UNIQUE dict_domain_key_unique(domain,key)` |
| key / value | varchar(255) | 存库值 / 显示值 |
| desc | varchar(255) | |
| order | int | |
| module | varchar(255) | → `_module.name`（FK，RESTRICT） |

### `_seq` — 55 行

| 字段 | 类型 | 注释 |
|---|---|---|
| id | int | PK |
| name | varchar(255) | 编号名（= `_prop.autoGen` 取值） |
| prefix | varchar(255) | 前缀 |
| timeFormat | varchar(255) | `%Y%m%d` |
| digits | int | 位数 |
| module | varchar(255) | → `_module.name`（FK，RESTRICT） |

### `_seq_value` — 60 行

| 字段 | 类型 | 注释 |
|---|---|---|
| id | int | PK |
| seqId | int | → `_seq.id`（FK，RESTRICT，`KEY seq_def`） |
| value | int | 当前计数 |
| orgId | int | 组织 |

---

## 四、白标与日志

### `_menu` — 219 行

| 字段 | 类型 | 注释 |
|---|---|---|
| id | int | PK |
| json | text | 菜单树 JSON |
| updateDate | datetime | |
| orgId | int | 所属组织 |

### `_sysconfig` — 327 行

| 字段 | 类型 | 注释 |
|---|---|---|
| id | int | PK |
| json | text | 白标配置（logo/desc/copyright/beian/logoChart/shortLogo） |
| updateDate | datetime | |
| orgId | int | 所属组织 |

### `_log` — 91,097 行

| 字段 | 类型 | 注释 |
|---|---|---|
| id | int | PK |
| method | varchar(255) | 日志概要：HTTP 方法 |
| url | varchar(255) | 日志概要：URL |
| data | text | 日志数据（Python repr） |
| opUser | varchar(255) | 操作账号 |
| ip | varchar(255) | IP |
| timeCost | int | 耗时 |
| opAction | varchar(255) | 操作类型 |
| createTime | datetime | 创建时间 |
| orgId | int | 所属组织 |

---

## 五、外键全景（19 条 FK，全部 `ON DELETE RESTRICT`）

```text
_acl_data.model          → _model.model
_acl_func.resourceId     → _resource.id
_dict.module             → _module.name
_model.module            → _module.name
_model_relation.model    → _model.model
_model_relation.linkModel→ _model.model
_model_table.model       → _model.model
_prop.model              → _model.model
_resource.module         → _module.name
_role_acl_data.roleId    → _role.id
_role_acl_data.aclDataId → _acl_data.id
_role_acl_func.aclFuncId → _acl_func.id
_role_acl_func.roleId    → _role.id
_role_prop.propId        → _prop.id
_role_prop.roleId        → _role.id
_seq.module              → _module.name
_seq_value.seqId         → _seq.id
_user_role.userId        → _user.id
_user_role.roleId        → _role.id
```

**没有外键的关联**（靠应用层维护，是「孤儿数据」的来源）：

```text
_user.orgId              → _org.id        （无 FK）
_org_owner.orgId/ownerOrgId → _org.id     （无 FK）
_role_owner.orgId        → _org.id        （无 FK）
_menu.orgId / _sysconfig.orgId → _org.id  （无 FK）
_acl_api.userId / orgId  → _user / _org   （无 FK）
_log.orgId               → _org.id        （无 FK）
_acl_data.orgId          → _org.id        （无 FK）
```

生成 107 份孤儿菜单、86 份孤儿配置、4 个悬空 `parentId` 的直接原因就在这里。
