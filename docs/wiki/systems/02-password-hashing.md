
# 用 Go 复刻 Python 的密码哈希，以及一次「前端加密密码」的完整复盘

对应归档里的 `sso/`（原始实现）、`sso_pwd/`（加密分支）、`jsjsjsj/`（前端演示页）、`go_test/`（实验代码）。

## 一、为什么会出现这个需求

认证中心正在从 Python（Flask/werkzeug）迁到 Go（Gin）。用户表里的 `password` 字段存的是 werkzeug 生成的哈希：

```
pbkdf2:sha256:150000$<salt>$<hex_digest>
```

迁移最怕两件事：**存量用户登不进来**，和**迁移期间双写不一致**。所以要做的不是「重新设计密码存储」，而是**在 Go 里逐字节复刻 werkzeug 的算法**，保证同一密码在两边算出同一个摘要。

## 二、复刻 werkzeug：三段式 + 150000 轮 PBKDF2

werkzeug 的哈希格式是 `method$salt$hash`，`method` 里还带着迭代次数。Go 侧完整还原：

```go
const defaultPbkdf2Iterations = 150000

func GeneratePasswordHash(password string) (string, error) {
    salt := utils.GenerateRandomString(8)
    h, actualMethod, err := hashInternal("pbkdf2:sha256", salt, password)
    return fmt.Sprintf("%s$%s$%s", actualMethod, salt, h), err
}

func CheckPasswordHash(pwHash, password string) error {
    if strings.Count(pwHash, "$") < 2 {
        return errors.New("加密密码格式不合法")
    }
    args := strings.SplitN(pwHash, "$", 3)   // 注意：SplitN，不是 Split
    tmp, _, err := hashInternal(args[0], args[1], password)
    if err != nil {
        return errors.New("加密错误")
    }
    if args[2] != tmp {
        return errors.New("密码错误")
    }
    return nil
}

func hashInternal(method, salt, password string) (string, string, error) {
    if method == "plain" {
        return password, method, nil      // 兼容历史明文密码
    }
    if strings.HasPrefix(method, "pbkdf2:") {
        args := strings.Split(method[7:], ":")
        method = args[0]                  // sha256
        var iterations int
        var err error
        if len(args) == 1 {
            iterations = defaultPbkdf2Iterations
        } else if len(args) == 2 {
            iterations, err = strconv.Atoi(args[1])
            if err != nil || iterations <= 0 {
                iterations = defaultPbkdf2Iterations
            }
        } else {
            return "", "", errors.New("invalid number of arguments for PBKDF2")
        }
        actualMethod := fmt.Sprintf("pbkdf2:%s:%d", method, iterations)
        rv := pbkdf2.Key([]byte(password), []byte(salt), iterations, 32, sha256.New)
        return hex.EncodeToString(rv), actualMethod, nil
    }
    return "", "", errors.New("don't support other method")
}
```

几个「必须一致」的点，错一个就全盘登不进：

| 参数 | 值 | 说明 |
| --- | --- | --- |
| 哈希函数 | `sha256` | `pbkdf2.Key(..., sha256.New)` |
| 迭代次数 | `150000` | werkzeug 0.16 时代默认值 |
| 输出长度 | `32` 字节 | 转成 **小写 hex** |
| salt | 8 位随机字符串 | 存明文 salt，不参与编码 |
| 拼接格式 | `method$salt$hex` | `SplitN(hash, "$", 3)` 才能保住 salt 里可能出现的字符 |

**`strings.SplitN` 而不是 `strings.Split`** 是这个函数里最容易写错的地方——多切一刀，`args[2]` 就变成了 salt 的一部分。

两个工程细节值得记住：

1. **`actualMethod` 是写回数据库的**，不是固定字符串。这样以后把迭代次数调到 200000，老用户依然是 150000，校验时按各自记录的轮数走，天然支持「渐进升级」。
2. **`method == "plain"` 的分支是逃生门**。历史上若有明文密码，可以校验通过；正确做法是**校验成功后立刻重哈希并覆盖**（代码里没有做，属于待补）。

还有一个 Go 特有的坑，注释里已经踩到了：

```go
var err error   // 必须先声明
if len(args) == 2 {
    iterations, err = strconv.Atoi(args[1])   // 若用 := 会遮蔽外层 iterations
}
```

## 三、第二个需求：密码不要在网络上裸奔

登录接口原本是「账号 + 明文密码」走 POST。虽然传输层有 TLS，但内部提出了一个额外要求：**在没有 SSL 的环境下（内网 http、私有化部署现场）也要保证密码不以明文出现在请求体里**。

于是有了 `sso_pwd` 分支：前端用 AES 加密密码，后端解密后**照旧走 PBKDF2 校验**。注意最后半句——**哈希没有变，只是输入从明文换成了密文解出来的明文**。

### 3.1 后端：AES-128-CBC + PKCS7 + Base64

```go
const (
    // 对称加密且前端密钥加密，仅保障无ssl情况数据安全
    AesKey          = "<AES_KEY_16_BYTES>" // 对称秘钥长度 16|24|32
    BlockSize       = 16                   // 偏移量长度，取密钥前 block_size 位
)

func padding(ciphertext []byte, blockSize int) []byte {
    p := blockSize - len(ciphertext)%blockSize
    return append(ciphertext, bytes.Repeat([]byte{byte(p)}, p)...)
}

func AesDecrypt(crypted, key []byte, deferErr *error) ([]byte, error) {
    block, err := aes.NewCipher(key)
    if err != nil { return nil, err }
    defer func() {
        if err := recover(); err != nil { *deferErr = errors.New("解码错误") }
    }()
    blockMode := cipher.NewCBCDecrypter(block, key[:e.BlockSize])  // IV = key 前 16 字节
    origData := make([]byte, len(crypted))
    blockMode.CryptBlocks(origData, crypted)
    return unPadding(origData), nil
}

func DecodePassword(pwd string) (string, error) {
    raw, err := base64.StdEncoding.DecodeString(pwd)
    if err != nil { return "", err }
    ...
    return string(origin), nil
}
```

### 3.2 前端：crypto-js 对齐同一套参数

```js
var AesKey  = "<AES_KEY_16_BYTES>";
var CBCIV   = "<IV_16_BYTES>";            // 演示页里给的是另一串固定值
var CBCOptions = {
  iv: CryptoJS.enc.Utf8.parse(CBCIV),
  mode: CryptoJS.mode.CBC,
  padding: CryptoJS.pad.Pkcs7
};

function encrypt(data) {
  var key = CryptoJS.enc.Utf8.parse(AesKey);
  return CryptoJS.AES.encrypt(CryptoJS.enc.Utf8.parse(data), key, CBCOptions).toString();
}
```

`CryptoJS.AES.encrypt(...).toString()` 默认输出 **Base64**，正好对上 Go 的 `base64.StdEncoding`。这条链路能跑通的三个必要条件：**相同 key、相同 IV、相同 padding**。

### 3.3 这里有一个真实的坑：IV 到底是谁

- Go 侧：`cipher.NewCBCDecrypter(block, key[:16])` —— IV 取的是**密钥前 16 字节**。
- 前端演示页：另外定义了一个 `CBCIV` 字符串。

两者只有在「`CBCIV` 恰好等于 `AesKey` 的前 16 个字符」时才一致。**任何一次改密钥不同步改 IV，前端就会加密成功、后端解密失败，且报错是「解码错误」这种没有信息量的文案。** 这种 bug 排查起来极其费时。

正确做法：**不要从密钥里派生 IV**。IV 应该由前端每次随机生成，与密文一起传（常见做法是 `base64(iv + ciphertext)`），后端拆出来再用。CBC 模式下 IV 不是秘密，随机化才能保证同一明文每次密文不同。

### 3.4 这个方案的安全边界（必须讲清楚）

代码注释自己写得很诚实：「仅保障无 ssl 情况数据安全」。把它的能力边界摊开看：

| 威胁 | 是否防住 | 说明 |
| --- | --- | --- |
| 网络抓包看到明文密码 | ✅ | 请求体里是 Base64 密文 |
| 日志系统记下密码 | ✅（部分） | 前提是日志只记密文；本文第 9 篇会说到请求日志全量打印 json，实际可能仍会落盘 |
| 攻击者拿到前端 JS | ❌ | 密钥就在 JS 里，等于公开 |
| 重放攻击 | ❌ | 无时间戳、无 nonce，密文可原样重发 |
| 中间人篡改 | ❌ | 无完整性校验（无 HMAC/GCM） |
| 固定 IV 的密文分析 | | 同一密码密文恒定，可做相等性比对 |

**结论：它是「防肩窥级别的混淆」，不是加密。** 真正正确的解法只有一个：**全站强制 HTTPS（含内网）**；如果确实无法上 TLS，退一步也应该用「服务端下发一次性公钥 + RSA-OAEP / ECDH 交换会话密钥」，而不是把对称密钥塞进前端。

如果短期内必须保留这套 AES 方案，最小改进是三点：

1. IV 随机化并随密文传输（解决密文恒定 + IV 复用）；
2. 请求体加时间戳与随机串，服务端记录已用 nonce 做重放拦截；
3. 密钥由接口按会话下发（短时效），而不是打包进 JS。

### 3.5 兼容旧客户端怎么办

`sso_pwd` 的分支是把「解密」插在原有流程前面。上线时最稳妥的姿势是**双读**：先尝试 Base64 解码 + AES 解密，失败则按明文处理（并记录日志计数）。等旧客户端清零后再收紧为「只接受密文」。代码里直接强解，会伤到老版本 —— 这也是为什么 `go_test/main.go` 里同时在试 `AesEncrypt`/`AesDecrypt` 和 `EncodePassword` 两套：那是在做联调验证。

## 四、顺带看一个「用加密做的事，用哈希也能做」

`go_test/main.go` 里有一段实验代码，把常量 `<AES_KEY>` 当密钥加密 `<INITIAL_PASSWORD>` 再解密，还硬编码了一个 base64 密文去 `DecodeString`。这类代码通常出现在**排查「前端加密结果与后端对不上」的现场**：拿一组已知明文自己跑一遍，对比输出。

这个习惯很好。**凡是跨端加解密，先固定一组 (key, iv, plaintext, expected_ciphertext) 作为测试向量**，两端各自跑，谁错谁改。比对着线上报错猜要快十倍。

## 五、结论清单

**关于跨语言哈希兼容**

1. 兼容优先于优化：先复刻算法（sha256 / 150000 / 32 字节 / 小写 hex / `$` 三段），再考虑调强度。
2. 把「实际使用的方法」写回数据库（`pbkdf2:sha256:150000`），为渐进升级留路。
3. 用真实存量数据做回归：拿 5 个老用户的哈希跑 `CheckPasswordHash`，比写单测更有效。
4. 兼容期结束就删掉 `plain` 分支和「先比对旧算法」的临时代码。

**关于前端加密**

5. 前端持有对称密钥 = 混淆，不等于加密；能上 TLS 就不要做这套。
6. CBC 必须随机 IV，且 IV 随密文传；禁止 `IV = key[:16]`。
7. 只有密文没有 nonce/timestamp/HMAC 的方案，扛不住重放和篡改。
8. 上线用「密文优先、明文兜底」的双读，别一把切。

---
