---
order: 6
---

# Flask 工程骨架：一个文件决定全站的错误、日志与异步边界

对应归档里的 `webot3/monarch/app.py`、`config.py`、`manage.py`、`gunicorn_config.py`、`.gitlab-ci.yml`、`doc/process/celery优先级设计.md`。

## 一、一句话概括这个骨架

这个客服平台的 Web 层代码量不大，复杂度全堆在 `app.py` 和 `config.py` 两个文件上：

- `app.py` 决定**应用怎么被组装**（扩展、蓝图、中间件、错误处理、Celery 上下文）；
- `config.py` 决定**运行时怎么被约束**（数据库池、连接数、队列路由、定时任务、各渠道地址）。

这种「两个中心文件」的组织方式在 Flask 项目里非常典型，优点是**新人两小时能看懂全貌**，缺点是文件会膨胀（`config.py` 已经 466 行）。下面挑最有复用价值的部分讲。

## 二、`create_app`：组装顺序是有讲究的

```python
def create_app(name=None, _config=None):
    if config.PRIVATIZATION_DEPLOYMENT:          # ① 私有化部署的授权校验
        lib = cdll.LoadLibrary("./secret.so")
        result = lib.CheckLicense()
        if not result:
            raise Exception("授权无效")

    app = Flask(name or __name__)
    app.config.from_object("monarch.config")     # ② 先加载配置
    if config.SENTRY_DSN and not config.DEBUG:
        Sentry(app, dsn=config.SENTRY_DSN)
    if isinstance(_config, dict):
        app.config.update(_config)               # ③ 测试可注入覆盖配置

    db.init_app(app)                             # ④ 扩展
    mc.init_app(app)
    pc.init_app(app)
    api.init_app(app)

    init_logging(app)                            # ⑤ 日志
    setup_before_request(app)
    setup_after_request(app)

    register_admin_api(app)                      # ⑥ 四套蓝图
    register_api(app)
    register_conf_center_api(app)
    register_customer_center_api(app)
    setup_errorhandler(app)                      # ⑦ 错误处理

    celery.conf.update(app.config)               # ⑧ Celery 吃同一份配置

    class ContextTask(celery.Task):              # ⑨ 让任务能访问 app 上下文
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return self.run(*args, **kwargs)
    celery.Task = ContextTask
    return app
```

值得逐个点评：

**① 授权校验用 `.so` + `cdll`**。私有化部署（客户机房部署）需要 license 校验，做法是加载一个本地动态库、调用 `CheckLicense()`。这个思路简单有效：**逻辑不暴露在 Python 源码里，也不联网**。代价是跨平台编译（Linux `.so` / Windows `.dll`）和「库文件丢了就起不来」。生产上应加一条：**license 失败要有明确的运维日志，而不是只抛一句 `授权无效`**。

**③ `_config` 参数** 让测试可以覆盖任意配置（`create_app(_config={"SQLALCHEMY_DATABASE_URI": ...})`），这是 Flask 应用工厂的标准姿势，务必保留。

**⑦ 错误处理放在最后**：它注册的 500 处理里会用到 `db.engine.pool.status()`，说明作者预期「跑到错误处理时 ORM 已经就绪」。

**⑨ `ContextTask`** 是 Celery + Flask 集成的必做项。没有它，任务里所有 `current_app`、`db.session`、`g` 都会报 `RuntimeError: Working outside of application context`。

## 三、四套蓝图，对应四类调用方

```python
register_admin_api(app)           # /admin_api/v1   客服工作台 / 管理后台
register_api(app)                 # /api/v1         访客端（H5、微信等渠道）
register_conf_center_api(app)     # /conf_center/v1 配置中心（内部服务间）
register_customer_center_api(app) # 客户中心
```

每套蓝图一个 `flask_restplus.Api` 实例、一套鉴权、一套 swagger 文档。这实际上是**按「调用方身份」切分 API，而不是按业务模块**。好处是：

- 鉴权逻辑只有四份，不用每个 namespace 各写一遍；
- 文档天然按端口分（客服端文档 / 访客端文档），对接方各看各的；
- 灰度时可以按蓝图限流、独立开关。

`admin_api` 的鉴权用一个 `before_request` 统一拦截，并有显式白名单：

```python
NO_LOGIN_ROUTE = ["/user/login", "/user/captcha", "/", "/swagger.json",
                  "/oauth/token", "/oauth/password_login", "/oauth/config"]

def login_before_request():
    if request.path.split(BLUEPRINT_URL_PREFIX)[-1] in NO_LOGIN_ROUTE:
        return
    token = request.headers.get("token")
    is_ok, resp = _check_user_login(token)
    if not is_ok:
        return resp
    g.user = resp
```

**白名单显式枚举 + 其余默认拦截**，这是本文想强调的第一个正确姿势（对比第 3 篇里 SSO 的 default allow）。

## 四、统一错误处理：把 traceback 和连接池状态一起记下来

```python
def setup_errorhandler(app):
    @app.errorhandler(400)
    @app.errorhandler(ValueError)
    @app.errorhandler(ValidationError)
    def error_400(e):
        current_app.logger.info(traceback.format_exc())
        return http_fail(http_code=codes.HTTP_BAD_REQUEST, code=codes.CODE_BAD_REQUEST)

    @app.errorhandler(500)
    def error_500(e):
        current_app.logger.info("%s request [500] %s, url: %s, args: %s, form: %s, json: %s",
            request.remote_addr, request.method, request.url,
            request.args, request.form, request.json)
        current_app.logger.info(traceback.format_exc())
        if isinstance(e, TimeoutError):
            current_app.logger.info("SQLAlchemy: status->{}".format(db.engine.pool.status()))
        return http_fail(http_code=codes.HTTP_SERVER_ERROR, code=codes.CODE_SERVER_ERROR)
```

三个高明之处：

1. **`ValueError` 和 `ValidationError` 都映射到 400**。marshmallow 校验失败、字段类型错误、显式 `raise ValueError`，走同一个出口，不会漏成 500。
2. **500 时打印完整请求上下文**（IP、方法、URL、args、form、json）。没有这段，线上 500 只能靠猜；有了它，一行日志就能复现。
3. **`TimeoutError` 时打印连接池状态**：`db.engine.pool.status()` 会输出当前池里 checked out / overflow 的数量。**这是定位「连接池被占满」这类问题的唯一线索**——很多项目直到 ORM 报 `QueuePool limit reached` 才想起来加这行。

**已知缺陷**：第 2 点把 `request.form` 和 `request.json` **全量打到日志**。登录接口的 `password`、客户手机号这类 PII 会落盘。日志平台通常权限更宽、留存更久，这属于**日志侧的数据泄露面**。改进方式很轻：加一个字段脱敏函数，对 `password`、`mobile`、`id_card`、`token` 这类 key 做掩码；或者干脆只记 `list(args.keys())` 而不记值。

## 五、请求日志 + 业务统计，一次请求只算一遍

### 5.1 结构化日志

```python
def _request_log(resp, *args, **kws):
    now = time.time()
    request_start_time = getattr(request, "request_start_time", None)
    real_ip = request.headers.get("X-Real-Ip", request.remote_addr)

    response = resp.get_json(silent=True)
    code = response.get("code", BIZ_CODE_FAIL) if response else BIZ_CODE_FAIL

    if request.endpoint != HEARTBEAT_ENDPOINT:          # 心跳不记，省日志量
        data = dict(
            request_time=..., remote_addr=real_ip, status_code=resp.status_code,
            code=code, method=request.method, url=request.url,
            endpoint=request.endpoint, args=request.args.to_dict(),
            form=request.form.to_dict(), json=request.json, response=response,
            elapsed=now - request_start_time if request_start_time else None,
        )
        logging.getLogger("request").info(data)
    return resp
```

一行 JSON 里同时有：耗时（`elapsed`）、业务码、端点名、请求全参数、响应体。这一点比「打一条 `INFO: POST /admin_api/v1/user/login`」强太多——**结构化日志才能真正做聚合分析**。

`request_start_time` 由另一个 `before_request` 打上时间戳，而 `elapsed` 用 `getattr(..., None)` 兜底，保证「即便 start time 没打上也不会抛」。这是很细的健壮性处理。

### 5.2 blinker 信号做业务埋点

```python
def _statics_log(resp, *args, **kws):
    if code == BIZ_CODE_OK:
        from monarch.utils.helpers import statics_signal
        if request.endpoint == "admin_api.oauth_client_oauth2_client_dto":
            statics_signal.send("user-login-statics", ...)
        elif request.endpoint == "admin_api.user_user_services":
            statics_signal.send("user-service-statics", ...)
        elif request.endpoint == "admin_api.user_user_status":
            statics_signal.send("user-work-status-statics", ...)
        elif request.endpoint == "admin_api.user_user_logout":
            statics_signal.send("user-logout-statics", ...)
```

用一个 `blinker` 信号把「HTTP 层」与「统计层」解耦：接收方注册在 `tasks/action_log.py`，收到信号就往 Celery 里丢任务。

**为什么不在视图函数里直接写统计？** 因为视图负责「业务」，统计是「副作用」，两者失败互不影响；而且统计任务要进低优先级队列（不能拖慢登录）。用信号做这一层缝合，是这份代码里最「工程化」的一处设计。

## 六、Celery：三队列、两级优先级

### 6.1 队列划分

```python
high_exchange     = Exchange("celery_exchange_high")
low_exchange      = Exchange("celery_exchange_low")

high_queue        = Queue("celery_queue_high",       high_exchange, routing_key="celery_routing_key_high")
low_queue         = Queue("celery_queue_low",        low_exchange,  routing_key="celery_routing_key_low")
low_import_queue  = Queue("celery_queue_low_import", low_exchange,  routing_key="celery_routing_key_low_import")

CELERY_DEFAULT_QUEUE  = low_import_queue.name       # 默认进"低优先级+慢"队列
CELERY_QUEUES         = (high_queue, low_queue, low_import_queue)
```

`doc/process/celery优先级设计.md` 把划分依据写成了表格，核心三行结论：

1. 机器人问答（`get_qa_task`）高频、走 HTTP 稍慢 → `low_import`；
2. 客服自动下线、行为日志、登录统计 → 快、关乎体验 → `high`；
3. 公司初始化、写 ES 这类批量 I/O → `low`。

设计目的原文写得很清楚，值得原样引用：

> 1. 机器人聊天不会影响 BI 的功能
> 2. 可能数据库 I/O 阻塞的任务，不影响机器人功能
> 3. 各 worker 任务频率均衡，避免造成 worker 长期空闲

**这就是「按资源类型分队列」而不是「按业务重要性分队列」的正确理解**：机器人问答很重要，但它耗 HTTP 且耗时，把它放高优先级队列会挤占登录统计；真正该隔离的是**I/O 特征**。

### 6.2 路由：显式声明，不用默认推断

```python
CELERY_ROUTES = {
    'monarch.tasks.user.auto_offline_kefu':                    {"queue": high_queue.name, ...},
    'monarch.dispatcher.tasks.worker.allocate_user_to_chat':   {"queue": high_queue.name, ...},
    'monarch.dispatcher.tasks.auto_check.company_chat_auto_check': {"queue": high_queue.name, ...},
    'monarch.tasks.robot.get_qa_task':                         {"queue": low_import_queue.name, ...},
    'monarch.tasks.company.init_company_settings':             {"queue": low_queue.name, ...},
    'monarch.tasks.chat_log.chat_log_send_es':                 {"queue": low_queue.name, ...},
    'monarch.tasks.blacklist.import_phone_blacklist':          {"queue": low_queue.name, ...},
    ...
}
```

路由表 50 行左右，把每个任务落在哪个队列写死。**这比 `task_routes` 正则更可审计**：新增任务如果忘了登记，会掉进默认队列（`low_import`），至少是「慢但安全」的一侧。

### 6.3 可靠性参数：六个必须配置的项

```python
CELERY_IGNORE_RESULT              = True          # 不要结果，省 Redis
CELERY_TASK_RESULT_EXPIRES        = 86400 * 7     # 万一要结果，留 7 天
CELERY_TRACK_STARTED              = True
CELERYD_MAX_TASKS_PER_CHILD       = 1000          # 防内存泄漏
CELERYD_TASK_SOFT_TIME_LIMIT      = 60 * 5        # 单任务软超时 5 分钟
CELERYD_PREFETCH_MULTIPLIER       = 20            # 预取，吞吐换公平
CELERY_ACCEPT_CONTENT             = ["application/json", "pickle"]
CELERY_TASK_SERIALIZER           = "pickle"
```

- **`MAX_TASKS_PER_CHILD = 1000`**：长期运行的 worker 会因 Python 内存碎片和库泄漏慢慢膨胀，定期重启子进程是标准解法。
- **`SOFT_TIME_LIMIT = 300s`**：注意这里只配了 soft limit，没有 hard limit。soft 会抛 `SoftTimeLimitExceeded` 让任务自己收尾，但如果任务阻塞在不可中断的 C 调用上，就杀不掉。**建议同时配 hard limit。**
- **`PREFETCH_MULTIPLIER = 20`**：每个 worker 预取 20 个任务，吞吐高但**长任务会饿死短任务**。调度类任务（`allocate_user_to_chat`）属于「必须低延迟」，如果和长任务混在一个 worker 里，预取就是延迟的元凶。正确做法是给高优先级队列单独起 worker 并设 `PREFETCH_MULTIPLIER = 1`。

**`pickle` 序列化**是这里最需要警惕的一项。`pickle` 能序列化任意 Python 对象，代价是**反序列化即执行代码**。只有「broker 完全内网可信、无外部写入」时才成立。一旦 Redis/RabbitMQ 暴露或被注入，就是 RCE。建议逐步迁到 `json`，把需要序列化的对象改成 dict。

### 6.4 Beat：定时任务也走队列

```python
CELERYBEAT_SCHEDULE = {
    "auto_offline_kefu":            {'task': 'monarch.tasks.user.auto_offline_kefu',        'schedule': 30 秒},
    "auto_offline_chat_user":       {'task': 'monarch.tasks.chat_user.auto_offline_chat_user', 'schedule': 30 秒},
    "company_chat_auto_check":      {'task': 'monarch.dispatcher.tasks.auto_check.company_chat_auto_check', 'schedule': 60 秒},
    "es_search_train_es":           {'task': 'monarch.tasks.es_search.train_es',            'schedule': crontab(minute=0, hour=0)},
    "auto_leave_browse_tracks":     {'task': 'monarch.tasks.browse_tracks.auto_leave_browse_tracks', 'schedule': 2 分钟},
    "save_company_referer_blance_to_db": {'task': 'monarch.tasks.company.save_company_referer_blance_to_db', 'schedule': crontab(minute=0, hour=0)},
    "wakeup_marketing_tasks":       {'task': 'monarch.tasks.marketing.wakeup_marketing_tasks', 'schedule': crontab(minute="*/1")},
    "reload_backlist_list":         {'task': 'monarch.tasks.blacklist.reload_backlist_list', 'schedule': crontab(minute=0, hour=4)},
}
```

`beat` 只负责「按时把任务丢进队列」，真正执行在 worker 里。**所以 beat 挂了不会导致「重复执行」，只会导致「漏执行」**——这比「cron 直接调脚本」安全得多。代价是 beat 是单点，必须只部署一个实例（`docker-compose` 里确实只有一个 `celery-beat`）。

## 七、部署：gunicorn + gevent + K8s 灰度

```python
# gunicorn_config.py
gevent.monkey.patch_all()
bind = "0.0.0.0:5000"
workers = 2
worker_class = 'gevent'
threads = 2
worker_connections = 2000
timeout = 60
backlog = 512
```

几个观察：

- **`gevent.monkey.patch_all()` 必须在任何 I/O 库导入前执行**，所以它写在配置文件的顶部（gunicorn 会先加载这个文件）。这是 gevent 最经典的踩坑点。
- **`workers=2`（注释里原本是 `cpu_count()*2+1`）**：在线客服是长连接 + 大量阻塞等待场景，单机进程数不是越多越好。真正的并发由 `worker_connections=2000` 提供。
- **`timeout = 60`**：gunicorn 的 worker 超时会**杀掉进程**。如果一个接口超过 60 秒（比如导出大 Excel），会被无声杀死。**导出类接口应该异步化，而不是调大 timeout。**

CI/CD 用 GitLab CI + `kubectl set image` 直接滚动更新三个 Deployment：

```yaml
build:
  script:
    - NAME=$CI_PROJECT_NAME-`date "+%Y%m%d"`-$CI_COMMIT_REF_NAME-$CI_PIPELINE_ID
    - docker build -t <REGISTRY>/<APP>:$NAME .
    - docker run -i --rm <REGISTRY>/<APP>:$NAME bash runtest.sh   # 构建后立刻跑代码检查
    - docker push <REGISTRY>/<APP>:$NAME

deploy:      only: [dev3.8.8]     # 指定分支才部署到测试环境
deploy-prod: only: ["灰测*"]       # 灰测分支部署到生产命名空间
```

**镜像 tag 里带日期、分支、流水线 ID**，好处是可以精确回滚到某一次构建；**构建完立刻 `docker run` 跑 lint**，把「镜像能跑但代码不规范」挡在推送之前。`only` 用分支名做闸门的方式很朴素，适合小团队；规模大了应改成 tag + 手动触发。

## 八、可复用的结论

1. **应用工厂要有 `_config` 注入口**，测试才能不起整套依赖。
2. **按调用方切蓝图，而不是按业务切**，鉴权与文档都省事。
3. **错误处理要覆盖 `ValueError`/`ValidationError` → 400**，别让校验失败变成 500。
4. **500 日志要带请求上下文；`TimeoutError` 要打连接池状态**——这是排查线上问题的两条命脉。
5. **请求日志结构化**（耗时 + 业务码 + 参数 + 响应），并给心跳开白名单。
6. **业务统计用信号解耦**，HTTP 层不关心统计怎么实现。
7. **Celery 按 I/O 特征分队列**（快 / 慢 / 批量），不是按业务重要性。
8. **`MAX_TASKS_PER_CHILD`、`SOFT/HARD_TIME_LIMIT`、`PREFETCH`** 是必然要配的三组参数，缺一个都会在生产上咬人。
9. **`pickle` 序列化要当成技术债登记**，能换 json 就换。
10. **日志里不要落 `form`/`json` 原文**，脱敏字段清单要提前定。

---
