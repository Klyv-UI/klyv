export type TokenKind =
  | 'plain'
  | 'comment'
  | 'string'
  | 'number'
  | 'keyword'
  | 'type'
  | 'fn'
  | 'punct'

export interface Token {
  text: string
  kind: TokenKind
}

const KEYWORDS =
  'import|export|from|default|const|let|var|function|return|if|else|for|while|do|of|in|new|' +
  'type|interface|enum|extends|implements|class|async|await|try|catch|finally|throw|switch|' +
  'case|break|continue|typeof|instanceof|as|is|keyof|readonly|public|private|protected|static|' +
  'void|null|undefined|true|false|this|super|yield|satisfies|delete|infer|declare'

/**
 * One pass, ordered so the greedy things win.
 *
 * Comments and strings come first because they may contain anything at all —
 * matching a keyword inside a string is the classic way a hand-rolled
 * highlighter goes wrong. Everything the pattern does not claim falls through
 * as plain text, so no input can be dropped.
 */
const PATTERN = new RegExp(
  [
    '(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)', // 1 comment
    "('(?:\\\\.|[^'\\\\])*'|\"(?:\\\\.|[^\"\\\\])*\"|`(?:\\\\.|[^`\\\\])*`)", // 2 string
    '(\\b\\d[\\d_.]*(?:e[+-]?\\d+)?\\b)', // 3 number
    `\\b(${KEYWORDS})\\b`, // 4 keyword
    '\\b([A-Z][A-Za-z0-9_]*)\\b', // 5 type or component
    '\\b([a-z_$][\\w$]*)(?=\\s*\\()', // 6 call
    '([{}()[\\].,;:<>=+\\-*/%!?&|]+)', // 7 punctuation
  ].join('|'),
  'g',
)

const KIND_BY_GROUP: TokenKind[] = ['comment', 'string', 'number', 'keyword', 'type', 'fn', 'punct']

/**
 * A deliberately small TypeScript/TSX tokenizer.
 *
 * It exists so the library can colour code without taking on a highlighter —
 * every one of those ships a grammar engine and a colour system of its own, and
 * both are larger than this component. The trade is honest: this understands
 * lexical categories, not syntax, so it will not know that a capitalised word
 * is a component rather than a class. For reading a component's source, which
 * is all it is asked to do, that distinction does not matter.
 */
export function tokenize(code: string): Token[] {
  const tokens: Token[] = []
  let last = 0

  PATTERN.lastIndex = 0
  let match = PATTERN.exec(code)
  while (match) {
    if (match.index > last) {
      tokens.push({ text: code.slice(last, match.index), kind: 'plain' })
    }

    const groupIndex = KIND_BY_GROUP.findIndex((_, index) => match![index + 1] !== undefined)
    tokens.push({
      text: match[0],
      kind: groupIndex === -1 ? 'plain' : KIND_BY_GROUP[groupIndex],
    })

    last = match.index + match[0].length
    match = PATTERN.exec(code)
  }

  if (last < code.length) tokens.push({ text: code.slice(last), kind: 'plain' })
  return tokens
}

export const TOKEN_COLOR: Record<TokenKind, string | undefined> = {
  plain: undefined,
  comment: 'var(--syntax-comment)',
  string: 'var(--syntax-string)',
  number: 'var(--syntax-number)',
  keyword: 'var(--syntax-keyword)',
  type: 'var(--syntax-type)',
  fn: 'var(--syntax-fn)',
  punct: 'var(--syntax-punct)',
}
