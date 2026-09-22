import { useState } from 'react'
import { Copy, Download, Pencil, Send, Share2, Trash2 } from 'lucide-react'
import {
  ActionSheet,
  AlertDialog,
  Button,
  Card,
  CommandPalette,
  ConfirmDialog,
  ContextMenu,
  Drawer,
  Field,
  Input,
  Modal,
  Surface,
  Text,
  ToastProvider,
  useToast,
} from 'klyvui'
import type { ExampleModule } from './types'

function ModalExample() {
  const [open, setOpen] = useState(false)
  const [large, setLarge] = useState(false)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open a dialog
      </Button>
      <Button
        variant="ghost"
        onClick={() => {
          setLarge(true)
          setOpen(true)
        }}
      >
        Open a large one
      </Button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false)
          setLarge(false)
        }}
        size={large ? 'lg' : 'md'}
        title="Send money"
        description="Funds usually arrive the next working day."
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => setOpen(false)}>
              Send $500.00
            </Button>
          </>
        }
      >
        <div className="mt-1 flex flex-col gap-3">
          <Field label="Recipient" required>
            <Input defaultValue="Sarah Rosewood" />
          </Field>
          <Field label="Reference" hint="Shown on their statement.">
            <Input placeholder="Rent for October" />
          </Field>
        </div>
      </Modal>
      <Text size="caption" tone="faint">
        Tab inside — focus is trapped, and returns to the trigger on close. Escape and the backdrop
        both dismiss.
      </Text>
    </div>
  )
}

function DrawerExample() {
  const [side, setSide] = useState<'left' | 'right' | 'bottom' | null>(null)
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(['left', 'right', 'bottom'] as const).map((option) => (
        <Button key={option} variant="outline" size="sm" onClick={() => setSide(option)}>
          Open from {option}
        </Button>
      ))}
      <Drawer
        open={side !== null}
        onClose={() => setSide(null)}
        side={side ?? 'left'}
        title="Filters"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setSide(null)}>
              Reset
            </Button>
            <Button size="sm" onClick={() => setSide(null)}>
              Apply
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          <Field label="Reference">
            <Input placeholder="Search references" />
          </Field>
          <Text size="caption" tone="faint" leading="normal">
            The panel slides from the edge it belongs to, which is what tells the reader where
            dismissing will send it.
          </Text>
        </div>
      </Drawer>
    </div>
  )
}

function DialogExample() {
  const [alert, setAlert] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [result, setResult] = useState('nothing yet')

  return (
    <div className="flex flex-col items-start gap-3">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setAlert(true)}>
          Cancel a transfer
        </Button>
        <Button variant="outline" size="sm" onClick={() => setConfirm(true)}>
          Close the account
        </Button>
      </div>

      <AlertDialog
        open={alert}
        onClose={() => setAlert(false)}
        onConfirm={() => {
          setResult('transfer cancelled')
          setAlert(false)
        }}
        destructive
        title="Cancel this transfer?"
        description="£369.41 will be returned to your balance. This cannot be undone."
        confirmLabel="Cancel transfer"
        cancelLabel="Keep it"
      />

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          setResult('account closed')
          setConfirm(false)
        }}
        destructive
        title="Close this account?"
        description="Everything in it will be moved to your main balance and the account number will stop working."
        confirmationText="CLOSE"
        confirmLabel="Close account"
      />

      <Text size="caption" tone="faint" role="status" aria-live="polite">
        Result: {result}
      </Text>
      <Text size="caption" tone="faint" leading="normal" className="max-w-[62ch]">
        Neither can be dismissed by Escape or the backdrop, and neither has a close control — a
        question the user can dismiss by accident is a question that will be.
      </Text>
    </div>
  )
}

function ActionSheetExample() {
  const [open, setOpen] = useState(false)
  const [last, setLast] = useState('none')
  return (
    <div className="flex flex-col items-start gap-3">
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open the sheet
      </Button>
      <ActionSheet
        open={open}
        onClose={() => setOpen(false)}
        title="Apple Music"
        description="Monthly plan, $8,99"
        actions={[
          { id: 'share', label: 'Share receipt', icon: Share2, onSelect: () => setLast('Share') },
          { id: 'export', label: 'Download PDF', icon: Download, onSelect: () => setLast('Download') },
          { id: 'edit', label: 'Change plan', icon: Pencil, onSelect: () => setLast('Change plan') },
          {
            id: 'cancel',
            label: 'Cancel subscription',
            description: 'Stops after the current period',
            icon: Trash2,
            destructive: true,
            onSelect: () => setLast('Cancel'),
          },
        ]}
      />
      <Text size="caption" tone="faint" role="status" aria-live="polite">
        Last chosen: {last}
      </Text>
    </div>
  )
}

function ContextMenuExample() {
  const [last, setLast] = useState('none')
  return (
    <div className="flex w-full flex-col items-start gap-3">
      <ContextMenu
        label="Transaction actions"
        items={[
          { id: 'copy', label: 'Copy reference', icon: Copy, meta: '⌘C', onSelect: () => setLast('Copy') },
          { id: 'export', label: 'Download receipt', icon: Download, onSelect: () => setLast('Download') },
          'separator',
          { id: 'delete', label: 'Hide transaction', icon: Trash2, destructive: true, onSelect: () => setLast('Hide') },
        ]}
        className="w-full max-w-[380px]"
      >
        <Card className="w-full">
          <Text>Right-click anywhere on this card</Text>
          <Text size="caption" tone="faint" leading="normal" className="mt-1">
            Or focus it and press the context-menu key, or Shift+F10 — otherwise the menu would be
            unreachable without a mouse.
          </Text>
        </Card>
      </ContextMenu>
      <Text size="caption" tone="faint" role="status" aria-live="polite">
        Last chosen: {last}
      </Text>
    </div>
  )
}

function CommandPaletteExample() {
  const [open, setOpen] = useState(false)
  const [last, setLast] = useState('none')
  const run = (label: string) => () => setLast(label)
  return (
    <div className="flex flex-col items-start gap-3">
      <Button variant="outline" onClick={() => setOpen(true)}>
        Open the palette
      </Button>
      <CommandPalette
        open={open}
        onClose={() => setOpen(false)}
        commands={[
          { id: 'send', group: 'Money', label: 'Send money', icon: Send, shortcut: ['⌘', 'N'], onSelect: run('Send money') },
          { id: 'exchange', group: 'Money', label: 'Exchange currency', keywords: ['fx', 'convert'], onSelect: run('Exchange') },
          { id: 'withdraw', group: 'Money', label: 'Withdraw cashback', onSelect: run('Withdraw') },
          { id: 'overview', group: 'Go to', label: 'Overview', shortcut: ['G', 'O'], onSelect: run('Overview') },
          { id: 'activity', group: 'Go to', label: 'Activity', shortcut: ['G', 'A'], onSelect: run('Activity') },
          { id: 'settings', group: 'Go to', label: 'Settings', onSelect: run('Settings') },
          { id: 'export', group: 'Account', label: 'Export statement', icon: Download, onSelect: run('Export') },
        ]}
      />
      <Text size="caption" tone="faint" role="status" aria-live="polite">
        Last run: {last}
      </Text>
      <Text size="caption" tone="faint" leading="normal" className="max-w-[62ch]">
        Type to filter, arrows to move, Enter to run. Focus stays in the input the whole time and
        the active row is tracked with aria-activedescendant, so typing never has to stop.
      </Text>
    </div>
  )
}

function ToastDemo() {
  const { toast } = useToast()
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={() => toast({ title: 'Transfer sent', description: '£369.41 to Sarah Rosewood', tone: 'success' })}
      >
        Success
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() =>
          toast({
            title: 'Subscription cancelled',
            tone: 'neutral',
            action: { label: 'Undo', onSelect: () => toast({ title: 'Restored', tone: 'success' }) },
          })
        }
      >
        With an action
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => toast({ title: 'Payment failed', description: 'The bank declined it.', tone: 'danger', duration: 0 })}
      >
        Persistent
      </Button>
    </div>
  )
}

function ToastExample() {
  return (
    <ToastProvider placement="bottom-right">
      <div className="flex flex-col items-start gap-3">
        <ToastDemo />
        <Text size="caption" tone="faint" leading="normal" className="max-w-[62ch]">
          The region is a polite live region, so a toast is announced without stealing focus. That
          is also why a toast must never be the only place an action lives — it disappears, and
          anything reachable only by racing it is not reachable.
        </Text>
      </div>
    </ToastProvider>
  )
}

export const demos: ExampleModule = {
  modal: {
    description:
      'A centred dialog. It brings together the four things an accessible modal needs and that are almost always partly missing: a Portal so it escapes ancestor clipping, a FocusTrap that restores focus on close, scroll lock on the page behind, and Escape plus backdrop dismissal. Everything else in the overlay family builds on this.',
    sections: [{ title: 'Example', bare: true, Content: ModalExample }],
    props: [
      { name: 'open / onClose', type: 'boolean / fn', description: 'Controlled visibility.' },
      { name: 'title / description', type: 'string', description: 'Become the accessible name and description.' },
      { name: 'footer', type: 'ReactNode', description: 'Actions row, aligned to the end.' },
      { name: 'size', type: "'sm' | 'md' | 'lg'", defaultValue: "'md'", description: '380 · 520 · 720px.' },
      { name: 'dismissible', type: 'boolean', defaultValue: 'true', description: 'Off forces a choice — no Escape, no backdrop, no close control.' },
      { name: 'role', type: "'dialog' | 'alertdialog'", defaultValue: "'dialog'", description: 'Use alertdialog for a destructive confirmation.' },
    ],
  },

  drawer: {
    description:
      'A panel anchored to an edge — the mobile navigation, a filter sheet, a detail view. It shares the Modal machinery and differs only in where it comes from. The panel slides rather than fades, because the direction tells the reader where it came from.',
    sections: [{ title: 'Example', bare: true, Content: DrawerExample }],
    props: [
      { name: 'side', type: "'left' | 'right' | 'bottom'", defaultValue: "'left'", description: 'Which edge it slides from.' },
      { name: 'title', type: 'string', description: 'Accessible name, and the header text unless bare.' },
      { name: 'bare', type: 'boolean', defaultValue: 'false', description: 'Hide the header and supply your own.' },
      { name: 'footer', type: 'ReactNode', description: 'Pinned below a divider.' },
    ],
  },

  'action-sheet': {
    description:
      'A bottom sheet of choices, for touch. The rows are deliberately tall and full-width: this is the pattern for where a dropdown menu would be too small to hit accurately with a thumb. It is a Drawer anchored to the bottom, so dismissal and focus work the same as every other overlay.',
    sections: [{ title: 'Example', bare: true, Content: ActionSheetExample }],
    props: [
      { name: 'actions', type: 'ActionSheetAction[]', description: 'id, label, icon, description, destructive, disabled.' },
      { name: 'title / description', type: 'string', description: 'What the sheet is about.' },
      { name: 'cancelLabel', type: 'string', defaultValue: "'Cancel'", description: 'Text on the trailing dismiss row.' },
    ],
  },

  'alert-dialog': {
    description:
      'A dialog that forces a choice. It uses alertdialog semantics, has no close control and cannot be dismissed by Escape or the backdrop. The confirm label should name the action rather than agree with a question, so it still makes sense read on its own.',
    sections: [{ title: 'Example', bare: true, Content: DialogExample }],
    props: [
      { name: 'title / description', type: 'string', description: 'The question and its consequence.' },
      { name: 'onConfirm / confirmLabel', type: 'fn / string', description: 'Name the action, not "OK".' },
      { name: 'destructive', type: 'boolean', defaultValue: 'false', description: 'Reddens the confirm button.' },
      { name: 'busy / confirmDisabled', type: 'boolean', description: 'Spinner while running; blocked without implying work.' },
    ],
  },

  'confirm-dialog': {
    description:
      'AlertDialog with the standard confirm and cancel pair, plus optional typed confirmation for the genuinely irreversible cases. Typed confirmation is a deliberate speed bump — reserve it for actions that destroy data, since asking routinely trains people to type past it.',
    sections: [{ title: 'Example', description: 'The second button requires typing CLOSE before it will confirm.', bare: true, Content: DialogExample }],
    props: [
      { name: 'confirmationText', type: 'string', description: 'Must be typed exactly before confirming becomes possible.' },
      { name: 'destructive / busy', type: 'boolean', description: 'As AlertDialog.' },
    ],
  },

  'context-menu': {
    description:
      'A menu opened at the pointer with a right-click. It also opens with the keyboard context-menu key and with Shift+F10, anchored to the focused element — without that it is unreachable for anyone not using a mouse. A context menu must never be the only route to an action.',
    sections: [{ title: 'Example', bare: true, Content: ContextMenuExample }],
    props: [
      { name: 'items', type: "(MenuItem | 'separator')[]", description: 'Shares the Menu item shape.' },
      { name: 'label', type: 'string', description: 'Accessible name for the menu.' },
    ],
  },

  'command-palette': {
    description:
      'Keyboard-first command launcher. Matching is a plain case-insensitive substring over the label, group and keywords — predictable enough that a user learns which prefix reaches which command, which is the whole value of a palette.',
    sections: [{ title: 'Example', bare: true, Content: CommandPaletteExample }],
    props: [
      { name: 'commands', type: 'Command[]', description: 'id, label, group, icon, keywords, shortcut, onSelect.' },
      { name: 'open / onClose', type: 'boolean / fn', description: 'Controlled visibility.' },
      { name: 'emptyMessage', type: 'string', description: 'Shown when nothing matches.' },
    ],
  },

  toast: {
    description:
      'Transient confirmations, queued and stacked. Wrap the application in ToastProvider and raise them from anywhere with useToast. The region is a polite live region, so a toast is announced without stealing focus.',
    sections: [
      { title: 'Example', bare: true, Content: ToastExample },
      {
        title: 'Usage',
        bare: true,
        Content: () => (
          <Surface variant="sunken" padding="md" className="w-full">
            <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-ink-soft">
{`<ToastProvider placement="bottom-right">
  <App />
</ToastProvider>

// anywhere below it
const { toast } = useToast()
toast({ title: 'Transfer sent', tone: 'success' })`}
            </pre>
          </Surface>
        ),
        note: 'Pass duration: 0 for a toast that stays until dismissed. Use it for failures — a five-second window is not long enough to read and act on an error.',
      },
    ],
    props: [
      { name: 'ToastProvider.max', type: 'number', defaultValue: '4', description: 'Oldest are dropped beyond this.' },
      { name: 'ToastProvider.placement', type: "'top-right' | 'bottom-right' | 'bottom-center'", defaultValue: "'bottom-right'", description: 'Where the stack sits.' },
      { name: 'toast(options)', type: '{ title, description?, tone?, duration?, action? }', description: 'Raises one. Returns its id.' },
    ],
  },
}
