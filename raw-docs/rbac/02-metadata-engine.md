---
order: 3
---

# 元数据层：一套运行期的「表 + 页面」描述语言

低代码后台的骨架由 7 张表构成：`_module`（业务模块）、`_model`（逻辑模型）、`_prop`（字段元数据）、`_model_table`（多表 JOIN）、`_model_relation`（模型关系）、`_dict`（值字典）、`_seq`（流水号）。

一句话概括设计思想：**物理表只提供「数据在哪」，元数据提供「怎么读、怎么显示、怎么校验、怎么授权」**。业务页面不写代码，只写配置。

---

## 一、模型表 `_model`（527 条）

| 字段 | 类型 | 含义 | 实际填充 |
|---|---|---|---|
| `id` | int | 主键 | 527 |
| `model` | varchar(255) | 逻辑模型名（`UNIQUE _model_model`） | 527 |
| `table` | varchar(255) | 映射的物理表名 | 527 |
| `displayName` | varchar(255) | 页面显示名 | 527 |
| `alias` | varchar(255) | SQL 别名 | **0（历史遗留，未使用）** |
| `columns` | varchar(1023) | 只列出参与查询的列（含聚合） | 139 |
| `where` | varchar(1023) | 默认 WHERE 条件 | 159 |
| `groupBy` | varchar(1023) | 默认 GROUP BY | 50 |
| `orderBy` | varchar(1023) | 默认 ORDER BY | 3 |
| `sql` | text | 完整 SQL 的「报表模型」 | 8 |
| `spName` / `spParams` | varchar | 存储过程名 / 参数 JSON | **0 / 0（预留未用）** |
| `distinctEnabled` | tinyint | SELECT DISTINCT | 12 个为 1 |
| `module` | varchar(255) | 所属模块（FK → `_module.name`） | 527 |
| `uiData` | text | 页面级 UI 配置（JSON） | 527 |

### 1.1 一个模型名，三种形态

**形态 A：物理表直映射**（绝大多数）

```text
model = 'iot_device', table = 'iot_device', displayName = '物联设备'
columns / where / groupBy 全空，字段语义全部由 _prop 驱动
```

页面上有哪些列、哪些可编辑、哪个字段是「关联设备状态」，都查 `_prop`。加字段要**先改物理表，再补 `_prop` 一行**，两边靠人同步（无校验，见 09 的风险）。

**形态 B：别名模型 = 物理表 + 条件 + 汇总**

同一张物理表被切成多个「逻辑视图」，各持有不同的默认过滤和分组口径。物联卡这一族是最典型的：

```text
model='wl_card'          table='wl_card'          where="is_cancel =0"
model='wl_renew_order'   table='wl_renew_order'   where="pay_status in (0,1,-1)"
model='wl_rebate_order'  table='wl_rebate_order'  where="wl_renew_order.pay_status=1"
model='wl_month_report'  table='wl_rebate_order'  columns="SUM(real_rebate) AS sumPric"
                                                  where="wl_rebate_order.owner_id is not null and pay_status =1"
                                                  groupBy="wl_rebate_order.owner_id, months"
                                                  orderBy="months DESC, wl_rebate_order.owner_id"
model='wl_stock_out'     table='wl_stock_out'     groupBy="wl_stock_out.id"
model='iot_device_stat'  table='iot_device'       columns="productKey,count(*) as total"
                                                  groupBy="productKey"  orderBy="productKey"
```

这就是「一个事实表，多种读法」：列表页要「未注销的卡」、财务页要「已支付的返利单」、月结要「按代理商 + 月份聚合」。作者不为每个页面写 SQL，而是把 `where / groupBy / columns` 变成模型属性 —— 同一套渲染器 + 同一套鉴权，通吃所有视图。

代价同样明显：`where` 里出现 `wl_renew_order.pay_status=1` 这种**跨模型引用**（依赖 `_model_table` JOIN 进来的别名），改一个 JOIN 就可能让另一个模型的筛选条件失效。

**形态 C：整段 SQL（8 个模型）**

无法用「单表 + JOIN 配置」表达的多表 UNION / CASE 统计，直接存 SQL：

```sql
-- a_approval：把申领单/申退单/借用单 UNION 成统一的"我的审批"流
SELECT approve_state, a_emp_take.CODE, '申领单' AS type, ...
FROM a_emp_take WHERE a_emp_take.approve_state is not null
UNION
SELECT approve_state, CODE, '申退单' AS type, ...
```

其余 7 个：`a_csm_summary`（收发存汇总，IFNULL/TRUNCATE 多表合并）、`a_csm_sum_details`、`asset_category_use`（按资产状态分列统计）、`asset_staff_use`、`a_emp_sign`、`a_sh_approve`、`realNameCard`。

> `a_csm_summary` 的 SQL 里出现了 `WHERE a_category.org_id = $user.orgId`：
> 说明**行权限变量替换发生在 SQL 文本层**，不区分这段 SQL 来自 `_model.sql` 还是 `_acl_data.cond`（详见 05）。

### 1.2 `uiData` 是页面级 DSL

`_prop.style` 管字段级样式，`_model.uiData` 管页面级：

```json
{
  "view":   { "align": "right", "tab": false, "width": 800 },
  "create": { "align": "right" },
  "update": { "align": "right" },
  "action": { "width": 160 },
  "mask":   { "queryEnabled": true, "createEnabled": true }
}
```

`mask` 段直接对应 `_acl_func` 的功能键（`queryEnabled / createEnabled / ...`）：**渲染时按功能点决定出不出「新增」按钮，服务端再校验一次**。前后端共用同一套功能键词表，这是设计里比较干净的一处。

---

## 二、字段元数据 `_prop`（6,499 条 / 49 个字段）

全库最「重」的一张表，也是低代码核心。49 个字段按用途分 7 组：

| 组 | 字段 | 作用 |
|---|---|---|
| 定位 | `id`、`model`(FK)、`name`（逻辑名）、`table`、`column`（物理列，可为 `a.b` 形式）、`dataType`、`displayName` | 字段从哪来、叫什么 |
| 排序 | `displayOrder`、`displayOrderView`、`displayOrderCreate`、`displayOrderUpdate` | 列表/详情/新建/编辑 四套顺序 |
| 布局 | `displayRow`、`displaySpan`（24 栅格）、`style`（JSON）、`placeHolder`、`hint` | 表单栅格与样式 |
| 查询 | `searchEnabled`(794)、`matchEnabled`(136 精确)、`filterEnabled`(332)、`orderEnabled`、`orderDir`、`orderAsDefault`、`uiOrderEnabled` | 能不能搜、模糊还是精确、能不能排序 |
| 展示 | `listEnabled`(4,560)、`viewEnabled`(4,299 开 / 2,200 关)、`exportEnabled`(226)、`batchOpEnabled`(35)、`selectEnabled`(6,273) | 列表/详情/导出/批量/勾选 |
| 写入 | `createEnabled`、`updateEnabled`、`updateReadonlyEnabled`、`createReadonlyEnabled`、`defaultValue`、`autoGen`（`uuid`/`timestamp`/序列名）、`createUserEnabled`(132)、`createTimeEnabled`(182)、`createOrgEnabled`(165)、`updateUserEnabled`、`updateTimeEnabled` | 谁能写、默认值、自动填充审计字段 |
| 转换校验 | `transTable`(1,114)、`transModel`(533)、`transObjectName`、`transColumns`、`transDict`(490)、`transJs`(506)、`validateEnabled`、`validateJs`(573)、`validateFailureMsg`、`asEnabled`(128) | 值怎么翻成人话、怎么校验 |

### 2.1 三个最有代表性的配置

**（1）字典翻译**：值 0/1 存库，页面显示中文。

```text
_prop:  model='_user', name='isActive', transDict='active_status'
_dict:  domain='active_status'  0=未激活  1=激活
```

**（2）JS 格式化**（506 个字段，日期/金额直接在前端表达式里处理）

```js
transJs = 'ctx.dateFormat(ctx.value, "YYYY/MM/DD HH:mm:ss")'   // 348 处
transJs = '"￥"+ctx.value'
```

**（3）校验规则直存 antd form rules**（573 个字段，不是抽象规则语言，而是把前端库的规则 JSON 塞进库）

```js
validateJs = "[{ required: true, message: '请输入账户名'}]"
validateJs = "[{ required: true, message: '请输入昵称', whitespace: true}]"
```

`validateEnabled` 全表为 0 —— **校验是否生效不靠这个开关，而是"`validateJs` 非空即生效"，该字段是死字段**。

### 2.2 元数据表自己写了自己的说明

`_prop` 描述 `style` 字段的 `hint` 就是一段带注释的 JSON 示例；描述 `_model.uiData` 的 `hint` 亦然：

```json
{
  "width": 200,          // 可以缩写为整个 json 去除改为 200
  "label": { "span": 6 },
  "input": { /* 输入框部分的 style json 数据 */ }
}
```

把「配置文档」内嵌在配置数据里 —— 后台的「模型属性」页面自己就能教会使用者怎么填。

### 2.3 字段开关的真实分布（说明权限是「靠建模裁剪」而非运行时）

```text
listEnabled     4,560 开 / 1,939 关
viewEnabled     4,299 开 / 2,200 关   ← 1/3 的字段详情页根本不显示
searchEnabled     794 开 / 5,705 关
filterEnabled     332 开
exportEnabled     226 开
batchOpEnabled     35 开
validateEnabled     0 开（死字段）
```

**2,200 个「详情页不可见」的字段**说明：库里存了但页面不给看的字段，靠建模时直接关掉表达。这解释了为什么列级权限表 `_role_prop` 只有 33 条 —— **大部分「不该看」的需求在字段元数据层就被裁掉了**，而不是留给角色运行时脱敏（详见 06）。

---

## 三、多表扩展 `_model_table`（472 条）

让一个逻辑模型由多张物理表 JOIN 而成，按 `order` 依次拼装：

| 字段 | 含义 |
|---|---|
| `model` | 逻辑模型（FK → `_model.model`） |
| `table` | 要 JOIN 的物理表 |
| `columns` | 只取这些列（如 `name,resource,type`） |
| `alias` | 表别名 |
| `join` | JOIN 片段 |
| `order` | 拼装顺序 |

实际样例（`role_acl_func` = `_acl_func` 主表 + 两张从表）：

```sql
-- order=0
LEFT JOIN _resource      ON _acl_func.resourceId = _resource.id        -- columns: name,resource,type
-- order=1
LEFT JOIN _role_acl_func ON _role_acl_func.aclFuncId = _acl_func.id     -- columns: roleId,aclFuncId,ownerId
```

联合 `_model.table='_acl_func'`，渲染出来就是「功能点 + 所属资源 + 被哪些角色授权」。

**评价**：把列表页需要的 JOIN 变成配置，页面不用写 SQL；代价是 `join` 里写死的表名/别名与 `_model.where`、`_acl_data.cond` 共享同一命名空间 —— **任一模型的 JOIN 调整都会波及另两个模型的过滤条件**（真实耦合，例：`_acl_data` #16「物联卡充值订单归属」的 join 直接用了 `wl_card.org_id`，并非自身模型表）。

---

## 四、模型关系 `_model_relation`（113 条）

用于表单里的子表 / 穿梭框 / 关联选择，三种关系（字典 `link_type`：`one2many / many2many / one2one`）。

**多对多 + 中间表**：

```json
{
  "model": "_user", "linkModel": "user_role", "linkType": "many2many",
  "linkData": "{\"relModel\": \"_user_role\", \"masterKey\": \"userId\", \"slaveKey\": \"roleId\" }",
  "name": "角色"
}
```

→ 用户详情页的「角色」穿梭框：主表 `_user`，中间表 `_user_role`，`masterKey=userId`、`slaveKey=roleId`。

**`${}` 取值的一对多**：

```json
{ "model": "_resource", "linkModel": "resource_acl_func", "linkType": "one2many",
  "linkData": "{\"resourceId\":\"${id}\" }", "name": "功能定义" }
```

`${id}` 是当前主记录主键，配合 `_model_table` 的 JOIN 条件即可。

**评价**：关系描述只用 JSON 片段，不引入独立 relation schema，配置极轻；但**没有反向引用约束**（删主表不清理中间表）。dump 里 `_role_acl_func` 的 16,789 条授权边全靠 `relation_update` 接口增量维护，一旦并发或半失败就会产生脏边。

---

## 五、值字典 `_dict`（855 条 / 243 个域）

| 字段 | 含义 |
|---|---|
| `domain` | 字典域（`card_provider`、`device_status`…） |
| `key` / `value` | 存库值 / 显示值 |
| `desc` | 描述 |
| `order` | 排序 |
| `module` | 所属模块（FK → `_module.name`） |

```text
card_provider: 1=移动  2=联通  3=电信
active_status: 0=未激活 1=激活          ← _user.isActive 用它翻译
data_type:     string=短文本 text=长文本 number=数字 bool=布尔开关
               datetime=时间 date=日期 file=文件 json=JSON key=公开KEY secret=秘钥KEY
acl_func_type: model=模型（表权限） menu=菜单 func=自定义
link_type:     one2many=一对多 many2many=多对多 one2one=一对一
```

注意 `data_type` 域 —— **它就是 `_prop.dataType` 的取值词表**：「控件类型」也是字典驱动的。243 个域里最大的三个：`wl_charge_cycle`(26)、`stock_card_type`(21)、`meal_type`(16)；按模块分：`card` 359、`asset` 193、`lift` 182、`device` 38。

---

## 六、流水号 `_seq` + `_seq_value`（55 / 60 条）

业务编号不是应用层拼的，而是库里的规则表：

| `_seq` 字段 | 含义 | 样例 |
|---|---|---|
| `name` | 编号名，同时是 `_prop.autoGen` 的取值 | `a_asset` |
| `prefix` | 前缀 | `A`、`RK`(入库)、`CK`(出库)、`LY`(领用) |
| `timeFormat` | 日期格式 | `%Y%m%d` |
| `digits` | 序号位数 | 4 / 5 |
| `module` | 所属模块 | `asset` |

`_seq_value(seqId, orgId, value)` 存**按组织独立的当前计数**，同一规则在不同租户下互不干扰：

```text
seq='a_asset'  prefix='A'  format='%Y%m%d'  digits=5
→ A2021111500001（某组织第 1 张资产单）
```

`autoGen` 除指向 `_seq.name` 外，还支持 `uuid`、`timestamp` 两个内置值（如 `wl_stock_in.in_no` 用 `timestamp`）。

这是整套元数据里设计得最「正」的一块 —— **编号规则、位数、作用域（组织）都是数据，不需要发版**。

---

## 七、小结：三个设计取舍

1. **「表结构」与「字段语义」拆两层，但没做一致性校验。**
   `_prop.column` 必须与物理列同名、`_model.table` 必须真实存在 —— 全靠人工，dump 里没有任何校验表或到 `information_schema` 的外键。这是最大的一处技术债。

2. **「读法」被提到元数据层，读法之间共享 SQL 命名空间。**
   `where / groupBy / columns / sql / join` 都是 SQL 片段，灵活但互相耦合，且直接面向「拼接执行」。

3. **「页面」也被数据化，因此权限点能一以贯之。**
   `_model.uiData.mask` 与 `_acl_func.funcKey` 共用词表（`queryEnabled/createEnabled/...`），前端渲染按钮和后端鉴权用同一份枚举，多租户下尤其省心。
