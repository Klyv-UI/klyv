import { Monitor, Moon, Sun } from 'lucide-react'
import { SegmentedControl, applyMode, cn, saveMode, type ThemeMode } from 'klyvui'
import { useMode } from './useTheme'

const OPTIONS: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

/**
 * Light, dark, or whatever the machine says.
 *
 * Three states rather than a switch: `system` is a real choice, and a two-way
 * toggle silently opts someone out of their machine following the sun the first
 * time they press it.
 */
export function ThemeToggle({ className }: { className?: string }) {
  // Starts from the document, which the inline script in index.html has
  // already set — so the control never renders one state and then corrects
  // itself a frame later.
  // Shared with the other toggle on the page — header and footer used to
  // disagree the moment one of them was used.
  const mode = useMode()

  const choose = (next: ThemeMode) => {
    applyMode(next)
    saveMode(next)
  }

  return (
    <SegmentedControl
      label="Colour theme"
      size="sm"
      value={mode}
      onValueChange={choose}
      className={cn(className)}
      options={OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
        icon: option.icon,
        iconOnly: true,
      }))}
    />
  )
}
