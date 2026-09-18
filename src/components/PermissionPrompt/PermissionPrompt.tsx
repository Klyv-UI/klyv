'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Button } from '../Button'
import { Spinner } from '../Spinner'

export type PermissionPromptKind = 'notifications' | 'geolocation' | 'camera' | 'microphone' | 'clipboard-read'
export type PermissionPromptState = 'checking' | 'prompt' | 'requesting' | 'granted' | 'denied' | 'unsupported'

export interface PermissionPromptProps {
  /** The browser permission this card asks for. */
  permission: PermissionPromptKind
  /** Heading. Defaults to a plain request for the permission. */
  title?: string
  /** Why the product needs it — the value to the reader, said before the browser asks. */
  reason: ReactNode
  /** Text of the button that triggers the real browser prompt. */
  allowLabel?: string
  /** Shows a Not now button. Called when it is pressed. */
  onDismiss?: () => void
  /** Called on every state change, including changes made in the browser’s own settings. */
  onStateChange?: (state: PermissionPromptState) => void
  /** Replaces the built-in steps for turning a blocked permission back on. */
  deniedInstructions?: ReactNode
  /** Render a fixed state without touching the browser — for docs and design review. */
  previewState?: PermissionPromptState
  /** Merged last, so it wins. */
  className?: string
}

const NAMES: Record<PermissionPromptKind, string> = {
  notifications: 'Notifications',
  geolocation: 'Location',
  camera: 'Camera',
  microphone: 'Microphone',
  'clipboard-read': 'Clipboard',
}

const GLYPHS: Record<PermissionPromptKind, ReactNode> = {
  notifications: <path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15L6 16zM10 20.5a2 2 0 004 0" />,
  geolocation: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.4" />
    </>
  ),
  camera: (
    <>
      <rect x="3" y="6.5" width="13" height="11" rx="2.5" />
      <path d="M16 10.5l5-3v9l-5-3" />
    </>
  ),
  microphone: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21" />
    </>
  ),
  'clipboard-read': (
    <>
      <rect x="5" y="4.5" width="14" height="16.5" rx="2.5" />
      <path d="M9 4.5V3.5h6v1M9 11h6M9 15h4" />
    </>
  ),
}

/** Where the switch lives, by browser and platform. Worded for what the reader will actually see. */
function reEnableSteps(kind: PermissionPromptKind): string[] {
  const name = NAMES[kind]
  const agent = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const ios = /iPhone|iPad|iPod/.test(agent) || (/Macintosh/.test(agent) && typeof document !== 'undefined' && 'ontouchend' in document)
  const android = /Android/.test(agent)
  const firefox = /Firefox\//.test(agent)
  const safari = /Safari\//.test(agent) && !/Chrome\/|Chromium\/|Edg\//.test(agent)
  if (ios)
    return kind === 'notifications'
      ? ['Add this site to your Home Screen from the Share menu.', 'Open it from the Home Screen and turn notifications on there.']
      : [`Open the Settings app, then Apps → Safari → ${name === 'Location' ? 'Location' : name}.`, 'Choose Ask or Allow, then reload this page.']
  if (android) return ['Tap the icon to the left of the address bar.', `Tap Permissions, then ${name}, and choose Allow.`, 'Reload this page.']
  if (firefox) return ['Click the permissions icon in the address bar.', `Clear the Blocked entry next to ${name}.`, 'Reload this page, then try again.']
  if (safari) return ['Open Safari → Settings → Websites.', `Choose ${name === 'Location' ? 'Location' : name} in the sidebar and set this site to Allow.`, 'Reload this page.']
  return ['Click the site-settings icon to the left of the address bar.', `Set ${name} to Allow.`, 'Reload this page.']
}

/** The real browser prompt for each permission. Resolves to the resulting state. */
async function request(kind: PermissionPromptKind): Promise<PermissionPromptState> {
  if (kind === 'notifications') {
    const result = await Notification.requestPermission()
    return result === 'granted' ? 'granted' : result === 'denied' ? 'denied' : 'prompt'
  }
  if (kind === 'geolocation')
    return new Promise((resolve) =>
      navigator.geolocation.getCurrentPosition(
        () => resolve('granted'),
        (error) => resolve(error.code === error.PERMISSION_DENIED ? 'denied' : 'granted'),
        { timeout: 15_000, maximumAge: Infinity },
      ),
    )
  if (kind === 'clipboard-read') {
    try {
      await navigator.clipboard.readText()
      return 'granted'
    } catch {
      return 'denied'
    }
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia(kind === 'camera' ? { video: true } : { audio: true })
    // Only the permission was wanted; the device light should not stay on.
    stream.getTracks().forEach((track) => track.stop())
    return 'granted'
  } catch (error) {
    return error instanceof DOMException && error.name === 'NotAllowedError' ? 'denied' : 'unsupported'
  }
}

function available(kind: PermissionPromptKind) {
  if (typeof window === 'undefined' || !window.isSecureContext) return false
  if (kind === 'notifications') return 'Notification' in window
  if (kind === 'geolocation') return 'geolocation' in navigator
  if (kind === 'clipboard-read') return typeof navigator.clipboard?.readText === 'function'
  return typeof navigator.mediaDevices?.getUserMedia === 'function'
}

/**
 * A pre-prompt for a browser permission: says what the reader gets, then asks
 * the browser — only when they choose to.
 *
 * Browsers give a site one real shot at most prompts. A cold prompt on page
 * load gets reflexively blocked, and a blocked permission can only be undone
 * in settings the reader has to go and find. So the card explains the value
 * first, and the real prompt fires from the button.
 *
 * It reads the current state from the Permissions API and listens for changes
 * made elsewhere, so a permission switched on in site settings updates the card
 * without a reload. Where the state cannot be read — Firefox and camera, say —
 * it falls back to the API’s own status or to asking. Blocked permissions get
 * steps for the reader’s own browser and platform; an insecure page or a
 * missing API says so, rather than showing a button that cannot work.
 */
export function PermissionPrompt({
  permission,
  title,
  reason,
  allowLabel,
  onDismiss,
  onStateChange,
  deniedInstructions,
  previewState,
  className,
}: PermissionPromptProps) {
  const [live, setLive] = useState<PermissionPromptState>('checking')
  const [error, setError] = useState('')
  const state = previewState ?? live
  const name = NAMES[permission]

  useEffect(() => {
    if (previewState) return
    let status: PermissionStatus | null = null
    let cancelled = false
    const apply = (next: PermissionPromptState) => !cancelled && setLive(next)
    const onChange = () => status && apply(status.state as PermissionPromptState)
    if (!available(permission)) {
      apply('unsupported')
      return
    }
    const fallback = () =>
      apply(permission === 'notifications' ? (Notification.permission === 'default' ? 'prompt' : (Notification.permission as PermissionPromptState)) : 'prompt')
    if (!navigator.permissions?.query) fallback()
    else
      navigator.permissions
        .query({ name: permission as PermissionName })
        .then((result) => {
          status = result
          onChange()
          result.addEventListener('change', onChange)
        })
        // Some browsers cannot query some names; the API itself still works.
        .catch(fallback)
    return () => {
      cancelled = true
      status?.removeEventListener('change', onChange)
    }
  }, [permission, previewState])

  useEffect(() => {
    onStateChange?.(state)
  }, [state, onStateChange])

  const ask = useCallback(async () => {
    if (previewState) return
    setLive('requesting')
    setError('')
    const result = await request(permission).catch(() => 'unsupported' as const)
    if (result === 'unsupported') setError(`No ${name.toLowerCase()} was found, or the browser refused to ask.`)
    setLive(result === 'unsupported' ? 'prompt' : result)
  }, [permission, previewState, name])

  const heading =
    state === 'granted'
      ? `${name} is on`
      : state === 'denied'
        ? `${name} is blocked`
        : state === 'unsupported'
          ? `${name} isn’t available here`
          : (title ?? `Allow ${name.toLowerCase()}?`)

  return (
    // A group, not a landmark: a settings page often shows several prompts, and
    // landmarks that share a role and name are noise to jump between.
    <div
      role="group"
      aria-label={`${name} permission`}
      aria-busy={state === 'checking' || state === 'requesting' || undefined}
      className={cn('flex w-full max-w-[440px] gap-3.5 rounded-[var(--radius-card)] border border-line bg-surface p-5 shadow-[var(--shadow-card)]', className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-[var(--radius-glyph)]',
          state === 'granted' ? 'bg-accent text-accent-ink' : state === 'denied' ? 'bg-[color-mix(in_oklab,var(--color-danger)_14%,transparent)] text-danger' : 'bg-surface-muted text-ink',
        )}
      >
        <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
          {GLYPHS[permission]}
        </svg>
      </span>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h3 className="m-0 text-[15px] font-bold leading-tight text-ink">{heading}</h3>
        <div role="status" className="flex flex-col gap-2 text-[13px] font-medium leading-normal text-ink-soft">
          {state === 'checking' && (
            <p className="m-0 flex items-center gap-2">
              <Spinner size="sm" /> Checking what this browser allows…
            </p>
          )}
          {(state === 'prompt' || state === 'requesting') && <div>{reason}</div>}
          {state === 'granted' && <p className="m-0">You’re all set. You can change this at any time in your browser’s site settings.</p>}
          {state === 'unsupported' && (
            <p className="m-0">
              {typeof window !== 'undefined' && !window.isSecureContext
                ? 'Browsers only allow this on secure (https) pages.'
                : `This browser doesn’t support ${name.toLowerCase()} access for websites.`}
            </p>
          )}
          {state === 'denied' &&
            (deniedInstructions ?? (
              <>
                <p className="m-0">The browser won’t ask again until it’s unblocked. To turn it back on:</p>
                <ol className="m-0 flex list-decimal flex-col gap-1 pl-5">
                  {reEnableSteps(permission).map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </>
            ))}
          {error && <p className="m-0 text-danger">{error}</p>}
        </div>

        {(state === 'prompt' || state === 'requesting' || state === 'denied') && (
          <div className="mt-1 flex flex-wrap gap-2">
            {state === 'denied' ? (
              <Button size="sm" variant="outline" onClick={() => window.location.reload()}>
                I’ve changed it — reload
              </Button>
            ) : (
              <Button size="sm" loading={state === 'requesting'} onClick={ask}>
                {allowLabel ?? `Allow ${name.toLowerCase()}`}
              </Button>
            )}
            {onDismiss && state !== 'denied' && (
              <Button size="sm" variant="ghost" onClick={onDismiss}>
                Not now
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
