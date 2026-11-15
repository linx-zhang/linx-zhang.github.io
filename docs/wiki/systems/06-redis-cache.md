
# Redis 缓存层封装：前缀强校验、pickle、scan 删除与防击穿

对应归档里的 `webot3/monarch/corelibs/mcredis.py` 与 `cache_decorator.py`（共约 330 行，是这套系统里复用度最高的两个文件）。

## 一、为什么不直接用 `redis.StrictRedis`

直接用的痛点，做过几个项目的都知道：

1. **key 满天飞**。`user:1`、`user_1`、`u:1` 混着用，某个模块清了 `user:1`，另一个模块还在读缓存，结果谁也不知道数据是哪来的。
2. **存不了对象**。Redis 只能存 bytes，业务代码里到处是 `json.dumps` / `json.loads`，漏一个就 500。
3. **批量清缓存只能 `KEYS`**。`KEYS` 在大库上会阻塞 Redis 主线程，线上直接卡死。
4. **锁和数据混在一起**。`redis.lock.Lock` 内部要求存取原始 token 字符串，如果同一个客户端会给 value 做压缩/序列化，锁就会失效。

这四个痛点正好对应 `mcredis.py` 的四个设计：前缀校验、pickle、`scan` 删除、`PureRedis` 分离。

## 二、命名空间：不做约定，就强制校验

```python
_CACHE_KEY_PREFIX = "monarch:"

def require_prefix(f):
    def func(self, key, *args, **kws):
        if not key.startswith(_CACHE_KEY_PREFIX):
            raise KeyError("%s is not starts with %s".format(key, _CACHE_KEY_PREFIX))
        return f(self, key, *args, **kws)
    return func

class McRedis(object):
    @require_prefix
    def set(self, name, value, ex=None, px=None, nx=False, xx=False):
        return self._client.set(name=name, value=cPickle.dumps(value),
                                ex=ex, px=px, nx=nx, xx=xx)
```

这个装饰器非常「粗暴」但非常有效：**写操作如果忘了带前缀，直接抛 `KeyError`，测试阶段就炸。**

注意它只装饰了**写方法**（`set` / `add` / `hset` / `zadd` / `lpush` / `delete_pattern` / `get_keys_by_pattern`），读方法（`get` / `hgetall` / `hmget`）没有校验，`delete` 也没有。这是一个**有意的不对称**：

- 写入必须规范，否则脏数据进库；
- 读取和删除放宽，方便「清理历史遗留的不规范 key」。

副作用是：如果有人用 `mc.get("other:key")` 去读别的前缀，代码不会报警。**建议给读方法也加一个只记 warning 的版本**，用日志把漏网的 key 暴露出来。

`McRedis` 还实现了 `__getattr__` 代理：

```python
def __getattr__(self, name):
    return getattr(self._client, name)
```

于是 `mc.zadd(...)`、`mc.ttl(...)`、`mc.exists(...)` 这些没被包装的方法也能直接用，包装类不必写全量 API。**这是代理模式在缓存封装里的标准用法**：要扩展的方法自己实现，其余透传。

## 三、pickle：省事，但要认清代价

```python
def get(self, name):
    r = self._client.get(name)
    return cPickle.loads(r) if r else None

@require_prefix
def set(self, name, value, ex=None, px=None, ...):
    v = cPickle.dumps(value)
```

用 `pickle` 的收益很直接：**`dict`、`list`、`datetime`、自定义对象都能直接塞**，业务代码里不再出现 `json.dumps`。

代价有三条，必须写进团队规范：

| 代价 | 说明 |
| --- | --- |
| 不可跨语言 | 别的语言写的服务读不了这份缓存；将来要用 Go 重写这块就得全量换 |
| 不安全 | `pickle.loads` 是代码执行入口。**只要 Redis 有被写入的可能，就等于有 RCE**。所以这个库必须只允许本服务访问、开 ACL、禁 `CONFIG`/`EVAL` 之外的高危命令 |
| 版本耦合 | 类定义改了字段，旧缓存反序列化会报 `AttributeError`。所以缓存里最好只放 dict/list，不放自定义类实例 |

代码里对 hash / zset 还专门做了「key 也 pickle」的版本：

```python
@require_prefix
def cpickle_zadd(self, key, maps, **kwargs):
    maps = {cPickle.dumps(name): value for name, value in maps.items()}
    return self._client.zadd(key, maps, **kwargs)

@require_prefix
def cpickle_zrangebyscore(self, key, min_score, max_score, **kwargs):
    result = self._client.zrangebyscore(key, min_score, max_score, **kwargs)
    return [cPickle.loads(item) for item in result]
```

这是为了「集合成员本身是对象」的场景（比如排队队列里存的是带时间戳的会话对象）。用法没错，但要注意：**ZSET 的 score 必须是数字，而 member 被 pickle 之后是一段二进制**，可读性为零，`ZRANGE` 查出来的东西人不认识，排障只能靠代码。

## 四、批量删除：`SCAN` 而不是 `KEYS`

```python
@require_prefix
def delete_pattern(self, pattern, batch_size=2000):
    """
    This method uses Redis's `scan` command to delete all
    keys with given pattern instead of using `keys` command (which
    may introduce performance issues).
    This method is not atomic...
    """
    cursor = 0
    while True:
        cursor, keys = self.scan(cursor, match=pattern, count=batch_size)
        self.delete(*keys)
        if cursor == 0:
            break
```

注释写得比大多数开源库还诚实，把三个限制都列出来了：**非原子、可能一直扫不完、`count` 只是提示**。这段注释建议原样保留——它替未来的维护者省了一次线上事故。

同一套逻辑还有一个「返回迭代器」的版本：

```python
@require_prefix
def get_keys_by_pattern(self, pattern, max_num=1000, batch_size=2000):
    cursor, count = 0, 0
    while True:
        cursor, result = self.scan(cursor, match=pattern, count=batch_size)
        count += len(result)
        for key in result:
            yield key
        if count >= max_num or cursor == 0:
            return
```

用 `yield` 而不是返回 list，避免一次拉回几万个 key 撑爆内存。**`max_num` 上限也很关键**——批量修复脚本最怕的就是「一个模式匹配到全库」。

## 五、锁为什么必须换一个连接

```python
class PureRedis(object):
    '''不重写任何方法 暂只做分布式锁状态存储 因数据存储的redis做了压缩处理 redis.lock.Lock不支持'''
```

代码里 `mc` 走 `REDIS_URL`（db 0），`pc` 走 db 1，并且 `get`/`set` 都**不做 pickle**。原因写在类注释里：`redis.lock.Lock` 内部会把 token 当作普通字符串读写，而 `McRedis` 的 `set` 会顺手 pickle 一遍，锁读回来的 token 就不匹配了 → `LockNotOwnedError`。

**这是个非常隐蔽的坑**：表现出来是「锁偶尔释放失败」，日志里一堆 `Cannot release a lock that's no longer owned`，但代码逻辑完全正确。凡是「给 redis 客户端做了序列化包装」的项目，都必须把锁放到**未包装的裸客户端**上。

`RedisLock` 又把 `redis.lock.Lock` 包了一层，让它变成标准的 context manager：

```python
class RedisLock(Lock):
    '''
    usage:
    with RedisLock(mc, "monarch:lock_key", timeout=5, blocking=False, thread_local=False) as lock:
        if not lock.is_acquired():
            return
        do_sth()
    '''
    def __enter__(self):
        self.acquire()
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        if self.is_acquired():
            self.release()

    def is_acquired(self):
        return bool(self.local.token)
```

两个细节值得记：

1. **`__exit__` 里先判断 `is_acquired()` 再 `release()`**。业务超时导致锁自动过期时，token 已丢失，直接 `release()` 会抛 `LockNotOwnedError`；先判断就干净了。
2. **`is_acquired()` 用 `self.local.token` 判断**，而不是再发一次 `GET`。`token` 是本次持有锁的标识，有值就说明「我拿到过」。这也是为什么超时后必须捕获 `LockNotOwnedError`（第 4 篇的调度队列就是这么处理的）。

## 六、缓存装饰器：三种 key 模板，一套生成器

`cache_decorator.py` 是最能体现「把约定写进代码」的文件。它的 docstring 直接给出了 6 种用法：

```python
# 单参数情况
@cache('Test:User:dev:%s' % '{user_id}')
def query_result(user_id, pid=13): ...

# 多参数情况
@cache('Test:User:dev:%s:%s' % ('{user_id}', '{pid}'))
def query_result(user_id, pid=14): ...

# 按参数顺序拼接 key
@cache('Text:User:dev:%s:%s')
def query_result(user_id, pid=15): ...

# 指定参数的数据类型
@cache('Test:User:%(user_id)d:%(pid)d')
def query_result(user_id, pid=15): ...

# 指定过期时间
@cache('Test:User:%(user_id)d:%(pid)d', expire=3600)
def query_result2(user_id, pid=15): ...

# 指定 refresh 强制刷新
print(query_result(user_id=111111, refresh=True))
```

支撑这六种写法的是 `formater()` —— 它先判断模板里用的是哪种占位符，然后**预编译成一个 lambda 缓存起来**：

```python
percent_pattern = re.compile(r"%\w")
brace_pattern   = re.compile(r"\{[\w\d\.\[\]_]+\}")

def formater(text):
    percent = percent_pattern.findall(text)
    brace   = brace_pattern.search(text)
    if percent and brace:
        raise Exception("mixed format is not allowed")   # 禁止混用

    if percent:                                   # 'xxx:%s:%s'
        n = len(percent)
        return lambda *a, **kw: text % tuple(a[:n])
    elif "%(" in text:                            # 'xxx:%(p1)d'
        return lambda *a, **kw: text % kw
    else:                                         # 'xxx:{p1}'
        return text.format
```

**「禁止混用」**这条校验很关键。`%s` 和 `{}` 混在一个模板里，行为完全不可预期，直接在装饰时抛异常，比运行时拼出一个奇怪的 key 好一万倍。

`gen_key_factory` 负责「把函数实参喂给模板」：

```python
def gen_key_factory(key_pattern, arg_names, defaults):
    # 开头参数可能没有默认值，所以从后往前拼
    args = dict(zip(arg_names[-len(defaults):], defaults)) if defaults else {}

    def gen_key(*a, **kw):
        aa = args.copy()
        aa.update(zip(arg_names, a))    # 位置参数
        aa.update(kw)                   # 关键字参数
        if callable(key_pattern):
            key = key_pattern(*[aa[n] for n in names])
        else:
            key = format(key_pattern, *[aa[n] for n in arg_names], **aa)
        return key and key.replace(" ", "_"), aa
    return gen_key
```

三处巧思：

1. **`arg_names[-len(defaults):]`** 只把**带默认值的尾部参数**拼进字典。因为 `def f(a, b=1)` 里 `defaults=(1,)`，只有 `b` 有默认值，直接 `zip(arg_names, defaults)` 会把 `1` 配给 `a`——这是 Python 里非常常见的默认值对齐错误。
2. **位置参数和关键字参数都覆盖进字典**，所以 `f(1, pid=2)` 和 `f(1, 2)` 生成的 key 一致。
3. **`key.replace(" ", "_")`** 顺手把空格替换掉。原因是 key 里出现空格容易在命令行排障时被拆成两个参数——很小的细节，但说明作者被坑过。

### 6.1 防击穿：mutex 自旋

```python
@wraps(f)
def _(*a, **kw):
    key, args = gen_key(*a, **kw)
    if not key:
        return f(*a, **kw)

    refresh = kw.pop("refresh", False)
    r = mc.get(key) if not refresh else None

    # anti miss-storm
    retry = max_retry
    while r is None and retry > 0:
        if mc.add(key + "#mutex", 1, int(max_retry * 0.1)):
            break              # 抢到 mutex，去真正查库
        time.sleep(0.1)        # 没抢到，等一会儿再读缓存
        r = mc.get(key)
        retry -= 1

    if r is None:
        r = f(*a, **kw)                        # 缓存未命中，查库
        if r is not None:
            mc.set(key, r, expire)             # 写回缓存
        if max_retry > 0:
            mc.delete(key + "#mutex")          # 释放 mutex

    if isinstance(r, Empty):
        r = None
    return r
```

这是标准的 **cache stampede 缓解方案**：并发未命中时，只有一个（或少数）请求拿到 mutex 去查库，其余请求自旋等待并重读缓存。

四个已知局限：

1. **mutex 的过期时间是 `max_retry * 0.1` 秒**。如果 `max_retry=10`，mutex 只活 1 秒。查库超过 1 秒，锁就没了，第二个请求会进来——**退化成「限流」而不是「单飞」**。
2. **`mc.add(key+"#mutex", 1, ...)` 用的是 `INCRBY`，不是 `SET NX`**。`add` 的实现是「`value` 有值就 `incrby`」，所以第一个请求拿到 1，第二个拿到 2……判断 `if mc.add(...)` 只对「首次为真」成立，行为碰巧可用，但语义不精确。**更清晰的做法是 `mc.set(key+"#mutex", 1, ex=..., nx=True)`**。
3. **`Empty` 类型被当成 `None` 返回**，是为了区分「数据库里确实没有」和「没查」。但代码里 `Empty` 实例**同样会被写进缓存吗？不会**——`if r is not None` 拦住了 `Empty` 吗？`Empty` 是对象不是 None，所以会被 pickle 进缓存，下次读出来再转成 None。这算是有意的「缓存空值」实现，能防穿透，但要注意 `Empty` 类必须在反序列化时仍可导入。
4. **`refresh=True` 时不是先删再查**，而是「跳过读缓存、直接查库、覆盖写」。并发 `refresh` 会造成多个请求同时查库。要真正实现「被动刷新」，应该配合 mutex。

`delete_cache` 则是「先执行函数，再删 key」：

```python
def delete_cache(key_pattern):
    def deco(f):
        ...
        def _(*a, **kw):
            key, args = gen_key(*a, **kw)
            r = f(*a, **kw)
            mc.delete(key)
            return r
        return _
    return deco
```

这个顺序是对的（先写库后删缓存，比「先删缓存后写库」产生的脏读窗口小）。但它**只删一个 key**，如果同一条数据有多个聚合缓存（列表、详情、统计），必须串多个 `delete_cache`，或者手工 `delete_pattern`。**这是缓存一致性最容易漏的地方**，建议在团队里统一约定「写操作必须显式声明受影响的 key 集合」。

## 七、还有一个「注册表」用于审计

```python
registered_keys = set()

def cache(key_pattern, expire=0, max_retry=0):
    def deco(f):
        registered_keys.add((key_pattern, f.__doc__ or None))
```

所有被装饰的 key 模板都进了一个全局 set。代码里没看到谁消费它，但意图很明显：**将来可以加一个管理接口，把全站缓存 key 列出来**，用于排查「这个 key 是谁写的」。这类「先埋点后使用」的设计值得保留——成本一行，收益是排障时的能见度。

## 八、可直接复用的结论

1. **缓存封装第一件事是强制命名空间**，写在写方法里，忘写就抛异常。
2. **只包装需要定制的方法，其余靠 `__getattr__` 透传**，封装类才不会变成 API 搬运工。
3. **批量删除一律 `SCAN`**，并在注释里写清「非原子、可能扫不完」。
4. **锁必须放在未做序列化的裸客户端上**，否则会出现「偶发释放失败」这种玄学 bug。
5. **锁的 `__exit__` 先判 `is_acquired()`**，再 `release()`，能消掉大部分 `LockNotOwnedError`。
6. **key 模板必须禁止混用格式**，装饰时就校验，别等运行时。
7. **默认值拼参要从尾部对齐**（`arg_names[-len(defaults):]`），这是最常错的细节。
8. **防击穿用 `SET NX` 而不是 `INCRBY`**，并把锁过期时间设成大于查库 P99。
9. **写操作要显式声明受影响的 key**，一致性问题八成出在「漏删一个」。

---
