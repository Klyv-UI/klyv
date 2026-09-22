import { useState } from 'react'
import {
  Button,
  SessionList,
  SsoSetup,
  SuccessMark,
  Surface,
  Text,
  TwoFactorSetup,
  type SsoConfig,
  type UserSession,
} from 'klyvui'
import type { ExampleModule } from './types'
import { rationale } from './shared'
import { daysFromNow } from './saas-shared'

const SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DP'
const OTPAUTH = `otpauth://totp/Acme:alex%40northwind.io?secret=${SECRET}&issuer=Acme`
const CODES = ['7h2k-9fqx', 'm4pd-2wze', 'q8rn-5tuc', 'b3vy-6kaj', 'x9ls-1hgm', 'e5wt-8pno']

function TwoFactorExample() {
  const [done, setDone] = useState(false)
  const [key, setKey] = useState(0)
  if (done) {
    return (
      <Surface variant="card" padding="lg" className="w-full items-start gap-3">
        <SuccessMark size="sm" label="Two-factor authentication is on" />
        <Text size="heading">Two-factor authentication is on</Text>
        <Button size="sm" variant="ghost" onClick={() => { setDone(false); setKey((value) => value + 1) }}>
          Run it again
        </Button>
      </Surface>
    )
  }
  return (
    <div className="flex w-full flex-col gap-3">
      <TwoFactorSetup
        key={key}
        otpauthUrl={OTPAUTH}
        secret={SECRET}
        onVerify={async (code) => {
          await new Promise((resolve) => window.setTimeout(resolve, 500))
          return code === '123456' ? CODES : false
        }}
        onComplete={() => setDone(true)}
        onCancel={() => undefined}
      />
      <Text size="caption" tone="faint">
        In this demo the correct code is 123456. Anything else is rejected.
      </Text>
    </div>
  )
}

const SESSIONS: UserSession[] = [
  { id: 's1', device: 'Chrome on macOS', kind: 'desktop', location: 'London, UK', ip: '81.2.69.160', lastActive: new Date(), current: true },
  { id: 's2', device: 'Safari on iPhone', kind: 'mobile', location: 'London, UK', ip: '81.2.69.142', lastActive: new Date(Date.now() - 2 * 3_600_000) },
  { id: 's3', device: 'Firefox on Windows', kind: 'desktop', location: 'Lisbon, Portugal', ip: '193.136.2.18', lastActive: daysFromNow(-3) },
  { id: 's4', device: 'Chrome on Android', kind: 'mobile', location: 'São Paulo, Brazil', ip: '177.71.8.9', lastActive: daysFromNow(-12) },
]

function SessionsExample() {
  const [sessions, setSessions] = useState(SESSIONS)
  return (
    <SessionList
      sessions={sessions}
      onRevoke={async (session) => {
        await new Promise((resolve) => window.setTimeout(resolve, 400))
        setSessions((current) => current.filter((item) => item.id !== session.id))
      }}
      onRevokeOthers={async () => {
        await new Promise((resolve) => window.setTimeout(resolve, 400))
        setSessions((current) => current.filter((item) => item.current))
      }}
    />
  )
}

const CERT = '-----BEGIN CERTIFICATE-----\nMIIDpDCCAoygAwIBAgIGAYbN1zPWMA0GCSqGSIb3DQEBCwUAMIGSMQswCQYDVQQG\n-----END CERTIFICATE-----'

function SsoExample() {
  const [config, setConfig] = useState<SsoConfig>({
    provider: 'okta',
    ssoUrl: 'https://northwind.okta.com/app/acme/sso/saml',
    entityId: 'http://www.okta.com/exk1abcd',
    certificate: CERT,
    enforced: false,
  })
  const [saved, setSaved] = useState<string>()
  return (
    <div className="flex w-full flex-col gap-3">
      <SsoSetup
        value={config}
        onChange={setConfig}
        domains={['northwind.io']}
        serviceProvider={{
          acsUrl: 'https://auth.acme.app/saml/northwind/acs',
          entityId: 'https://auth.acme.app/saml/northwind',
          metadataUrl: 'https://auth.acme.app/saml/northwind/metadata.xml',
        }}
        onTest={async (value) => {
          await new Promise((resolve) => window.setTimeout(resolve, 800))
          return value.ssoUrl.includes('okta.com')
            ? { ok: true, message: 'Signed in as alex@northwind.io through Okta.' }
            : { ok: false, message: 'The identity provider rejected the request: unknown entity ID.' }
        }}
        onSave={(value) => setSaved(`Saved · SSO ${value.enforced ? 'required' : 'optional'}`)}
      />
      <Text size="caption" tone="faint" aria-live="polite" leading="normal">
        {saved ?? 'Test passes for any okta.com URL. Edit a field after a passing test and enforcement locks again.'}
      </Text>
    </div>
  )
}

export const demos: ExampleModule = {
  'two-factor-setup': {
    description:
      'Turn on two-factor authentication: scan, confirm with a code, keep the recovery codes. Done stays locked until the codes are stored, because without them a lost phone is a locked account.',
    sections: [
      { title: 'Example', bare: true, Content: TwoFactorExample },
      rationale(
        'Most 2FA setups end at “code accepted”, and the recovery codes are shown once in a dialog people click past.',
        'The setup key is offered as grouped text beside the QR code for authenticators without a camera; the code verifies automatically on the sixth digit.',
        'Account security settings, an enforced-2FA onboarding step.',
        ['QRCode', 'InputOTP', 'Alert', 'Checkbox', 'Surface'],
      ),
    ],
    props: [
      { name: 'otpauthUrl / secret', type: 'string', description: 'The provisioning URI and its secret.' },
      { name: 'onVerify', type: '(code) => Promise<string[] | false>', description: 'Resolve with recovery codes on success.' },
      { name: 'onComplete / onCancel', type: '() => void', description: 'After the codes are stored; abandon.' },
    ],
  },

  'session-list': {
    description:
      'Where the account is signed in, and a way to end any of it. The current device is pinned first and cannot be revoked here — that is signing out.',
    sections: [
      { title: 'Example', bare: true, Content: SessionsExample },
      rationale(
        '“A phone in a city I have never been to” is the whole reason people open this list, and many only show a browser name.',
        'Location and IP on every row, recent activity shown as “Active now”, and one confirmed action to sign out everywhere else.',
        'Account security settings, an admin’s view of a user.',
        ['Surface', 'Tag', 'Button', 'ConfirmDialog'],
      ),
    ],
    props: [
      { name: 'sessions', type: 'UserSession[]', description: "{ id, device, kind?: 'desktop' | 'mobile', location?, ip?, lastActive, current? }." },
      { name: 'onRevoke', type: '(session) => void | Promise', description: 'After confirmation.' },
      { name: 'onRevokeOthers', type: '() => void | Promise', description: 'Sign out everywhere but here.' },
    ],
  },

  'sso-setup': {
    description:
      'SAML single sign-on in the order it happens: give the identity provider our values, paste back theirs, test, then enforce. Enforcement stays locked until a test passes against exactly the values on screen.',
    sections: [
      { title: 'Example', bare: true, Content: SsoExample },
      rationale(
        'Enforcing SSO with a wrong certificate locks out the whole organisation, admins included — the most expensive support ticket a SaaS gets.',
        'A passing test is tied to the exact field values; any edit re-locks enforcement. URL and certificate shape are checked before testing.',
        'Enterprise security settings.',
        ['Field', 'Input', 'Textarea', 'Select', 'Switch', 'InlineMessage'],
      ),
    ],
    props: [
      { name: 'value / onChange', type: 'SsoConfig / fn', description: '{ provider, ssoUrl, entityId, certificate, enforced }.' },
      { name: 'serviceProvider', type: '{ acsUrl, entityId, metadataUrl? }', description: 'What the identity provider needs from us.' },
      { name: 'onTest', type: '(config) => Promise<{ ok, message }>', description: 'A real sign-in round trip.' },
      { name: 'onSave', type: '(config) => void | Promise', description: 'enforced is forced false unless the test passed.' },
      { name: 'domains', type: 'string[]', description: 'Verified domains named in the enforcement copy.' },
    ],
  },
}
