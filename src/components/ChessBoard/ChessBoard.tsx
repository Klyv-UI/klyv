'use client'

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { IconButton } from '../IconButton'
import { Input } from '../Input'
import { Textarea } from '../Textarea'
import { ChevronLeftIcon, ChevronRightIcon } from '../internal/icons'

export type ChessBoardColor = 'w' | 'b'
export type ChessBoardPromotion = 'q' | 'r' | 'b' | 'n'

export interface ChessBoardMove {
  /** Square names, e.g. `e2` and `e4`. */
  from: string
  to: string
  /** Standard algebraic notation, with + or #. */
  san: string
  color: ChessBoardColor
  /** The piece moved, as a FEN letter: `N`, `p`. */
  piece: string
  captured?: string
  promotion?: ChessBoardPromotion
}

export interface ChessBoardResult {
  outcome: 'checkmate' | 'stalemate' | 'threefold' | 'fifty-move' | 'insufficient'
  /** Null for every kind of draw. */
  winner: ChessBoardColor | null
}

export interface ChessBoardProps {
  /** The starting position. Defaults to the standard one. */
  defaultFen?: string
  /** A game to load on mount instead. Wins over `defaultFen`. */
  defaultPgn?: string
  /** Which side sits at the bottom. The Flip button changes it. */
  defaultOrientation?: ChessBoardColor
  /** Show the FEN and PGN tools under the move list. */
  tools?: boolean
  /** Accessible name for the board. */
  label?: string
  /** Called after every move with the move and the FEN it produced. */
  onMove?: (move: ChessBoardMove, fen: string) => void
  /** Called when a move ends the game. */
  onGameEnd?: (result: ChessBoardResult) => void
  /** Merged last, so it wins. */
  className?: string
}

/* ------------------------------------------------------------------ rules */

interface Position {
  /** 64 squares from a8 to h1, as FEN letters or ''. */
  board: string[]
  turn: ChessBoardColor
  castling: string
  ep: number
  half: number
  full: number
}

interface Move {
  from: number
  to: number
  piece: string
  captured: string
  promotion: string
  flag: '' | 'ep' | 'double' | 'castle'
}

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const FILES = 'abcdefgh'
const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]
const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]]
const ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]]
const NAMES: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' }

const squareName = (index: number) => FILES[index & 7] + (8 - (index >> 3))
const colorOf = (piece: string): ChessBoardColor => (piece === piece.toUpperCase() ? 'w' : 'b')
const other = (color: ChessBoardColor): ChessBoardColor => (color === 'w' ? 'b' : 'w')
const pieceName = (piece: string) => `${colorOf(piece) === 'w' ? 'white' : 'black'} ${NAMES[piece.toLowerCase()]}`
const step = (index: number, dr: number, df: number) => {
  const row = (index >> 3) + dr
  const file = (index & 7) + df
  return row < 0 || row > 7 || file < 0 || file > 7 ? -1 : row * 8 + file
}

function attacked(board: string[], square: number, by: ChessBoardColor) {
  const is = (index: number, kind: string) => index >= 0 && board[index] !== '' && colorOf(board[index]) === by && board[index].toLowerCase() === kind
  // A white pawn attacks upwards, so it sits one row below the square.
  for (const df of [-1, 1]) if (is(step(square, by === 'w' ? 1 : -1, df), 'p')) return true
  for (const [dr, df] of KNIGHT) if (is(step(square, dr, df), 'n')) return true
  for (const [dr, df] of KING) if (is(step(square, dr, df), 'k')) return true
  for (const [dirs, kinds] of [[DIAG, 'bq'], [ORTHO, 'rq']] as const) {
    for (const [dr, df] of dirs) {
      for (let at = step(square, dr, df); at >= 0; at = step(at, dr, df)) {
        const piece = board[at]
        if (!piece) continue
        if (colorOf(piece) === by && kinds.includes(piece.toLowerCase())) return true
        break
      }
    }
  }
  return false
}

const kingOf = (position: Position, color: ChessBoardColor) => position.board.indexOf(color === 'w' ? 'K' : 'k')
const inCheck = (position: Position) => attacked(position.board, kingOf(position, position.turn), other(position.turn))

function pseudoMoves(position: Position): Move[] {
  const { board, turn } = position
  const moves: Move[] = []
  const add = (from: number, to: number, flag: Move['flag'] = '') => {
    const piece = board[from]
    const captured = flag === 'ep' ? (turn === 'w' ? 'p' : 'P') : board[to]
    const last = to >> 3 === 0 || to >> 3 === 7
    if (piece.toLowerCase() === 'p' && last) for (const promotion of 'qrbn') moves.push({ from, to, piece, captured, promotion, flag })
    else moves.push({ from, to, piece, captured, promotion: '', flag })
  }
  const enemy = (index: number) => board[index] !== '' && colorOf(board[index]) !== turn

  for (let from = 0; from < 64; from += 1) {
    const piece = board[from]
    if (!piece || colorOf(piece) !== turn) continue
    const kind = piece.toLowerCase()
    if (kind === 'p') {
      const dir = turn === 'w' ? -1 : 1
      const one = step(from, dir, 0)
      if (one >= 0 && !board[one]) {
        add(from, one)
        const two = step(from, dir * 2, 0)
        if (from >> 3 === (turn === 'w' ? 6 : 1) && !board[two]) add(from, two, 'double')
      }
      for (const df of [-1, 1]) {
        const to = step(from, dir, df)
        if (to < 0) continue
        if (enemy(to)) add(from, to)
        else if (to === position.ep) add(from, to, 'ep')
      }
    } else if (kind === 'n' || kind === 'k') {
      for (const [dr, df] of kind === 'n' ? KNIGHT : KING) {
        const to = step(from, dr, df)
        if (to >= 0 && (!board[to] || enemy(to))) add(from, to)
      }
    } else {
      for (const [dr, df] of kind === 'b' ? DIAG : kind === 'r' ? ORTHO : [...DIAG, ...ORTHO]) {
        for (let to = step(from, dr, df); to >= 0; to = step(to, dr, df)) {
          if (board[to]) {
            if (enemy(to)) add(from, to)
            break
          }
          add(from, to)
        }
      }
    }
  }

  // Castling: the king may not start in, pass through, or land in check.
  const home = turn === 'w' ? 60 : 4
  const [king, rook, short, long] = turn === 'w' ? ['K', 'R', 'K', 'Q'] : ['k', 'r', 'k', 'q']
  const foe = other(turn)
  if (board[home] === king && !attacked(board, home, foe)) {
    const clear = (...squares: number[]) => squares.every((square) => !board[square])
    const safe = (...squares: number[]) => squares.every((square) => !attacked(board, square, foe))
    if (position.castling.includes(short) && board[home + 3] === rook && clear(home + 1, home + 2) && safe(home + 1, home + 2)) add(home, home + 2, 'castle')
    if (position.castling.includes(long) && board[home - 4] === rook && clear(home - 1, home - 2, home - 3) && safe(home - 1, home - 2)) add(home, home - 2, 'castle')
  }
  return moves
}

function apply(position: Position, move: Move): Position {
  const board = position.board.slice()
  const { turn } = position
  board[move.to] = move.promotion ? (turn === 'w' ? move.promotion.toUpperCase() : move.promotion) : move.piece
  board[move.from] = ''
  if (move.flag === 'ep') board[move.to + (turn === 'w' ? 8 : -8)] = ''
  if (move.flag === 'castle') {
    const short = move.to > move.from
    board[short ? move.from + 1 : move.from - 1] = board[short ? move.from + 3 : move.from - 4]
    board[short ? move.from + 3 : move.from - 4] = ''
  }
  let castling = position.castling
  const drop = (rights: string) => {
    for (const right of rights) castling = castling.replace(right, '')
  }
  if (move.piece === 'K') drop('KQ')
  if (move.piece === 'k') drop('kq')
  // A rook that moves or is captured on its home square takes its right with it.
  for (const square of [move.from, move.to]) drop(({ 63: 'K', 56: 'Q', 7: 'k', 0: 'q' } as Record<number, string>)[square] ?? '')
  return {
    board,
    turn: other(turn),
    castling,
    ep: move.flag === 'double' ? (move.from + move.to) / 2 : -1,
    half: move.piece.toLowerCase() === 'p' || move.captured ? 0 : position.half + 1,
    full: position.full + (turn === 'b' ? 1 : 0),
  }
}

/** Pseudo-legal moves that do not leave the mover's own king attacked. */
function legalMoves(position: Position) {
  return pseudoMoves(position).filter((move) => {
    const next = apply(position, move)
    return !attacked(next.board, kingOf(next, position.turn), next.turn)
  })
}

function toSan(position: Position, move: Move, moves = legalMoves(position)) {
  let san: string
  if (move.flag === 'castle') san = move.to > move.from ? 'O-O' : 'O-O-O'
  else if (move.piece.toLowerCase() === 'p') {
    san = (move.captured ? `${FILES[move.from & 7]}x` : '') + squareName(move.to) + (move.promotion ? `=${move.promotion.toUpperCase()}` : '')
  } else {
    // Disambiguate by file, then rank, then both — in that order of preference.
    const rivals = moves.filter((other) => other.piece === move.piece && other.to === move.to && other.from !== move.from)
    let from = ''
    if (rivals.length) {
      if (!rivals.some((rival) => (rival.from & 7) === (move.from & 7))) from = FILES[move.from & 7]
      else if (!rivals.some((rival) => rival.from >> 3 === move.from >> 3)) from = squareName(move.from)[1]
      else from = squareName(move.from)
    }
    san = move.piece.toUpperCase() + from + (move.captured ? 'x' : '') + squareName(move.to)
  }
  const next = apply(position, move)
  if (inCheck(next)) san += legalMoves(next).length ? '+' : '#'
  return san
}

function parseFen(fen: string): Position | string {
  const [placement, turn = 'w', castling = '-', ep = '-', half = '0', full = '1'] = fen.trim().split(/\s+/)
  const rows = placement?.split('/') ?? []
  if (rows.length !== 8) return 'A FEN board needs eight ranks separated by /.'
  const board: string[] = []
  for (const row of rows) {
    let width = 0
    for (const char of row) {
      if (/[1-8]/.test(char)) {
        width += Number(char)
        board.push(...new Array(Number(char)).fill(''))
      } else if (/[pnbrqkPNBRQK]/.test(char)) {
        width += 1
        board.push(char)
      } else return `“${char}” is not a piece letter.`
    }
    if (width !== 8) return `The rank “${row}” is not eight squares wide.`
  }
  if (turn !== 'w' && turn !== 'b') return 'The side to move must be w or b.'
  if (!/^(-|K?Q?k?q?)$/.test(castling)) return 'Castling rights must be - or some of KQkq.'
  if (ep !== '-' && !/^[a-h][36]$/.test(ep)) return 'The en passant square must be on the third or sixth rank.'
  if (board.filter((piece) => piece === 'K').length !== 1 || board.filter((piece) => piece === 'k').length !== 1) return 'Each side needs exactly one king.'
  if (board.some((piece, index) => piece.toLowerCase() === 'p' && (index < 8 || index > 55))) return 'Pawns cannot stand on the first or last rank.'
  const position: Position = {
    board,
    turn,
    castling: castling === '-' ? '' : castling,
    ep: ep === '-' ? -1 : (8 - Number(ep[1])) * 8 + FILES.indexOf(ep[0]),
    half: Number(half) || 0,
    full: Math.max(1, Number(full) || 1),
  }
  if (attacked(board, kingOf(position, other(turn)), turn)) return 'The side not to move is in check.'
  return position
}

function toFen(position: Position) {
  const rows: string[] = []
  for (let row = 0; row < 8; row += 1) {
    let out = ''
    let empty = 0
    for (let file = 0; file < 8; file += 1) {
      const piece = position.board[row * 8 + file]
      if (!piece) empty += 1
      else {
        out += (empty || '') + piece
        empty = 0
      }
    }
    rows.push(out + (empty || ''))
  }
  const ep = position.ep >= 0 ? squareName(position.ep) : '-'
  return `${rows.join('/')} ${position.turn} ${position.castling || '-'} ${ep} ${position.half} ${position.full}`
}

/** The FEN fields that decide repetition. En passant counts only if a capture there is legal. */
function repetitionKey(position: Position, moves: Move[]) {
  const ep = moves.some((move) => move.flag === 'ep') ? squareName(position.ep) : '-'
  return toFen(position).split(' ').slice(0, 3).join(' ') + ' ' + ep
}

function insufficient(board: string[]) {
  const rest = board.map((piece, index) => [piece, index] as const).filter(([piece]) => piece && piece.toLowerCase() !== 'k')
  if (rest.length <= 1) return rest.every(([piece]) => 'nbNB'.includes(piece))
  // Any number of bishops, all on one colour of square, can never mate.
  const shade = (index: number) => ((index >> 3) + (index & 7)) % 2
  return rest.every(([piece, index]) => piece.toLowerCase() === 'b' && shade(index) === shade(rest[0][1]))
}

const plain = (san: string) => san.replace(/[+#?!]+$/, '').replace(/=/, '').replace(/^0-0-0$/, 'O-O-O').replace(/^0-0$/, 'O-O')

function parsePgn(text: string): { start: Position; moves: Move[] } | string {
  const headers = Object.fromEntries([...text.matchAll(/\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]/g)].map((match) => [match[1], match[2]]))
  let body = text.replace(/\[[^\]]*\]/g, ' ').replace(/\{[^}]*\}/g, ' ').replace(/;[^\n]*/g, ' ')
  // Variations nest, so strip the innermost pair until none are left.
  while (/\([^()]*\)/.test(body)) body = body.replace(/\([^()]*\)/g, ' ')
  body = body.replace(/\$\d+/g, ' ').replace(/(1-0|0-1|1\/2-1\/2|\*)\s*$/, ' ').replace(/\d+\.(\.\.)?/g, ' ')
  const start = headers.FEN ? parseFen(headers.FEN) : (parseFen(START) as Position)
  if (typeof start === 'string') return `FEN header: ${start}`
  const moves: Move[] = []
  let position = start
  for (const token of body.split(/\s+/).filter(Boolean)) {
    const options = legalMoves(position)
    const move = options.find((option) => plain(toSan(position, option, options)) === plain(token))
    if (!move) return `“${token}” is not a legal move after ${moves.length} ${moves.length === 1 ? 'move' : 'moves'}.`
    moves.push(move)
    position = apply(position, move)
  }
  return { start, moves }
}

/* ------------------------------------------------------------------ view */

const GLYPHS: Record<string, string> = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }

/** One filled glyph for both sides, painted white or black — the outline set renders unevenly across fonts. */
function Piece({ piece }: { piece: string }) {
  const white = colorOf(piece) === 'w'
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" className="pointer-events-none size-full">
      <text
        x="50"
        y="56"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="80"
        paintOrder="stroke"
        strokeLinejoin="round"
        strokeWidth={white ? 5 : 2.5}
        className={cn('font-sans', white ? 'fill-white stroke-black' : 'fill-black stroke-white')}
      >
        {GLYPHS[piece.toLowerCase()] + '︎'}
      </text>
    </svg>
  )
}

interface Game {
  start: Position
  moves: Move[]
}

function describeEnd(result: ChessBoardResult) {
  if (result.outcome === 'checkmate') return `Checkmate. ${result.winner === 'w' ? 'White' : 'Black'} wins.`
  if (result.outcome === 'stalemate') return 'Stalemate. Draw.'
  if (result.outcome === 'threefold') return 'Draw by threefold repetition.'
  if (result.outcome === 'fifty-move') return 'Draw by the fifty-move rule.'
  return 'Draw by insufficient material.'
}

function initialGame(defaultFen?: string, defaultPgn?: string): Game {
  if (defaultPgn) {
    const parsed = parsePgn(defaultPgn)
    if (typeof parsed !== 'string') return parsed
  }
  const start = defaultFen ? parseFen(defaultFen) : null
  return { start: start && typeof start !== 'string' ? start : (parseFen(START) as Position), moves: [] }
}

/**
 * A chessboard that knows the rules, all of them.
 *
 * Moves are generated, not validated after the fact: every pseudo-legal move is
 * played on a copy of the board and kept only if the mover’s king is not then
 * attacked. That one filter is what makes pins, discovered checks, en passant
 * that exposes the king and castling out of check come out right without a
 * special case each — the bugs that toy boards ship with.
 *
 * The game is stored as a start position plus a list of moves, so the move
 * list, the navigation, repetition counting and PGN export all read from the
 * same source. Moving while looking at an earlier position starts a new line
 * from there, as analysis boards do.
 *
 * The board is an ARIA grid with one tab stop. Arrows move between squares
 * (following the board when it is flipped), Enter picks a piece up and puts it
 * down, and every move is announced in words rather than notation.
 */
export function ChessBoard({
  defaultFen,
  defaultPgn,
  defaultOrientation = 'w',
  tools = true,
  label = 'Chess board',
  onMove,
  onGameEnd,
  className,
}: ChessBoardProps) {
  const [game, setGame] = useState<Game>(() => initialGame(defaultFen, defaultPgn))
  const [cursor, setCursor] = useState(() => game.moves.length)
  const [orientation, setOrientation] = useState<ChessBoardColor>(defaultOrientation)
  const [selected, setSelected] = useState<number | null>(null)
  const [focus, setFocus] = useState(52)
  const [promotion, setPromotion] = useState<Move[] | null>(null)
  const [drag, setDrag] = useState<{ from: number; x: number; y: number; active: boolean; pointer: number } | null>(null)
  const [message, setMessage] = useState('')
  const [fenDraft, setFenDraft] = useState('')
  const [pgnDraft, setPgnDraft] = useState('')
  const [toolNote, setToolNote] = useState('')
  const boardRef = useRef<HTMLDivElement>(null)
  const cells = useRef<(HTMLDivElement | null)[]>([])
  const promotionRef = useRef<HTMLDivElement>(null)
  const id = useId()

  const history = useMemo(() => {
    const positions = [game.start]
    const sans: string[] = []
    for (const move of game.moves) {
      const position = positions[positions.length - 1]
      sans.push(toSan(position, move))
      positions.push(apply(position, move))
    }
    return { positions, sans }
  }, [game])

  const position = history.positions[cursor]
  const moves = useMemo(() => legalMoves(position), [position])
  const status = useMemo((): ChessBoardResult | null => {
    if (!moves.length) return inCheck(position) ? { outcome: 'checkmate', winner: other(position.turn) } : { outcome: 'stalemate', winner: null }
    if (position.half >= 100) return { outcome: 'fifty-move', winner: null }
    if (insufficient(position.board)) return { outcome: 'insufficient', winner: null }
    const key = repetitionKey(position, moves)
    const seen = history.positions.slice(0, cursor + 1).filter((earlier, index) => {
      if (earlier.turn !== position.turn) return false
      return repetitionKey(earlier, index === cursor ? moves : legalMoves(earlier)) === key
    }).length
    return seen >= 3 ? { outcome: 'threefold', winner: null } : null
  }, [position, moves, history, cursor])

  const fen = toFen(position)
  useEffect(() => setFenDraft(fen), [fen])

  useEffect(() => {
    if (promotion) promotionRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }, [promotion])

  const targets = selected === null ? [] : moves.filter((move) => move.from === selected)
  const last = cursor > 0 ? game.moves[cursor - 1] : null
  const checked = inCheck(position) ? kingOf(position, position.turn) : -1

  const commit = (move: Move) => {
    const san = toSan(position, move, moves)
    const next = apply(position, move)
    const nextGame = { start: game.start, moves: [...game.moves.slice(0, cursor), move] }
    setGame(nextGame)
    setCursor(cursor + 1)
    setSelected(null)
    setPromotion(null)
    const words = `${pieceName(move.piece)} ${squareName(move.from)} to ${squareName(move.to)}${
      move.flag === 'castle' ? (move.to > move.from ? ', castles kingside' : ', castles queenside') : ''
    }${move.captured ? `, takes ${pieceName(move.captured).split(' ')[1]}` : ''}${move.flag === 'ep' ? ' en passant' : ''}${
      move.promotion ? `, promotes to ${NAMES[move.promotion]}` : ''
    }.`
    const nextMoves = legalMoves(next)
    let end: ChessBoardResult | null = null
    if (!nextMoves.length) end = inCheck(next) ? { outcome: 'checkmate', winner: position.turn } : { outcome: 'stalemate', winner: null }
    else if (next.half >= 100) end = { outcome: 'fifty-move', winner: null }
    else if (insufficient(next.board)) end = { outcome: 'insufficient', winner: null }
    else {
      const key = repetitionKey(next, nextMoves)
      const seen = [...history.positions.slice(0, cursor + 1), next].filter(
        (earlier) => earlier.turn === next.turn && repetitionKey(earlier, earlier === next ? nextMoves : legalMoves(earlier)) === key,
      ).length
      if (seen >= 3) end = { outcome: 'threefold', winner: null }
    }
    setMessage(`${words}${end ? ` ${describeEnd(end)}` : inCheck(next) ? ' Check.' : ''}`)
    onMove?.(
      {
        from: squareName(move.from),
        to: squareName(move.to),
        san,
        color: position.turn,
        piece: move.piece,
        captured: move.captured || undefined,
        promotion: (move.promotion || undefined) as ChessBoardPromotion | undefined,
      },
      toFen(next),
    )
    if (end) onGameEnd?.(end)
  }

  const tryMove = (from: number, to: number) => {
    const options = moves.filter((move) => move.from === from && move.to === to)
    if (!options.length) return false
    if (options.length > 1) setPromotion(options)
    else commit(options[0])
    return true
  }

  const activate = (square: number) => {
    if (promotion || status) {
      if (status) setMessage(describeEnd(status))
      return
    }
    if (selected !== null && selected !== square && tryMove(selected, square)) return
    const piece = position.board[square]
    if (selected === square) {
      setSelected(null)
      setMessage('Selection cleared.')
    } else if (piece && colorOf(piece) === position.turn) {
      const reach = moves.filter((move) => move.from === square)
      if (!reach.length) {
        setSelected(null)
        setMessage(`The ${pieceName(piece)} on ${squareName(square)} has no legal moves.`)
        return
      }
      setSelected(square)
      const destinations = [...new Set(reach.map((move) => squareName(move.to)))]
      setMessage(`${pieceName(piece)} on ${squareName(square)} selected. ${destinations.length} ${destinations.length === 1 ? 'move' : 'moves'}: ${destinations.join(', ')}.`)
    } else if (selected !== null) {
      setMessage(`${squareName(square)} is not a legal move for that piece.`)
    }
  }

  // Display order: row and column on screen, whichever way the board faces.
  const at = (row: number, col: number) => (orientation === 'w' ? row * 8 + col : (7 - row) * 8 + (7 - col))
  const focusSquare = (square: number) => {
    setFocus(square)
    cells.current[square]?.focus()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>, square: number) => {
    const row = orientation === 'w' ? square >> 3 : 7 - (square >> 3)
    const col = orientation === 'w' ? square & 7 : 7 - (square & 7)
    const moveTo = (r: number, c: number) => {
      event.preventDefault()
      focusSquare(at(Math.min(7, Math.max(0, r)), Math.min(7, Math.max(0, c))))
    }
    if (event.key === 'ArrowUp') moveTo(row - 1, col)
    else if (event.key === 'ArrowDown') moveTo(row + 1, col)
    else if (event.key === 'ArrowLeft') moveTo(row, col - 1)
    else if (event.key === 'ArrowRight') moveTo(row, col + 1)
    else if (event.key === 'Home') moveTo(row, 0)
    else if (event.key === 'End') moveTo(row, 7)
    else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      activate(square)
    } else if (event.key === 'Escape' && selected !== null) {
      event.preventDefault()
      setSelected(null)
      setMessage('Selection cleared.')
    }
  }

  const squareAt = (x: number, y: number) => {
    const box = boardRef.current?.getBoundingClientRect()
    if (!box || x < box.left || y < box.top || x >= box.right || y >= box.bottom) return -1
    return at(Math.floor(((y - box.top) / box.height) * 8), Math.floor(((x - box.left) / box.width) * 8))
  }

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || promotion || status) return
    const square = squareAt(event.clientX, event.clientY)
    const piece = position.board[square]
    if (square < 0 || !piece || colorOf(piece) !== position.turn) return
    setDrag({ from: square, x: event.clientX, y: event.clientY, active: false, pointer: event.pointerId })
  }
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag || drag.pointer !== event.pointerId) return
    const far = Math.hypot(event.clientX - drag.x, event.clientY - drag.y) > 4
    if (!drag.active && !far) return
    // Captured only once it is a drag, so a plain click still lands on its square.
    if (!drag.active) {
      boardRef.current?.setPointerCapture(event.pointerId)
      setSelected(drag.from)
    }
    setDrag({ ...drag, x: event.clientX, y: event.clientY, active: true })
  }
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!drag || drag.pointer !== event.pointerId) return
    setDrag(null)
    if (!drag.active) return
    const square = squareAt(event.clientX, event.clientY)
    if (square >= 0 && square !== drag.from && tryMove(drag.from, square)) focusSquare(square)
  }

  const box = boardRef.current?.getBoundingClientRect()
  const loadFen = () => {
    const parsed = parseFen(fenDraft)
    if (typeof parsed === 'string') return setToolNote(`FEN not loaded: ${parsed}`)
    setGame({ start: parsed, moves: [] })
    setCursor(0)
    setSelected(null)
    setToolNote('Position loaded.')
  }
  const importPgn = () => {
    const parsed = parsePgn(pgnDraft)
    if (typeof parsed === 'string') return setToolNote(`PGN not imported: ${parsed}`)
    setGame(parsed)
    setCursor(parsed.moves.length)
    setSelected(null)
    setToolNote(`Imported ${parsed.moves.length} ${parsed.moves.length === 1 ? 'move' : 'moves'}.`)
  }
  const exportPgn = () => {
    const final = history.positions[history.positions.length - 1]
    const finalMoves = legalMoves(final)
    const result = !finalMoves.length && inCheck(final) ? (final.turn === 'w' ? '0-1' : '1-0') : !finalMoves.length || final.half >= 100 || insufficient(final.board) ? '1/2-1/2' : '*'
    const today = new Date()
    const startFen = toFen(game.start)
    const headers = [
      ['Event', 'Casual game'],
      ['Site', '-'],
      ['Date', `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`],
      ['White', 'White'],
      ['Black', 'Black'],
      ['Result', result],
      ...(startFen === START ? [] : [['SetUp', '1'], ['FEN', startFen]]),
    ]
    const words: string[] = []
    history.sans.forEach((san, index) => {
      const mover = history.positions[index]
      if (mover.turn === 'w') words.push(`${mover.full}.`)
      else if (index === 0) words.push(`${mover.full}...`)
      words.push(san)
    })
    words.push(result)
    const lines: string[] = []
    for (const word of words) {
      if (lines.length && lines[lines.length - 1].length + word.length < 80) lines[lines.length - 1] += ` ${word}`
      else lines.push(word)
    }
    const pgn = `${headers.map(([key, value]) => `[${key} "${value}"]`).join('\n')}\n\n${lines.join('\n')}\n`
    setPgnDraft(pgn)
    void navigator.clipboard?.writeText(pgn).catch(() => {})
    setToolNote('PGN written below and copied.')
  }

  const goTo = (index: number) => {
    setCursor(Math.max(0, Math.min(game.moves.length, index)))
    setSelected(null)
    setPromotion(null)
  }

  const turnText = status ? describeEnd(status) : `${position.turn === 'w' ? 'White' : 'Black'} to move${checked >= 0 ? ' — check' : ''}`

  return (
    <div className={cn('flex w-full flex-col gap-4 md:flex-row md:items-start', className)}>
      <div className="flex w-full max-w-[440px] flex-col gap-2">
        <p className="m-0 text-[13px] font-bold text-ink" aria-hidden="true">
          {turnText}
        </p>
        <div className="relative">
          <div
            ref={boardRef}
            role="grid"
            aria-label={`${label}. ${turnText}.`}
            aria-rowcount={8}
            aria-colcount={8}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={() => setDrag(null)}
            className="grid aspect-square w-full touch-none select-none grid-rows-8 overflow-hidden rounded-[var(--radius-tile)] border border-line-strong"
          >
            {Array.from({ length: 8 }, (_, row) => (
              <div role="row" key={row} aria-rowindex={row + 1} className="grid grid-cols-8">
                {Array.from({ length: 8 }, (_, col) => {
                  const square = at(row, col)
                  const piece = position.board[square]
                  const dark = ((square >> 3) + (square & 7)) % 2 === 1
                  const target = targets.find((move) => move.to === square)
                  const lifted = drag?.active && drag.from === square
                  return (
                    <div
                      role="gridcell"
                      key={col}
                      aria-colindex={col + 1}
                      ref={(node) => {
                        cells.current[square] = node
                      }}
                      tabIndex={square === focus ? 0 : -1}
                      aria-selected={selected === square}
                      aria-label={`${squareName(square)}, ${piece ? pieceName(piece) : 'empty'}${target ? (target.captured ? ', capture available' : ', move available') : ''}${
                        square === checked ? ', in check' : ''
                      }`}
                      onFocus={() => setFocus(square)}
                      onClick={() => {
                        setFocus(square)
                        activate(square)
                      }}
                      onKeyDown={(event) => onKeyDown(event, square)}
                      className={cn(
                        'relative flex cursor-pointer items-center justify-center outline-none',
                        dark ? 'bg-[color-mix(in_oklab,var(--color-accent-strong)_58%,black)]' : 'bg-[color-mix(in_oklab,var(--color-accent)_22%,white)]',
                        'focus-visible:z-10 focus-visible:outline-3 focus-visible:outline-offset-[-3px] focus-visible:outline-focus',
                      )}
                    >
                      {last && (last.from === square || last.to === square) && (
                        <span aria-hidden="true" className="absolute inset-0 bg-[color-mix(in_oklab,var(--color-warning)_42%,transparent)]" />
                      )}
                      {selected === square && <span aria-hidden="true" className="absolute inset-0 bg-[color-mix(in_oklab,var(--color-warning)_70%,transparent)]" />}
                      {square === checked && (
                        <span aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle,var(--color-danger)_0%,transparent_72%)]" />
                      )}
                      {piece && <span className={cn('relative size-[88%]', lifted && 'opacity-30')}>{<Piece piece={piece} />}</span>}
                      {target && (
                        <span
                          aria-hidden="true"
                          className={cn(
                            'absolute rounded-full',
                            target.captured ? 'inset-[4%] border-[0.35em] border-black/30' : 'size-[30%] bg-black/30',
                          )}
                        />
                      )}
                      {col === 0 && (
                        <span aria-hidden="true" className={cn('absolute left-0.5 top-0 text-[10px] font-bold', dark ? 'text-white' : 'text-black/70')}>
                          {8 - (square >> 3)}
                        </span>
                      )}
                      {row === 7 && (
                        <span aria-hidden="true" className={cn('absolute bottom-0 right-1 text-[10px] font-bold', dark ? 'text-white' : 'text-black/70')}>
                          {FILES[square & 7]}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {drag?.active && box && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute z-20"
              style={{ width: box.width / 8, height: box.width / 8, left: drag.x - box.left - box.width / 16, top: drag.y - box.top - box.width / 16 }}
            >
              <Piece piece={position.board[drag.from]} />
            </span>
          )}

          {promotion && (
            <div
              ref={promotionRef}
              role="dialog"
              aria-label="Promote pawn to"
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault()
                  setPromotion(null)
                  setMessage('Promotion cancelled.')
                  cells.current[focus]?.focus()
                }
              }}
              className="absolute inset-x-[12%] top-1/2 z-30 flex -translate-y-1/2 flex-col gap-2 rounded-[var(--radius-tile)] border border-line bg-surface p-3 shadow-[var(--shadow-float)]"
            >
              <p className="m-0 text-[12px] font-bold text-ink">Promote to</p>
              <div className="grid grid-cols-4 gap-2">
                {promotion.map((move) => (
                  <button
                    key={move.promotion}
                    type="button"
                    aria-label={NAMES[move.promotion]}
                    onClick={() => {
                      commit(move)
                      focusSquare(move.to)
                    }}
                    className="aspect-square rounded-[var(--radius-glyph)] bg-[color-mix(in_oklab,var(--color-accent)_22%,white)] p-1 hover:bg-[color-mix(in_oklab,var(--color-accent)_45%,white)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    <Piece piece={position.turn === 'w' ? move.promotion.toUpperCase() : move.promotion} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <IconButton icon={ChevronLeftIcon} label="Previous move" size="sm" tone="muted" onClick={() => goTo(cursor - 1)} disabled={cursor === 0} />
          <IconButton icon={ChevronRightIcon} label="Next move" size="sm" tone="muted" onClick={() => goTo(cursor + 1)} disabled={cursor === game.moves.length} />
          <Button size="sm" variant="ghost" onClick={() => goTo(0)} disabled={cursor === 0}>
            Start
          </Button>
          <Button size="sm" variant="ghost" onClick={() => goTo(game.moves.length)} disabled={cursor === game.moves.length}>
            Latest
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setGame({ start: game.start, moves: game.moves.slice(0, Math.max(0, cursor - 1)) })
              goTo(cursor - 1)
              setMessage('Last move taken back.')
            }}
            disabled={cursor === 0}
          >
            Undo
          </Button>
          <Button size="sm" variant="outline" aria-pressed={orientation === 'b'} onClick={() => setOrientation(other(orientation))}>
            Flip board
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setGame({ start: parseFen(START) as Position, moves: [] })
              setCursor(0)
              setSelected(null)
              setMessage('New game.')
            }}
          >
            New game
          </Button>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div role="group" aria-labelledby={`${id}-moves`} className="flex flex-col gap-1.5">
          <h3 id={`${id}-moves`} className="m-0 text-[12px] font-bold uppercase tracking-wider text-ink-faint">
            Moves
          </h3>
          {history.sans.length === 0 ? (
            <p className="m-0 text-[13px] font-medium text-ink-soft">No moves yet.</p>
          ) : (
            <ol className="m-0 flex max-h-[220px] list-none flex-wrap gap-x-1 gap-y-0.5 overflow-y-auto p-0 text-[13px]">
              {history.sans.map((san, index) => {
                const mover = history.positions[index]
                return (
                  <li key={index} className="flex items-center">
                    {(mover.turn === 'w' || index === 0) && (
                      <span className="mr-1 text-ink-faint tabular-nums">
                        {mover.full}
                        {mover.turn === 'w' ? '.' : '...'}
                      </span>
                    )}
                    <button
                      type="button"
                      aria-label={`${mover.full}${mover.turn === 'w' ? '' : '...'} ${san}`}
                      aria-current={cursor === index + 1 ? 'step' : undefined}
                      onClick={() => goTo(index + 1)}
                      className={cn(
                        'rounded-[var(--radius-6)] px-1.5 py-0.5 font-semibold text-ink hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-focus',
                        cursor === index + 1 && 'bg-[color-mix(in_oklab,var(--color-accent)_40%,transparent)]',
                      )}
                    >
                      {san}
                    </button>
                  </li>
                )
              })}
            </ol>
          )}
        </div>

        {tools && (
          <div role="group" aria-labelledby={`${id}-tools`} className="flex flex-col gap-2">
            <h3 id={`${id}-tools`} className="m-0 text-[12px] font-bold uppercase tracking-wider text-ink-faint">
              Position and game
            </h3>
            <label htmlFor={`${id}-fen`} className="text-[12px] font-semibold text-ink-soft">
              FEN
            </label>
            <div className="flex gap-2">
              <Input id={`${id}-fen`} inputSize="sm" containerClassName="min-w-0 flex-1" value={fenDraft} onChange={(event) => setFenDraft(event.target.value)} className="font-mono text-[11px]" spellCheck={false} />
              <Button size="sm" variant="outline" onClick={loadFen}>
                Load
              </Button>
            </div>
            <label htmlFor={`${id}-pgn`} className="text-[12px] font-semibold text-ink-soft">
              PGN
            </label>
            <Textarea id={`${id}-pgn`} rows={5} value={pgnDraft} onChange={(event) => setPgnDraft(event.target.value)} className="font-mono text-[11px]" spellCheck={false} placeholder="Paste a game, then Import." />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={importPgn} disabled={!pgnDraft.trim()}>
                Import
              </Button>
              <Button size="sm" variant="outline" onClick={exportPgn}>
                Export
              </Button>
            </div>
            <p role="status" className="m-0 min-h-[1.2em] text-[12px] font-medium text-ink-soft">
              {toolNote}
            </p>
          </div>
        )}
      </div>

      <p role="status" className="sr-only">
        {message}
      </p>
    </div>
  )
}
