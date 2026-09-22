import { useId, useState, type FormEvent } from 'react'
import { Mail } from 'lucide-react'
import {
  AuthCard,
  Button,
  OnboardingWizard,
  RadioGroup,
  Checkbox,
  Field,
  Input,
  Label,
  PasswordInput,
  PasswordStrength,
  SegmentedControl,
  SetupChecklist,
  Text,
  Wordmark,
  type ChecklistStep,
} from 'klyvui'
import type { ExampleModule } from './types'
import { rationale } from './shared'

const BRAND = <Wordmark name="Acme" size="md" markOnly mark={<span className="text-[15px] font-extrabold">A</span>} />

/** A neutral provider glyph — the library ships no third-party logos. */
function ProviderMark({ letter }: { letter: string }) {
  return (
    <span className="inline-flex size-4 items-center justify-center rounded-full bg-ink text-[9px] font-extrabold text-ink-inverse">
      {letter}
    </span>
  )
}

function SignInExample() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState<string>()
  const [password, setPassword] = useState('')
  const strengthId = useId()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setLoading('form')
    window.setTimeout(() => {
      setLoading(undefined)
      setError(mode === 'in' ? 'That email and password do not match. Try again or reset your password.' : undefined)
    }, 700)
  }

  const provider = (id: string, label: string, letter: string) => ({
    id,
    label,
    icon: <ProviderMark letter={letter} />,
    loading: loading === id,
    onClick: () => {
      setLoading(id)
      window.setTimeout(() => setLoading(undefined), 900)
    },
  })

  return (
    <div className="flex w-full flex-col items-center gap-4 rounded-[var(--radius-card)] bg-app px-4 py-10">
      <SegmentedControl
        label="Flow"
        size="sm"
        value={mode}
        onValueChange={(value) => {
          setMode(value)
          setError(undefined)
        }}
        options={[
          { value: 'in', label: 'Sign in' },
          { value: 'up', label: 'Sign up' },
        ]}
      />
      <AuthCard
        headingLevel="h2"
        brand={BRAND}
        title={mode === 'in' ? 'Welcome back' : 'Create your account'}
        description={mode === 'in' ? 'Sign in to your Acme workspace.' : 'Free for 14 days. No credit card required.'}
        providers={[provider('google', 'Continue with Google', 'G'), provider('sso', 'Continue with SAML SSO', 'S')]}
        error={error}
        legal={
          mode === 'up' ? (
            <>
              By creating an account you agree to the <a href="#terms" className="font-bold text-ink underline underline-offset-2">Terms</a> and{' '}
              <a href="#privacy" className="font-bold text-ink underline underline-offset-2">Privacy Policy</a>.
            </>
          ) : undefined
        }
        footer={
          mode === 'in' ? (
            <>
              No account yet?{' '}
              <button type="button" onClick={() => setMode('up')} className="font-bold text-ink underline underline-offset-2">
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have one?{' '}
              <button type="button" onClick={() => setMode('in')} className="font-bold text-ink underline underline-offset-2">
                Sign in
              </button>
            </>
          )
        }
      >
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          {mode === 'up' && (
            <Field label="Full name">
              <Input autoComplete="name" placeholder="Alex Morgan" />
            </Field>
          )}
          <Field label="Work email">
            <Input type="email" autoComplete="email" placeholder="you@company.com" leading={<Mail size={15} />} />
          </Field>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between">
              <Label htmlFor="auth-password">Password</Label>
              {mode === 'in' && (
                <a href="#reset" className="text-[11px] font-bold text-ink-soft underline underline-offset-2 hover:text-ink">
                  Forgot password?
                </a>
              )}
            </div>
            <PasswordInput
              id="auth-password"
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-describedby={mode === 'up' ? strengthId : undefined}
            />
            {mode === 'up' && (
              <div id={strengthId} className="mt-1">
                <PasswordStrength value={password} compact />
              </div>
            )}
          </div>
          {mode === 'in' && (
            <label className="flex items-center gap-2 text-[12px] font-semibold text-ink-soft">
              <Checkbox boxSize="sm" defaultChecked /> Keep me signed in
            </label>
          )}
          <Button type="submit" fullWidth loading={loading === 'form'}>
            {mode === 'in' ? 'Sign in' : 'Create account'}
          </Button>
        </form>
      </AuthCard>
    </div>
  )
}

const INITIAL_STEPS: ChecklistStep[] = [
  { id: 'account', title: 'Create your account', done: true, description: 'Done — welcome aboard.' },
  { id: 'install', title: 'Install the SDK', done: true, description: 'Two lines in your app’s entry point.' },
  { id: 'event', title: 'Send your first event', done: false, description: 'Events appear on the Live tab within seconds of arriving.' },
  { id: 'invite', title: 'Invite your team', done: false, description: 'Dashboards are more useful when the people who act on them can see them.' },
  { id: 'slack', title: 'Connect Slack', done: false, optional: true, description: 'Get alerts where the team already talks.' },
]

function ChecklistExample() {
  const [steps, setSteps] = useState(INITIAL_STEPS)
  const [dismissed, setDismissed] = useState(false)
  const complete = (id: string) => setSteps((current) => current.map((step) => (step.id === id ? { ...step, done: true } : step)))

  if (dismissed) {
    return (
      <Button variant="outline" size="sm" onClick={() => { setDismissed(false); setSteps(INITIAL_STEPS) }}>
        Bring the checklist back
      </Button>
    )
  }

  return (
    <div className="flex w-full max-w-[460px] flex-col gap-3">
      <SetupChecklist
        title="Get set up"
        description="Four steps to your first dashboard."
        onDismiss={() => setDismissed(true)}
        steps={steps.map((step) => ({
          ...step,
          action: (
            <Button size="sm" onClick={() => complete(step.id)}>
              {step.id === 'invite' ? 'Invite people' : step.id === 'slack' ? 'Connect Slack' : 'Mark as done'}
            </Button>
          ),
        }))}
      />
      <Text size="caption" tone="faint" leading="normal">
        The card follows the steps’ <code className="font-mono">done</code> props, so completing the open one moves it on by itself.
        The optional Slack step does not count against completion.
      </Text>
    </div>
  )
}

export const demos: ExampleModule = {
  'auth-card': {
    description:
      'The frame every authentication screen shares — sign in, sign up, reset, accept an invitation. It fixes the order (providers, the rule, the form, the way out) and announces a failed attempt at the top.',
    sections: [
      {
        title: 'Sign in and sign up',
        description: 'Submit Sign in to see the error announced; switch to Sign up for the strength meter.',
        bare: true,
        Content: SignInExample,
      },
      rationale(
        'Every product rebuilds its sign-in card, usually with the error as red text under a field the person has already left.',
        'It owns layout and error placement but none of the fields, because those differ per product — composing Field, PasswordInput and PasswordStrength inside it.',
        'Sign in, sign up, password reset, email verification, invitation acceptance, SSO pickers.',
        ['Surface', 'Button', 'Divider', 'Alert', 'Field', 'PasswordInput'],
      ),
    ],
    props: [
      { name: 'title / description / brand', type: 'string / ReactNode', description: 'The header.' },
      { name: 'providers', type: 'AuthProvider[]', description: '{ id, label, icon?, onClick, loading? }.' },
      { name: 'error', type: 'string', description: 'Announced as an alert.' },
      { name: 'children', type: 'ReactNode', description: 'The form.' },
      { name: 'legal / footer', type: 'ReactNode', description: 'Small print, and the switch to the other flow.' },
      { name: 'headingLevel', type: "'h1' | 'h2'", defaultValue: 'h1', description: 'On a sign-in page the card is the page.' },
    ],
  },

  'setup-checklist': {
    description:
      'The “get set up” card on a new workspace. The next step is open; everything else is a line. Steps are props, so the card moves on when the work is done anywhere in the product.',
    sections: [
      { title: 'Example', bare: true, Content: ChecklistExample },
      rationale(
        'Onboarding checklists either track their own clicks (and drift from reality) or stall at 80% on a step nobody wanted.',
        'Optional steps do not count against completion, it can be dismissed at any stage, and the finished state replaces the list rather than leaving a wall of ticks.',
        'A new workspace’s home screen, a sidebar card, a post-signup page.',
        ['Surface', 'Progress', 'Collapse', 'SuccessMark', 'Tag'],
      ),
    ],
    props: [
      { name: 'steps', type: 'ChecklistStep[]', description: '{ id, title, description?, done, action?, optional? }.' },
      { name: 'title / description', type: 'string / ReactNode', description: 'Header copy.' },
      { name: 'onDismiss', type: '() => void', description: 'Offered at every stage.' },
      { name: 'completeTitle / completeDescription', type: 'string / ReactNode', description: 'Copy once everything required is done.' },
    ],
  },

  'onboarding-wizard': {
    description:
      'The multi-step setup after sign-up. Each step validates in place before moving on; completed steps can be revisited, future ones cannot; focus moves to each new step’s heading.',
    sections: [
      { title: 'Example', description: 'Continue with an empty name to see the step refuse, and say why.', bare: true, Content: WizardExample },
      rationale(
        'Setup wizards let people skip ahead past required answers and leave focus on a button whose meaning just changed.',
        'Step content is owned by the caller, so state survives Back; optional steps offer Skip; validate may be async for server checks such as a taken URL.',
        'Post-signup setup, creating a project, connecting a data source.',
        ['Stepper', 'Surface', 'Button', 'InlineMessage'],
      ),
    ],
    props: [
      { name: 'steps', type: 'WizardStep[]', description: '{ id, title, description?, content, validate?, optional? }.' },
      { name: 'onComplete', type: '() => void | Promise', description: 'After the last step validates.' },
      { name: 'onStepChange / finishLabel / title', type: 'fn / string / string', description: 'Tracking and copy.' },
    ],
  },
}

function WizardExample() {
  const [name, setName] = useState('')
  const [size, setSize] = useState('2-10')
  const [goal, setGoal] = useState('growth')
  const [done, setDone] = useState(false)

  if (done) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Text size="heading">
          {name} is ready — {size} people, focused on {goal}.
        </Text>
        <Button size="sm" variant="ghost" onClick={() => { setDone(false); setName('') }}>
          Start again
        </Button>
      </div>
    )
  }

  return (
    <OnboardingWizard
      className="w-full max-w-[620px]"
      title="Set up your workspace"
      onComplete={async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 500))
        setDone(true)
      }}
      steps={[
        {
          id: 'name',
          title: 'Name your workspace',
          description: 'Usually your company or team name. You can change it later.',
          validate: () => (name.trim().length < 2 ? 'Give the workspace a name of at least two characters.' : undefined),
          content: (
            <Field label="Workspace name">
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Northwind" />
            </Field>
          ),
        },
        {
          id: 'size',
          title: 'How big is the team?',
          content: (
            <RadioGroup
              label="Team size"
              variant="card"
              value={size}
              onValueChange={setSize}
              options={[
                { value: '1', label: 'Just me' },
                { value: '2-10', label: '2 to 10' },
                { value: '11-50', label: '11 to 50' },
                { value: '50+', label: 'More than 50' },
              ]}
            />
          ),
        },
        {
          id: 'goal',
          title: 'What do you want to track first?',
          optional: true,
          description: 'We will set up a starter dashboard. Skip to start from a blank one.',
          content: (
            <RadioGroup
              label="First goal"
              variant="card"
              value={goal}
              onValueChange={setGoal}
              options={[
                { value: 'growth', label: 'Growth', hint: 'Sign-ups, activation, conversion' },
                { value: 'retention', label: 'Retention', hint: 'Churn and engagement' },
                { value: 'revenue', label: 'Revenue', hint: 'MRR and expansion' },
              ]}
            />
          ),
        },
        {
          id: 'done',
          title: 'Ready to go',
          description: 'Your workspace, its starter dashboard and a sample dataset will be created.',
          content: (
            <Text size="body" weight="medium" tone="soft">
              {name || 'Your workspace'} · {size} people · {goal}
            </Text>
          ),
        },
      ]}
    />
  )
}
