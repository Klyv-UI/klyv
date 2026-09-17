import { useState } from 'react'
import {
  ApprovalChain,
  Button,
  DiffSummary,
  InlineMessage,
  Input,
  Label,
  Surface,
  Text,
  UndoStack,
  ValidationSummary,
  type Approver,
  type FieldChange,
  type FieldError,
  type UndoEntry,
} from 'klyv'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ---------------------------------------------------------------- data */

const CHANGES: FieldChange[] = [
  { field: 'limit', label: 'Daily limit', from: '$500', to: '$5,000', note: 'A ten-fold rise. Two approvals are needed.' },
  { field: 'reference', label: 'Reference', from: 'September rent', to: 'October rent' },
  { field: 'notify', label: 'Notify by', from: 'Email', to: 'Email and push', added: false },
  { field: 'nickname', label: 'Nickname', from: 'Rent account', removed: true },
  { field: 'category', label: 'Category', to: 'Housing', added: true },
]

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000)

const APPROVERS: Approver[] = [
  { id: 'a', name: 'Sarah Rosewood', role: 'Finance', state: 'approved', at: minutesAgo(52) },
  { id: 'b', name: 'Vaibhav Zapadiya', role: 'Second signatory', state: 'pending' },
  { id: 'c', name: 'Max Oduya', role: 'Engineering', state: 'skipped' },
  { id: 'd', name: 'Lena Fischer', role: 'Risk', state: 'pending' },
]

const STEPS: UndoEntry[] = [
  { id: '1', label: 'Added a payee' },
  { id: '2', label: 'Renamed the account' },
  { id: '3', label: 'Raised the daily limit' },
  { id: '4', label: 'Changed the reference' },
]

/* ----------------------------------------------------------- specimens */

function DiffExample() {
  const [changes, setChanges] = useState(CHANGES)

  return (
    <div className="flex w-full flex-col gap-3">
      <Surface variant="card" padding="lg" className="items-start gap-3">
        <Text size="heading">Review before sending</Text>
        <DiffSummary
          changes={changes}
          label="Changes to review"
          onRevert={(field) => setChanges((current) => current.filter((change) => change.field !== field))}
        />
        <div className="flex gap-2">
          <Button size="sm" disabled={changes.length === 0}>
            Submit for approval
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setChanges(CHANGES)}>
            Reset
          </Button>
        </div>
      </Surface>
      <Text size="caption" tone="faint" leading="normal" className="max-w-[68ch]">
        Reverting is per field. A single Discard forces an all-or-nothing decision on someone who
        has spotted one mistake among five deliberate edits — which is why that person retypes
        everything instead.
      </Text>
    </div>
  )
}

function UndoExample() {
  const [past, setPast] = useState<UndoEntry[]>(STEPS)
  const [future, setFuture] = useState<UndoEntry[]>([])

  return (
    <div className="flex w-full flex-col items-start gap-3">
      <UndoStack
        past={past}
        future={future}
        label="Edit history"
        onUndo={(steps) => {
          const moved = past.slice(-steps).reverse()
          setPast(past.slice(0, -steps))
          setFuture([...moved, ...future])
        }}
        onRedo={(steps) => {
          const moved = future.slice(0, steps)
          setFuture(future.slice(steps))
          setPast([...past, ...moved.reverse()])
        }}
      />
      <Text size="caption" tone="faint" leading="normal" className="max-w-[68ch]">
        {past.length} to undo, {future.length} to redo. Press ⌘Z or Ctrl+Z anywhere on this page —
        then try it with the cursor inside a text field, where the browser’s own undo is left alone.
      </Text>
      <input
        aria-label="A field with its own undo"
        defaultValue="Type here, then press Cmd+Z"
        className="w-full max-w-[320px] rounded-[var(--radius-field)] border border-line bg-surface px-3.5 py-2.5 text-[13px] font-medium"
      />
    </div>
  )
}

function ValidationExample() {
  const [errors, setErrors] = useState<FieldError[]>([])

  const submit = () =>
    setErrors([
      { id: 'payee-name', label: 'Payee name', message: 'Enter the name exactly as the bank holds it.' },
      { id: 'payee-account', label: 'Account number', message: 'This needs to be eight digits.' },
      { id: 'payee-amount', label: 'Amount', message: 'This is above your daily limit of $500.' },
    ])

  return (
    <div className="flex w-full max-w-[520px] flex-col gap-4">
      <ValidationSummary errors={errors} />

      <Surface variant="card" padding="lg" className="gap-4">
        {/* Ids are written by hand here rather than delegated to `Field`,
            because the summary links to them — Field generates its own. */}
        {[
          { id: 'payee-name', label: 'Payee name', value: '', placeholder: 'Sarah Rosewood' },
          { id: 'payee-account', label: 'Account number', value: '5199' },
          { id: 'payee-amount', label: 'Amount', value: '2,400.00' },
        ].map((field) => {
          const error = errors.find((entry) => entry.id === field.id)
          return (
            <div key={field.id} className="flex flex-col gap-1.5">
              <Label htmlFor={field.id}>{field.label}</Label>
              <Input
                id={field.id}
                defaultValue={field.value}
                placeholder={field.placeholder}
                invalid={Boolean(error)}
                aria-describedby={error ? `${field.id}-message` : undefined}
              />
              {error && (
                <InlineMessage id={`${field.id}-message`} tone="danger">
                  {error.message}
                </InlineMessage>
              )}
            </div>
          )
        })}
        <div className="flex gap-2">
          <Button onClick={submit}>Send money</Button>
          <Button variant="ghost" onClick={() => setErrors([])}>
            Clear errors
          </Button>
        </div>
      </Surface>

      <Text size="caption" tone="faint" leading="normal">
        Press Send: the summary appears and takes focus. Each entry is a link that moves the caret
        into the field, not just the viewport.
      </Text>
    </div>
  )
}

function ApprovalExample() {
  const [approvers, setApprovers] = useState(APPROVERS)

  const answer = (state: 'approved' | 'rejected') =>
    setApprovers((current) =>
      current.map((person) =>
        person.id === 'b'
          ? {
              ...person,
              state,
              at: new Date(),
              note: state === 'rejected' ? 'The limit rise has not been agreed with Risk.' : undefined,
            }
          : person,
      ),
    )

  return (
    <div className="flex w-full flex-col gap-3">
      <Surface variant="card" padding="lg" className="gap-3">
        <Text size="heading">Raise the daily limit to $5,000</Text>
        <ApprovalChain
          approvers={approvers}
          label="Approvals for this change"
          required={2}
          youId="b"
          onApprove={() => answer('approved')}
          onReject={() => answer('rejected')}
        />
      </Surface>
      <Button size="sm" variant="ghost" className="self-start" onClick={() => setApprovers(APPROVERS)}>
        Reset
      </Button>
    </div>
  )
}

/* ---------------------------------------------------------------- demos */

export const demos: ExampleModule = {
  'diff-summary': {
    description:
      'The list of what is about to change, before it is submitted. A form edited for ten minutes cannot be reviewed by looking at it — the fields show what the values will be, and the reader has long since forgotten what they were.',
    sections: [
      {
        title: 'Five changes',
        description: 'Set and cleared fields are their own facts, not changes from an empty string.',
        bare: true,
        Content: DiffExample,
        note: motionNote('unchanged.'),
      },
      rationale(
        'Anything with an approval step, a cost or an audit consequence needs a review moment, and a form cannot be one — it only knows its current state.',
        'Stating both values per field at the moment of submission is the review, and per-field revert means spotting one mistake does not cost the other five edits.',
        'A limit change, a payee edit, a settings page with consequences, anything queued for approval.',
        ['Surface', 'Tag', 'Text'],
      ),
    ],
    props: [
      { name: 'changes', type: 'FieldChange[]', description: 'label, from, to, plus added and removed for the two special cases.' },
      { name: 'onRevert', type: '(field: string) => void', description: 'Put one field back. Omit for a read-only summary.' },
      { name: 'emptyLabel', type: 'string', description: 'Copy when nothing has changed.' },
    ],
  },

  'undo-stack': {
    description:
      'Undo and redo, with the history behind them visible. An undo button that says only “Undo” asks the reader to remember what they last did — and after a few minutes of work they do not, so they press it, watch something change, and press redo.',
    sections: [
      {
        title: 'Example',
        description: 'Try ⌘Z on the page, then inside the field, where the browser’s own undo is left alone.',
        bare: true,
        Content: UndoExample,
        note: motionNote('unchanged.'),
      },
      rationale(
        'Undo is the safety net that makes a destructive interface usable, and an unlabelled one is a gamble rather than a decision.',
        'Naming each step turns it into a choice, the history makes jumping back four steps one action instead of four, and ignoring the shortcut inside a field respects something older and more familiar than this component.',
        'An editor toolbar, a settings page, a canvas, a bulk-edit table.',
        ['Kbd', 'Surface', 'Text', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'past / future', type: 'UndoEntry[]', description: 'Applied steps oldest first; undone steps most recent first.' },
      { name: 'onUndo / onRedo', type: '(steps: number) => void', description: 'The count is what makes the history list one action.' },
      { name: 'shortcuts', type: 'boolean', defaultValue: 'true', description: 'Bind the platform shortcuts — skipped while a field has focus.' },
      { name: 'historyLimit', type: 'number', defaultValue: '8', description: 'Entries offered in the list.' },
    ],
  },

  'validation-summary': {
    description:
      'The digest at the top of a form listing everything wrong, with a link to each field. Inline messages alone fail the case that matters: a long form, submitted, with one error below the fold — nothing appears to happen.',
    sections: [
      {
        title: 'Example',
        description: 'Press Send. The summary appears, takes focus, and each entry moves the caret into its field.',
        bare: true,
        Content: ValidationExample,
        note: motionNote('unchanged — the scroll into view is smooth by default and reduced-motion users get a jump.'),
      },
      rationale(
        'A rejected submission that produces no perceivable change is the most common accessibility failure in any product with a long form.',
        'The summary is the established technique: it takes focus, so the heading and count are announced, and links move the caret rather than only the viewport — which a scrollIntoView never does.',
        'Any form long enough to scroll. Which is most of them.',
        ['Text', 'focus management', 'status tokens'],
      ),
    ],
    props: [
      { name: 'errors', type: 'FieldError[]', description: 'id of the control, its label, and what to do about it.' },
      { name: 'title', type: 'string', description: 'Override the generated heading.' },
      { name: 'focusOnError', type: 'boolean', defaultValue: 'true', description: 'Take focus on the transition into an error state, not on every keystroke.' },
    ],
  },

  'approval-chain': {
    description:
      'Who has signed off, who has not, and whether that is enough yet. Approvals are usually drawn as a Stepper, which is wrong in the way that matters: a stepper is a sequence, and approvals are parallel.',
    sections: [
      {
        title: 'Two of four, quorum of two',
        description: 'Approve or reject as the second signatory. One rejection ends it either way.',
        bare: true,
        Content: ApprovalExample,
        note: motionNote('unchanged.'),
      },
      rationale(
        'Three people can be waiting at once, the second can answer before the first, and the quorum can be met without everyone replying — none of which a sequence can express.',
        'A count against a rule can, including the case every sequential version gets wrong: one rejection ends it however many approvals are already in.',
        'A limit change, a large payment, a contract, a deployment gate.',
        ['Avatar', 'Meter', 'StatusDot', 'Button'],
      ),
    ],
    props: [
      { name: 'approvers', type: 'Approver[]', description: 'name, role, state, at, note.' },
      { name: 'required', type: 'number', description: 'The quorum. Defaults to everyone not skipped.' },
      { name: 'youId', type: 'string', description: 'Whose row gets the actions.' },
      { name: 'onApprove / onReject', type: 'fn / fn', description: 'Offered only while it is genuinely your turn.' },
    ],
  },
}
