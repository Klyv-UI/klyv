import { useState } from 'react'
import {
  Button,
  Card,
  FocusTrap,
  Input,
  Portal,
  Surface,
  Text,
} from 'klyv'
import type { ExampleModule } from './types'

function PortalExample() {
  const [shown, setShown] = useState(false)
  return (
    <div className="flex w-full flex-col items-start gap-3">
      <Button size="sm" variant="outline" onClick={() => setShown((previous) => !previous)}>
        {shown ? 'Remove the portal' : 'Render into document.body'}
      </Button>

      <div className="relative h-[120px] w-full max-w-[380px] overflow-hidden rounded-[var(--radius-tile)] border border-line bg-app p-3">
        <Text size="caption" weight="semibold" tone="faint">
          This box has overflow: hidden
        </Text>
        <Text size="caption" tone="faint" leading="normal" className="mt-1">
          Anything rendered here normally would be clipped at its edge. The panel below is rendered
          through a Portal, so it escapes.
        </Text>
      </div>

      {shown && (
        <Portal>
          <div className="fixed bottom-6 right-6 z-[var(--z-overlay)]">
            <Surface variant="floating" padding="md" className="w-[240px] border border-line">
              <Text size="heading">Outside the box</Text>
              <Text size="caption" tone="faint" leading="normal" className="mt-1">
                Mounted at the end of document.body, pinned to the viewport corner.
              </Text>
            </Surface>
          </div>
        </Portal>
      )}
    </div>
  )
}

function FocusTrapExample() {
  const [trapped, setTrapped] = useState(false)
  return (
    <div className="flex w-full flex-col items-start gap-3">
      <Button size="sm" variant="outline" onClick={() => setTrapped((previous) => !previous)}>
        {trapped ? 'Release focus' : 'Trap focus in the panel'}
      </Button>

      <div className="flex w-full flex-wrap gap-4">
        <Card title="Outside the trap" className="min-w-[220px] flex-1">
          <div className="mt-3 flex flex-col gap-2">
            <Input placeholder="Outside field" aria-label="Outside field" />
            <Button size="sm" variant="outline">
              Outside button
            </Button>
          </div>
        </Card>

        <FocusTrap active={trapped} autoFocus={trapped} restoreFocus className="min-w-[220px] flex-1">
          <Card
            title="Inside the trap"
            className={trapped ? 'border-accent-strong' : undefined}
          >
            <div className="mt-3 flex flex-col gap-2">
              <Input placeholder="First field" aria-label="First trapped field" />
              <Input placeholder="Second field" aria-label="Second trapped field" />
              <Button size="sm">Confirm</Button>
            </div>
          </Card>
        </FocusTrap>
      </div>

      <Text size="caption" tone="faint" leading="normal" className="max-w-[62ch]">
        With the trap on, Tab cycles between the three controls on the right and never reaches the
        card on the left. Turn it off and focus returns to whatever was focused before.
      </Text>
    </div>
  )
}

export const demos: ExampleModule = {
  portal: {
    description:
      'Renders children outside the current DOM position, so an overlay is never clipped by an ancestor overflow or trapped under a stacking context. Every overlay in the library shares this one implementation — which is why Popover, Tooltip, HoverCard and Combobox all behave identically inside a scrolling card.',
    sections: [
      { title: 'Example', bare: true, Content: PortalExample },
      {
        title: 'Notes',
        bare: true,
        Content: () => (
          <div className="grid w-full gap-3 sm:grid-cols-2">
            <Surface variant="tile" padding="md" className="gap-2">
              <Text size="caption" weight="bold" tone="soft">
                What it moves
              </Text>
              <Text size="caption" weight="medium" tone="faint" leading="normal">
                The DOM position only. React context, state and event bubbling through the React
                tree all still work — a click inside a portalled panel still reaches handlers on
                its React parent.
              </Text>
            </Surface>
            <Surface variant="tile" padding="md" className="gap-2">
              <Text size="caption" weight="bold" tone="soft">
                What it does not do
              </Text>
              <Text size="caption" weight="medium" tone="faint" leading="normal">
                It does not position, trap focus, or handle Escape. Those are the caller&apos;s, or
                the job of FocusTrap and Popover which build on it.
              </Text>
            </Surface>
          </div>
        ),
      },
    ],
    props: [
      { name: 'children', type: 'ReactNode', description: 'Rendered at the mount point.' },
      { name: 'container', type: 'Element | null', description: 'Where to mount. Defaults to document.body.' },
    ],
  },

  'focus-trap': {
    description:
      'Keeps Tab inside its subtree and restores focus when it closes. Extracted so every dialog, drawer and sheet gets identical, correct behaviour instead of each reimplementing it — the piece that is most often left out, and the one that makes an overlay unusable by keyboard when it is.',
    sections: [
      { title: 'Example', description: 'Turn the trap on, then press Tab repeatedly.', bare: true, Content: FocusTrapExample },
      {
        title: 'Behaviour',
        bare: true,
        Content: () => (
          <div className="grid w-full gap-3 sm:grid-cols-3">
            {[
              ['Cycles', 'Tab from the last control wraps to the first; Shift+Tab from the first wraps to the last.'],
              ['Restores', 'On close, focus returns to whatever was focused before it opened.'],
              ['Deactivates', 'Setting active to false releases the trap without unmounting the subtree.'],
            ].map(([title, copy]) => (
              <Surface key={title} variant="tile" padding="md" className="gap-2">
                <Text size="caption" weight="bold" tone="soft">
                  {title}
                </Text>
                <Text size="caption" weight="medium" tone="faint" leading="normal">
                  {copy}
                </Text>
              </Surface>
            ))}
          </div>
        ),
        note: 'A trap alone is not a dialog. Pair it with a Portal, a backdrop, Escape handling and aria-modal — which is exactly what Modal and Drawer do.',
      },
    ],
    props: [
      { name: 'active', type: 'boolean', defaultValue: 'true', description: 'Turn the trap off without unmounting.' },
      { name: 'autoFocus', type: 'boolean', defaultValue: 'true', description: 'Move focus inside on mount.' },
      { name: 'restoreFocus', type: 'boolean', defaultValue: 'true', description: 'Return focus on unmount.' },
    ],
  },
}
