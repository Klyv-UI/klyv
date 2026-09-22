import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, Check, Copy, FileCode2, Upload } from 'lucide-react'
import { Badge, Button, CodeBlock, SegmentedControl, Tag, Text, Textarea, VisuallyHidden, cn } from 'klyvui'
import { PageIntro } from '../components/PageIntro'
import { Note, Section } from '../components/Doc'
import { SOURCES, detectSource, migrate, type MigrateNote, type MigrateSource } from '../lib/migrate'
import { findComponentByName } from '../data/catalog'

/**
 * Paste a component file from another library and get this one back.
 *
 * Adoption is the hard part of any component library: a team has files full
 * of another one and no appetite for a week of hand-edits. This does the
 * mechanical half in the browser — tags renamed, props mapped, imports
 * rewritten — and is loud about the half it cannot do. Every rename, every
 * dropped prop and every part with no equivalent is listed with the reason,
 * because a converted file that silently lost `color="error"` is worse than
 * one that was never converted.
 */
const SAMPLES: Record<MigrateSource, string> = {
  shadcn: `import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"

export function InviteCard({ open, onOpenChange }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite a teammate</CardTitle>
      </CardHeader>
      <Separator />
      <CardContent>
        <Input type="email" placeholder="ada@example.com" />
        <Switch checked={open} onCheckedChange={onOpenChange} />
        <Button variant="destructive" size="lg">Remove access</Button>
        <Button variant="secondary" size="sm">Cancel</Button>
        <Button>Send invite</Button>
      </CardContent>
    </Card>
  )
}`,
  mui: `import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import Alert from '@mui/material/Alert'
import CircularProgress from '@mui/material/CircularProgress'

export function Billing({ busy }) {
  return (
    <Stack spacing={2} sx={{ p: 3 }}>
      <Typography variant="h3">Billing</Typography>
      <Alert severity="error">Your card expired.</Alert>
      <TextField label="Card number" helperText="We never store it" variant="outlined" />
      <Button variant="contained" color="primary" size="large" disableElevation>
        {busy ? <CircularProgress size={16} /> : 'Save card'}
      </Button>
    </Stack>
  )
}`,
  chakra: `import { Box, Button, HStack, Heading, Switch, Tag, Text, Tooltip } from '@chakra-ui/react'

export function Workspace({ pro }) {
  return (
    <Box p={6}>
      <Heading size="lg">Northwind</Heading>
      <HStack spacing={3}>
        <Text fontSize="sm">Billing and team settings</Text>
        {pro && <Tag>Pro</Tag>}
      </HStack>
      <Tooltip label="Everyone in the workspace can see this">
        <Switch colorScheme="green" defaultChecked />
      </Tooltip>
      <Button colorScheme="blue" variant="solid" size="lg">Save changes</Button>
    </Box>
  )
}`,
}

const KINDS: { kind: MigrateNote['kind']; label: string; tone: 'accent' | 'neutral' | 'outline' }[] = [
  { kind: 'renamed', label: 'Renamed', tone: 'accent' },
  { kind: 'prop', label: 'Props mapped', tone: 'accent' },
  { kind: 'dropped', label: 'Dropped', tone: 'neutral' },
  { kind: 'unmapped', label: 'Needs a look', tone: 'outline' },
  { kind: 'import', label: 'Imports', tone: 'neutral' },
]

export default function MigratePage() {
  const [source, setSource] = useState<MigrateSource>('shadcn')
  const [code, setCode] = useState(SAMPLES.shadcn)
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const detected = useMemo(() => detectSource(code), [code])
  const effective = detected ?? source
  const result = useMemo(() => migrate(code, effective), [code, effective])

  const take = (next: string) => {
    setCode(next)
    const found = detectSource(next)
    if (found) setSource(found)
  }

  const readFile = (file: File | undefined) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => take(String(reader.result ?? ''))
    reader.readAsText(file)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  const byKind = (kind: MigrateNote['kind']) => result.notes.filter((note) => note.kind === kind)
  const attention = byKind('unmapped')

  return (
    <div className="flex flex-col gap-10">
      <PageIntro
        title="Bring the code you already have"
        eyebrow="Migrate"
        stats={[
          { value: String(result.counts.tags), label: 'tags read' },
          { value: String(result.counts.renamed), label: 'renamed' },
          { value: String(result.counts.props), label: 'props mapped' },
          { value: String(attention.length), label: 'need a look' },
        ]}
      >
        Paste a component file from shadcn/ui, MUI or Chakra. It is rewritten here in your browser — tags renamed,
        props mapped, imports replaced — and everything that has no equivalent is listed underneath with the reason,
        rather than quietly dropped.
      </PageIntro>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* What they have. */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <SegmentedControl<MigrateSource>
              label="Coming from"
              size="sm"
              value={effective}
              onValueChange={(next) => {
                setSource(next)
                setCode(SAMPLES[next])
              }}
              options={SOURCES.map((entry) => ({ value: entry.id, label: entry.label }))}
            />
            {detected && (
              <Tag size="sm" tone="accent">
                Detected from the imports
              </Tag>
            )}
            <Button variant="ghost" size="sm" onClick={() => inputRef.current?.click()} className="ml-auto">
              <Upload size={14} aria-hidden />
              Open a file
            </Button>
            <input
              ref={inputRef}
              type="file"
              accept=".tsx,.jsx,.ts,.js,text/plain"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={(event) => {
                readFile(event.target.files?.[0])
                event.target.value = ''
              }}
            />
          </div>

          <label className="flex flex-col gap-1.5">
            <Text as="span" size="label" weight="semibold">
              Your file
            </Text>
            <Textarea
              rows={22}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              onDrop={(event) => {
                const file = event.dataTransfer.files[0]
                if (!file) return
                event.preventDefault()
                readFile(file)
              }}
              className="font-mono text-[12px]"
            />
          </label>
        </div>

        {/* What they get. */}
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-center gap-3">
            <Text as="span" size="label" weight="semibold" className="inline-flex items-center gap-2">
              <FileCode2 size={15} aria-hidden className="text-ink-faint" />
              In Klyv
            </Text>
            <Button variant="outline" size="sm" onClick={copy} className="ml-auto">
              {copied ? <Check size={14} strokeWidth={3} aria-hidden /> : <Copy size={14} aria-hidden />}
              {copied ? 'Copied' : 'Copy'}
              <VisuallyHidden>
                <span role="status" aria-live="polite">
                  {copied ? 'Converted file copied to clipboard' : ''}
                </span>
              </VisuallyHidden>
            </Button>
          </div>
          <CodeBlock language="tsx" code={result.code} collapsible collapsedLines={26} />
        </div>
      </div>

      <Section title="What it did, and what it could not">
        <Note>
          A codemod, not a compiler. It rewrites what it has a mapping for and leaves everything else exactly as it
          found it — so the output compiles only after the parts below are dealt with by hand. Nothing is uploaded:
          the rewrite runs in this tab.
        </Note>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {KINDS.map((entry) => {
            const notes = byKind(entry.kind)
            if (notes.length === 0) return null
            return (
              <section
                key={entry.kind}
                className={cn(
                  'flex flex-col gap-2.5 rounded-[var(--radius-card)] border bg-surface p-4',
                  entry.kind === 'unmapped' ? 'border-line-strong md:col-span-2' : 'border-line',
                )}
              >
                <h3 className="flex items-center gap-2">
                  <Text as="span" size="label" weight="bold">
                    {entry.label}
                  </Text>
                  <Badge>{notes.length}</Badge>
                </h3>
                <ul className="flex flex-col gap-1.5">
                  {notes.map((note, index) => (
                    <li key={`${note.subject}-${index}`} className="flex flex-wrap items-baseline gap-x-2">
                      <Text as="span" size="caption" weight="bold" className="font-mono text-[12px]">
                        {note.subject}
                      </Text>
                      <Text as="span" size="caption" tone="soft" className="min-w-0 flex-1">
                        {note.detail}
                      </Text>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>

        {result.used.length > 0 && (
          <div className="mt-6 flex flex-col gap-2">
            <Text as="span" size="label" weight="semibold">
              Components it now uses
            </Text>
            <ul className="flex flex-wrap gap-1.5">
              {result.used.map((name) => {
                const entry = findComponentByName(name)
                return (
                  <li key={name}>
                    {entry ? (
                      <Link
                        to={`/components/${entry.slug}`}
                        className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-3 py-1.5 font-mono text-[12px] font-semibold text-ink-soft transition-colors hover:border-line-strong hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {name}
                        <ArrowRight size={11} aria-hidden className="text-ink-faint" />
                      </Link>
                    ) : (
                      <span className="inline-flex rounded-full border border-line px-3 py-1.5 font-mono text-[12px] font-semibold text-ink-soft">
                        {name}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {result.unmapped.length > 0 && (
          <div className="mt-6 flex flex-col gap-2">
            <Text as="span" size="label" weight="semibold">
              Left untouched
            </Text>
            <Text size="caption" tone="soft" className="max-w-[70ch]">
              These were not recognised as {SOURCES.find((entry) => entry.id === effective)?.label} components, so they
              were left exactly as they were: your own components, and anything this tool has no mapping for.
            </Text>
            <p className="m-0 flex flex-wrap gap-1.5">
              {result.unmapped.map((name) => (
                <span key={name} className="rounded-full bg-surface-muted px-2.5 py-1 font-mono text-[12px] font-semibold text-ink-soft">
                  {name}
                </span>
              ))}
            </p>
          </div>
        )}
      </Section>
    </div>
  )
}
