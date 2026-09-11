import { useState, type FormEvent } from 'react'
import { Lock, Mail } from 'lucide-react'
import { Alert, Button, Checkbox, Field, Input, Label, PasswordInput, Surface, Text } from 'citrine'

/**
 * A sign-in screen.
 *
 * The error is an Alert with `live`, not a red border: a border says something
 * is wrong to people who can see it and nothing to anyone else. The button
 * carries the pending state rather than a spinner overlaying the form, so the
 * fields stay readable while the request is in flight.
 */
export default function LoginBlock() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!email.includes('@')) {
      setError('Enter the email address you signed up with.')
      return
    }
    if (password.length < 8) {
      setError('That password is too short to be one of ours.')
      return
    }

    setPending(true)
    window.setTimeout(() => {
      setPending(false)
      setError('We could not find an account with those details.')
    }, 900)
  }

  return (
    <div className="flex w-full justify-center px-4 py-10">
      <Surface variant="card" padding="lg" className="w-full max-w-[400px] gap-5">
        <div className="flex flex-col gap-1.5">
          <span
            aria-hidden
            className="mb-1 grid h-10 w-10 place-items-center rounded-[12px] bg-accent text-accent-ink"
          >
            <Lock size={18} />
          </span>
          <Text as="h1" size="subtitle">
            Sign in
          </Text>
          <Text size="caption" tone="soft" leading="normal">
            Use the address your workspace was created with.
          </Text>
        </div>

        {error && (
          <Alert tone="danger" live onDismiss={() => setError(null)}>
            {error}
          </Alert>
        )}

        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label="Email" required>
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
            <PasswordInput
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </Field>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="login-remember"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              <Label htmlFor="login-remember">
                <Text as="span" size="caption" weight="semibold" tone="soft">
                  Keep me signed in
                </Text>
              </Label>
            </div>
            <a
              href="#reset"
              className="rounded-md text-[12px] font-bold text-ink-soft underline underline-offset-2 transition-colors hover:text-ink"
            >
              Forgot password?
            </a>
          </div>

          <Button type="submit" fullWidth loading={pending}>
            {pending ? 'Signing in' : 'Sign in'}
          </Button>
        </form>

        <div className="flex items-center gap-3" aria-hidden>
          <span className="h-px flex-1 bg-line" />
          <Text size="micro" weight="bold" tone="faint" className="uppercase tracking-[0.14em]">
            or
          </Text>
          <span className="h-px flex-1 bg-line" />
        </div>

        <div className="flex flex-col gap-2">
          <Button variant="outline" fullWidth type="button">
            Continue with SSO
          </Button>
          <Text size="caption" tone="faint" className="text-center">
            No account?{' '}
            <a href="#signup" className="font-bold text-ink underline underline-offset-2">
              Create one
            </a>
          </Text>
        </div>
      </Surface>
    </div>
  )
}
