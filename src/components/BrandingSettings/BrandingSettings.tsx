'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { contrastRatio } from '../../lib/contrast'
import { useIsomorphicLayoutEffect } from '../../lib/layout-effect'
import { ACCENT_PRESETS, applyAccent, deriveAccent } from '../../theme/accent'
import { onModeChange } from '../../theme/mode'
import { Button } from '../Button'
import { ColorPicker } from '../ColorPicker'
import { InlineMessage } from '../InlineMessage'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { CheckIcon } from '../internal/icons'

export interface BrandingSettingsValue {
  /** Brand colour as a hex string. */
  color: string
  /** URL of the uploaded logo. */
  logoUrl?: string
}

export interface BrandingSettingsProps {
  /** The saved branding. Edits are a draft against this until saved. */
  value: BrandingSettingsValue
  /** Persist the draft. Return a promise to show the saving state; reject to show its message. */
  onSave: (value: BrandingSettingsValue) => void | Promise<void>
  /** Receive a chosen logo file and return the URL to store. Defaults to a local object URL. */
  onLogoUpload?: (file: File) => string | Promise<string>
  /** Where Reset returns the colour to. Defaults to the library’s first accent preset. */
  defaultColor?: string
  /** Named colours offered in the picker. Defaults to the accent presets. */
  swatches?: { value: string; label: string }[]
  /** Shown in the preview. */
  workspaceName?: string
  /** Label contrast below this ratio raises a warning. 4.5 is WCAG AA; 7 is AAA. */
  minContrast?: number
  /** Largest logo accepted, in bytes. */
  maxLogoSize?: number
  /** Merged last, so it wins. */
  className?: string
}

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i
const PRESET_SWATCHES = ACCENT_PRESETS.map((preset) => ({ value: preset.hex, label: preset.name }))

/**
 * A workspace’s logo and brand colour, previewed the way the product will
 * actually draw them.
 *
 * The preview runs the colour through the library’s own accent derivation —
 * the same `applyAccent` that themes the whole app — so the hover step, the
 * tinted wash and the label colour shown are the ones members will get, not a
 * swatch next to some guesses. It is written onto the preview element only, so
 * trying colours never repaints the settings page around it.
 *
 * Derivation guarantees AA label contrast, so the warning is for stricter
 * targets: raise `minContrast` to 7 and a mid-tone brand colour that clears AA
 * will say, before it is saved, that it misses AAA. Changes stay a draft until
 * saved, with Discard beside Save and Reset returning to the default.
 */
export function BrandingSettings({
  value,
  onSave,
  onLogoUpload,
  defaultColor = ACCENT_PRESETS[0].hex,
  swatches = PRESET_SWATCHES,
  workspaceName = 'Workspace',
  minContrast = 4.5,
  maxLogoSize = 2 * 1024 * 1024,
  className,
}: BrandingSettingsProps) {
  const id = useId()
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)
  const [themeTick, setThemeTick] = useState(0)
  const preview = useRef<HTMLDivElement>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(value)
  }, [value.color, value.logoUrl])

  // The last complete colour stands while a hex value is still being typed.
  const [color, setColor] = useState(HEX.test(value.color) ? value.color : defaultColor)
  useEffect(() => {
    if (HEX.test(draft.color)) setColor(draft.color)
  }, [draft.color])

  const family = deriveAccent(color)
  const labelRatio = Math.min(contrastRatio(family.ink, family.accent), contrastRatio(family.ink, family.strong))
  const dirty = draft.color.toLowerCase() !== value.color.toLowerCase() || draft.logoUrl !== value.logoUrl

  useIsomorphicLayoutEffect(() => {
    if (preview.current) applyAccent(color, preview.current)
  }, [color, themeTick])

  // A scoped accent picks its wash for the theme in force, so a theme switch re-applies it.
  useEffect(() => {
    const bump = () => setThemeTick((tick) => tick + 1)
    const query = window.matchMedia?.('(prefers-color-scheme: dark)')
    query?.addEventListener('change', bump)
    const stop = onModeChange(bump)
    return () => {
      query?.removeEventListener('change', bump)
      stop()
    }
  }, [])

  const chooseLogo = async (file: File | undefined) => {
    if (!file) return
    setMessage(null)
    if (!file.type.startsWith('image/')) {
      setMessage({ tone: 'danger', text: 'Choose an image file — PNG, SVG, JPG or WebP.' })
      return
    }
    if (file.size > maxLogoSize) {
      setMessage({ tone: 'danger', text: `That logo is over ${Math.round(maxLogoSize / 1024 / 1024)} MB.` })
      return
    }
    const logoUrl = onLogoUpload ? await onLogoUpload(file) : URL.createObjectURL(file)
    setDraft((current) => ({ ...current, logoUrl }))
  }

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await onSave({ ...draft, color })
      setMessage({ tone: 'success', text: 'Branding saved.' })
    } catch (reason) {
      setMessage({ tone: 'danger', text: reason instanceof Error ? reason.message : 'Branding could not be saved.' })
    } finally {
      setSaving(false)
    }
  }

  const initial = workspaceName.charAt(0).toUpperCase()

  return (
    <Surface variant="card" className={cn('grid w-full overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]', className)}>
      <div className="flex flex-col gap-6 p-5">
        <div className="flex flex-col gap-2">
          <Text as="h3" size="heading" weight="bold">
            Logo
          </Text>
          <div className="flex items-center gap-4">
            <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-tile)] border border-dashed border-line-strong bg-surface-sunken">
              {draft.logoUrl ? (
                <img src={draft.logoUrl} alt={`${workspaceName} logo`} className="size-full object-contain p-1.5" />
              ) : (
                <Text as="span" size="caption" tone="faint">
                  No logo
                </Text>
              )}
            </span>
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                  {draft.logoUrl ? 'Replace logo' : 'Upload logo'}
                </Button>
                {draft.logoUrl && (
                  <Button variant="ghost" size="sm" onClick={() => setDraft((current) => ({ ...current, logoUrl: undefined }))}>
                    Remove
                  </Button>
                )}
              </div>
              <Text as="span" size="caption" tone="faint" id={`${id}-logo-hint`}>
                Square, at least 128 px. SVG or PNG with transparency works best.
              </Text>
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              className="sr-only"
              tabIndex={-1}
              aria-label="Logo file"
              aria-describedby={`${id}-logo-hint`}
              onChange={(change) => {
                void chooseLogo(change.target.files?.[0])
                change.target.value = ''
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Text as="h3" size="heading" weight="bold" id={`${id}-colour`}>
            Brand colour
          </Text>
          <div className="flex flex-wrap items-center gap-2">
            <ColorPicker label="Brand colour" swatches={swatches} value={draft.color} onValueChange={(next) => setDraft((current) => ({ ...current, color: next }))} />
            <Button
              variant="ghost"
              size="sm"
              disabled={color.toLowerCase() === defaultColor.toLowerCase()}
              onClick={() => setDraft((current) => ({ ...current, color: defaultColor }))}
            >
              Reset to default
            </Button>
          </div>
          <Text as="p" size="caption" tone="faint" leading="normal">
            {`Button labels on this colour read at ${labelRatio.toFixed(1)}:1.`}
          </Text>
          {labelRatio < minContrast && (
            <InlineMessage tone="warning" live>
              {`That is below the ${minContrast}:1 your workspace requires. A lighter or darker shade will read better.`}
            </InlineMessage>
          )}
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-line pt-4">
          <Button onClick={() => void save()} loading={saving} disabled={!dirty}>
            Save branding
          </Button>
          <Button variant="ghost" disabled={!dirty || saving} onClick={() => setDraft(value)}>
            Discard
          </Button>
          {dirty && !saving && (
            <Text as="span" size="caption" tone="faint">
              Unsaved changes
            </Text>
          )}
        </div>
        {message && (
          <InlineMessage tone={message.tone} live>
            {message.text}
          </InlineMessage>
        )}
      </div>

      {/* The preview is decorative mock chrome: its buttons are drawn, not real controls. */}
      <div className="flex flex-col gap-2 border-t border-line bg-app p-5 lg:border-l lg:border-t-0">
        <Text as="h3" size="caption" weight="bold" tone="faint" className="uppercase tracking-wider">
          Preview
        </Text>
        <div ref={preview} aria-hidden="true" className="flex flex-1 flex-col overflow-hidden rounded-[var(--radius-tile)] border border-line bg-surface shadow-[var(--shadow-tile)]">
          <div className="flex items-center gap-2.5 border-b border-line px-4 py-3">
            <span className="flex size-7 items-center justify-center overflow-hidden rounded-[var(--radius-glyph)] bg-accent text-[13px] font-extrabold text-accent-ink">
              {draft.logoUrl ? <img src={draft.logoUrl} alt="" className="size-full bg-surface object-contain p-0.5" /> : initial}
            </span>
            <span className="text-[13px] font-bold text-ink">{workspaceName}</span>
          </div>
          <div className="flex flex-1">
            <div className="hidden w-28 flex-col gap-1 border-r border-line p-2 sm:flex">
              {['Home', 'Projects', 'Reports'].map((item, index) => (
                <span
                  key={item}
                  className={cn('rounded-[var(--radius-glyph)] px-2 py-1.5 text-[12px]', index === 1 ? 'bg-accent-soft font-bold text-ink' : 'text-ink-soft')}
                >
                  {item}
                </span>
              ))}
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">
              <span className="text-[14px] font-extrabold text-ink">Q3 launch</span>
              <div className="flex flex-col gap-1">
                <span className="flex justify-between text-[11px] text-ink-soft">
                  <span>Progress</span>
                  <span>68%</span>
                </span>
                <span className="h-1.5 overflow-hidden rounded-full bg-track">
                  <span className="block h-full w-[68%] rounded-full bg-accent-strong" />
                </span>
              </div>
              <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-bold text-ink">
                <CheckIcon size={11} />
                On track
              </span>
              <div className="mt-auto flex gap-2">
                <span className="inline-flex h-8 items-center rounded-full bg-accent px-3.5 text-[12px] font-bold text-accent-ink">New task</span>
                <span className="inline-flex h-8 items-center rounded-full bg-accent-strong px-3.5 text-[12px] font-bold text-accent-ink">Hovered</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Surface>
  )
}
