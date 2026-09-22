/**
 * Rewrites a component file from another library into this one.
 *
 * It is a codemod, not a compiler, and it says so: the scanner walks JSX tags
 * and import statements and rewrites what it has a mapping for, leaves
 * everything it does not recognise exactly as it found it, and reports every
 * decision either way. A tool that quietly dropped the props it did not
 * understand would be worse than no tool, because the file would look
 * converted.
 *
 * The scanner is deliberately small. It does not parse expressions: it finds
 * tags, respecting quotes and braces so a `>` inside `onClick={() => a > b}`
 * does not end a tag early, and edits names and attributes within them.
 */

export type MigrateSource = 'shadcn' | 'mui' | 'chakra'

export interface MigrateNote {
  kind: 'renamed' | 'prop' | 'dropped' | 'unmapped' | 'import'
  /** The tag or import the note is about. */
  subject: string
  detail: string
}

export interface MigrateResult {
  code: string
  notes: MigrateNote[]
  /** Klyv components the output uses, for the import line. */
  used: string[]
  /** Tags left untouched because there was no mapping. */
  unmapped: string[]
  counts: { tags: number; renamed: number; props: number }
}

/** How one component maps: its new name, and what to do with its props. */
interface ComponentRule {
  /** The Klyv component, or null when there is no equivalent to rename to. */
  to: string | null
  /** Left as a note rather than a rename. */
  note?: string
  /** Prop renames: `old` -> `new`. */
  props?: Record<string, string>
  /** Props to remove, each with the reason shown in the report. */
  drop?: Record<string, string>
  /** Value maps for a prop that survives, keyed by prop then old value. */
  values?: Record<string, Record<string, string>>
  /** Values with no equivalent: keyed by prop then value, the reason. */
  unknownValues?: Record<string, Record<string, string>>
  /** Why a mapped value had to change, when the change is worth explaining. */
  valueNotes?: Record<string, Record<string, string>>
}

/** shadcn/ui is Radix underneath, so its parts map part by part. */
const SHADCN: Record<string, ComponentRule> = {
  Button: {
    to: 'Button',
    values: {
      variant: { default: 'accent', secondary: 'muted', outline: 'outline', ghost: 'ghost', link: 'ghost' },
      size: { sm: 'sm', default: 'md', lg: 'md' },
    },
    valueNotes: {
      variant: { link: 'Klyv has no link button; ghost is the closest, or use TextLink.' },
      size: { lg: 'Klyv buttons are sm or md, so lg became md.' },
    },
    unknownValues: {
      variant: { destructive: 'Klyv has no destructive button variant; use variant="outline" with the danger token, or a confirm dialog.' },
      size: { icon: 'Use IconButton for an icon-only button.' },
    },
  },
  Input: { to: 'Input' },
  Textarea: { to: 'Textarea' },
  Label: { to: 'Label', note: 'Klyv’s Field renders the label, hint and error together — Field is usually the better fit.' },
  Card: { to: 'Card' },
  CardHeader: { to: null, note: 'Card takes `title` and `description` props instead of a header part.' },
  CardTitle: { to: null, note: 'Becomes Card’s `title` prop.' },
  CardDescription: { to: null, note: 'Becomes Card’s `description` prop.' },
  CardContent: { to: null, note: 'Card’s children are its content; the wrapper can go.' },
  CardFooter: { to: null, note: 'Card takes a `footer` prop.' },
  Dialog: { to: 'Modal', props: { onOpenChange: 'onOpenChange' } },
  DialogContent: { to: null, note: 'Modal’s children are its content.' },
  DialogHeader: { to: null, note: 'Modal takes `title` and `description`.' },
  DialogTitle: { to: null, note: 'Becomes Modal’s `title` prop.' },
  DialogFooter: { to: null, note: 'Modal takes a `footer` prop.' },
  DialogTrigger: { to: null, note: 'Klyv’s Modal is controlled by `open`; render your own trigger.' },
  AlertDialog: { to: 'AlertDialog' },
  Sheet: { to: 'Drawer' },
  SheetContent: { to: null, note: 'Drawer’s children are its content.' },
  Tabs: { to: 'Tabs', note: 'Klyv’s Tabs takes an `items` array rather than Trigger and Content parts.' },
  TabsList: { to: null, note: 'Becomes entries in Tabs’ `items`.' },
  TabsTrigger: { to: null, note: 'Becomes an item’s `label`.' },
  TabsContent: { to: null, note: 'Becomes an item’s `content`.' },
  Accordion: { to: 'Accordion' },
  Switch: { to: 'Switch', props: { onCheckedChange: 'onChange' }, drop: { asChild: 'Klyv components render their own element.' } },
  Checkbox: { to: 'Checkbox', props: { onCheckedChange: 'onChange' } },
  RadioGroup: { to: 'RadioGroup' },
  Select: { to: 'Select', note: 'Klyv’s Select takes an `options` array rather than Item children.' },
  SelectTrigger: { to: null, note: 'Select draws its own trigger.' },
  SelectValue: { to: null, note: 'Select draws its own value.' },
  SelectContent: { to: null, note: 'Becomes Select’s `options`.' },
  SelectItem: { to: null, note: 'Becomes an entry in Select’s `options`.' },
  Slider: { to: 'Slider', props: { onValueChange: 'onChange' } },
  Badge: { to: 'Badge' },
  Avatar: { to: 'Avatar', props: { src: 'src' } },
  AvatarImage: { to: null, note: 'Avatar takes `src` and `name` directly.' },
  AvatarFallback: { to: null, note: 'Avatar derives its initials from `name`.' },
  Tooltip: { to: 'Tooltip' },
  TooltipTrigger: { to: null, note: 'Tooltip wraps its child.' },
  TooltipContent: { to: null, note: 'Becomes Tooltip’s `content`.' },
  Popover: { to: 'Popover' },
  DropdownMenu: { to: 'DropdownMenu', note: 'Klyv’s DropdownMenu takes an `items` array.' },
  DropdownMenuItem: { to: null, note: 'Becomes an entry in `items`.' },
  Table: { to: 'Table', note: 'For sorting, selection and paging, DataTable takes `columns` and `rows` instead.' },
  Skeleton: { to: 'Skeleton' },
  Progress: { to: 'Progress' },
  Separator: { to: 'Divider' },
  Toaster: { to: null, note: 'Klyv’s ToastProvider hosts toasts; mount it once at the root.' },
  Command: { to: 'CommandPalette' },
  Calendar: { to: 'DatePicker' },
  Breadcrumb: { to: 'Breadcrumb' },
  Alert: { to: 'Alert' },
  Pagination: { to: 'Pagination' },
  ScrollArea: { to: null, note: 'A plain element with `overflow-auto` does this; Klyv has no wrapper for it.' },
}

const MUI: Record<string, ComponentRule> = {
  Button: {
    to: 'Button',
    drop: { color: 'One accent themes everything, so a per-button colour has nowhere to go.', disableElevation: 'Klyv buttons have one elevation.', sx: 'Style with className and the tokens.' },
    values: { variant: { contained: 'accent', outlined: 'outline', text: 'ghost' }, size: { small: 'sm', medium: 'md', large: 'md' } },
    valueNotes: { size: { large: 'Klyv buttons are sm or md, so large became md.' } },
  },
  TextField: { to: 'Input', note: 'Wrap it in Field for the label, hint and error.', drop: { variant: 'Klyv has one field style.', sx: 'Style with className and the tokens.' }, props: { helperText: 'hint' } },
  Typography: { to: 'Text', props: { variant: 'size' }, values: { size: { h1: 'display', h2: 'title', h3: 'heading', h4: 'heading', subtitle1: 'subtitle', body1: 'body', body2: 'body', caption: 'caption' } } },
  Box: { to: null, note: 'A div with utility classes; Klyv has no Box.' },
  Stack: { to: 'Stack', props: { spacing: 'gap' } },
  Grid: { to: 'Grid' },
  Paper: { to: 'Surface' },
  Card: { to: 'Card' },
  CardContent: { to: null, note: 'Card’s children are its content.' },
  Chip: { to: 'Tag', drop: { color: 'The accent is the only hue.' } },
  Switch: { to: 'Switch', drop: { color: 'The accent is the only hue.' } },
  Checkbox: { to: 'Checkbox' },
  Radio: { to: 'RadioGroup', note: 'Klyv groups radios: RadioGroup takes `options`.' },
  Select: { to: 'Select', note: 'Takes an `options` array rather than MenuItem children.' },
  MenuItem: { to: null, note: 'Becomes an entry in `options` or `items`.' },
  Slider: { to: 'Slider' },
  Dialog: { to: 'Modal' },
  DialogTitle: { to: null, note: 'Becomes Modal’s `title` prop.' },
  DialogContent: { to: null, note: 'Modal’s children are its content.' },
  DialogActions: { to: null, note: 'Becomes Modal’s `footer` prop.' },
  Snackbar: { to: 'Toast', note: 'Raised through Klyv’s toast hook rather than rendered inline.' },
  Tooltip: { to: 'Tooltip', props: { title: 'content' } },
  Avatar: { to: 'Avatar' },
  Badge: { to: 'Badge' },
  Tabs: { to: 'Tabs', note: 'Takes an `items` array rather than Tab children.' },
  Tab: { to: null, note: 'Becomes an entry in Tabs’ `items`.' },
  Drawer: { to: 'Drawer' },
  Menu: { to: 'DropdownMenu' },
  Table: { to: 'Table', note: 'DataTable does sorting, selection and paging for you.' },
  LinearProgress: { to: 'Progress' },
  CircularProgress: { to: 'Spinner' },
  Divider: { to: 'Divider' },
  Accordion: { to: 'Accordion' },
  Autocomplete: { to: 'Combobox' },
  Skeleton: { to: 'Skeleton' },
  Alert: { to: 'Alert', props: { severity: 'tone' }, values: { tone: { error: 'danger', warning: 'warning', info: 'info', success: 'success' } } },
}

const CHAKRA: Record<string, ComponentRule> = {
  Button: {
    to: 'Button',
    drop: { colorScheme: 'One accent themes everything.' },
    values: { variant: { solid: 'accent', outline: 'outline', ghost: 'ghost', link: 'ghost' }, size: { xs: 'sm', sm: 'sm', md: 'md', lg: 'md' } },
    valueNotes: { size: { lg: 'Klyv buttons are sm or md, so lg became md.', xs: 'Klyv buttons are sm or md, so xs became sm.' } },
  },
  Input: { to: 'Input' },
  Textarea: { to: 'Textarea' },
  Text: { to: 'Text', props: { fontSize: 'size' } },
  Heading: { to: 'Text', note: 'Text renders any element: pass `as="h2"` and a `size`.' },
  Box: { to: null, note: 'A div with utility classes; Klyv has no Box.' },
  Flex: { to: null, note: 'A div with `flex` utilities.' },
  Stack: { to: 'Stack', props: { spacing: 'gap' } },
  VStack: { to: 'Stack', props: { spacing: 'gap' }, note: 'Stack is vertical by default.' },
  HStack: { to: 'Stack', props: { spacing: 'gap' }, note: 'Pass `direction="row"`.' },
  Badge: { to: 'Badge' },
  Tag: { to: 'Tag' },
  Switch: { to: 'Switch', drop: { colorScheme: 'One accent themes everything.' } },
  Checkbox: { to: 'Checkbox' },
  Radio: { to: 'RadioGroup', note: 'Klyv groups radios: RadioGroup takes `options`.' },
  Select: { to: 'Select', note: 'Takes an `options` array rather than option children.' },
  Slider: { to: 'Slider' },
  Modal: { to: 'Modal' },
  ModalOverlay: { to: null, note: 'Modal draws its own scrim.' },
  ModalContent: { to: null, note: 'Modal’s children are its content.' },
  ModalHeader: { to: null, note: 'Becomes Modal’s `title` prop.' },
  ModalFooter: { to: null, note: 'Becomes Modal’s `footer` prop.' },
  ModalCloseButton: { to: null, note: 'Modal draws its own close button.' },
  Tooltip: { to: 'Tooltip', props: { label: 'content' } },
  Avatar: { to: 'Avatar' },
  Tabs: { to: 'Tabs', note: 'Takes an `items` array rather than Tab and TabPanel children.' },
  TabList: { to: null, note: 'Becomes entries in `items`.' },
  Tab: { to: null, note: 'Becomes an item’s `label`.' },
  TabPanels: { to: null, note: 'Becomes entries in `items`.' },
  TabPanel: { to: null, note: 'Becomes an item’s `content`.' },
  Drawer: { to: 'Drawer' },
  Menu: { to: 'DropdownMenu' },
  MenuItem: { to: null, note: 'Becomes an entry in `items`.' },
  Table: { to: 'Table', note: 'DataTable does sorting, selection and paging for you.' },
  Progress: { to: 'Progress' },
  Spinner: { to: 'Spinner' },
  Divider: { to: 'Divider' },
  Accordion: { to: 'Accordion' },
  Skeleton: { to: 'Skeleton' },
  Alert: { to: 'Alert', props: { status: 'tone' }, values: { tone: { error: 'danger', warning: 'warning', info: 'info', success: 'success' } } },
  useToast: { to: null, note: 'Klyv has a toast hook of its own; see the Toast page.' },
}

const RULES: Record<MigrateSource, Record<string, ComponentRule>> = { shadcn: SHADCN, mui: MUI, chakra: CHAKRA }

/**
 * Props every component of a library carries, dropped wherever they appear.
 *
 * Both are the same decision seen twice: colour is one accent here, and style
 * is utility classes and tokens rather than a style prop.
 */
const COMMON_DROPS: Record<MigrateSource, Record<string, string>> = {
  shadcn: { asChild: 'Klyv components render their own element.' },
  mui: { sx: 'Style with className and the tokens.', color: 'One accent themes everything, so a per-part colour has nowhere to go.' },
  chakra: { colorScheme: 'One accent themes everything, so a per-part colour has nowhere to go.' },
}

export const SOURCES: { id: MigrateSource; label: string; hint: string; imports: RegExp }[] = [
  { id: 'shadcn', label: 'shadcn/ui', hint: 'Radix parts, @/components/ui', imports: /@\/components\/ui\/[\w-]+|@radix-ui\/[\w-]+/ },
  { id: 'mui', label: 'MUI', hint: '@mui/material', imports: /@mui\/[\w-]+/ },
  { id: 'chakra', label: 'Chakra UI', hint: '@chakra-ui/react', imports: /@chakra-ui\/[\w-]+/ },
]

/** Guess which library a file came from, by its imports. */
export function detectSource(code: string): MigrateSource | null {
  for (const source of SOURCES) if (source.imports.test(code)) return source.id
  return null
}

/* ------------------------------------------------------------------ scan */

interface Tag {
  start: number
  end: number
  name: string
  attributes: string
  closing: boolean
  selfClosing: boolean
}

/**
 * Every JSX tag in the source, in order.
 *
 * Quotes and braces are tracked so a `>` inside an attribute — `onClick={() =>
 * a > b}` or `title="a > b"` — does not end the tag early, which is the one
 * thing a naive regex gets wrong on real files.
 */
function scanTags(code: string): Tag[] {
  const tags: Tag[] = []
  for (let index = 0; index < code.length; index++) {
    if (code[index] !== '<') continue
    const closing = code[index + 1] === '/'
    const nameStart = index + (closing ? 2 : 1)
    if (!/[A-Za-z]/.test(code[nameStart] ?? '')) continue

    let cursor = nameStart
    while (cursor < code.length && /[\w.$]/.test(code[cursor])) cursor++
    const name = code.slice(nameStart, cursor)

    let depth = 0
    let quote: string | null = null
    let end = -1
    for (let scan = cursor; scan < code.length; scan++) {
      const character = code[scan]
      if (quote) {
        if (character === quote && code[scan - 1] !== '\\') quote = null
        continue
      }
      if (character === '"' || character === "'" || character === '`') quote = character
      else if (character === '{') depth++
      else if (character === '}') depth--
      else if (character === '>' && depth === 0) {
        end = scan
        break
      }
    }
    if (end === -1) continue

    const inner = code.slice(cursor, end)
    tags.push({ start: index, end: end + 1, name, attributes: inner, closing, selfClosing: inner.trimEnd().endsWith('/') })
    index = end
  }
  return tags
}

/** Rewrite one tag's attributes by its rule, collecting a note for each edit. */
function rewriteAttributes(rule: ComponentRule, tag: Tag, notes: MigrateNote[]): { text: string; changed: number } {
  let text = tag.attributes
  let changed = 0

  for (const [from, to] of Object.entries(rule.props ?? {})) {
    if (from === to) continue
    const pattern = new RegExp(`(^|\\s)${from}(=|\\s|$)`, 'g')
    if (pattern.test(text)) {
      text = text.replace(pattern, `$1${to}$2`)
      changed++
      notes.push({ kind: 'prop', subject: tag.name, detail: `${from} → ${to}` })
    }
  }

  for (const [prop, reason] of Object.entries(rule.drop ?? {})) {
    // The whole attribute: a string, an expression, or a bare boolean.
    const pattern = new RegExp(`\\s${prop}(?:=(?:"[^"]*"|'[^']*'|\\{(?:[^{}]|\\{[^{}]*\\})*\\}))?`, 'g')
    if (pattern.test(text)) {
      text = text.replace(pattern, '')
      changed++
      notes.push({ kind: 'dropped', subject: tag.name, detail: `${prop} removed — ${reason}` })
    }
  }

  for (const [prop, map] of Object.entries(rule.values ?? {})) {
    text = text.replace(new RegExp(`(^|\\s)${prop}="([^"]*)"`, 'g'), (whole, lead: string, value: string) => {
      const mapped = map[value]
      if (mapped && mapped !== value) {
        changed++
        const why = rule.valueNotes?.[prop]?.[value]
        notes.push({ kind: 'prop', subject: tag.name, detail: `${prop}="${value}" → ${prop}="${mapped}"${why ? ` — ${why}` : ''}` })
        return `${lead}${prop}="${mapped}"`
      }
      const unknown = rule.unknownValues?.[prop]?.[value]
      if (unknown) {
        notes.push({ kind: 'unmapped', subject: tag.name, detail: `${prop}="${value}" — ${unknown}` })
      }
      return whole
    })
  }

  return { text, changed }
}

/**
 * Convert a file. Everything without a mapping is left exactly as it was, and
 * every edit and every gap is reported.
 */
export function migrate(code: string, source: MigrateSource): MigrateResult {
  const rules = RULES[source]
  const notes: MigrateNote[] = []
  const used = new Set<string>()
  const unmapped = new Set<string>()
  const seen = new Set<string>()
  let renamed = 0
  let props = 0

  const tags = scanTags(code)
  let output = ''
  let cursor = 0

  for (const tag of tags) {
    output += code.slice(cursor, tag.start)
    cursor = tag.end

    const found = rules[tag.name]
    const rule = found && found.to ? { ...found, drop: { ...COMMON_DROPS[source], ...found.drop } } : found
    if (!rule) {
      // Not this library's, or not something with an equivalent: leave it be.
      if (/^[A-Z]/.test(tag.name) && !seen.has(tag.name)) {
        seen.add(tag.name)
        unmapped.add(tag.name)
      }
      output += code.slice(tag.start, tag.end)
      continue
    }

    if (!rule.to) {
      if (!seen.has(tag.name)) {
        seen.add(tag.name)
        notes.push({ kind: 'unmapped', subject: tag.name, detail: rule.note ?? 'No direct equivalent; left as it was.' })
        unmapped.add(tag.name)
      }
      output += code.slice(tag.start, tag.end)
      continue
    }

    used.add(rule.to)
    if (rule.to !== tag.name && !seen.has(`${tag.name}>`)) {
      seen.add(`${tag.name}>`)
      notes.push({ kind: 'renamed', subject: tag.name, detail: `→ ${rule.to}${rule.note ? ` — ${rule.note}` : ''}` })
    } else if (rule.note && !seen.has(`${tag.name}!`)) {
      seen.add(`${tag.name}!`)
      notes.push({ kind: 'unmapped', subject: tag.name, detail: rule.note })
    }
    if (rule.to !== tag.name) renamed++

    if (tag.closing) {
      output += `</${rule.to}>`
      continue
    }
    const rewritten = rewriteAttributes(rule, tag, notes)
    props += rewritten.changed
    output += `<${rule.to}${rewritten.text}>`
  }
  output += code.slice(cursor)

  output = rewriteImports(output, source, [...used], notes)

  return {
    code: output,
    notes,
    used: [...used].sort(),
    unmapped: [...unmapped].sort(),
    counts: { tags: tags.filter((tag) => !tag.closing).length, renamed, props },
  }
}

/** Drop the old library's imports and add one for everything now in use. */
function rewriteImports(code: string, source: MigrateSource, used: string[], notes: MigrateNote[]): string {
  const matcher = SOURCES.find((entry) => entry.id === source)!.imports
  const lines = code.split('\n')
  const kept: string[] = []
  let firstImport = -1
  let removed = 0

  for (const line of lines) {
    const isImport = /^\s*import\s/.test(line)
    if (isImport && matcher.test(line)) {
      removed++
      continue
    }
    if (isImport && firstImport === -1) firstImport = kept.length
    kept.push(line)
  }
  if (removed > 0) notes.push({ kind: 'import', subject: 'imports', detail: `${removed} import${removed === 1 ? '' : 's'} from the old library removed` })
  if (used.length === 0) return kept.join('\n')

  const line = `import { ${used.slice().sort().join(', ')} } from 'klyvui'`
  notes.push({ kind: 'import', subject: 'imports', detail: `${used.length} component${used.length === 1 ? '' : 's'} imported from klyvui` })
  const at = firstImport === -1 ? 0 : firstImport
  kept.splice(at, 0, line)
  return kept.join('\n')
}
