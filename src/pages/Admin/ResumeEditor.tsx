import { useEffect, useMemo, useState } from 'react'
import Modal from '@/components/Modal'
import { errorMessage } from '@/api/errors'
import { resumeApi } from '@/api/resumes'
import type { ResumeDetail } from '@/api/resumes'
import { RESUME_HTML_MAX, RESUME_NOTE_MAX, RESUME_TITLE_MAX } from '@/constants'
import { sanitizeResumeHtml } from '@/utils/resumeHtml'
import { RESUME_TEMPLATE_HTML } from '@/utils/resumeTemplate'
import '@/styles/resume.css'

interface ResumeEditorProps {
  /** null = 新建；数字 = 编辑已有简历 */
  resumeId: number | null
  onClose: () => void
  onSaved: (resume: ResumeDetail) => void
}

/**
 * 简历编辑器：左编辑右预览。
 *
 * 正文是 HTML，但预览永远走 `sanitizeResumeHtml`：即使粘贴进来一段带脚本的网页，
 * 编辑器里也不会触发；保存时仍存原文，渲染端再洗一次。
 */
export default function ResumeEditor({ resumeId, onClose, onSaved }: ResumeEditorProps) {
  const isEdit = resumeId !== null
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [content, setContent] = useState(RESUME_TEMPLATE_HTML)
  const [loading, setLoading] = useState(isEdit)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [preview, setPreview] = useState(() => sanitizeResumeHtml(RESUME_TEMPLATE_HTML))

  useEffect(() => {
    if (resumeId === null) return
    let cancelled = false
    setLoading(true)
    resumeApi
      .get(resumeId)
      .then((resume) => {
        if (cancelled) return
        setTitle(resume.title)
        setNote(resume.note)
        setContent(resume.content_html)
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setError(errorMessage(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [resumeId])

  // 预览防抖，避免每敲一个字符就解析整段 HTML
  useEffect(() => {
    const timer = window.setTimeout(() => setPreview(sanitizeResumeHtml(content)), 250)
    return () => window.clearTimeout(timer)
  }, [content])

  const counts = useMemo(
    () => ({
      title: title.trim().length,
      note: note.length,
      html: content.length,
    }),
    [title, note, content],
  )

  const handleSave = async () => {
    setError('')
    if (!title.trim()) {
      setError('标题不能为空')
      return
    }
    if (counts.title > RESUME_TITLE_MAX) {
      setError(`标题最多 ${RESUME_TITLE_MAX} 个字符`)
      return
    }
    if (counts.note > RESUME_NOTE_MAX) {
      setError(`备注最多 ${RESUME_NOTE_MAX} 个字符`)
      return
    }
    if (!content.trim()) {
      setError('正文 HTML 不能为空')
      return
    }
    if (counts.html > RESUME_HTML_MAX) {
      setError(`正文最多 ${RESUME_HTML_MAX} 个字符`)
      return
    }

    setSaving(true)
    try {
      const payload = { title: title.trim(), note: note.trim(), content_html: content }
      const saved =
        resumeId === null
          ? await resumeApi.create(payload)
          : await resumeApi.update(resumeId, payload)
      onSaved(saved)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      title={isEdit ? '编辑简历' : '新建简历'}
      onClose={onClose}
      busy={saving}
      width={1180}
      footer={
        <>
          <span className="resume-editor-hint">
            HTML 白名单：div / section / h1–h3 / p / ul / li / span / strong / em / br / hr / a
          </span>
          <div className="modal-footer-end">
            <button type="button" className="resume-button" onClick={onClose} disabled={saving}>
              取消
            </button>
            <button
              type="button"
              className="resume-button resume-button-primary"
              onClick={() => void handleSave()}
              disabled={saving || loading}
            >
              {saving ? '保存中…' : '保存'}
            </button>
          </div>
        </>
      }
    >
      {loading ? (
        <p className="resume-editor-loading">简历加载中…</p>
      ) : (
        <div className="resume-editor">
          <div className="resume-editor-meta">
            <label className="modal-field">
              <span>
                标题 <em>必填</em>
                <small>{counts.title}/{RESUME_TITLE_MAX}</small>
              </span>
              <input
                type="text"
                value={title}
                maxLength={RESUME_TITLE_MAX}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="例如：高级 Python 工程师 · 2026"
              />
            </label>
            <label className="modal-field">
              <span>
                备注 <em>仅自己可见</em>
                <small>{counts.note}/{RESUME_NOTE_MAX}</small>
              </span>
              <input
                type="text"
                value={note}
                maxLength={RESUME_NOTE_MAX}
                onChange={(event) => setNote(event.target.value)}
                placeholder="例如：投数据平台岗，弱化 3D 经历"
              />
            </label>
          </div>

          <div className="resume-editor-layout">
            <label className="resume-editor-pane">
              <span className="resume-editor-pane-head">
                正文 HTML
                <small className={counts.html > RESUME_HTML_MAX ? 'over' : ''}>
                  {counts.html}/{RESUME_HTML_MAX}
                </small>
              </span>
              <textarea
                className="resume-editor-textarea"
                value={content}
                spellCheck={false}
                onChange={(event) => setContent(event.target.value)}
              />
            </label>
            <div className="resume-editor-pane">
              <span className="resume-editor-pane-head">渲染预览</span>
              <div className="resume-editor-preview">
                <div
                  className="profile-print-root"
                  dangerouslySetInnerHTML={{ __html: preview }}
                />
              </div>
            </div>
          </div>

          {error && <p className="admin-error">{error}</p>}
        </div>
      )}
    </Modal>
  )
}
