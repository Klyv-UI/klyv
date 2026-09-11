import { useMemo } from 'react'
import { CodeBlock, CopyButton, Text } from 'citrine'
import { ComponentLinks } from '../components/Links'
import { generate } from './codegen'
import type { ComposerDoc } from './model'

/**
 * The composition as code: the file, how to install what it needs, where the
 * files go, and everything it brings with it.
 */
export function CodeView({ doc }: { doc: ComposerDoc }) {
  const generated = useMemo(() => generate(doc), [doc])

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6">
      <section aria-labelledby="composer-file" className="flex flex-col gap-2.5">
        <Text as="h2" id="composer-file" size="heading" className="font-mono">
          {generated.path}
        </Text>
        <CodeBlock language="tsx" code={generated.code} numbered />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section aria-labelledby="composer-install" className="flex flex-col gap-2.5">
          <Text as="h2" id="composer-install" size="heading">
            Install
          </Text>
          <CodeBlock language="bash" code={generated.commands} highlight={false} />
        </section>
        <section aria-labelledby="composer-tree" className="flex flex-col gap-2.5">
          <Text as="h2" id="composer-tree" size="heading">
            File structure
          </Text>
          <CodeBlock language="text" code={generated.tree} highlight={false} copyable={false} />
        </section>
      </div>

      <section aria-labelledby="composer-deps" className="flex flex-col gap-2.5">
        <Text as="h2" id="composer-deps" size="heading">
          Dependencies
        </Text>
        <Text size="caption" tone="soft" leading="normal">
          Packages: {generated.packages.join(', ')}, with react and react-dom as peers.
          {generated.blocks.length > 0 && ` Blocks: ${generated.blocks.map((block) => block.name).join(', ')}.`}
        </Text>
        {generated.components.length > 0 ? (
          <>
            <ComponentLinks names={generated.components} label="Components the file imports" />
            <Text size="caption" tone="faint" leading="normal">
              Copying the source instead of installing brings {generated.resolved.length} components in all, because
              components are built from each other: {generated.resolved.join(', ')}.
            </Text>
          </>
        ) : (
          <Text size="caption" tone="faint">
            No library components yet.
          </Text>
        )}
      </section>

      <section aria-labelledby="composer-export" className="flex flex-col gap-2.5">
        <Text as="h2" id="composer-export" size="heading">
          Export
        </Text>
        <Text size="caption" tone="soft" leading="normal">
          The composition itself, as data — the same shape the draft is saved in.
        </Text>
        <div>
          <CopyButton value={JSON.stringify(doc, null, 2)} label="Copy composition JSON" copiedLabel="Copied" />
        </div>
      </section>
    </div>
  )
}
