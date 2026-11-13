import { useState } from 'react'

interface JsonTreeProps {
  value: unknown
  /** 全部展开（false）还是全部折叠（true）；切换时父组件换 key 重挂 */
  defaultCollapsed: boolean
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isBranch = (value: unknown): value is Record<string, unknown> | unknown[] =>
  Array.isArray(value) || isObject(value)

function hint(value: unknown): string {
  if (Array.isArray(value)) return `${value.length} 项`
  return `${Object.keys(value as object).length} 个键`
}

function Primitive({ item }: { item: unknown }) {
  if (typeof item === 'string') return <span className="json-string">"{item}"</span>
  if (typeof item === 'number') return <span className="json-number">{String(item)}</span>
  if (typeof item === 'boolean') return <span className="json-bool">{String(item)}</span>
  return <span className="json-null">null</span>
}

export default function JsonTree({ value, defaultCollapsed }: JsonTreeProps) {
  const [overrides, setOverrides] = useState<Record<string, boolean>>({})

  const isOpen = (path: string) => {
    const override = overrides[path]
    return override === undefined ? !defaultCollapsed : override
  }

  const toggle = (path: string) => setOverrides((prev) => ({ ...prev, [path]: !isOpen(path) }))

  /** prefix 是父级给的 `"key":` 或数组下标；tail 是行尾逗号 */
  const renderNode = (
    item: unknown,
    path: string,
    depth: number,
    prefix: string,
    tail: string,
    prefixIsIndex = false,
  ) => {
    const prefixNode = prefix ? (
      <span className={prefixIsIndex ? 'json-index' : 'json-key'}>{prefix}</span>
    ) : null

    if (!isBranch(item)) {
      return (
        <div className="json-row" style={{ paddingLeft: depth * 14 }}>
          {prefixNode}
          <Primitive item={item} />
          <span className="json-tail">{tail}</span>
        </div>
      )
    }

    const entries: [string, unknown][] = Array.isArray(item)
      ? item.map((entry, index) => [String(index), entry])
      : Object.entries(item)
    const open = isOpen(path)
    const isArray = Array.isArray(item)
    const [openBracket, closeBracket] = isArray ? ['[', ']'] : ['{', '}']

    if (entries.length === 0) {
      return (
        <div className="json-row" style={{ paddingLeft: depth * 14 }}>
          {prefixNode}
          <span className="json-bracket">
            {openBracket}
            {closeBracket}
          </span>
          <span className="json-tail">{tail}</span>
        </div>
      )
    }

    return (
      <>
        <div className="json-row" style={{ paddingLeft: depth * 14 }}>
          <button
            type="button"
            className="json-arrow"
            aria-expanded={open}
            aria-label={open ? '折叠' : '展开'}
            onClick={() => toggle(path)}
          >
            {open ? '▾' : '▸'}
          </button>
          {prefixNode}
          <span className="json-bracket">{openBracket}</span>
          {!open && (
            <>
              <span className="json-hint">… {hint(item)}</span>
              <span className="json-bracket">{closeBracket}</span>
              <span className="json-tail">{tail}</span>
            </>
          )}
        </div>

        {open &&
          entries.map(([key, entry], index) => {
            const last = index === entries.length - 1
            const childPath = `${path}|${key}`
            return (
              <div key={childPath} className="json-node">
                {renderNode(
                  entry,
                  childPath,
                  depth + 1,
                  isArray ? key : `"${key}":`,
                  last ? '' : ',',
                  isArray,
                )}
              </div>
            )
          })}

        {open && (
          <div className="json-row" style={{ paddingLeft: depth * 14 }}>
            <span className="json-bracket">{closeBracket}</span>
            <span className="json-tail">{tail}</span>
          </div>
        )}
      </>
    )
  }

  return <div className="json-tree">{renderNode(value, '$', 0, '', '')}</div>
}
