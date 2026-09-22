import { useState } from 'react'
import {
  Card,
  ColorPicker,
  Field,
  FileUpload,
  QRCode,
  Surface,
  Text,
  type UploadFile,
} from 'klyvui'
import type { ExampleModule } from './types'

function ColorPickerExample() {
  const [color, setColor] = useState('#c8f24e')
  return (
    <div className="flex flex-wrap items-start gap-6">
      <Field label="Card colour" className="min-w-[200px]">
        <ColorPicker value={color} onValueChange={setColor} label="Card colour" />
      </Field>
      <Surface
        variant="card"
        padding="lg"
        className="h-[120px] w-[190px] justify-end"
        style={{ background: color }}
      >
        <Text size="caption" weight="bold" className="text-ink/70">
          Klyv
        </Text>
        <Text size="body" tabular className="text-ink">
          **** 5199
        </Text>
      </Surface>
      <Text size="caption" tone="faint" leading="normal" className="max-w-[36ch]">
        Swatches come first deliberately: in a product built on tokens, most colour choices should
        be a token. Every swatch is named, so colour is never the only way to tell them apart.
      </Text>
    </div>
  )
}

function FileUploadExample() {
  const [files, setFiles] = useState<UploadFile[]>([
    { id: '1', name: 'statement-september.pdf', size: 284_000 },
    { id: '2', name: 'proof-of-address.jpg', size: 1_240_000, progress: 62 },
  ])

  return (
    <div className="w-full max-w-[440px]">
      <FileUpload
        files={files}
        maxSize={2_000_000}
        accept=".pdf,.jpg,.png"
        onFilesAdded={(incoming) =>
          setFiles((previous) => [
            ...previous,
            ...incoming.map((file, index) => ({
              id: `${Date.now()}-${index}`,
              name: file.name,
              size: file.size,
              progress: 0,
            })),
          ])
        }
        onFileRemoved={(id) => setFiles((previous) => previous.filter((file) => file.id !== id))}
      />
    </div>
  )
}

function QRCodeExample() {
  const [value, setValue] = useState('klyv:5199?amount=369.41')
  return (
    <div className="flex flex-wrap items-start gap-6">
      <Card className="items-center gap-3 p-5">
        <QRCode value={value} size={168} label={`Payment code for ${value}`} />
        <Text size="caption" tone="faint">
          Scan to pay
        </Text>
      </Card>
      <div className="flex min-w-[240px] flex-col gap-2">
        <Field label="Encoded value">
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="h-10 w-full rounded-full border border-line bg-surface px-4 font-mono text-[12px] text-ink outline-none focus:border-line-strong"
          />
        </Field>
        <Text size="caption" tone="faint" leading="normal">
          The matrix is derived deterministically from the value, so the same input always draws the
          same code and it scales without blurring. The encoded text is also the accessible name,
          because a camera is not an input method everyone has.
        </Text>
      </div>
    </div>
  )
}

export const demos: ExampleModule = {
  'color-picker': {
    description:
      'Colour selection from the design system palette, with a native picker and a hex field for anything outside it. Swatches come first because in a product built on tokens most colour choices should be a token, and an unconstrained wheel invites values that do not belong to the system.',
    sections: [{ title: 'Example', bare: true, Content: ColorPickerExample }],
    props: [
      { name: 'value / onValueChange', type: 'string / fn', description: 'Hex colour, including the leading hash.' },
      { name: 'swatches', type: '{ value, label }[]', description: 'Defaults to the design system palette.' },
      { name: 'label', type: 'string', description: 'Accessible name.' },
    ],
  },

  'file-upload': {
    description:
      'A drop zone with a file list and per-file progress. The zone is a real button wrapping a hidden input, so choosing a file works from the keyboard exactly as it does with a pointer — dragging is an accelerator, never the only route. Rejected files stay in view with their reason rather than vanishing silently.',
    sections: [
      { title: 'Example', description: 'Drop a file, or click to browse. Anything over 2 MB is rejected with a reason.', bare: true, Content: FileUploadExample },
      {
        title: 'States',
        bare: true,
        Content: () => (
          <div className="grid w-full gap-3 sm:grid-cols-3">
            {[
              ['Idle', 'Dashed border on line-strong.'],
              ['Dragging over', 'Accent border and a soft accent wash.'],
              ['Rejected', 'Reported above the list, in an alert region.'],
            ].map(([title, copy]) => (
              <Surface key={title} variant="tile" padding="md" className="gap-1.5">
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
      },
    ],
    props: [
      { name: 'files', type: 'UploadFile[]', description: 'id, name, size, and optional progress or error.' },
      { name: 'onFilesAdded / onFileRemoved', type: 'fn', description: 'The component is controlled; you own the list.' },
      { name: 'accept / multiple / maxSize', type: 'string / boolean / number', description: 'Native accept string, and a size cap in bytes.' },
    ],
  },

  'qr-code': {
    description:
      'A QR matrix rendered as SVG, with no dependency and no canvas. It scales without blurring and draws identically for identical input. For a code that must be read by a real scanner, feed it a matrix from an encoder — this draws a deterministic, scannable-looking code suitable for layout, previews and print mock-ups.',
    sections: [{ title: 'Example', bare: true, Content: QRCodeExample }],
    props: [
      { name: 'value', type: 'string', description: 'The text to encode. Also the accessible name.' },
      { name: 'size', type: 'number', defaultValue: '160', description: 'Rendered size in pixels.' },
      { name: 'margin', type: 'number', defaultValue: '4', description: 'Quiet zone in modules. Four is the specified minimum.' },
      { name: 'color / background', type: 'string', description: 'Keep the contrast between them high.' },
    ],
  },
}
