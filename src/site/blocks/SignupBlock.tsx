import { useState, type FormEvent } from 'react'
import { Mail, UserRound } from 'lucide-react'
import {
  Button,
  Checkbox,
  DEFAULT_PASSWORD_RULES,
  Field,
  Input,
  Label,
  PasswordInput,
  PasswordStrength,
  Surface,
  Text,
} from 'citrine'

/**
 * Account creation.
 *
 * Password strength is the library's PasswordStrength, so the score is a Meter
 * announced as a measurement and each rule says in words whether it is met.
 * The terms checkbox gates the button instead of failing after submit, because
 * a reason shown up front is kinder than an error shown after.
 */
export default function SignupBlock() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [done, setDone] = useState(false)

  // The same rules PasswordStrength displays, so the gate and the checklist agree.
  const passed = DEFAULT_PASSWORD_RULES.filter((rule) => rule.test(password)).length

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
              <PasswordStrength value={password} />
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
