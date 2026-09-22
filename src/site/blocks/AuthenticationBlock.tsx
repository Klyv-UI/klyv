import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { Alert, Button, InputOTP, Surface, SuccessMark, Text } from 'klyvui'

/**
 * The step after the password.
 *
 * The field submits on completion rather than waiting for a button, because
 * six digits is the whole input and asking for a click afterwards is asking
 * twice. The resend timer counts in state, not in a ref read during render, so
 * it stays honest if the component remounts.
 */
const CORRECT = '314159'

export default function AuthenticationBlock() {
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'checking' | 'wrong' | 'verified'>('idle')
  const [seconds, setSeconds] = useState(30)

  useEffect(() => {
    if (seconds === 0) return
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [seconds])

  const check = (value: string) => {
    setStatus('checking')
    window.setTimeout(() => setStatus(value === CORRECT ? 'verified' : 'wrong'), 700)
  }

  if (status === 'verified') {
    return (
      <div className="flex w-full justify-center px-4 py-10">
        <Surface variant="card" padding="lg" className="w-full max-w-[400px] items-center gap-4">
          <SuccessMark />
          <div className="flex flex-col items-center gap-1.5">
            <Text as="h1" size="subtitle">
              You are in
            </Text>
            <Text size="caption" tone="soft" leading="normal" className="text-center">
              This device is remembered for 30 days. We will ask again after that, or sooner if
              anything looks unusual.
            </Text>
          </div>
          <Button fullWidth onClick={() => { setStatus('idle'); setCode('') }}>
            Continue
          </Button>
        </Surface>
      </div>
    )
  }

  return (
    <div className="flex w-full justify-center px-4 py-10">
      <Surface variant="card" padding="lg" className="w-full max-w-[400px] gap-5">
        <div className="flex flex-col gap-1.5">
          <span
            aria-hidden
            className="mb-1 grid h-10 w-10 place-items-center rounded-[12px] bg-accent-soft text-accent"
          >
            <ShieldCheck size={18} />
          </span>
          <Text as="h1" size="subtitle">
            Two-factor
          </Text>
          <Text size="caption" tone="soft" leading="normal">
            Enter the six digits from your authenticator app. For this demo the code is{' '}
            <span className="font-mono font-bold text-ink">{CORRECT}</span>.
          </Text>
        </div>

        {status === 'wrong' && (
          <Alert tone="danger" live onDismiss={() => setStatus('idle')}>
            That code is not right, or it has expired. Try the current one.
          </Alert>
        )}

        <InputOTP
          value={code}
          onValueChange={(value) => {
            setCode(value)
            if (status === 'wrong') setStatus('idle')
          }}
          onComplete={check}
          label="Verification code"
          invalid={status === 'wrong'}
          disabled={status === 'checking'}
        />

        <div className="flex flex-col gap-2">
          <Button
            fullWidth
            loading={status === 'checking'}
            disabled={code.length < 6}
            onClick={() => check(code)}
          >
            {status === 'checking' ? 'Checking' : 'Verify'}
          </Button>

          <Button
            variant="ghost"
            fullWidth
            disabled={seconds > 0}
            onClick={() => setSeconds(30)}
          >
            {seconds > 0 ? `Resend in ${seconds}s` : 'Resend code'}
          </Button>
        </div>
      </Surface>
    </div>
  )
}
