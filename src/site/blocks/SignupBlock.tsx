import { useMemo, useState, type FormEvent } from 'react'
import { Mail, UserRound } from 'lucide-react'
import {
  Button,
  Checkbox,
  Field,
  Input,
  Label,
  Meter,
  PasswordInput,
  Surface,
  Text,
} from 'citrine'

/**
 * Account creation.
 *
 * The strength meter is a Meter, not a coloured bar: it has a value, a maximum
 * and a label, so it is announced as a measurement rather than being a hint
 * only sighted users receive. The terms checkbox gates the button instead of
 * failing after submit, because a disabled reason shown up front is kinder than
 * an error shown after.
 */
const RULES: { label: string; test: (value: string) => boolean }[] = [
  { label: '12 characters or more', test: (v) => v.length >= 12 },
  { label: 'a number', test: (v) => /\d/.test(v) },
  { label: 'a symbol', test: (v) => /[^A-Za-z0-9]/.test(v) },
  { label: 'mixed case', test: (v) => /[a-z]/.test(v) && /[A-Z]/.test(v) },
]

const LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong']

export default function SignupBlock() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [done, setDone] = useState(false)

  const passed = useMemo(() => RULES.filter((rule) => rule.test(password)).length, [password])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setDone(true)
  }

  return (
    <div className="flex w-full justify-center px-4 py-10">
      <Surface variant="card" padding="lg" className="w-full max-w-[420px] gap-5">
        <div className="flex flex-col gap-1.5">
          <Text as="h1" size="subtitle">
            Create your workspace
          </Text>
          <Text size="caption" tone="soft" leading="normal">
            Fourteen days, no card. You can invite the rest of the team once you are in.
          </Text>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label="Full name" required>
            <Input
              autoComplete="name"
              placeholder="Ada Lovelace"
              leading={<UserRound size={15} aria-hidden />}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </Field>

          <Field label="Work email" required hint="We send one verification link, nothing else.">
            <Input
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              leading={<Mail size={15} aria-hidden />}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>

          <Field label="Password" required>
            <div className="flex flex-col gap-2.5">
              <PasswordInput
                autoComplete="new-password"
                placeholder="••••••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <Meter
                value={passed}
                total={RULES.length}
                label={`Password strength: ${LABELS[passed]}`}
              />
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {RULES.map((rule) => {
                  const ok = rule.test(password)
                  return (
                    <Text
                      key={rule.label}
                      size="micro"
                      weight="semibold"
                      tone={ok ? 'success' : 'faint'}
                    >
                      {ok ? '✓' : '·'} {rule.label}
                    </Text>
                  )
                })}
              </div>
            </div>
          </Field>

          <div className="flex items-start gap-2">
            <span className="pt-0.5">
              <Checkbox
                id="signup-terms"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
              />
            </span>
            <Label htmlFor="signup-terms">
              <Text as="span" size="caption" weight="medium" tone="soft" leading="normal">
                I agree to the terms of service and the privacy policy.
              </Text>
            </Label>
          </div>

          <Button type="submit" fullWidth disabled={!accepted || passed < 3}>
            {done ? 'Check your inbox' : 'Create workspace'}
          </Button>

          <Text size="micro" tone="faint" className="text-center">
            {accepted
              ? passed < 3
                ? 'Pick a stronger password to continue.'
                : 'Ready when you are.'
              : 'Accept the terms to continue.'}
          </Text>
        </form>
      </Surface>
    </div>
  )
}
