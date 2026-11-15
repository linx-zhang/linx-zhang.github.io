
# 设计评价、风险清单与改造建议

## 一、一句话评价

**这是一套「以组织为域、以元数据为骨、以 SQL 片段为血肉」的实用主义权限系统**：正统 RBAC 的部分做得规矩，真正解决业务问题的部分（行权限、组织闭包、双轨角色）做得聪明但粗糙 —— 优点和风险同源，都来自「把 SQL 当配置」。

---

## 二、六个确实做对的地方

| # | 设计 | 为什么值得学 |
|---|---|---|
| 1 | **资源 = 模型名 / 路由路径** | URL、模型、权限资源三者同名，不用维护权限码字典；前端拿到 path 就能查权限 |
| 2 | **功能点即数据行**（`_acl_func`，`UNIQUE(resourceId, funcKey)`） | 加一个业务动作（「退费」、「停机」）只需插一行，不发版 |
| 3 | **业务动词直接当权限点**（`wlkRecharge`、`approveEnabled`、`allocationEnabled`） | 权限粒度到「操作」，不是「页面」；比字符串硬编码的 permission_code 可读得多 |
| 4 | **拆出「数据过滤角色」** | 功能与数据视野解耦、可叠加复用；162 个用户在用，是真实跑起来的设计 |
| 5 | **组织闭包表 `_org_owner` 替代树遍历** | 一条 JOIN 管 366 个模型；支持多上级、跨层级、非树形代理授权 |
| 6 | **前后端共用功能键词表** | `_model.uiData.mask` 与 `_acl_func.funcKey` 同枚举，渲染与鉴权不会脱节 |

---

## 三、风险清单

### P0（安全 / 正确性，必须处理）

| 编号 | 问题 | 证据 | 影响 |
|---|---|---|---|
| P0-1 | **行权限是自由 SQL 文本** | `_acl_data.cond/join` 无参数化，`$user` 为字符串替换 | 可写入 `1=1` 全开；可子查询越权读其他组织数据；理论上可闭合引号做注入 |
| P0-2 | **权限判定无 deny、无冲突检测** | `_role_acl_*` 只有允许边，多角色取并集 | 做不了「某组织禁止导出/禁止看返利」；两个互斥策略叠加 = 范围变宽 |
| P0-3 | **删除操作审计缺失内容** | `_log` 中 `opAction=delete` 961 条，`data` 多为空 | 数据被删后无法还原现场，无法追责 |
| P0-4 | **口令强度不足** | `pbkdf2:sha256:50000`（老账号）/ `150000` | 按 OWASP 建议（≥60 万次）低一个量级；无全量重算 |
| P0-5 | **apiSecret 明文** | `_acl_api.apiSecret` 直接存 uuid 明文 | 表泄露 = 凭证泄露 = 该用户全部权限 |
| P0-6 | **组织/配置副本无清理** | `_menu` 107 份孤儿、`_sysconfig` 86 份孤儿、`_org` 4 个悬空 `parentId` | 组织删除后配置残留；可能被新建组织「撞 id」复用，出现串租户 |

### P1（可维护性 / 一致性）

| 编号 | 问题 | 证据 | 影响 |
|---|---|---|---|
| P1-1 | **300+ 条同构策略无抽象** | `JOIN _org ... JOIN _org_owner ... ownerOrgId=$user.orgId` 重复 300 多次；`a_firm.firm_id IN (...)` 重复 30 多次 | 口径一变要改几百条文本，无测试无版本 |
| P1-2 | **元数据与物理表无校验** | 无外键到 `information_schema`，`_prop.column` 靠人工 | 加列/改名后元数据静默失效（查询报错或列错位） |
| P1-3 | **菜单 JSON 按租户复制** | 同一节点在 310 份 JSON 里各一份 | 改文案要改几百处；无法回答「哪些租户有该菜单」 |
| P1-4 | **三重组织收敛无优先级** | `_role_owner`（角色级）、`_org_owner`（用户级）、`_acl_data`（SQL 级） | 结果取决于拼接形状，不可预期 |
| P1-5 | **同一模型靠「名字」区分双视角** | 员工端/管理员策略仅 `name` 不同 | 人不可读、机器不可判；改名即失去语义 |
| P1-6 | **`_model.sql` 与 `_acl_data.join` 共享别名空间** | `_acl_data` 引用 `wl_card.org_id`、`u.orgId`、`stockIn.org_id` 等外部别名 | 改一处 JOIN 顺序可让某条行权限静默失效或放宽 |
| P1-7 | **无角色继承** | `_role` 无 `parentId`；日志 `create_role` 传过 `parentId` | 改口径需逐角色改（资产线角色 4 个各 1,400+ 功能点） |
| P1-8 | **字符集混用 utf8mb3 / utf8mb4** | 建表脚本里两套并存（`_acl_api` 为 utf8mb3） | emoji/生僻字入库报错或被截断 |
| P1-9 | **后台账号与 C 端账号同表** | org 14 占 39,819 中的 36,593 | 权限体系被 3.6 万个「无角色」账号稀释；username 唯一约束跨两类账号冲突 |

### P2（清理 / 优化）

| 编号 | 问题 | 证据 |
|---|---|---|
| P2-1 | `_acl_func.funcValue` 全为 1，预留字段未落地 | 3,704 行 |
| P2-2 | `_model.alias`、`_model.spName`、`_model.spParams`、`_prop.validateEnabled` 全未使用 | 0 填充 |
| P2-3 | `funcKey` 拼写不统一（`' dateEnabled'` 前导空格、`AssignUserEnabled` 首字母大写） | 6 + 3 条 |
| P2-4 | `_acl_data.order` 语义不明且几乎不用 | 383 条 10000 / 14 条 1000 |
| P2-5 | `_acl_data` 存在空策略与测试残留 | #460 `ddd`（cond/join 全空） |
| P2-6 | 授权边冗余索引 | `_role_acl_func` 的 `UNIQUE(roleId,aclFuncId)` 与主键同构 |
| P2-7 | 预置空壳角色无授权 | 307–310 云智电系列，0 条授权 |
| P2-8 | `_log.data` 不是合法 JSON | Python repr 单引号 + `None` |
| P2-9 | 菜单 JSON 新旧字段并存（`title` 与 `meta.title`、`key`、`parent`） | 前端兼容残留 |
| P2-10 | `_org_owner` 的索引命名为 `roleId` | 复制粘贴遗留 |

---

## 四、改造建议（按投入产出排序）

### 阶段一：止血（1–2 周，不动架构）

1. **给 `cond/join` 做白名单校验**：
   - 只允许 `[a-zA-Z0-9_ .(),<>=!$*+\-/']` 与已知表名/别名的组合；
   - 禁止 `;`、`--`、`/*`、`information_schema`、`mysql.`、`UNION`、子查询里的写操作；
   - 上线时对所有存量 397 条做一次静态扫描（现在就能做，成本极低）。
2. **`$user` 变量改为强类型占位**：`$user.orgId` / `$user.id` 一律按整数插入，`$user.username` 按 SQL 字面量转义，不允许拼接。
3. **补删除审计**：delete 时把待删行快照写进 `_log.data`（`DELETE` 前 `SELECT` 一次）。
4. **老账号口令重算**：登录时若迭代数 < 15 万，重算为新参数（渐进升级）。
5. **`apiSecret` 改存哈希**（校验时哈希比对），并加最小长度/轮换策略。

### 阶段二：收敛（1–2 月）

6. **把 300+ 条组织归属策略抽成宏**：

```text
现状：每条 _acl_data 手写
      JOIN _org ON _org.id = X.org_id
      JOIN _org_owner ON _org_owner.orgId = _org.id AND _org_owner.ownerOrgId = $user.orgId

改造：_acl_data 加一列 scope_type ∈ {org, self, firm, all, custom}
      org  → 后端固定注入 EXISTS(...)（不用再存 SQL）
      self → 固定注入 <表>.user_id = $user.id
      firm → 固定注入 firm 归属子查询
      custom → 走白名单校验后的文本
结果：397 条可压到 20 条以内，口径调整只需改一处代码
```

7. **明确 `_acl_data.order` 语义**：建议定义为「优先级，数字小者优先，命中即停止合并」（避免「越叠越宽」），并在保存时做冲突检测（同模型两条策略同时命中即告警）。
8. **菜单从「按租户的 JSON 副本」改为「模板 + 差异」**：
   - 保留 `_menu(json, orgId)` 作为「该租户的差异层」；
   - 新增一份「平台默认菜单」，渲染时 `默认 + 差异` 合并；
   - 删除组织时级联清理 `_menu` / `_sysconfig`（补外键或清理任务）。
9. **给 `_prop` 加一致性巡检**：定时任务比对 `_prop.column` / `_model.table` 与 `information_schema.columns`，生成「元数据漂移报告」（先做成报告，不阻断）。

### 阶段三：结构升级（3–6 月，视业务需要）

10. **行权限从「SQL 片段」升级为「结构化谓词 + 编译器」**：
    - 最小模型：`_acl_scope(id, model, type, params_json)`，`type ∈ {org_self, org_manage, user_self, firm_owned, all, custom}`；
    - 后端把谓词编译成参数化 SQL，`custom` 只允许表达式模板（如 `owner_id = :user_id`）；
    - 保留 `_acl_data` 作为「历史兼容层」，新策略只走新表。
11. **`_user` 拆表**：`_user`（后台员工，有 `orgId` + 角色）+ `_member`（C 端/终端，按手机号登录），两者共享 `_acl_api` 式的「身份映射」。
12. **组织关系表补深度**：`_org_owner` 加 `depth`、`is_transitive`，或直接维护一张 `_org_closure(ancestor, descendant, depth)`。
13. **加角色继承与 deny 位**：`_role.parentId` + `_role_acl_func.effect ∈ {allow, deny}`，deny 优先。
14. **字符集统一 utf8mb4**：尤其 `_acl_api`、`_acl_data`（名称里可能有中文）。

---

## 五、如果要「抄作业」：最小可行表集

如果只是想复用它的思想，不需要 24 张表 —— **8 张就能跑起来**：

| 表 | 作用 |
|---|---|
`_org` | 租户/组织
`_org_owner` | 组织管理关系（闭包）
`_user` + `_user_role` | 账号与角色
`_role` | 角色（建议加 `parentId`）
`_resource` + `_acl_func` + `_role_acl_func` | 功能权限（资源-功能点-角色）
`_acl_scope`（新） | 结构化数据范围（替代 `_acl_data` 的自由 SQL）
`_role_prop` | 列权限（可选，按需）

元数据层（`_model/_prop/_model_table/_model_relation/_dict`）是另一套东西 —— **它解决的是「页面怎么生成」，不是「权限怎么算」**。两者可以共用一张 `_resource`（模型即资源），但不必耦合。

---

## 六、三个值得记住的判断

1. **它的强项是「省工程量」，不是「强安全」。** 397 条策略覆盖 366 个模型，靠的是一段可复制的 SQL；一旦要对外部开放「权限配置」能力，这套设计会立刻暴露。
2. **它的巧思在「双轨角色 + 组织闭包」。** 把「能做什么」和「能看谁」拆开，再加一层「角色在哪些组织生效」，用一个 JOIN 解决多租户数据隔离 —— 这三件事组合起来，比很多「策略引擎 + 表达式语言」的方案更实用。
3. **它的债集中在「配置即代码但没有代码的工程化」。** SQL 片段、菜单 JSON、字典项、字段元数据都是「运行期配置」，但没有版本、没有测试、没有一致性校验、没有清理机制 —— 这不是能力问题，是治理问题。
