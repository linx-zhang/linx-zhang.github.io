import { useEffect, useState } from 'react'
import Modal from '@/components/Modal'
import Select from '@/components/Select'
import { errorMessage } from '@/api/errors'
import { resumeApi, resumeShareUrl } from '@/api/resumes'
import type { ResumeShare } from '@/api/resumes'
import { formatTimestamp } from '@/utils/format'
import { copyText } from '@/utils/clipboard'

interface ShareDialogProps {
  resumeId: number
  title: string
  onClose: () => void
  onChanged: () => void
}

const EXPIRY_OPTIONS = [
  { value: '60', label: '1 小时' },
  { value: '1440', label: '24 小时' },
  { value: '10080', label: '7 天' },
  { value: '43200', label: '30 天' },
]

/**
 * 分享弹窗：签发的是「有期限的短码」，不是简历快照。
 * 改简历后同一链接会看到最新内容；撤销或到期后链接立即失效。
 */
export default function ShareDialog({ resumeId, title, onClose, onChanged }: ShareDialogProps) {
  const [expiry, setExpiry] = useState('1440')
  const [shares, setShares] = useState<ResumeShare[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState<string | null>(null)

  const loadShares = () => {
    setLoading(true)
    resumeApi
      .listShares(resumeId)
      .then(setShares)
      .catch((err: unknown) => setError(errorMessage(err)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadShares()
    // 只在打开时按 resumeId 取一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumeId])

  const handleCreate = async () => {
    setError('')
    setNotice('')
    setCreating(true)
    try {
      const created = await resumeApi.createShare(resumeId, Number(expiry))
      setShares((list) => [created, ...list])
      setCopied(null)
      const ok = await copyText(resumeShareUrl(created.code))
      setNotice(ok ? '已签发分享链接并复制到剪贴板。' : '已签发分享链接。')
      onChanged()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = async (code: string) => {
    setError('')
    const ok = await copyText(resumeShareUrl(code))
    if (ok) setCopied(code)
    else setError('复制失败，请手动选中链接复制。')
  }

  const handleRevoke = async (code: string) => {
    setError('')
    setNotice('')
    setRevoking(code)
    try {
      await resumeApi.revokeShare(code)
      setShares((list) => list.filter((item) => item.code !== code))
      setNotice('分享链接已撤销。')
      onChanged()
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setRevoking(null)
    }
  }

  return (
    <Modal
      title={`分享简历 · ${title}`}
      onClose={onClose}
      busy={creating}
      width={620}
      footer={
        <div className="modal-footer-end">
          <button type="button" className="resume-button" onClick={onClose}>
            关闭
          </button>
        </div>
      }
    >
      <div className="share-dialog">
        <div className="share-create">
          <label className="modal-field">
            <span>有效期</span>
            <Select
              value={expiry}
              onChange={setExpiry}
              ariaLabel="分享链接有效期"
              options={EXPIRY_OPTIONS}
            />
          </label>
          <button
            type="button"
            className="resume-button resume-button-primary"
            onClick={() => void handleCreate()}
            disabled={creating}
          >
            {creating ? '签发中…' : '生成分享链接'}
          </button>
        </div>

        {notice && <p className="admin-notice">{notice}</p>}
        {error && <p className="admin-error">{error}</p>}

        <div className="share-list-head">
          <h3>有效链接</h3>
          <span>{shares.length} 条</span>
        </div>

        {loading ? (
          <p className="share-empty">加载中…</p>
        ) : shares.length === 0 ? (
          <p className="share-empty">还没有有效分享链接，使用上方按钮生成。</p>
        ) : (
          <ul className="share-list">
            {shares.map((share) => (
              <li key={share.code} className="share-item">
                <div className="share-item-main">
                  <code className="share-code">{resumeShareUrl(share.code)}</code>
                  <button
                    type="button"
                    className="resume-action"
                    onClick={() => void handleCopy(share.code)}
                  >
                    {copied === share.code ? '已复制' : '复制'}
                  </button>
                  <button
                    type="button"
                    className="resume-action resume-action-danger"
                    disabled={revoking === share.code}
                    onClick={() => void handleRevoke(share.code)}
                  >
                    {revoking === share.code ? '撤销中…' : '撤销'}
                  </button>
                </div>
                <div className="share-item-meta">
                  <span>到期：{formatTimestamp(share.expires_at)}</span>
                  <span>创建：{formatTimestamp(share.created_at)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}
