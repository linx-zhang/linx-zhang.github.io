import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { clipApi } from '@/api/clips'
import type { ClipShare } from '@/api/clips'
import { ApiError } from '@/api/client'
import { errorMessage } from '@/api/errors'
import { useAuth } from '@/auth/AuthProvider'
import { useCopy } from '@/hooks/useCopy'
import { formatTimestamp } from '@/utils/format'

const BODY_MAX = 20_000
const TITLE_MAX = 80

/** 分享链接就是当前站点上的这个路径，复制给谁都能在浏览器打开 */
function shareUrl(code: string): string {
  return `${window.location.origin}/tools/clip/${code}`
}

function CopyButton({
  label,
  copiedLabel,
  copied,
  onClick,
  primary = false,
}: {
  label: string
  copiedLabel: string
  copied: boolean
  onClick: () => void
  primary?: boolean
}) {
  const base = primary ? 'tool-button tool-button-primary' : 'tool-button'
  return (
    <button type="button" className={copied ? `${base} is-copied` : base} onClick={onClick}>
      {copied ? copiedLabel : label}
    </button>
  )
}

/** 链接条：生成成功后和「返回编辑」时都要用它，链接、复制、撤销只写一处 */
function LinkBar({
  share,
  copied,
  onCopy,
  revoking,
  onRevoke,
}: {
  share: ClipShare
  copied: boolean
  onCopy: () => void
  revoking: boolean
  onRevoke: () => void
}) {
  const url = shareUrl(share.code)
  return (
    <div className="tool-bar">
      <input className="tool-input" value={url} readOnly onFocus={(event) => event.target.select()} />
      <CopyButton label="复制链接" copiedLabel="已复制" copied={copied} onClick={onCopy} primary />
      <button
        type="button"
        className="tool-button tool-copy"
        onClick={onRevoke}
        disabled={revoking}
      >
        {revoking ? '撤销中…' : '撤销这条链接'}
      </button>
    </div>
  )
}

/** 阅读态：别人拿到链接看到的就是这一屏，只有内容和几个时间 */
function ClipView({ code }: { code: string }) {
  const [clip, setClip] = useState<ClipShare | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [error, setError] = useState('')
  const [rateLimited, setRateLimited] = useState(false)
  const { isCopied, copy } = useCopy()

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    clipApi
      .read(code)
      .then((next) => {
        if (cancelled) return
        setClip(next)
        setStatus('ready')
      })
      .catch((err) => {
        if (cancelled) return
        // 404 是「没有这段内容」这一业务结果，429 是读得太频繁；后端 detail 是英文，这里换成可直接读的说明
        const status = err instanceof ApiError ? err.status : 0
        setRateLimited(status === 429)
        setError(
          status === 404
            ? '这条链接不存在，或者已经过期了。'
            : status === 429
              ? '打开得太频繁了，等一分钟再刷新试试。'
              : errorMessage(err),
        )
        setStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [code])

  if (status === 'loading') return <div className="tools-state">加载中…</div>

  if (status === 'error' || !clip) {
    return (
      <div className="tool">
        <p className="tool-empty">
          {error || '这段内容不存在或已经过期。'}
          {!rateLimited && (
            <>
              <br />
              共享链接的有效期是 24 小时，过期后无法找回。
            </>
          )}
        </p>
        <div className="tool-bar">
          <Link to="/tools/clip" className="tool-button">
            去分享一段日志
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="tool">
      <div className="tool-bar">
        <span className="tool-inline">
          创建于 {formatTimestamp(clip.created_at)} · 有效期至 {formatTimestamp(clip.expires_at)}
        </span>
        <Link to="/tools/clip" className="tool-button">
          分享新内容
        </Link>
        <CopyButton
          label="复制全文"
          copiedLabel="已复制"
          copied={isCopied()}
          onClick={() => void copy(clip.body)}
        />
      </div>

      {clip.title && <h2 className="clip-title">{clip.title}</h2>}

      <div className="tool-pane">
        <div className="tool-pane-head">
          <span>内容</span>
          <span className="tool-meta">{clip.body.length} 字符</span>
        </div>
        <div className="tool-code-scroll clip-scroll">
          <pre className="tool-code">{clip.body}</pre>
        </div>
      </div>

      <p className="tool-note">
        任何拿到这个链接的人都能看到上面的内容，24 小时后自动失效。
      </p>
    </div>
  )
}

/** 编辑态：粘贴内容 → 生成链接；登录是为了知道这条链接属于谁 */
function ClipComposer() {
  const { user, ready, openLogin } = useAuth()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<ClipShare | null>(null)
  const [revoking, setRevoking] = useState(false)
  // 生成成功后可以「再分享一条」回到编辑区；上一条链接保持有效并常驻在上方
  const [editing, setEditing] = useState(false)
  const { isCopied, copy } = useCopy()

  const stats = useMemo(
    () => `${body.length} / ${BODY_MAX} 字符 · ${body.split('\n').length} 行`,
    [body],
  )

  const create = async () => {
    setError('')
    if (!body.trim()) {
      setError('先贴一段要分享的内容')
      return
    }
    setCreating(true)
    try {
      const share = await clipApi.create({ title: title.trim(), body })
      setCreated(share)
      setEditing(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  const revoke = async () => {
    if (!created) return
    setError('')
    setRevoking(true)
    try {
      await clipApi.revoke(created.code)
      // 内容留在编辑区，想再生成一条时不用重新粘贴
      setCreated(null)
      setEditing(false)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setRevoking(false)
    }
  }

  if (!ready) return <div className="tools-state">加载中…</div>

  if (!user) {
    return (
      <div className="tool">
        <div className="tool-block">
          <div className="tool-block-head">
            <h2>登录后才能生成链接</h2>
            <p>
              内容是存到后端的，链接 24 小时后自动失效。登录只是为了让这条链接有主人，方便自己撤销；看到内容的人不需要账号。
            </p>
          </div>
          <div className="tool-bar">
            <button type="button" className="tool-button tool-button-primary" onClick={() => openLogin()}>
              登录
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (created && !editing) {
    return (
      <div className="tool">
        <div className="tool-block">
          <div className="tool-block-head">
            <h2>链接已生成</h2>
            <p>
              {`24 小时内有效，到期时间 ${formatTimestamp(created.expires_at)}。谁拿到链接都能看，不需要登录；随时可以在下面撤销。`}
            </p>
          </div>
          <LinkBar
            share={created}
            copied={isCopied()}
            onCopy={() => void copy(shareUrl(created.code))}
            revoking={revoking}
            onRevoke={revoke}
          />
          <div className="tool-bar">
            <span className="tool-inline">
              {created.title || '未命名'} · {created.body.length} 字符
            </span>
            <button type="button" className="tool-button" onClick={() => setEditing(true)}>
              再分享一条
            </button>
          </div>
          {error && <p className="tool-error">{error}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="tool">
      {/* 回到编辑区后，上一条链接仍然有效：留一条常驻入口，不用为了改内容先撤销 */}
      {created && (
        <div className="tool-block">
          <div className="tool-block-head">
            <h2>上一条链接仍然有效</h2>
            <p>继续编辑或再生成一条都不会影响它；想让它立刻失效就点撤销。</p>
          </div>
          <LinkBar
            share={created}
            copied={isCopied()}
            onCopy={() => void copy(shareUrl(created.code))}
            revoking={revoking}
            onRevoke={revoke}
          />
        </div>
      )}

      <div className="tool-bar">
        <input
          className="tool-input"
          value={title}
          maxLength={TITLE_MAX}
          placeholder="标题（可选，例如「11-13 网关日志」）"
          onChange={(event) => setTitle(event.target.value)}
        />
        <button
          type="button"
          className="tool-button tool-button-primary"
          onClick={create}
          disabled={creating}
        >
          {creating ? '生成中…' : '生成分享链接'}
        </button>
      </div>

      {error && <p className="tool-error">{error}</p>}

      <div className="tool-pane">
        <div className="tool-pane-head">
          <span>要分享的日志 / 文本</span>
          <span className="tool-meta">{stats}</span>
        </div>
        <textarea
          className="tool-editor"
          value={body}
          spellCheck={false}
          maxLength={BODY_MAX}
          placeholder="把日志粘在这里，生成一条 24 小时内可读的短链。"
          onChange={(event) => setBody(event.target.value)}
        />
      </div>

      <p className="tool-note">
        内容会原样保存，包含缩进与换行；请先确认里面没有密钥、密码这类不该外传的东西。
      </p>
    </div>
  )
}

export default function ClipTool({ code }: { code?: string }) {
  return code ? <ClipView code={code} /> : <ClipComposer />
}
