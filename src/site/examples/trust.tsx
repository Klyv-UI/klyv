import { useState } from 'react'
import {
  AuditTrail,
  Button,
  ConsentManager,
  DescriptionList,
  MaskedValue,
  PermissionGate,
  SegmentedControl,
  Surface,
  Text,
  type AuditEntry,
  type ConsentCategory,
} from 'klyv'
import type { ExampleModule } from './types'
import { motionNote, rationale } from './shared'

/* ---------------------------------------------------------------- data */

const CATEGORIES: ConsentCategory[] = [
  {
    id: 'essential',
    label: 'Keeping you signed in',
    description: 'Session cookies and fraud checks. Without these the account will not open.',
    required: true,
  },
  {
    id: 'analytics',
    label: 'Product analytics',
    description: 'Which screens are used, and where people get stuck.',
    recipients: ['Fathom'],
  },
  {
    id: 'personalisation',
    label: 'Personalised insights',
    description: 'Spending categories used to suggest budgets and cashback partners.',
  },
  {
    id: 'marketing',
    label: 'Marketing',
    description: 'Emails about new features and partner offers.',
    recipients: ['Customer.io', 'Meta'],
  },
]

const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000)

const AUDIT: AuditEntry[] = [
  {
    id: '1',
    at: hoursAgo(0.4),
    actor: { name: 'Sarah Rosewood' },
    action: 'changed',
    target: 'the daily transfer limit',
    source: 'Chrome on Windows · 82.14.6.3',
    changes: [{ field: 'Daily limit', from: '$500', to: '$5,000' }],
  },
  {
    id: '2',
    at: hoursAgo(3),
    actor: { name: 'Vaibhav Zapadiya', you: true },
    action: 'added',
    target: 'a payee',
    changes: [
      { field: 'Name', from: null, to: 'Northwind Energy' },
      { field: 'Account', from: null, to: '**** 8841' },
    ],
  },
  {
    id: '3',
    at: hoursAgo(27),
    actor: { name: 'Max Oduya' },
    action: 'revoked',
    target: 'an API key',
    source: 'API · key ending 4f2a',
  },
  {
    id: '4',
    at: hoursAgo(30),
    actor: { name: 'Sarah Rosewood' },
    action: 'changed',
    target: 'the statement address',
    changes: [
      { field: 'Address', from: '12 Rowan Street', to: '4 Kestrel Court' },
      { field: 'Postcode', from: 'E2 8AA', to: 'SE1 9RT' },
    ],
  },
]

const SCOPE_NAMES = {
  'limits:write': 'Change limits',
  'audit:read': 'View the audit log',
  'payees:write': 'Manage payees',
}

/* ----------------------------------------------------------- specimens */

function MaskedExample() {
  return (
    <Surface variant="card" padding="lg" className="w-full max-w-[480px] gap-3">
      <Text size="heading">Everyday account</Text>
      <DescriptionList
        items={[
          {
            term: 'Card number',
            description: (
              <MaskedValue
                label="Card number"
                value="4029518844105199"
                group={4}
                hideAfter={8000}
                copyValue="4029518844105199"
              />
            ),
          },
          {
            term: 'Sort code',
            description: <MaskedValue label="Sort code" value="040004" tail={2} copyable={false} />,
          },
          {
            term: 'IBAN',
            description: <MaskedValue label="IBAN" value="GB29NWBK60161331926819" tail={4} />,
          },
        ]}
      />
      <Text size="caption" tone="faint" leading="normal">
        Revealed values hide themselves again after eight seconds here. Copy never reveals — wanting
        the value in the clipboard is not the same as wanting it on a screen in an office.
      </Text>
    </Surface>
  )
}

function ConsentExample() {
  const [value, setValue] = useState<Record<string, boolean>>({
    essential: true,
    analytics: true,
    personalisation: false,
    marketing: false,
  })
  const [saved, setSaved] = useState<string | null>(null)

  return (
    <div className="flex w-full flex-col gap-2">
      <ConsentManager
        categories={CATEGORIES}
        value={value}
        onChange={setValue}
        onSave={(next) =>
          setSaved(
            Object.entries(next)
              .filter(([, on]) => on)
              .map(([id]) => id)
              .join(', '),
          )
        }
        label="Privacy choices"
        description="Choose what you are comfortable with. You can change any of this later, and rejecting everything optional costs you nothing but the extras."
      />
      <Text size="caption" tone="faint" role="status" aria-live="polite">
        {saved ? `Saved: ${saved}.` : 'Nothing saved yet.'}
      </Text>
    </div>
  )
}

function GateExample() {
  const [role, setRole] = useState<'admin' | 'analyst' | 'viewer'>('analyst')

  const granted =
    role === 'admin'
      ? ['limits:write', 'audit:read', 'payees:write']
      : role === 'analyst'
        ? ['audit:read']
        : []

  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="Signed in as"
        size="sm"
        value={role}
        onValueChange={(value) => setRole(value as typeof role)}
        className="self-start"
        options={[
          { value: 'admin', label: 'Admin' },
          { value: 'analyst', label: 'Analyst' },
          { value: 'viewer', label: 'Viewer' },
        ]}
      />

      <PermissionGate
        granted={granted}
        requires={['limits:write']}
        names={SCOPE_NAMES}
        label="limits"
        onRequest={() => undefined}
      >
        <Surface variant="card" padding="lg" className="items-start gap-2">
          <Text size="heading">Daily transfer limit</Text>
          <Text size="amount" tabular>
            $5,000
          </Text>
          <Button size="sm" variant="outline">
            Change the limit
          </Button>
        </Surface>
      </PermissionGate>

      <Text size="caption" tone="faint" leading="normal" className="max-w-[66ch]">
        A blank space where a panel should be reads as a bug and produces a support ticket. The
        refusal names the region, the missing permission, and a way to ask.
      </Text>
    </div>
  )
}

function AuditExample() {
  return (
    <Surface variant="card" padding="lg" className="w-full gap-3">
      <Text size="heading">Account activity</Text>
      <AuditTrail entries={AUDIT} label="Audit trail" />
    </Surface>
  )
}

/* ---------------------------------------------------------------- demos */

export const demos: ExampleModule = {
  'masked-value': {
    description:
      'A sensitive value shown as dots until someone asks for it. The real value is not in the DOM while it is masked — hiding it with CSS puts a card number in the accessibility tree, the page source and any extension reading the document.',
    sections: [
      {
        title: 'Three values',
        description: 'Reveal one and it hides itself again. Copy works without revealing.',
        bare: true,
        Content: MaskedExample,
        note: motionNote('unchanged — the reveal is a state change, not a transition.'),
      },
      rationale(
        'Masking done with a font or a CSS filter looks identical and protects nothing: the value is still in the document for anything that reads documents.',
        'Rendering it only when revealed is the version that is actually true, and hiding it again matters more than the reveal — the risk is the twenty minutes afterwards.',
        'Card numbers, account details, API keys, recovery codes.',
        ['Text', 'VisuallyHidden', 'Clipboard API'],
      ),
    ],
    props: [
      { name: 'value / label', type: 'string / string', description: 'The real value, and what it is — used in every announcement.' },
      { name: 'tail', type: 'number', defaultValue: '4', description: 'Characters left visible while masked.' },
      { name: 'hideAfter', type: 'number', defaultValue: '20000', description: 'Milliseconds before it re-hides. 0 keeps it shown.' },
      { name: 'group', type: 'number', defaultValue: '0', description: 'Group the digits — 4 for a card number.' },
      { name: 'copyable / copyValue', type: 'boolean / string', description: 'Copy without revealing; and what to copy instead.' },
    ],
  },

  'consent-manager': {
    description:
      'Granular consent, with rejecting everything exactly as easy as accepting it. The two bulk buttons are the same size and side by side — a choice that is cheaper to give than to withhold is not a choice.',
    sections: [
      {
        title: 'Example',
        description: 'The essential category is shown, on, disabled, and explained rather than hidden.',
        bare: true,
        Content: ConsentExample,
        note: motionNote('unchanged.'),
      },
      rationale(
        'Every dark pattern in this space is built the same way: a bright Accept all beside a grey link to a settings page nobody opens.',
        'Equal weight for both bulk actions, required categories shown rather than hidden, and recipients named per category — “Analytics” is not informed consent, “Analytics — shared with Fathom” is.',
        'First run, a privacy settings page, a cookie banner that is not a lie.',
        ['Switch', 'Button', 'Surface', 'Text'],
      ),
    ],
    props: [
      { name: 'categories', type: 'ConsentCategory[]', description: 'label, description, required, recipients.' },
      { name: 'value / onChange', type: 'Record<string, boolean> / fn', description: 'Which are on. Required ones are treated as on regardless.' },
      { name: 'onSave', type: '(value) => void', description: 'Called by Save, and by both bulk buttons.' },
      { name: 'description', type: 'string', description: 'Copy above the list.' },
    ],
  },

  'permission-gate': {
    description:
      'Shows a region only to people who may see it, and says so plainly when they may not. The default is an explanation, not emptiness — a blank space where a panel should be is read as a bug, and the support ticket costs more than the sentence.',
    sections: [
      {
        title: 'Three roles',
        description: 'Only Admin holds limits:write. The other two get the refusal.',
        bare: true,
        Content: GateExample,
        note: motionNote('unchanged.'),
      },
      rationale(
        'Hiding what someone cannot use is the right instinct and the usual implementation — rendering null — produces a product full of mysterious gaps nobody can ask about.',
        'Naming the region and the missing permission turns a dead end into a request, and `silent` stays opt-in because it is the wrong answer almost every time.',
        'An admin panel, a settings section, a report, a destructive action.',
        ['Surface', 'Button', 'Text'],
      ),
      {
        title: 'It is presentation, not enforcement',
        bare: true,
        Content: () => (
          <Text size="caption" weight="medium" tone="soft" leading="normal" className="max-w-[70ch]">
            A scope check in the browser hides a panel; it does not protect the data behind it.
            The server has to make the same decision independently, and a gate that has made the
            client feel safe is the reason that check sometimes gets skipped.
          </Text>
        ),
      },
    ],
    props: [
      { name: 'granted / requires', type: 'string[] / string[]', description: 'What the person holds, and what the region needs.' },
      { name: 'mode', type: "'all' | 'any'", defaultValue: "'all'", description: 'How `requires` is satisfied.' },
      { name: 'names', type: 'Record<string, string>', description: 'Readable names for scopes, used in the refusal.' },
      { name: 'fallback / onRequest', type: 'ReactNode / fn', description: 'Replace the explanation, or offer to ask for access.' },
      { name: 'silent', type: 'boolean', defaultValue: 'false', description: 'Render nothing. Only where the region’s existence is itself confidential.' },
    ],
  },

  'audit-trail': {
    description:
      'Who changed what, when, and what the value was before. The before value is the whole difference between an audit trail and an activity feed — and it is the field every implementation drops first, because storing it is inconvenient.',
    sections: [
      {
        title: 'Example',
        description: 'Expand an entry to see the field-level changes. Absolute times sit under relative ones.',
        bare: true,
        Content: AuditExample,
        note: motionNote('the disclosure opens without the height transition; everything is still reachable.'),
      },
      rationale(
        'Timeline shows events; an investigation needs values. “Sarah changed the daily limit” is a log line, “from $500 to $5,000” is evidence.',
        'Grouping by day and refusing to sort by anything but time is what keeps it evidence — and there is deliberately no edit, no delete and no “collapse similar”.',
        'A security page, an account history, a compliance export, an admin view.',
        ['Avatar', 'Collapse', 'Text'],
      ),
    ],
    props: [
      { name: 'entries', type: 'AuditEntry[]', description: 'at, actor, action, target, changes, source.' },
      { name: 'actorFilter', type: 'string', description: 'Show only one actor’s entries.' },
      { name: 'label', type: 'string', description: 'Accessible name for the list.' },
    ],
  },
}
