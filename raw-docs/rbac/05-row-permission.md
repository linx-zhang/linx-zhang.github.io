---
order: 6
---

# 数据行权限：用 SQL 片段表达的「归属」

这是整套设计里最有特色、也最危险的一层。**行权限不是策略对象，而是一段 SQL 片段**：`cond`（WHERE 片段）+ `join`（JOIN 片段）+ `$user` 模板变量。

---

## 一、表结构 `_acl_data`（397 条）

| 字段 | 类型 | 含义 |
|---|---|---|
| `id` | int | 主键 |
| `name` | varchar(255) | 策略名，几乎都叫「××归属」 |
| `model` | varchar(255) | 作用于哪个模型（FK → `_model.model`） |
| `cond` | varchar(500) | WHERE 片段 |
| `join` | varchar(500) | JOIN 片段 |
| `desc` | varchar(255) | 描述 |
| `orgId` | int | 策略归属组织（182 条为空 = 公共策略；143 条属组织 1；65 条属组织 83） |
| `order` | int | 排序/优先级（383 条 `10000`，14 条 `1000`） |

约束：

```sql
UNIQUE KEY acl_data_name (name, model)
KEY aclDataModelRequired (model)
FK model → _model.model ON DELETE RESTRICT
```

注意 `UNIQUE(name, model)`：**策略按「名字 + 模型」唯一**，所以同一模型可以挂多条不同名的策略（如 `wl_card` 有 2 条：`物联卡归属`、`物联卡注销卡归属`），但同名策略不能重复。

---

## 二、只用了两种表达：`join` 为主，`cond` 为辅

| 组合 | 条数 | 说明 |
|---|---:|---|
| 只有 `join`，`cond` 空 | 329 | 主流：把「归属」表 JOIN 进来，用 JOIN 条件过滤 |
| 同时有 `cond` + `join` | 62 | 归属 + 额外业务条件（本人、公司、仓库等） |
| 只有 `cond`，无 `join` | 5 | 用 `EXISTS` 子查询完成，无需 JOIN |
| 都没有 | 1 | 空策略（#460 `ddd`，测试残留） |

**为什么偏向 `join` 而不是 `cond`？** 因为 `join` 可以把 `_org_owner`（管理关系闭包）挂进来，用一条通用 JOIN 条件解决所有「归属」判断：

```sql
JOIN _org       ON _org.id = <业务表>.org_id
JOIN _org_owner ON _org_owner.orgId = _org.id
               AND _org_owner.ownerOrgId = $user.orgId
```

这一句能覆盖 300+ 个模型 —— 前提是业务表都有 `org_id`（或 `orgId`）列。dump 里确实大部分表都带 `org_id`，**这就是它敢用「一段 SQL 通吃所有表」的物理基础**。

---

## 三、四种「归属」套路

### 套路 A：组织闭包（占绝大多数，329+ 条）

```sql
-- #5 账号归属   model=_user
JOIN _org       ON _org.id = _user.orgId
JOIN _org_owner ON _org_owner.orgId = _org.id
               AND _org_owner.ownerOrgId = $user.orgId
```

`_org_owner(orgId, ownerOrgId)` 是一张「谁能管谁」的关系表。上句语义：**当前用户所在组织（`$user.orgId`）能管的组织里，该账号所属组织必须在内**。

同构的还有 `_role`(#11)、`iot_product`(#22)、`iot_device`(#23)、`wl_place_order`(#46)、`a_asset`(#194)、`d_lift`(#159)… 几乎每个业务表都有一条。

### 套路 B：`EXISTS` 子查询（无 JOIN 版）

```sql
-- #15 物联卡归属   model=wl_card
EXISTS (select orgId from _org_owner
        where wl_card.org_id = _org_owner.orgId
          and _org_owner.ownerOrgId = $user.orgId)
```

语义与 A 等价，但**不往 FROM 里加表**。用在「模型本身被别的表 JOIN 引用」或「主查询已经 GROUP BY」的场合，避免 JOIN 干扰聚合（如 #50 `wl_stock_card`、#111 `wl_cancel_card`）。

### 套路 C：业务外键 + 子查询（跨「公司/仓库」维度）

资产与仓储模块不按组织，而按「公司/员工」维度做归属：

```sql
-- #300 仓库管理归属   model=a_sh_store
cond: firm.id IN (
        SELECT DISTINCT a_firm_owner.firm_id
        FROM a_firm_owner
        LEFT JOIN a_staff ON a_firm_owner.owner_firm_id = a_staff.firm_id
        WHERE a_staff.user_id = $user.id
      )
join: JOIN _org_owner ON _org_owner.orgId = a_sh_store.org_id
                    AND _org_owner.ownerOrgId = $user.orgId
```

即：**「我所在的公司能管哪些公司」→ 这些公司名下的仓库才可见**，再叠加组织归属。同一段 `a_firm.firm_id IN (...)` 在 #300–#346 里重复出现了 30 多次，是明显的可抽公共谓词的地方。

### 套路 D：本人/作业员视角（按人，不按组织）

```sql
-- #263 员工日用品领用归属(员工端)
cond: staff.user_id = $user.id
-- #284 员工领用归属(员工端)
cond: asset_staff.user_id=$user.id
-- #352 上架单归属(作业员)
cond: _user.username = $user.username
join: JOIN _org_owner ON _org_owner.orgId = org.id AND _org_owner.ownerOrgId = $user.orgId
      LEFT JOIN _user ON staff.user_id = _user.id
```

同一模型（`a_emp_take`、`a_emp_borrow`、`a_sh_in`…）配**两条策略**：一条「管理员」（组织级），一条「员工端」（本人级）。策略靠 `name` 区分（「员工领用归属(员工端)」 vs 「(管理员)」），由不同角色各自持有 —— 于是**同一页面，管理员看全组织、作业员只看自己经手的单**。

这三条对应了角色表里的 `资产管理员` / `资产作业员` / `资产员工` 三个角色的差异：**功能权限相似，数据策略不同**。

---

## 四、`$user` 模板变量

只有三个变量，全部取自当前登录用户：

| 变量 | 取值 | 出现场景 |
|---|---|---|
| `$user.orgId` | 用户所属组织 ID | 几乎所有 A/B 类策略 |
| `$user.id` | 用户主键 | 员工端本人策略、`wl_card.owner_id` |
| `$user.username` | 登录名 | 作业员策略（日志里 `_user.username = $user.username`） |

**注意**：`$user` 变量同时出现在 `_acl_data.cond/join` 和 `_model.sql`（如 `a_csm_summary`）里 —— 说明替换是**全局的字符串替换**，不区分来源。这也是风险的一半：**任何能写进 `_acl_data` 或 `_model.sql` 的人，都能改写整个查询的语义**。

---

## 五、策略分布的真实画像

### 5.1 覆盖广度

```text
策略数 397       覆盖模型 366       平均每模型 1.09 条
同模型 2 条策略：_role、wl_do_rule、wl_cancel_card、
                a_emp_csm_take / a_emp_borrow / a_emp_put / a_emp_take_query …（员工端 + 管理员成对出现）
```

即：**绝大多数模型只有一条「组织归属」策略**，少数需要「双视角」的才配两条。

### 5.2 授权边 `_role_acl_data`（2,572 条）

| 角色 | 数据策略数 | 说明 |
|---|---:|---|
| 速转通rfid（294） | **386** | 几乎把全部策略都授给一个角色 |
| super资产管理员（299） | 191 | 资产全线 |
| 捷通资产管理员（303） | 191 | 同上 |
| super资产作业员（301） | 190 | |
| 资产管理员（289） | 165 | |
| 资产员工（295） | 164 | |
| 资产作业员（290） | 125 | |
| 资产仓储客户（286） | 124 | |
| 管理员（123） | 76 | |
| 代理商（114） | 74 | |

对比功能点授权（最多 1,604 条），**数据策略的授权边数量小一个量级**（最多 386）—— 因为一条策略可复用于多个模型场景（一个组织归属策略管一张表），而功能点必须逐资源逐操作配。

### 5.3 `order` 与 `orgId`

```text
order: 10000 → 383 条（默认）
        1000 → 14 条（集中在物联卡核心表：wl_rebate_set、wl_channel、wl_agent_user、
                       wl_place_order、wl_finance、wl_stock_in、wl_stock_out、wl_set_meal 等）
orgId:  NULL → 182 条（全局公共策略）
          1   → 143 条（超管组织定制）
         83   → 65 条
        507/518/524 → 7 条
```

`order=1000` 的这一批和 `order=10000` 的差别没有文档，从分布看更像是「早期策略 / 后补策略」或「优先级更高」的标记（**推断**：若多条策略同时命中同一模型，`order` 可能决定哪条生效或哪条先合并）。由于 `_acl_data_name` 唯一、且大多数模型只有一条策略，这个字段在 397 条数据里几乎不起作用 —— **属于「设计了但没用起来」的字段**。

---

## 六、拼接后的 SQL 长什么样（还原演示）

以「物联卡管理员」查 `wl_card` 列表为例（推断还原，逻辑来自 `_model` + `_acl_data` + `_prop`）：

```sql
SELECT wl_card.iccid, wl_card.msisdn, ...        -- 由 _prop(listEnabled=1) 决定列
FROM wl_card
JOIN _org       ON _org.id = wl_card.org_id      -- ← _acl_data #15 改写为 EXISTS 版
JOIN _org_owner ON _org_owner.orgId = _org.id
               AND _org_owner.ownerOrgId = 1     -- ← $user.orgId 替换
WHERE wl_card.is_cancel = 0                      -- ← _model.where
ORDER BY wl_card.create_date DESC                -- ← _prop.orderDir/orderAsDefault
```

再叠加功能鉴权：只有当 `role_acl_func` 里存在 `wl_card` 的 `queryEnabled`，这个查询才会被执行。

---

## 七、这一层的问题（按严重度）

### P0-1 · SQL 片段可写 → 注入与越权

- `cond` / `join` 是**无参数化的自由文本**，任何能编辑「数据权限」页面的账号（`_resource` 里有 `modelAclDataEnabled` 这类功能点）都可以写入任意子查询；
- 例：把 `cond` 写成 `1=1` → 该角色看到全部行；写成 `org_id IN (select ...)` → 可越权读取其他组织数据；
- `$user` 变量是**字符串替换**，如果用户字段（如 `$user.username`）含有引号，理论上可以闭合字符串（取决于替换时机与转义）。
- 现实缓解：写这段配置的是内部管理员（`_acl_data` 只有 6 个 orgId 在用，且 143 条集中在超管组织 1），暴露面比「面向租户开放」小得多 —— 但**在 SaaS 里这不是可以依赖的前提**。

### P0-2 · 策略是「全表级」的，粒度到不了「某类客户」

`_acl_data` 只能表达「整张表的过滤条件」，无法表达「财务角色的返利数据要脱敏、运营角色不需要」。需要这种区分时，只能**再造一个模型**（如 `wl_agent_user` vs `link_wl_agent_user`）—— 这也解释了为什么 `_model` 有 527 个，而物理业务表并没有那么多。

### P1-1 · 大量同构策略没有抽象

397 条里，`JOIN _org ... JOIN _org_owner ... ownerOrgId = $user.orgId` 这一句重复了 300 多次；`a_firm.firm_id IN (SELECT ... a_firm_owner ... a_staff ...)` 重复 30 多次。任何一处口径调整（比如把「上级组织」改成「上级 + 同级」），都要改几百条记录 —— **且没有版本、没有测试**。

### P1-2 · 双视角策略靠「名字」区分

「员工端/管理员」两条策略的差异只写在 `name` 里（`(员工端)`、`(管理员)`），`UNIQUE(name, model)` 用名字保证唯一。**名字是唯一的结构**，一旦有人改了名字，授权关系（`_role_acl_data` 按 id 关联）不受影响，但人已无法判断哪条对哪条。

### P1-3 · 与 `_model_table` 的别名空间耦合

多个策略直接引用别的模型的别名：

```sql
-- #16 物联卡充值订单归属  model=wl_renew_order
JOIN _org ON _org.id = wl_card.org_id      ← 引用了 wl_card，而 wl_card 来自 _model_table 的 JOIN
```

如果 `wl_renew_order` 这个模型的 `_model_table` 配置里没有 `wl_card`，这段 SQL 直接报错；有，则依赖它的 JOIN 顺序与别名。**改一处建模配置，可能让某条数据权限静默失效（或反过来放宽）**。

### P2 · 空策略、脏策略混入

- `#460 ddd`（`model=_role`，cond/join 皆空）——测试残留，等价于「无过滤」，若被授权就是全开；
- `#459 常用短信指令编辑` 的 join 是 `JOIN wl_cmpp_info_temp cit ON cit.u_id = $user.id`，不走组织维度，属特例但无注释说明；
- `#81/#82` 月结报表用了 `u.orgId`、`wc.org_id` 这类别名，需要 `_model.sql` 里恰好有 `u`/`wc` 别名，否则报错 —— 这类隐式契约完全没有登记。

---

## 八、如果要复用这套设计，最小改造

| 问题 | 改法 |
|---|---|
| 拼接 SQL | 把 `cond/join` 收窄成**结构化谓词**（`orgScope: 'self' / 'manage' / 'all'`、`userScope: 'self'`、`firmScope`），由后端生成固定 SQL；确实需要自定义的，走白名单函数 + 只读视图 |
| 重复策略 | 抽出 `org_owner` 归属宏：后端统一注入 `WHERE EXISTS (...)`，397 条可压到 20 条以内 |
| 无优先级 | 明确 `_acl_data.order` 语义（并集 or 覆盖），并给出冲突检测（同一模型两条策略同时命中时告警） |
| 变量替换 | 用参数绑定代替字符串替换；`$user.id` 一律按整数处理 |
| 可观测性 | 每次拼接记录「命中了哪些 acl_data」，落进 `_log.data`，便于事后审计（现在日志里完全看不到行权限的生效情况） |

---

## 九、小结

- **核心创意**：把「数据范围」从抽象策略变成 SQL 片段，用 `$user.orgId` + `_org_owner` 闭包，一条模式覆盖 366 个模型，工程成本极低；
- **核心代价**：安全边界落在字符串上，且大量同构片段没有抽象，任何口径变化都是「改几百行 SQL 文本」；
- **最能说明作者业务思维的一点**：同一模型配「管理员 / 员工端」两条策略，靠角色叠加切换视角 —— 这是**用权限系统直接表达业务角色差异**，比在代码里写 `if (isOperator)` 优雅得多。
