/**
 * 只做 Base64URL 解码与字段展示，不校验签名；alg:none 会单独标红提醒。
 */
import { useMemo, useState } from 'react'
import { useCopy } from '@/hooks/useCopy'
import {
  JWT_SAMPLE,
  claimRows,
  claimTimes,
  cleanToken,
  decodeJwt,
  formatClaim,
  formatLocalTime,
  prettyJson,
  remainingText,
} from './jwt'
import type { JwtParts } from './jwt'
import './JwtTool.css'

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}

export default function JwtTool() {
  const [token, setToken] = useState('')
  const { copy, isCopied } = useCopy()

  const state = useMemo<{ parts: JwtParts | null; error: string }>(() => {
    if (!cleanToken(token)) return { parts: null, error: '' }
    try {
      return { parts: decodeJwt(token), error: '' }
    } catch (err) {
      return { parts: null, error: err instanceof Error ? err.message : String(err) }
    }
  }, [token])

  const parts = state.parts
  const times = parts ? claimTimes(parts.payload) : null
  const header = parts ? objectValue(parts.header) : {}
  const claims = parts ? claimRows(parts.payload) : []
  const payloadObject = parts ? objectValue(parts.payload) : {}
  const otherClaims = parts
    ? Object.keys(payloadObject).filter(
        (key) => !['iss', 'sub', 'aud', 'iat', 'nbf', 'exp', 'jti'].includes(key),
      )
    : []

  return (
    <div className="tool tool-stack">
      <section className="tool-block">
        <div className="tool-block-head">
          <h2>JWT</h2>
          <p>
            只做 Base64URL 解码和字段展示，不校验签名、不发请求。签名是否正确要让服务端验证，这里不能替代。
          </p>
        </div>

        <textarea
          className="tool-editor jwt-token"
          value={token}
          spellCheck={false}
          aria-label="JWT"
          placeholder="粘贴 JWT，或从 Authorization: Bearer 后面整段复制过来"
          onChange={(event) => setToken(event.target.value)}
        />

        <div className="tool-bar">
          <button type="button" className="tool-button" onClick={() => setToken(JWT_SAMPLE)}>
            填入示例
          </button>
          <button type="button" className="tool-button" onClick={() => setToken('')}>
            清空
          </button>
          {token && (
            <span className="tool-meta">
              {cleanToken(token).length} 字符 · {cleanToken(token).split('.').length} 段
            </span>
          )}
        </div>
      </section>

      {state.error && <p className="tool-error">{state.error}</p>}

      {parts && times && (
        <>
          <section className="tool-block">
            <div className="tool-block-head jwt-summary-head">
              <div>
                <h2>令牌概览</h2>
                <p>头部和载荷都是明文可读的，不要把密码、密钥之类的敏感信息放进 JWT。</p>
              </div>
              <div className="jwt-badges">
                {typeof header.alg === 'string' && <span className="jwt-badge">alg {header.alg}</span>}
                {typeof header.typ === 'string' && <span className="jwt-badge">{header.typ}</span>}
                {times.expiresAt && (
                  <span className={times.expired ? 'jwt-badge is-danger' : 'jwt-badge is-ok'}>
                    {times.expired ? '已过期' : '未过期'}
                  </span>
                )}
                {times.notYetValid && <span className="jwt-badge is-warn">尚未生效</span>}
              </div>
            </div>

            {times.expiresAt && (
              <div className={times.expired ? 'jwt-expiry is-danger' : 'jwt-expiry'}>
                <strong>{remainingText(times.remainingMs)}</strong>
                <span>exp：{formatLocalTime(times.expiresAt)}（本机时区）</span>
              </div>
            )}

            {header.alg === 'none' && (
              <p className="tool-error">
                这个令牌声明 alg 为 none，意味着没有签名；任何需要鉴权的服务端都不应该接受这种令牌。
              </p>
            )}

            {claims.length > 0 ? (
              <dl className="jwt-claims">
                {claims.map((claim) => (
                  <div key={claim.key} className="jwt-claim">
                    <dt>{claim.label}</dt>
                    <dd>
                      {claim.time ? (
                        <span>
                          <code>{claim.value}</code>
                          {' · '}
                          {formatLocalTime(secondsToDate(payloadObject[claim.key]))}
                        </span>
                      ) : (
                        claim.value
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="tool-note">载荷里没有 iss / sub / aud / iat / nbf / exp / jti 这些标准字段。</p>
            )}

            {otherClaims.length > 0 && (
              <p className="tool-note">
                另有自定义字段：{otherClaims.map((key) => `${key}=${formatClaim(payloadObject[key])}`).join('，')}
              </p>
            )}
          </section>

          <div className="jwt-pane-grid">
            <section className="tool-block">
              <div className="tool-block-head jwt-json-head">
                <h2>Header</h2>
                <button
                  type="button"
                  className={isCopied('jwt-header') ? 'tool-mini is-copied' : 'tool-mini'}
                  onClick={() => void copy(prettyJson(parts.header), 'jwt-header')}
                >
                  {isCopied('jwt-header') ? '已复制' : '复制'}
                </button>
              </div>
              <pre className="jwt-json">{prettyJson(parts.header)}</pre>
            </section>

            <section className="tool-block">
              <div className="tool-block-head jwt-json-head">
                <h2>Payload</h2>
                <button
                  type="button"
                  className={isCopied('jwt-payload') ? 'tool-mini is-copied' : 'tool-mini'}
                  onClick={() => void copy(prettyJson(parts.payload), 'jwt-payload')}
                >
                  {isCopied('jwt-payload') ? '已复制' : '复制'}
                </button>
              </div>
              <pre className="jwt-json">{prettyJson(parts.payload)}</pre>
            </section>
          </div>

          <section className="tool-block">
            <div className="tool-block-head">
              <h2>Signature</h2>
              <p>签名段按 Base64URL 原样展示，不在这里做 HMAC / RSA / ECDSA 校验。</p>
            </div>
            <code className="jwt-signature">{parts.signature || '（空签名）'}</code>
            <p className="tool-note">
              签名长度 {parts.signature.length} 字符。真正校验需要服务端持有公钥或共享密钥，浏览器里只验证签名没有意义。
            </p>
          </section>
        </>
      )}
    </div>
  )
}

function secondsToDate(value: unknown): Date | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? new Date(value * 1000) : undefined
}
