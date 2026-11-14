/**
 * 写作工具栏的命令表。
 *
 * 这里只声明「命令是什么 + 怎么变换文本」，图标与渲染留给组件——
 * 新增一个按钮 = 在数组里加一项，组件和快捷键自动认得它（可插拔）。
 */
import type { TextEdit } from '@/utils/markdownEdit'
import { applyLink, insertBlock, toggleLinePrefix, wrapSelection } from '@/utils/markdownEdit'

export type CommandId =
  | 'bold'
  | 'italic'
  | 'strike'
  | 'heading'
  | 'code'
  | 'codeblock'
  | 'link'
  | 'ul'
  | 'ol'
  | 'quote'
  | 'divider'

export interface EditorSelectionState {
  value: string
  start: number
  end: number
}

export interface EditorCommand {
  id: CommandId
  /** 按钮上显示的文字（图标在组件里映射） */
  label: string
  /** tooltip：说明插入什么、快捷键是什么 */
  hint: string
  /** 快捷键描述，用于提示；实际匹配在 matchShortcut 里 */
  shortcut?: string
  apply: (state: EditorSelectionState) => TextEdit
}

export const EDITOR_COMMANDS: EditorCommand[] = [
    {
    id: 'bold',
    label: '粗体',
    hint: '加粗选中文本（Ctrl+B）',
    shortcut: 'Ctrl+B',
    apply: ({ value, start, end }) => wrapSelection(value, start, end, '**', '**', '粗体文字'),
  },
  {
    id: 'italic',
    label: '斜体',
    hint: '倾斜选中文本（Ctrl+I）',
    shortcut: 'Ctrl+I',
    apply: ({ value, start, end }) => wrapSelection(value, start, end, '*', '*', '斜体文字'),
  },
  {
    id: 'strike',
    label: '删除线',
    hint: '删除线（~~文字~~）',
    apply: ({ value, start, end }) => wrapSelection(value, start, end, '~~', '~~', '删除线文字'),
  },
  {
    id: 'heading',
    label: '小标题',
    hint: '把当前行变成二级标题',
    apply: ({ value, start, end }) => toggleLinePrefix(value, start, end, '## '),
  },
  {
    id: 'code',
    label: '行内代码',
    hint: '行内代码（`code`）',
    apply: ({ value, start, end }) => wrapSelection(value, start, end, '`', '`', 'code'),
  },
  {
    id: 'codeblock',
    label: '代码块',
    hint: '插入三反引号代码块',
    apply: ({ value, start, end }) => insertBlock(value, start, end, '```\n\n```', 4),
  },
  {
    id: 'link',
    label: '链接',
    hint: '插入链接，选中文字时作为链接标题（Ctrl+K）',
    shortcut: 'Ctrl+K',
    apply: ({ value, start, end }) => applyLink(value, start, end),
  },
  {
    id: 'ul',
    label: '无序列表',
    hint: '把每行变成「- 」列表项',
    apply: ({ value, start, end }) => toggleLinePrefix(value, start, end, '- '),
  },
  {
    id: 'ol',
    label: '有序列表',
    hint: '把每行变成 1. 2. 3. 列表项',
    apply: ({ value, start, end }) => toggleLinePrefix(value, start, end, '', { numbered: true }),
  },
  {
    id: 'quote',
    label: '引用',
    hint: '把每行变成「> 」引用',
    apply: ({ value, start, end }) => toggleLinePrefix(value, start, end, '> '),
  },
  {
    id: 'divider',
    label: '分割线',
    hint: '插入一条分割线',
    apply: ({ value, start, end }) => insertBlock(value, start, end, '---'),
  },
]

/** 快捷键 → 命令：只认 Ctrl/⌘ + 单键，避免和浏览器自带组合冲突 */
export function matchShortcut(
  event: { key: string; ctrlKey: boolean; metaKey: boolean; altKey: boolean },
  commands: EditorCommand[] = EDITOR_COMMANDS,
): EditorCommand | undefined {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return undefined
  const key = event.key.toLowerCase()
  const byKey: Record<string, CommandId> = { b: 'bold', i: 'italic', k: 'link' }
  const id = byKey[key]
  if (!id) return undefined
  return commands.find((command) => command.id === id)
}
