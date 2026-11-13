/* SQL 语法着色：按顺序切 token，字符串/注释优先，避免里面的关键字被误伤 */

export type SqlToken = { text: string; cls: string }

const KEYWORDS = [
  'SELECT','FROM','WHERE','JOIN','LEFT','RIGHT','INNER','OUTER','FULL','CROSS','ON','USING',
  'GROUP','BY','ORDER','ASC','DESC','LIMIT','OFFSET','HAVING','UNION','ALL','DISTINCT','AS',
  'AND','OR','NOT','NULL','IS','IN','EXISTS','BETWEEN','LIKE','ILIKE','CASE','WHEN','THEN',
  'ELSE','END','INSERT','INTO','VALUES','UPDATE','SET','DELETE','CREATE','TABLE','VIEW','INDEX',
  'ALTER','DROP','PRIMARY','KEY','FOREIGN','REFERENCES','DEFAULT','CONSTRAINT','UNIQUE','WITH',
  'RECURSIVE','RETURNING','OVER','PARTITION','WINDOW','ROWS','RANGE','PRECEDING','FOLLOWING',
  'CURRENT','ROW','TRUE','FALSE','CAST','INTERVAL','EXCEPT','INTERSECT','LATERAL','TOP','FETCH',
  'NEXT','ONLY','IF','BEGIN','COMMIT','ROLLBACK','GRANT','REVOKE','TRUNCATE','EXPLAIN','ANALYZE',
  'VACUUM','VARCHAR','INT','INTEGER','BIGINT','SMALLINT','TEXT','TIMESTAMP','DATE','BOOLEAN','DECIMAL',
  'NUMERIC','JSON','JSONB','UUID','SERIAL','CHAR','DOUBLE','FLOAT','REAL',
]

const KEYWORD_SET = new Set(KEYWORDS)

/** 常见函数名单独上一档颜色，让 SQL 的“骨架”和“零件”分得开 */
const FUNCTIONS = [
  'COUNT','SUM','AVG','MIN','MAX','COALESCE','NULLIF','GREATEST','LEAST','NOW','DATE_TRUNC',
  'ROW_NUMBER','RANK','DENSE_RANK','LAG','LEAD','FIRST_VALUE','LAST_VALUE','JSON_EXTRACT',
  'JSON_UNQUOTE','GROUP_CONCAT','STRING_AGG','ARRAY_AGG','UNNEST','LOWER','UPPER','TRIM','REPLACE',
  'SUBSTRING','SUBSTR','LEFT_STRIP','LENGTH','ROUND','FLOOR','CEIL','ABS','CONCAT',
]

const FUNCTION_SET = new Set(FUNCTIONS)

const isWordStart = (ch: string) => /[A-Za-z_@#]/.test(ch)
const isWord = (ch: string) => /[A-Za-z0-9_$@#]/.test(ch)

export function tokenizeSql(source: string): SqlToken[] {
  const tokens: SqlToken[] = []
  let i = 0
  const push = (text: string, cls = '') => {
    if (text) tokens.push({ text, cls })
  }

  while (i < source.length) {
    const ch = source[i]

    // -- 行注释
    if (ch === '-' && source[i + 1] === '-') {
      let end = source.indexOf('\n', i)
      if (end === -1) end = source.length
      push(source.slice(i, end), 'sql-comment')
      i = end
      continue
    }

    // /* 块注释 */
    if (ch === '/' && source[i + 1] === '*') {
      let end = source.indexOf('*/', i + 2)
      end = end === -1 ? source.length : end + 2
      push(source.slice(i, end), 'sql-comment')
      i = end
      continue
    }

    // 单引号字符串，'' 是转义
    if (ch === "'") {
      let j = i + 1
      while (j < source.length) {
        if (source[j] === "'" && source[j + 1] === "'") {
          j += 2
          continue
        }
        if (source[j] === "'") {
          j += 1
          break
        }
        j += 1
      }
      push(source.slice(i, j), 'sql-string')
      i = j
      continue
    }

    // "..." / `...` 标识符
    if (ch === '"' || ch === '`') {
      const quote = ch
      let j = i + 1
      while (j < source.length && source[j] !== quote) j += 1
      j = Math.min(j + 1, source.length)
      push(source.slice(i, j), 'sql-quoted')
      i = j
      continue
    }

    // 数字
    if (/[0-9]/.test(ch)) {
      let j = i
      while (j < source.length && /[0-9._]/.test(source[j])) j += 1
      push(source.slice(i, j), 'sql-number')
      i = j
      continue
    }

    // 单词：关键字 / 函数 / 普通标识符
    if (isWordStart(ch)) {
      let j = i
      while (j < source.length && isWord(source[j])) j += 1
      const word = source.slice(i, j)
      const upper = word.toUpperCase()
      let cls = ''
      if (KEYWORD_SET.has(upper)) cls = 'sql-keyword'
      else if (FUNCTION_SET.has(upper)) cls = 'sql-function'
      else {
        // 后面紧跟括号的也按函数处理，兜住没列进名单的函数
        let k = j
        while (k < source.length && source[k] === ' ') k += 1
        if (source[k] === '(') cls = 'sql-function'
      }
      push(word, cls)
      i = j
      continue
    }

    // 标点与运算符
    if (/[(),;.*+\-<>=!|/:%~&^]/.test(ch)) {
      push(ch, 'sql-punct')
      i += 1
      continue
    }

    push(ch)
    i += 1
  }

  return tokens
}
