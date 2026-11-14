import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, KeyboardEvent, ReactNode } from 'react'
import type { EditorCommand, EditorSelectionState } from '@/components/MarkdownEditor/commands'
import { EDITOR_COMMANDS, matchShortcut } from '@/components/MarkdownEditor/commands'
import type { TextEdit } from '@/utils/markdownEdit'
import './MarkdownEditor.css'

// 预览复用全站唯一的 Markdown 渲染出口；它体量大（remark/rehype/prism），懒加载避免拖进写作页首屏
const MarkdownView = lazy(() => import('@/components/MarkdownView'))

export interface MarkdownEditorProps {
  value: string
  onChange: (next: string) => void
  placeholder?: string
  disabled?: boolean
  /** 文本域最小高度（行数），默认 14 */
  rows?: number
  /** 是否展示实时预览；关掉则退化为纯文本框 */
  preview?: boolean
  /** Ctrl / ⌘ + Enter 的回调（提交用） */
  onSubmitShortcut?: () => void
  /** 额外命令：页面可以按需追加按钮，与内置命令共用同一套变换 */
  extraCommands?: EditorCommand[]
  /** 工具条左侧的说明文字，例如「正文（Markdown）」 */
  label?: ReactNode
}

/** 工具栏按钮的显示符号：命令表只描述行为，符号在这里映射，新增命令时在这里补一行即可 */
const GLYPHS: Partial<Record<EditorCommand['id'], ReactNode>> = {
  bold: <b>B</b>,
  italic: <i>I</i>,
  strike: <s>S</s>,
  heading: 'H2',
  code: <code>{'</>'}</code>,
  codeblock: '{ }',
  link: <span className="md-editor-glyph-link">链接</span>,
  ul: '• 列表',
  ol: '1. 列表',
  quote: '引用',
  divider: '—',
}

/**
 * 取「旧值 → 新值」真正变化的那一段。
 * 工具栏改动用它反推替换区间：只替换变化部分，才能走原生 insertText 保住撤销栈。
 */
function diffRange(before: string, after: string): { start: number; end: number; text: string } {
  let start = 0
  const max = Math.min(before.length, after.length)
  while (start < max && before[start] === after[start]) start += 1
  let tail = 0
  while (tail < max - start && before[before.length - 1 - tail] === after[after.length - 1 - tail]) tail += 1
  return {
    start,
    end: before.length - tail,
    text: after.slice(start, after.length - tail),
  }
}

export default function MarkdownEditor({
  value,
  onChange,
  placeholder = '用 Markdown 写正文，右侧会实时渲染。',
  disabled = false,
  rows = 14,
  preview = true,
  onSubmitShortcut,
  extraCommands = [],
  label,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [previewText, setPreviewText] = useState(value)
  // 窄屏默认只看编辑区，点「预览」切换；宽屏两栏同时显示（由 CSS 控制）
  const [previewFocus, setPreviewFocus] = useState(false)

  const commands = useMemo(() => [...EDITOR_COMMANDS, ...extraCommands], [extraCommands])

  // 预渲染有成本：输入停下 260ms 再渲染，键入过程不受影响
  useEffect(() => {
    const timer = window.setTimeout(() => setPreviewText(value), 260)
    return () => window.clearTimeout(timer)
  }, [value])

  /** 把变换结果写回文本域：选区代表「将被替换的旧片段」，走 insertText 保留撤销历史 */
  const applyEdit = (edit: TextEdit) => {
    const textarea = textareaRef.current
    if (!textarea) {
      onChange(edit.value)
      return
    }
    const range = diffRange(value, edit.value)
    textarea.focus()
    textarea.setSelectionRange(range.start, range.end)

    // execCommand 已废弃，但仍是唯一能并入浏览器原生撤销栈的插入方式；
    // 不支持时退回受控赋值，功能不受影响，只是这一笔无法 Ctrl+Z 撤回
    document.execCommand?.('insertText', false, range.text)
    onChange(edit.value)
    textarea.setSelectionRange(edit.start, edit.end)
  }

  const runCommand = (command: EditorCommand) => {
    if (disabled) return
    const textarea = textareaRef.current
    const state: EditorSelectionState = textarea
      ? { value, start: textarea.selectionStart, end: textarea.selectionEnd }
      : { value, start: value.length, end: value.length }
    applyEdit(command.apply(state))
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault()
      onSubmitShortcut?.()
      return
    }
    const command = matchShortcut(event, commands)
    if (command) {
      event.preventDefault()
      runCommand(command)
      return
    }
    // Tab 在正文里应当缩进而不是跳走焦点；这是写代码块的常见期待
    if (event.key === 'Tab' && !event.shiftKey) {
      event.preventDefault()
      const textarea = event.currentTarget
      applyEdit({
        value: value.slice(0, textarea.selectionStart) + '  ' + value.slice(textarea.selectionEnd),
        start: textarea.selectionStart + 2,
        end: textarea.selectionStart + 2,
      })
    }
  }

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value)
  }

  const chars = value.length

  return (
    <div className="md-editor" data-preview={previewFocus ? 'on' : 'off'}>
      {label && <span className="md-editor-label">{label}</span>}

      <div className="md-editor-toolbar" role="toolbar" aria-label="格式工具">
        {commands.map((command) => (
          <button
            key={command.id}
            type="button"
            className="md-editor-tool"
            title={command.hint}
            aria-label={command.label}
            disabled={disabled}
            // 按下时别抢走焦点：否则 textarea 里的选区在点击瞬间就丢了
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => runCommand(command)}
          >
            {GLYPHS[command.id] ?? command.label}
          </button>
        ))}

        {preview && (
          <button
            type="button"
            className="md-editor-tool md-editor-tool-preview"
            aria-pressed={previewFocus}
            onClick={() => setPreviewFocus((open) => !open)}
          >
            {previewFocus ? '编辑' : '预览'}
          </button>
        )}
      </div>

      <div className="md-editor-body">
        <textarea
          ref={textareaRef}
          className="md-editor-input"
          value={value}
          rows={rows}
          placeholder={placeholder}
          disabled={disabled}
          spellCheck={false}
          aria-label="正文（Markdown）"
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />

        {preview && (
          <div className="md-editor-preview" aria-label="预览">
            <div className="md-editor-preview-head">
              <span>预览</span>
              {value !== previewText && <span className="md-editor-preview-pending">渲染中…</span>}
            </div>
            <div className="md-editor-preview-body">
              {previewText.trim().length === 0 ? (
                <p className="md-editor-preview-empty">正文还是空的，写点什么就会出现在这里。</p>
              ) : (
                <Suspense fallback={<p className="md-editor-preview-empty">正在准备预览…</p>}>
                  <MarkdownView content={previewText} className="md-editor-markdown" />
                </Suspense>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="md-editor-foot">
        <span>{chars} 字符</span>
        <span className="md-editor-tip">
          支持 Markdown 与工具栏按钮，Ctrl/⌘ + B 加粗、+ I 斜体、+ K 链接、+ Enter 发布
        </span>
      </div>
    </div>
  )
}
