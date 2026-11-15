
# 列权限与字段脱敏：33 条配置背后的取舍

## 一、表结构 `_role_prop`（33 条）

| 字段 | 类型 | 含义 |
|---|---|---|
| `roleId` | int | 角色（FK → `_role.id`，`ON DELETE RESTRICT`） |
| `propId` | int | 字段（FK → `_prop.id`，`ON DELETE RESTRICT`） |
| `mask` | int | 掩码/脱敏标记 |

```sql
PRIMARY KEY (roleId, propId)
KEY _role_prop_ibfk_2 (propId)
```

表名叫「role + prop」，语义是「**某角色对某字段做处理**」。与前三层（功能/行/域）不同，这一层只有 33 条记录，是全库最小的权限表。

---

## 二、全部 33 条的真实内容

| 角色 | 字段（`_prop.model` / `name` / `displayName`） | mask |
|---|---|---:|
| 18 物联卡代理商 | `wl_card` / `create_by` / 入库用户 | 0 |
| 18 | `wl_card` / `create_date` / 入库时间 | 0 |
| 18 | `wl_card` / `stock_status` / 库存状态 | 0 |
| 18 | `wl_card` / `auto_no` / **实名验证码** | 0 |
| 18 | `wl_rebate_set` / `plat_form` / **平台提成** | 0 |
| 18 | `wl_rebate_set` / `first_rebate` / **一级返利** | 0 |
| 18 | `wl_rebate_set` / `status` / 状态 | 0 |
| 18 | `wl_card` / `wl_stock_out.identify` / 卡标识 | 0 |
| 18 | `wl_card` / `wl_place_order.place_no` / 下单编号 | 0 |
| 18 | `wl_card` / `org_id` / 归属组织 | 0 |
| 45 支付管理员 | `wxpay_user_info` / `nickname` / **昵称** | 0 |
| 60 物联卡短信管理员 | `wl_card` / `create_by`、`create_date`、`auto_no`、`wl_stock_out.identify`、`org_id` | 0 |
| 62 物联卡组织管理员 | `wl_channel` / `cq_token` / **CqToken**；`wl_channel` / `update_date`；`wl_agent_user` / `api_key` / **充值ApiKey** | 0 |
| 63 代理商 | `wl_channel` / `cq_token`、`update_date`；`wl_agent_user` / **`cmpp_key` 下游短信ApiKey**；`wl_stock_in` / `branch` / 归属分公司 | 0 |
| 180 物联卡代理商短信管理 | 与角色 18 基本相同的 10 个字段 | 0 |

**共同点非常清晰**：

1. 全部集中在物联卡这条业务线（`wl_card`、`wl_rebate_set`、`wl_channel`、`wl_agent_user`、`wl_stock_in`），加 1 条支付昵称；
2. 全部 `mask = 0`，**没有任何一条是 1**；
3. 针对的字段都是「敏感但代理商/下游不该看」的：**返利与平台提成、实名验证码、渠道 CqToken、充值/短信 ApiKey、入库人与库存状态、归属组织、下单编号**；
4. 被设置的角色都是**外部角色**（代理商、代理商短信管理、支付管理员、组织管理员），不是内部管理员。

---

## 三、`mask` 的语义：只能推断，无法确证

由于 33 条全是 `mask = 0`，无法从数据推断「0 和 1 分别代表什么」。有两种合理解释：

**解释 A（可能性更高）：`mask` 是「掩码级别」，0 = 隐藏/打码**
- 支撑：被设置的全是敏感字段（返利、验证码、Token、ApiKey），而这些角色都是外部角色；
- 支撑：若是「允许可见」，33 条会分散到正常字段上，不会精准命中这批敏感列。

**解释 B：`mask` 是「从第几位开始遮」，0 表示完全遮住**
- 支撑：字段名 `mask` 更像「掩码」而非「开关」；
- 弱项：若如此，应出现 `1`、`2` 表示「保留前 N 位」，但一条都没有 → 说明只实现了「全遮」。

**结论（保守表述）**：这张表在当前数据里只能证明一件事 —— **它被用来对「代理商类角色」屏蔽物联卡的返利、凭证类字段**；具体 `mask` 取值语义需要源码确认。

---

## 四、为什么只有 33 条：真正的列权限在「元数据层」

三条证据：

**（1）字段开关直接裁列**

```text
_prop.viewEnabled = 0 → 2,200 个字段（占 6,499 的 34%）
```

三分之一的字段在详情页根本不显示。**「不该看」在建模阶段就解决了**，不需要角色级脱敏。

**（2）按角色拆模型**

同一个业务对象按角色拆出多个逻辑模型，权限作用于模型而不是字段：

```text
wl_agent_user（代理商）         vs  link_wl_agent_user（关联选择用）
a_emp_take（管理员视角）        vs  a_emp_take_query（员工端视角，cond 里带 asset_staff.user_id=$user.id）
role_prop / acl_prop / prop_role  三个不同的模型都指向 _prop，只是用途不同
```

**（3）敏感字段本身就不进普通模型**

`wl_card.auto_no`（实名验证码）、`wl_channel.cq_token`、`wl_agent_user.api_key` 这些字段，在大多数模型的 `_prop` 里 `viewEnabled=0`，只有少数「配置类」模型会显示 —— 于是 `_role_prop` 只需要兜住**极端剩下的那一小撮**。

---

## 五、前端如何消费这两层配置（按表结构还原）

```text
① 取字段清单
   _prop WHERE model = ? ORDER BY displayOrderView
② 过滤展示
   viewEnabled = 1 且 listEnabled (列表) / viewEnabled (详情)
③ 套用角色掩码
   SELECT mask FROM _role_prop WHERE roleId IN (当前用户所有角色) AND propId = ?
   命中 → 字段置空 / 显示 ***  （具体行为取决于后端实现）
④ 套用值转换
   transDict → 查 _dict 得到中文；transJs → 前端表达式格式化
```

**关键缺陷**：`_role_prop` 按 `roleId + propId` 存储，一个用户有多个角色时，**多个 mask 如何合并没有定义**（取最小？取最大？任一命中即遮？）。从数据看不出合并规则，因为 33 条集中在不同角色、互不重叠 —— 也就是说，**这套机制还没被真正压测过复杂场景**。

---

## 六、相关但容易混淆的四张「列权限」表

| 表 / 模型 | 是什么 | 与 `_role_prop` 的区别 |
|---|---|---|
| `_prop.propId` | 字段定义（含 `viewEnabled/createEnabled/updateEnabled`） | **全局**开关，作用于所有角色 |
| `_role_prop` | 角色 × 字段 | **按角色**的补充掩码（33 条） |
| `acl_prop`（`_model` id=153） | 逻辑模型：`_prop` 的子集（`id,model,name,table,column,displayName`） | 用于「给角色挑字段」的穿梭框左栏 |
| `role_prop`（`_model` id=155） | 逻辑模型：另一视角的 `_prop` | 与 `_role_prop` 配套的穿梭框右栏 |

`_acl_data` 里还有两条用于约束这两张表的行策略：

```sql
-- #102 数据列权限角色过滤  model=role_prop
JOIN _resource s ON s.type='model' AND s.resource=_prop.model
JOIN _acl_func f ON f.resourceId = s.id
JOIN _role_acl_func rf ON rf.aclFuncId = f.id
JOIN _user_role ur ON rf.roleId = ur.roleId AND ur.userId = $user.id

-- #42 角色归属（数据列权限） model=acl_prop   （同构）
```

意思是：**一个用户只能给「自己有模型权限的那些模型」的字段做列权限配置** —— 列权限的配置入口本身也被权限约束住了，这是一个考虑比较细的地方。

---

## 七、小结

- 表结构正确（角色 × 字段 × mask，复合主键 + 双外键），但**使用量极小、只有一种取值**，属于「通了电没跑车」；
- 真正的列级控制是靠**字段元数据开关（2,200 个字段被关）+ 按角色拆模型**实现的，比运行时脱敏成本低、性能好，但**不灵活**：同一模型对不同角色显示不同字段，做不到；
- 若要补齐，最小改法是：`mask` 改为枚举（`0=隐藏 1=掩码 2=只读 3=可见`），并明确多角色合并规则（建议「最严优先」）；同时把 `_prop.viewEnabled` 从「全局」改为「角色可覆盖的默认值」。
