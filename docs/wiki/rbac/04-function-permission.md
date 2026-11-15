
# 功能权限：资源、功能点、菜单

功能权限是这套系统里「最像标准 RBAC」的一层：**资源（resource）→ 功能点（acl_func）→ 角色（role）→ 用户（user）**。四张表全用主键关联，没有任何权限码字符串。

---

## 一、权限资源 `_resource`（1,192 条）

| 字段 | 含义 |
|---|---|
| `id` | 主键，被 `_acl_func.resourceId` 引用 |
| `name` | 显示名（「账户」、「物联设备」、「功能权限」…） |
| `resource` | 资源标识：模型取模型名，菜单取**路由路径** |
| `type` | `model` / `menu` / `func` |
| `module` | 所属模块（FK → `_module.name`） |

唯一约束 `UNIQUE(resource, type, module)` —— **同名资源在不同模块下可以并存**（例如 `system` 模块的 `/auth/user` 与业务模块的 `/auth/user`）。

### 1.1 三类资源

| type | 数量 | `resource` 的取值 | 用途 |
|---|---:|---|---|
| `model` | 541 | 模型名，如 `iot_device`、`wl_card`、`_user` | 表级权限：查询/新增/改/删/导入/导出 + 业务动作 |
| `menu` | 649 | 前端路由路径，如 `/auth/user`、`/card/wl_set_meal` | 菜单可见性 |
| `func` | 2 | `configModel`(配置模型)、`configLog`(配置系统日志) | 与模型无关的独立功能开关 |

字典 `acl_func_type` 正好这三个值：`model=模型（表权限）`、`menu=菜单`、`func=自定义`。

按模块分布（说明业务重心）：

```text
asset 608 · lift 154 · card 157 · system 73 · xf 45 · csi 38
device 44 · pay 16 · vbox 19 · rule 10 · video 6 · push 6 · wm 6 · sms 2 · task 3
```

---

## 二、功能点 `_acl_func`（3,704 条）

| 字段 | 含义 |
|---|---|
| `id` | 主键，被 `_role_acl_func.aclFuncId` 引用 |
| `resourceId` | 所属资源（FK → `_resource.id`，`ON DELETE RESTRICT`） |
| `funcKey` | 功能键（字符串枚举，见下表） |
| `funcValue` | **全表 3,704 行都是 1** —— 预留的「值」（配额/开关级别？），实际未用 |

唯一约束 `UNIQUE(resourceId, funcKey)`：**一个资源同一个功能键只有一条**，于是这条记录本身就是「可授权的开关」。

### 2.1 功能键词表（按出现次数）

**标准 CRUD 类**（所有模型资源共有）

| funcKey | 条数 | 含义 |
|---|---:|---|
| `viewEnabled` | 1,169 | 查看（详情页）—— 649 个菜单各 1 条 + 模型详情 |
| `queryEnabled` | 533 | 列表查询 |
| `createEnabled` | 525 | 新增 |
| `deleteEnabled` | 523 | 删除 |
| `updateEnabled` | 515 | 修改 |
| `exportEnabled` | 177 | 导出 |
| `importEnabled` | 119 | 导入 |

**扩展操作类**（按模型单独定义）

| funcKey | 条数 | 典型场景 |
|---|---:|---|
| `dateEnabled`(含一个脏值 `' dateEnabled'`) | 22 + 6 | 日期选择/时间区间查询 |
| `approveEnabled` | 16 | 审批 |
| `syncEnabled` | 8 | 数据同步（模型层）/ ERP 同步 |
| `videoEnabled` | 7 | 视频相关 |
| `batchSyncEnabled` / `singleSyncEnabled` | 6 / 3 | 批量 / 单条同步 |
| `batchEnabled` / `importModel` | 2 | 批量操作 / 按模板导入 |
| `resetPwdEnabled` | 2 | 重置密码（`_user`） |
| `userRoleEnabled` | 2 | 分配角色（`_user`） |
| `inlineEditEnabled` | 3 | 行内编辑 |
| `hideLinkEnabled` | 5 | 隐藏关联 |
| `downloadEnabled` | 3 | 下载 |

**业务动作类**（把「业务动词」直接当权限点，最有代表性的一批）

```text
物联卡:  renewEnabled(续费) gprsOnEnabled/gprsOffEnabled(开/停GPRS)
         wlkOnEnabled/wlkOffEnabled   testToSilenceEnabled/silenceToNormalEnabled(停机/复机)
         openAPN/closeAPN  distribution(分配)  zeroRecharge(零元充值)
         wlkRecharge(充值)  wlkRefund(退费)
组织:    configMenuEnabled / configOrgEnabled / configPageEnabled（配置菜单/组织/页面）
模型:    modelPreviewEnabled  modelAclDataEnabled  modelAclFuncEnabled
资源:    resourceAclFuncEnabled  resourceAclDataEnabled
角色:    roleUserEnabled  aclFuncRoleEnabled  aclDataRoleEnabled  aclPropRoleEnabled
资产:    allocationEnabled(调拨)  InventoryEnabled(盘点)  InvenActualEnabled
         AllocateEnabled  updateGoods  AssignUserEnabled
工地:    approveEnabled(16) + newFormEnabled(3)
```

一个模型带多少功能点，很能说明复杂度：

```text
wl_card（物联卡）  18 个：query/view/create/update/delete/import/export
                       + renew/gprsOn/gprsOff/openAPN/closeAPN/distribution
                       + testToSilence/silenceToNormal/wlkOn/wlkOff/zeroRecharge
_org（组织）       10 个：标准 CRUD + export/import + configMenu/configOrg/configPage
_user（账户）       9 个：标准 CRUD + export/import + resetPwd + userRole
_model（模型）      10 个：标准 CRUD + import + modelPreview + sync
wl_renew_order     9 个：标准 CRUD + export + wlkRecharge + wlkRefund
```

> 设计亮点：**权限粒度下沉到「操作」而不是「页面」**。一个物联卡管理员能「看列表、开盘、续费」，但不能「退费」 —— 这种精细度在传统 RBAC 里通常靠 `permission_code` 字符串硬编码，这里靠一行 `_acl_func`。

### 2.2 菜单资源的权限点极其统一

643 个菜单资源各只有 1 个功能点 `viewEnabled`（649 个菜单资源里 643 个有功能点定义，6 个漏配）：

```text
_resource(type='menu', resource='/auth/user')
→ _acl_func(resourceId=59, funcKey='viewEnabled', funcValue=1)
→ _role_acl_func(roleId, aclFuncId)
```

**菜单可见性 = 该路径的 `viewEnabled` 被授予**。菜单不走另一套机制，也不用前端写死路由白名单 —— 这是它做得比较彻底的地方。

---

## 三、授权边 `_role_acl_func`（16,789 条）

```sql
PRIMARY KEY (roleId, aclFuncId)
UNIQUE KEY aclFuncIdRoleId (roleId, aclFuncId)   -- 与主键重复，冗余索引
KEY _role_acl_func_funcId (aclFuncId)
FK roleId → _role.id      ON DELETE RESTRICT
FK aclFuncId → _acl_func.id ON DELETE RESTRICT
```

`ON DELETE RESTRICT` 很关键：**删角色前必须先清授权边**（因为授权边不能被级联删除）。日志里能看到对应的删除顺序：

```text
relation_update model=_role_acl_func delData=[{roleId:67, aclFuncId:1284}...]   ← 先删边
POST /api/user/delete_role/54                                                    ← 再删角色
```

### 3.1 角色画像（58 个角色，全表）

| roleId | 角色 | code | 功能点 | 菜单 | 模型 | 数据策略 | 可见组织 | 字段屏蔽 |
|---:|---|---|---:|---:|---:|---:|---:|---:|
| 1 | 超级管理员 | `super_admin` | 874 | 155 | 718 | 0 | 65 | 0 |
| 2 | 账户管理员 | `xc+4Ld` | 48 | 5 | 43 | 5 | 0 | 0 |
| 8 | 物联卡管理员 | `Ju73Gd` | 230 | 39 | 191 | 2 | 85 | 0 |
| 18 | 物联卡代理商 | `1wYNx7` | 55 | 7 | 48 | 13 | 1 | **10** |
| 31 | 数据过滤（全部） | `acb2BP` | 3 | 0 | 3 | 54 | 0 | 0 |
| 38 | 支付音箱管理员 | `+TsdO7` | 114 | 18 | 96 | 22 | 1 | 0 |
| 40 | 设备管理员 | `device_admin` | 37 | 5 | 32 | 5 | 0 | 0 |
| 42 | 物联卡数据过滤 | `eqT4wZ` | 12 | 0 | 12 | 25 | 0 | 0 |
| 43 | 设备数据过滤 | `Gqs4f9` | 3 | 0 | 3 | 11 | 0 | 0 |
| 44 | 账户数据过滤 | `p1QdHd` | 3 | 0 | 3 | 17 | 0 | 0 |
| 45 | 支付管理员 | `i+8Q1n` | 30 | 7 | 23 | 5 | 0 | 1 |
| 46 | 短信管理员 | `0pPghG` | 5 | 2 | 3 | 5 | 0 | 0 |
| 52 | 财务管理 | `37wSL5` | 134 | 7 | 127 | 38 | 1 | 0 |
| 53 | 支付数据过滤 | `yfAZWO` | 314 | 52 | 262 | 5 | 0 | 0 |
| 55 | 区域管理员 | `+6APar` | 104 | 19 | 85 | 47 | 1 | 0 |
| 60 | 物联卡短信管理员 | `YO3RYj` | 36 | 9 | 27 | 12 | 85 | 5 |
| 61 | 微信H5支付申请 | `PnH7S6` | 458 | 72 | 386 | 5 | 85 | 0 |
| 62 | 物联卡组织管理员 | `M3vmK5` | 220 | 31 | 189 | 60 | 85 | 3 |
| 63 | 代理商 | `dEwUw7` | 244 | 41 | 203 | 62 | 1 | 4 |
| 64 | 支付音箱质检员 | `1zfgBX` | 6 | 1 | 5 | 5 | 1 | 0 |
| 65 | 解绑管理员 | `3RqIkB` | 4 | 0 | 4 | 5 | 85 | 0 |
| 67 | 无权限角色 | `none` | **0** | 0 | 0 | 0 | 0 | 0 |
| 68 | GPS管理员 | `uASJRp` | 20 | 7 | 13 | 5 | 85 | 0 |
| 114 | 代理商 | `qyzd` | 98 | 7 | 91 | 74 | 9 | 0 |
| 115 | 运维人员 | `qyyw` | 64 | 3 | 61 | 74 | 9 | 0 |
| 120 | 配置管理员 | `system_config` | 190 | 21 | 168 | 0 | **86** | 0 |
| 123 | 管理员 | `mt_admin` | 99 | 9 | 90 | 76 | 9 | 0 |
| 171 | 账户权限（全部） | `user_all` | 56 | 6 | 50 | 17 | 85 | 0 |
| 172 | 账户权限（只读） | `user_readonly` | 45 | 6 | 39 | 17 | 85 | 0 |
| 173 | 角色配置 | `role_config` | 53 | 0 | 53 | 1 | 85 | 0 |
| 174 | E电梯管理员 | `lift_admin` | 199 | 49 | 150 | 37 | 14 | 0 |
| 175 | E电梯维保员 | `lift_maintain` | 10 | 1 | 9 | 26 | 14 | 0 |
| 176 | E电梯救援员 | `lift_rescue` | 6 | 1 | 5 | 26 | 14 | 0 |
| 177 | 电信电梯管理员 | `lift_telecom` | 244 | 69 | 175 | 35 | 79 | 0 |
| 178 | 电信电梯维保员 | `lift_telecom_maintain` | 3 | 1 | 2 | 26 | 79 | 0 |
| 179 | 电信电梯救援员 | `lift_telecom_rescue` | 3 | 1 | 2 | 26 | 79 | 0 |
| 180 | 物联卡代理商短信管理 | `wl_agent_cmpp` | 39 | 9 | 30 | 11 | 76 | 10 |
| 285 | 资产仓储管理员 | `storage_admin` | 554 | 44 | 510 | 73 | 2 | 0 |
| 286 | 资产仓储客户 | `a_sh_customer` | 663 | 53 | 609 | 124 | 2 | 0 |
| 288 | 消防安全用户 | `xf_user` | 119 | 26 | 93 | 0 | 1 | 0 |
| 289 | 资产管理员 | `hf2lEA` | **1,562** | 145 | 1,417 | 165 | 7 | 0 |
| 290 | 资产作业员 | `operator` | 1,289 | 77 | 1,212 | 125 | 6 | 0 |
| 291 | 安全员 | `anquanyuan` | 115 | 26 | 89 | 6 | 1 | 0 |
| 292 | 物联卡管理员(new) | `wlkadmin_new` | 271 | 45 | 226 | 1 | 65 | 0 |
| 293 | 捷通科技-体验版 | `jtkjrfid-test` | 556 | 44 | 512 | 71 | 1 | 0 |
| 294 | 速转通rfid | `supertomrfid` | 750 | 44 | 706 | **386** | 1 | 0 |
| 295 | 资产员工 | `okWKD7` | 1,532 | 132 | 1,400 | 164 | 65 | 0 |
| 296 | 物联卡查询权限 | `wlk_query` | 246 | 22 | 224 | 1 | 65 | 0 |
| 299 | super资产管理员 | `admin_asset` | **1,604** | 145 | 1,459 | 191 | 1 | 0 |
| 301 | super资产作业员 | `worker_asset` | 1,573 | 133 | 1,440 | 190 | 1 | 0 |
| 303 | 捷通资产管理员 | `jt_asset_admin` | 1,603 | 145 | 1,458 | 191 | 1 | 0 |
| 304 | 智慧工地管理员 | `csi_admin` | 125 | 22 | 103 | 10 | 63 | 0 |
| 305 | 智慧工地助理 | `csi_aid` | 88 | 16 | 72 | 10 | 63 | 0 |
| 306 | 智慧工地运维 | `csi_ops` | 76 | 12 | 64 | 10 | 63 | 0 |
| 307 | 云智电管理员 | `c_admin` | 0 | 0 | 0 | 0 | 0 | 0 |
| 308 | 云智电用户 | `c_user` | 0 | 0 | 0 | 0 | 0 | 0 |
| 309 | 云智电运营商 | `c_operate` | 0 | 0 | 0 | 0 | 0 | 0 |
| 310 | 小区管理员 | `c_area_admin` | 0 | 0 | 0 | 0 | 0 | 0 |

几个可读的结论：

- **`code` 有两种风格**：人工命名的语义码（`super_admin`、`operator`、`csi_admin`）和后台随机生成的 6 位码（`Ju73Gd`、`hf2lEA`、`1wYNx7`）。后者是通过 UI 建角色时自动生成的，说明**早期没有为 role code 设计命名规范**；
- 角色 307–310（云智电/小区管理员）已建但**一条授权都没有**，是典型的「预置空壳角色」（规划了模块，尚未配置）；
- 角色 67「无权限角色」0 条授权，作为「默认角色/占位角色」使用（日志里 `create_role` 时 `parentId: '67'` 正是挂在它下面）；
- 资产线角色规模最大（1,400–1,460 个模型功能点），因为 `asset` 模块有 286 个模型，每个模型 5–10 个功能点。

### 3.2 热门资源：权限授给谁最多

```text
csi_user     被 199 个角色授权   ← 智慧工地账号
_user        被 197 个角色授权
csi_firm     被 172 个
_org         被 151 个
_role        被 145 个
wl_card      被 119 个
_resource    被 103 个
_module       被 89 个
```

「账户/组织/角色」这类系统资源被授权给几乎每个角色 —— 说明每个业务角色都要配一套「能管自己组织内的人和角色」的能力，而不是集中由超级管理员统一管。这与多租户/多代理的商业模式一致。

---

## 四、与菜单的关系：一套权限两种消费

```text
① 渲染菜单树
   _menu(orgId → 菜单 JSON，含 path/title/icon/children)
   for each node.path:
       if 用户拥有 _resource(type='menu', resource=path) 的 viewEnabled
       → 保留该节点（含子节点）
② 渲染操作按钮
   _model.uiData.mask + 用户拥有的同资源 funcKey
       queryEnabled → 出现"查询"按钮
       createEnabled → 出现"新增"
       wlkRecharge   → 出现"充值"
③ 服务端二次校验
   拦截器按 URL 中的 model/path 取 _resource → _acl_func → 是否有该 funcKey
```

①②③ 共用同一份 `_acl_func` 词表，**前端渲染和后端鉴权没有第二套枚举**，这是「元数据驱动 + 权限」最实在的收益：加一个业务动作，插一行 `_acl_func` + 前端认这个 key，就通了。

---

## 五、这一层的具体缺陷

| 现象 | 证据 | 影响 |
|---|---|---|
| `funcValue` 冗余 | 3,704 行全为 1，从无其他值 | 预留字段未落地，白占一列；若原意是「权限值/配额」，说明设计设想（按值授权）未实现 |
| `funcKey` 拼写不统一 | 存在 `' dateEnabled'`（前导空格，6 条）、`'AssignUserEnabled'`（首字母大写）、`'InventoryEnabled'` 等大小写混杂 | `UNIQUE(resourceId, funcKey)` 挡不住语义重复；前端匹配靠字符串，容易漏 |
| 菜单漏配功能点 | 649 个菜单资源，仅 643 个有 `viewEnabled` | 6 个菜单永远不可见（除非另有兜底逻辑） |
| 无 deny/优先级 | 只有 `(roleId, aclFuncId)` 允许边 | 做不了「某角色禁止导出」 |
| 无角色继承 | `_role` 无 `parentId`；但日志里 `create_role` 传了 `parentId` | 配置重复，改口径要逐角色改 |
| 授权边与主键重复索引 | `UNIQUE aclFuncIdRoleId(roleId, aclFuncId)` 与 `PRIMARY KEY(roleId, aclFuncId)` 完全同构 | 冗余索引，写放大 |

---

## 六、小结

- 资源类型三分（model / menu / func）对得上真实系统里的三种「可授权对象」，比纯菜单级权限细，比字段级权限稳；
- 把业务动词（续费、开卡、停机、审批、调拨）直接做成权限点，是这套设计最有价值的地方之一；
- 但权限网是「加法并集」、无继承、无 deny，且 `funcKey` 靠字符串约定 —— 随着角色数量增长（58 个角色 / 1.6 万条边），配置熵会越来越高，实际收益主要来自「很多角色共享同一批策略」（见 03 双轨角色）。
