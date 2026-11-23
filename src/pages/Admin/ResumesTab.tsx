import { useEffect, useState } from 'react'
import Modal from '@/components/Modal'
import ListState from '@/components/ListState'
import { useConfirm } from '@/components/ConfirmDialog/useConfirm'
import { usePagedList } from '@/hooks/usePagedList'
import { errorMessage } from '@/api/errors'
import { resumeApi } from '@/api/resumes'
import type { ResumeDetail, ResumeRow } from '@/api/resumes'
import { formatTimestamp } from '@/utils/format'
import { sanitizeResumeHtml } from '@/utils/resumeHtml'
import '@/styles/resume.css'
import ResumeEditor from './ResumeEditor'
import ShareDialog from './ShareDialog'
import Pager from './Pager'
import './ResumeAdmin.css'

/** 列表里的「预览」：只读弹窗，内容仍按白名单渲染 */
function ResumePreviewDialog({ id, onClose }: { id: number; onClose: () => void }) {
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    resumeApi
      .get(id)
      .then((resume) => {
        if (!cancelled) setHtml(sanitizeResumeHtml(resume.content_html))
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  return (
    <Modal
      title="简历预览"
      onClose={onClose}
      width={1000}
      footer={
        <div className="modal-footer-end">
          <button type="button" className="resume-button" onClick={onClose}>
            关闭
          </button>
        </div>
      }
    >
      {loading ? (
        <p className="share-empty">加载中…</p>
      ) : error ? (
        <p className="admin-error">{error}</p>
      ) : (
        <div className="resume-readonly-preview">
          <div className="profile-print-root" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      )}
    </Modal>
  )
}

export default function ResumesTab() {
  const list = usePagedList<ResumeRow>((limit, offset) => resumeApi.list(limit, offset))
  const { items, total, hasNext, pageIndex, status, error } = list
  const { confirm, dialog } = useConfirm()

  const [editor, setEditor] = useState<{ id: number | null } | null>(null)
  const [share, setShare] = useState<ResumeRow | null>(null)
  const [previewId, setPreviewId] = useState<number | null>(null)
  const [busy, setBusy] = useState<{ id: number; kind: 'copy' | 'default' | 'delete' } | null>(
    null,
  )
  const [notice, setNotice] = useState('')
  const [actionError, setActionError] = useState('')

  const afterMutation = (message: string) => {
    setNotice(message)
    setActionError('')
    list.reset()
  }

  const makeDefault = (row: ResumeRow) => {
    confirm({
      title: '设为默认简历',
      description: `确认把「${row.title}」设为 /profile 的默认简历？原默认简历会退为普通简历。`,
      confirmText: '设为默认',
      pendingText: '设置中…',
      onConfirm: async () => {
        setBusy({ id: row.id, kind: 'default' })
        try {
          await resumeApi.setDefault(row.id)
          afterMutation('默认简历已切换。')
        } catch (err) {
          setActionError(errorMessage(err))
        } finally {
          setBusy(null)
        }
      },
    })
  }

  const copyResume = async (row: ResumeRow) => {
    setBusy({ id: row.id, kind: 'copy' })
    setActionError('')
    try {
      await resumeApi.copy(row.id)
      afterMutation('已复制为新草稿（不继承默认状态）。')
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setBusy(null)
    }
  }

  const deleteResume = (row: ResumeRow) => {
    if (row.is_default) {
      setActionError('默认简历不能直接删除，先把另一份设为默认。')
      return
    }
    confirm({
      title: '删除简历',
      description: `确认删除「${row.title}」？关联的分享链接会立即失效。`,
      confirmText: '删除',
      pendingText: '删除中…',
      tone: 'danger',
      onConfirm: async () => {
        setBusy({ id: row.id, kind: 'delete' })
        try {
          await resumeApi.remove(row.id)
          setNotice('简历已删除。')
          setActionError('')
          if (items.length <= 1 && pageIndex > 0) list.goToPage(pageIndex - 1)
          else list.reset()
        } catch (err) {
          setActionError(errorMessage(err))
        } finally {
          setBusy(null)
        }
      },
    })
  }

  const onSaved = (resume: ResumeDetail) => {
    setEditor(null)
    afterMutation(`「${resume.title}」已保存。`)
  }

  return (
    <section className="resume-admin-section">
      <div className="resume-admin-head">
        <div>
          <h2 className="admin-section-title">简历列表</h2>
          <p className="admin-note">
            正文是 HTML；默认简历供 /profile 使用，分享链接有独立期限，撤销即失效。
          </p>
        </div>
        <div className="resume-admin-head-actions">
          {status === 'ready' && <span className="invite-total">共 {total ?? 0} 份</span>}
          <button
            type="button"
            className="resume-button resume-button-primary"
            onClick={() => setEditor({ id: null })}
          >
            新建简历
          </button>
        </div>
      </div>

      {notice && <p className="admin-notice">{notice}</p>}
      {actionError && <p className="admin-error">{actionError}</p>}

      <ListState
        status={status}
        error={error}
        onRetry={list.retry}
        count={items.length}
        className="admin-card invite-empty"
        emptyText="还没有简历，从右上角新建一份。"
      />

      {status === 'ready' && items.length > 0 && (
        <ul className="resume-list">
          {items.map((row) => (
            <li key={row.id} className="resume-card">
              <div className="resume-card-head">
                <div className="resume-card-title">
                  <h3>{row.title}</h3>
                  {row.is_default && <span className="resume-badge">默认</span>}
                </div>
                <span className="resume-card-id">#{row.id}</span>
              </div>
              <p className={row.note ? 'resume-card-note' : 'resume-card-note empty'}>
                {row.note || '未填备注'}
              </p>
              <div className="resume-card-meta">
                <span>创建：{formatTimestamp(row.created_at)}</span>
                <span>更新：{formatTimestamp(row.updated_at)}</span>
              </div>
              <div className="resume-card-actions">
                <button
                  type="button"
                  className="resume-action"
                  onClick={() => setPreviewId(row.id)}
                >
                  预览
                </button>
                <button
                  type="button"
                  className="resume-action"
                  onClick={() => setEditor({ id: row.id })}
                >
                  编辑
                </button>
                <button
                  type="button"
                  className="resume-action"
                  disabled={busy?.id === row.id}
                  onClick={() => void copyResume(row)}
                >
                  {busy?.id === row.id && busy.kind === 'copy' ? '复制中…' : '复制'}
                </button>
                {!row.is_default && (
                  <button
                    type="button"
                    className="resume-action"
                    disabled={busy?.id === row.id}
                    onClick={() => makeDefault(row)}
                  >
                    {busy?.id === row.id && busy.kind === 'default' ? '设置中…' : '设为默认'}
                  </button>
                )}
                <button
                  type="button"
                  className="resume-action"
                  onClick={() => setShare(row)}
                >
                  分享
                </button>
                <button
                  type="button"
                  className="resume-action resume-action-danger"
                  disabled={busy?.id === row.id || row.is_default}
                  title={row.is_default ? '默认简历不能删除' : undefined}
                  onClick={() => deleteResume(row)}
                >
                  {busy?.id === row.id && busy.kind === 'delete' ? '删除中…' : '删除'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {status === 'ready' && (
        <Pager pageIndex={pageIndex} hasNext={hasNext} onPage={list.goToPage} className="admin-pager" />
      )}

      {editor && (
        <ResumeEditor resumeId={editor.id} onClose={() => setEditor(null)} onSaved={onSaved} />
      )}
      {share && (
        <ShareDialog
          resumeId={share.id}
          title={share.title}
          onClose={() => setShare(null)}
          onChanged={() => list.reload()}
        />
      )}
      {previewId !== null && (
        <ResumePreviewDialog id={previewId} onClose={() => setPreviewId(null)} />
      )}
      {dialog}
    </section>
  )
}
