import { useState } from 'react'
import { AtSign, Download, Globe, PencilLine, Share2, Trash2 } from 'lucide-react'
import {
  Button,
  ConfirmPopover,
  FileList,
  IconButton,
  ImageGallery,
  OrderTracker,
  ProductCard,
  ProfileCard,
  ReviewSummary,
  SegmentedControl,
  ShareMenu,
  Text,
  type FileListItem,
  type OrderTrackerStatus,
  type ReviewSummaryStars,
} from 'klyv'
import type { ExampleModule } from './types'
import { rationale } from './shared'

/* ------------------------------------------------------------------ images */

/** Product shots drawn as SVG, so the demos need no network and no image files. */
const shot = (backdrop: string, body: string, shade: string, shape: 'tee' | 'mug' | 'bag' = 'tee') => {
  const figure =
    shape === 'mug'
      ? `<rect x='220' y='190' width='200' height='230' rx='26' fill='${body}'/><path d='M420 240 h40 a50 50 0 0 1 0 110 h-40' fill='none' stroke='${body}' stroke-width='26'/><rect x='220' y='190' width='200' height='34' rx='14' fill='${shade}'/>`
      : shape === 'bag'
        ? `<path d='M250 250 q70 -150 140 0' fill='none' stroke='${shade}' stroke-width='18'/><rect x='190' y='240' width='260' height='230' rx='22' fill='${body}'/><rect x='190' y='300' width='260' height='16' fill='${shade}'/>`
        : `<path d='M230 170 L290 150 Q320 180 350 150 L410 170 L470 230 L430 270 L410 255 L410 470 L230 470 L230 255 L210 270 L170 230Z' fill='${body}'/><path d='M290 150 Q320 180 350 150' fill='none' stroke='${shade}' stroke-width='10'/>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 640 640'><rect width='640' height='640' fill='${backdrop}'/><ellipse cx='320' cy='540' rx='190' ry='24' fill='${shade}' opacity='.25'/>${figure}</svg>`,
  )}`
}

const cover = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 600 160' preserveAspectRatio='xMidYMid slice'><rect width='600' height='160' fill='#dfe9c8'/><circle cx='480' cy='40' r='90' fill='#c8f24e' opacity='.55'/><circle cx='120' cy='170' r='110' fill='#b8d6a0' opacity='.6'/></svg>`,
)}`

/* ------------------------------------------------------------ profile-card */

function ProfileExample() {
  const [following, setFollowing] = useState(false)
  const links = [
    { label: 'Website', href: 'https://example.com', icon: Globe },
    { label: 'Email', href: 'mailto:ines@example.com', icon: AtSign },
  ]
  return (
    <div className="grid w-full grid-cols-1 items-start gap-4 md:grid-cols-[300px_1fr]">
      <ProfileCard
        name="Inés Carvalho"
        role="Staff product designer · Lisbon"
        coverSrc={cover}
        bio="Designs the billing and checkout flows. Previously led the design system at a payments startup."
        stats={[
          { label: 'Projects', value: '38' },
          { label: 'Followers', value: '2.4k' },
          { label: 'Following', value: '312' },
        ]}
        links={links}
        secondaryAction={
          <Button variant="outline" size="sm">
            Message
          </Button>
        }
        primaryAction={
          <Button size="sm" variant={following ? 'muted' : 'accent'} aria-pressed={following} onClick={() => setFollowing(!following)}>
            {following ? 'Following' : 'Follow'}
          </Button>
        }
      />
      <div className="flex flex-col gap-2">
        {[
          ['Kofi Mensah', 'Engineering manager'],
          ['Priya Raman', 'Support lead'],
          ['Tomás Ortega', 'Data analyst'],
        ].map(([name, role]) => (
          <ProfileCard
            key={name}
            variant="compact"
            name={name}
            role={role}
            primaryAction={
              <Button size="sm" variant="outline" aria-label={`View ${name}`}>
                View
              </Button>
            }
          />
        ))}
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- file-list */

const now = Date.now()
const DAY = 86_400_000

const FILES: FileListItem[] = [
  { id: 'f1', name: 'Q3 board deck.pdf', size: 4_820_000, modified: new Date(now - 2 * DAY) },
  { id: 'f2', name: 'Revenue by region.xlsx', size: 312_400, modified: new Date(now - 5 * DAY) },
  { id: 'f3', name: 'Launch hero.png', size: 1_940_000, status: 'uploading', progress: 64 },
  { id: 'f4', name: 'Customer interviews.mp4', size: 812_000_000, status: 'error', error: 'Too large — the limit is 500 MB' },
  { id: 'f5', name: 'pricing-api.ts', size: 8_200, modified: new Date(now - 21 * DAY) },
]

function FileListExample() {
  const [files, setFiles] = useState(FILES)
  const [selected, setSelected] = useState<string[]>(['f2'])
  return (
    <div className="flex w-full flex-col gap-3">
      <Text size="caption" weight="semibold" tone="faint" aria-live="polite">
        {selected.length} selected
      </Text>
      <FileList
        label="Shared files"
        files={files}
        selectable
        selected={selected}
        onSelectedChange={setSelected}
        onRetry={(file) =>
          setFiles((all) => all.map((entry) => (entry.id === file.id ? { ...entry, name: 'Customer interviews (720p).mp4', size: 214_000_000, status: 'uploading', progress: 12 } : entry)))
        }
        actions={(file) => [
          { id: 'download', label: 'Download', icon: Download },
          { id: 'rename', label: 'Rename', icon: PencilLine },
          { id: 'share', label: 'Copy link', icon: Share2 },
          'separator',
          {
            id: 'delete',
            label: 'Delete',
            icon: Trash2,
            destructive: true,
            onSelect: () => setFiles((all) => all.filter((entry) => entry.id !== file.id)),
          },
        ]}
      />
    </div>
  )
}

/* ---------------------------------------------------------- review-summary */

const REVIEWS = [
  { stars: 5, author: 'Maya R., verified buyer', quote: 'Kept its shape after a dozen washes. Bought a second colour.' },
  { stars: 4, author: 'Jon P., verified buyer', quote: 'Great weight for spring. Runs a touch long in the body.' },
  { stars: 2, author: 'Sam K., verified buyer', quote: 'The sage is much greyer in person than in the photos.' },
  { stars: 5, author: 'Aiko T., verified buyer', quote: 'Softest tee I own, and the seams are properly finished.' },
  { stars: 1, author: 'Lee W., verified buyer', quote: 'Arrived with a pulled thread at the collar.' },
]

function ReviewExample() {
  const [filter, setFilter] = useState<ReviewSummaryStars | null>(null)
  const shown = REVIEWS.filter((review) => filter === null || review.stars === filter)
  return (
    <div className="flex w-full flex-col gap-4">
      <ReviewSummary
        average={4.4}
        distribution={{ 5: 812, 4: 264, 3: 71, 2: 38, 1: 29 }}
        filter={filter}
        onFilterChange={setFilter}
        highlights={shown.slice(0, 2).map((review, index) => ({
          id: `${review.author}-${index}`,
          quote: review.quote,
          author: review.author,
          rating: review.stars,
        }))}
      />
      <Text size="caption" tone="faint" aria-live="polite">
        {filter === null ? 'Showing all reviews' : `Showing ${filter}-star reviews only`}
      </Text>
    </div>
  )
}

/* ------------------------------------------------------------ product-card */

function ProductExample() {
  const [cart, setCart] = useState(0)
  const add = () => new Promise<void>((resolve) => setTimeout(() => {
    setCart((count) => count + 1)
    resolve()
  }, 900))
  return (
    <div className="flex w-full flex-col gap-3">
      <Text size="caption" weight="semibold" tone="faint">
        Cart: {cart} {cart === 1 ? 'item' : 'items'}
      </Text>
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-3">
        <ProductCard
          title="Everyday organic tee"
          href="#tee"
          badge="sale"
          image={{ src: shot('#eef1ea', '#9fb49a', '#6f8a6a'), alt: 'Sage organic cotton t-shirt, front' }}
          hoverImage={{ src: shot('#e4e9df', '#8aa385', '#5c7657'), alt: '' }}
          price={28}
          compareAtPrice={38}
          rating={{ value: 4.4, count: 1214 }}
          swatches={[
            { value: 'sage', label: 'Sage', color: '#9fb49a' },
            { value: 'oat', label: 'Oat', color: '#e6dccb' },
            { value: 'ink', label: 'Ink', color: '#2b2f36' },
          ]}
          onAddToCart={add}
        />
        <ProductCard
          title="Stoneware mug, 350 ml"
          href="#mug"
          badge="new"
          image={{ src: shot('#f3efe8', '#d8cbb5', '#a8977c', 'mug'), alt: 'Speckled cream stoneware mug' }}
          price={22}
          rating={{ value: 4.8, count: 86 }}
          onAddToCart={add}
          defaultWishlisted
        />
        <ProductCard
          title="Waxed canvas tote"
          href="#tote"
          image={{ src: shot('#ecefe9', '#6b6f4f', '#4a4d35', 'bag'), alt: 'Olive waxed canvas tote bag' }}
          price={64.5}
          swatches={[
            { value: 'olive', label: 'Olive', color: '#6b6f4f' },
            { value: 'tan', label: 'Tan', color: '#b38a5a' },
          ]}
          onAddToCart={add}
        />
      </div>
    </div>
  )
}

/* ----------------------------------------------------------- order-tracker */

const STATUSES: { value: OrderTrackerStatus; label: string }[] = [
  { value: 'ordered', label: 'Ordered' },
  { value: 'packed', label: 'Packed' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'out-for-delivery', label: 'Out' },
  { value: 'delivered', label: 'Delivered' },
]

function OrderExample() {
  const [status, setStatus] = useState<OrderTrackerStatus>('shipped')
  const base = new Date(2026, 8, 14, 9, 12)
  const at = (hours: number) => new Date(base.getTime() + hours * 3_600_000)
  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl label="Shipment status" size="sm" value={status} onValueChange={setStatus} options={STATUSES} className="self-start" />
      <OrderTracker
        status={status}
        orderNumber="A-10482"
        carrier="DHL Express"
        trackingNumber="JD014600006281234567"
        trackingUrl="https://www.dhl.com/"
        estimatedDelivery={new Date(2026, 8, 18)}
        timestamps={{ ordered: base, packed: at(6), shipped: at(26), 'out-for-delivery': at(94), delivered: at(99) }}
      />
    </div>
  )
}

/* ----------------------------------------------------------- image-gallery */

const GALLERY = [
  { src: shot('#eef1ea', '#9fb49a', '#6f8a6a'), alt: 'Sage tee, front', caption: 'Front' },
  { src: shot('#e4e9df', '#8aa385', '#5c7657'), alt: 'Sage tee, back', caption: 'Back' },
  { src: shot('#f3efe8', '#e6dccb', '#b5a88f'), alt: 'The same tee in oat', caption: 'Also in oat' },
  { src: shot('#e9ebee', '#2b2f36', '#15171b'), alt: 'The same tee in ink', caption: 'Also in ink' },
]

function GalleryExample() {
  const [index, setIndex] = useState(0)
  return (
    <div className="flex w-full max-w-[420px] flex-col gap-2">
      <ImageGallery images={GALLERY} label="Product photos" index={index} onIndexChange={setIndex} aspectRatio="1 / 1" />
      <Text size="caption" tone="faint">
        Showing: {GALLERY[index].caption}
      </Text>
    </div>
  )
}

/* -------------------------------------------------------------- share-menu */

function ShareExample() {
  const [last, setLast] = useState<string | null>(null)
  return (
    <div className="flex flex-col items-start gap-3">
      <ShareMenu
        url="https://klyvui.xyz/components/share-menu"
        title="ShareMenu — Klyv"
        preferNative={false}
        onShare={(channel) => setLast(channel)}
      />
      <Text size="caption" tone="faint">
        {last ? `Last shared via: ${last}` : 'Nothing shared yet'}
      </Text>
    </div>
  )
}

/* --------------------------------------------------------- confirm-popover */

function ConfirmExample() {
  const [keys, setKeys] = useState(['Production — sk_live_…9f2a', 'Staging — sk_test_…41bc'])
  const [failNext, setFailNext] = useState(true)
  return (
    <ul className="flex w-full max-w-[460px] flex-col divide-y divide-line rounded-[var(--radius-tile)] border border-line">
      {keys.map((key) => (
        <li key={key} className="flex items-center justify-between gap-3 px-3 py-2.5">
          <Text size="body" weight="semibold" className="font-mono">
            {key}
          </Text>
          <ConfirmPopover
            title="Revoke this key?"
            description="Requests using it will fail at once. This cannot be undone."
            confirmLabel="Revoke"
            tone="destructive"
            align="end"
            onConfirm={() =>
              new Promise<void>((resolve, reject) =>
                setTimeout(() => {
                  if (failNext) {
                    setFailNext(false)
                    reject(new Error('The network dropped. Try again.'))
                    return
                  }
                  setKeys((all) => all.filter((entry) => entry !== key))
                  resolve()
                }, 900),
              )
            }
            trigger={<IconButton icon={Trash2} label={`Revoke ${key}`} size="xs" />}
          />
        </li>
      ))}
      {keys.length === 0 && (
        <li className="px-3 py-4">
          <Text size="caption" tone="faint">
            No keys left.
          </Text>
        </li>
      )}
    </ul>
  )
}

/* ------------------------------------------------------------------- demos */

export const demos: ExampleModule = {
  'profile-card': {
    description:
      'A person, summarised: cover, avatar, name, role, bio, a stats row, links and the next action. The full card stands alone on a profile or team page; the compact variant drops cover, bio and stats for lists, where the reader is choosing a person rather than reading about one.',
    sections: [
      { title: 'Full and compact', bare: true, Content: ProfileExample },
      rationale(
        'Team pages, author bylines and member directories each rebuild the same card, and each forgets a different piece: the heading, the labelled stats, the name on an icon-only link.',
        'The name is a real heading and the stats a description list, so skimming by heading works and figures are read with their labels. Actions are slots, because Follow, Message and Invite differ per product.',
        'Profile and team pages, author boxes, member directories, the result of a people search.',
        ['Surface', 'Avatar', 'Text', 'Button'],
      ),
    ],
    props: [
      { name: 'name', type: 'string', description: 'Full name; drives the initials and the heading.' },
      { name: 'role / bio', type: 'ReactNode', description: 'Line under the name, and the sentence or two below.' },
      { name: 'avatarSrc / coverSrc', type: 'string', description: 'Portrait and banner. The banner falls back to an accent band.' },
      { name: 'stats', type: 'ProfileCardStat[]', description: '{ label, value } pairs, rendered as a description list.' },
      { name: 'links', type: 'ProfileCardLink[]', description: '{ label, href, icon? }. With an icon, the label becomes its accessible name.' },
      { name: 'primaryAction / secondaryAction', type: 'ReactNode', description: 'The next step — usually Buttons.' },
      { name: 'variant', type: "'full' | 'compact'", defaultValue: 'full', description: 'compact is a single row for lists.' },
      { name: 'headingLevel', type: "'h2' | 'h3' | 'h4'", defaultValue: 'h3', description: 'Fits the name into the page outline.' },
    ],
  },
  'file-list': {
    description:
      'Files as rows: a type glyph from the extension, the name, a human-readable size and the modified date. Uploads show progress in place and failures say why with a retry beside them, so a file never moves between a tray and the list. Selection and a per-row actions menu are optional.',
    sections: [
      { title: 'Shared files', description: 'Select rows, open a row’s menu, retry the failed upload, or delete a file.', Content: FileListExample },
      rationale(
        'Drive folders, attachment lists and upload queues show the same four facts about a file and usually disagree about sizes, dates and where errors appear.',
        'One row shape for every state keeps the reader’s place as uploads finish. Errors are words, not a red icon, and every icon-only control is named after its file.',
        'Attachments on a record, shared folders, the queue under a FileUpload drop zone.',
        ['Checkbox', 'Progress', 'Menu', 'IconButton', 'Button', 'Text'],
      ),
    ],
    props: [
      { name: 'files', type: 'FileListItem[]', description: '{ id, name, size, modified?, status?, progress?, error? }.' },
      { name: 'label', type: 'string', description: 'Accessible name for the list.' },
      { name: 'actions', type: '(file) => (MenuItem | separator)[]', description: 'Row menu items. Omit for no menu.' },
      { name: 'onRetry', type: '(file) => void', description: 'Adds a Retry button to failed rows.' },
      { name: 'selectable', type: 'boolean', defaultValue: 'false', description: 'Show a checkbox per row.' },
      { name: 'selected / defaultSelected / onSelectedChange', type: 'string[]', description: 'Selection by file id, controlled or not.' },
      { name: 'empty', type: 'ReactNode', defaultValue: "'No files yet'", description: 'Shown when the list is empty.' },
    ],
  },
  'review-summary': {
    description:
      'The shape of a product’s reviews before the reviews: the average in stars, the total, and a 5 → 1 distribution whose rows are also the filters. The place a reader notices a cluster of 2-star reviews is the place they want to read them, so each bar is a toggle button with a pressed state.',
    sections: [
      { title: 'With filters and highlights', description: 'Press a row to filter the highlighted reviews; press it again to clear.', Content: ReviewExample },
      rationale(
        'An average alone hides whether complaints are common or a loud few, and a separate filter dropdown asks the reader to translate what they saw in the bars.',
        'Bars that filter put the action where the question arises. Their names give count and share in words, since bar length is visual only.',
        'Product and app store pages, course and venue listings, anywhere reviews are counted.',
        ['Text', 'Surface', 'StarIcon'],
      ),
    ],
    props: [
      { name: 'average', type: 'number', description: 'Mean rating 0–5; the stars fill fractionally.' },
      { name: 'distribution', type: 'Record<1–5, number>', description: 'Review counts per star level. The total is their sum.' },
      { name: 'filter / defaultFilter / onFilterChange', type: 'ReviewSummaryStars | null', description: 'The pressed row. Without a handler or a value, rows are not buttons.' },
      { name: 'highlights', type: 'ReviewSummaryHighlight[]', description: '{ id, quote, author, rating } excerpts under the bars.' },
    ],
  },
  'product-card': {
    description:
      'A product in a grid, with enough to decide and enough to buy: photo with a second on hover, sale or new badge, price against the earlier price, rating, colour swatches as radios, a wishlist toggle, and an add-to-cart button that shows adding and added in place and announces the result.',
    sections: [
      { title: 'A small grid', description: 'Hover a card for the second photo, pick a colour, save one, add one to the cart.', Content: ProductExample, bare: true },
      rationale(
        'Product cards are copied between listing, search and recommendation rails, and the cart feedback usually lives in a header badge nobody is looking at.',
        'The button reports its own outcome and a live region says it aloud. Swatches are native radios, so arrow keys work, and the heart is a pressed toggle rather than a fill change.',
        'Collection and search pages, "you may also like" rails, wishlists.',
        ['Surface', 'Badge', 'Button', 'Text', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'title / href', type: 'string', description: 'Product name, linked to its page when href is set.' },
      { name: 'image / hoverImage', type: 'ProductCardImage', description: '{ src, alt }. The hover photo crossfades in; instantly under reduced motion.' },
      { name: 'badge', type: "'sale' | 'new'", description: 'Corner label.' },
      { name: 'price / compareAtPrice / currency', type: 'number, number, string', defaultValue: "currency '$'", description: 'The earlier price is struck through when higher.' },
      { name: 'rating', type: '{ value, count }', description: 'Average and review count.' },
      { name: 'swatches / swatch / defaultSwatch / onSwatchChange', type: 'ProductCardSwatch[] / string', description: '{ value, label, color } options as a radio group.' },
      { name: 'onAddToCart', type: '(swatch) => void | Promise<void>', description: 'Return a promise to show adding until it settles.' },
      { name: 'wishlisted / defaultWishlisted / onWishlistChange', type: 'boolean', description: 'The heart toggle.' },
    ],
  },
  'order-tracker': {
    description:
      'Shipment progress as the five steps every carrier reduces to — ordered, packed, shipped, out for delivery, delivered — with times, the estimated date, and the carrier’s tracking number beside a copy button. It is an ordered list with aria-current on the step reached, running across on wide screens and down on narrow ones.',
    sections: [
      { title: 'Order A-10482', description: 'Move the shipment along with the control above it.', Content: OrderExample },
      rationale(
        '"Where is my order?" is the most common support question in commerce, and carrier pages answer it in carrier language.',
        'Five fixed steps map to any carrier’s events. Each step says complete, current or upcoming in words, and the tracking number is one press from the clipboard.',
        'Order detail pages, confirmation emails rendered on the web, support tools.',
        ['Surface', 'Text', 'CopyButton', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'status', type: 'OrderTrackerStatus', description: "'ordered' | 'packed' | 'shipped' | 'out-for-delivery' | 'delivered'." },
      { name: 'timestamps', type: 'Partial<Record<status, Date>>', description: 'When each reached step happened.' },
      { name: 'orderNumber', type: 'string', description: 'Shown in the header.' },
      { name: 'carrier / trackingNumber / trackingUrl', type: 'string', description: 'Carrier details; the number gets a copy button and links when a url is set.' },
      { name: 'estimatedDelivery', type: 'Date', description: 'Headline date until delivered.' },
      { name: 'labels', type: 'Partial<Record<status, string>>', description: 'Rename steps.' },
    ],
  },
  'image-gallery': {
    description:
      'One large image with the rest as a thumbnail strip. The strip is a tablist and the frame its panel; arrow keys, Home and End move and select, previous and next buttons and a counter serve pointer users, and clicking the image opens the full-screen Lightbox on the same picture.',
    sections: [
      { title: 'Product photos', description: 'Use the arrows, the thumbnails, or open the image full screen.', Content: GalleryExample },
      rationale(
        'Product and listing pages rebuild this with thumbnails that are unlabelled images and a zoom that does not trap focus or return it.',
        'Tabs semantics match what the strip does, only the chosen thumbnail is a tab stop, and the full-screen view reuses Lightbox rather than a second viewer.',
        'Product detail pages, property and rental listings, portfolio entries.',
        ['IconButton', 'Lightbox', 'Text'],
      ),
    ],
    props: [
      { name: 'images', type: 'ImageGalleryImage[]', description: '{ src, alt, thumbnail?, caption? }.' },
      { name: 'label', type: 'string', description: 'Accessible name for the thumbnail strip.' },
      { name: 'index / defaultIndex / onIndexChange', type: 'number', defaultValue: '0', description: 'The shown image, controlled or not.' },
      { name: 'lightbox', type: 'boolean', defaultValue: 'true', description: 'Open the main image full screen on click.' },
      { name: 'aspectRatio', type: 'string', defaultValue: "'4 / 3'", description: 'Main frame ratio as CSS.' },
    ],
  },
  'share-menu': {
    description:
      'A Share button that hands off to the system share sheet where the browser has one, and otherwise opens a menu: copy link, which stays open to confirm the copy, then email, X, LinkedIn and Facebook as real links built from the url and title. Brand marks are drawn in the text colour.',
    sections: [
      { title: 'Fallback menu', description: 'Native sharing is turned off here so the menu shows on every device.', Content: ShareExample },
      rationale(
        'Share rows are usually four brand-coloured buttons that ignore the share sheet phones already have, and copy buttons that give no sign they worked.',
        'navigator.share knows the reader’s apps; the menu covers the rest. Network entries are links, so they open in new tabs and work with middle-click.',
        'Article and changelog headers, product pages, anything with a public URL.',
        ['Popover', 'Button', 'VisuallyHidden'],
      ),
    ],
    props: [
      { name: 'url / title', type: 'string', description: 'What is shared; title is the email subject and post text.' },
      { name: 'text', type: 'string', description: 'Extra line for the native share sheet.' },
      { name: 'preferNative', type: 'boolean', defaultValue: 'true', description: 'Use navigator.share when available.' },
      { name: 'channels', type: "('email' | 'x' | 'linkedin' | 'facebook')[]", defaultValue: 'all four', description: 'Which networks to list, in order.' },
      { name: 'label / variant / size', type: 'ReactNode / ButtonVariant / ButtonSize', defaultValue: "'Share', outline, sm", description: 'The trigger button.' },
      { name: 'onShare', type: '(channel) => void', description: 'Called after each share, with how.' },
    ],
  },
  'confirm-popover': {
    description:
      'An "are you sure?" anchored to the control that asked, for actions too small for a modal. Focus lands on Cancel, Escape and an outside click back out, focus returns to the trigger, and an async confirm holds the panel open with a pending button — and keeps it open with the reason if it fails.',
    sections: [
      { title: 'Revoking API keys', description: 'The first revoke fails on purpose, to show the error state.', Content: ConfirmExample },
      rationale(
        'A full-page dialog for deleting one row pulls the eye away from the row, while no confirmation at all makes destructive icons dangerous to click.',
        'The question sits next to its subject. Built on Popover, so layering, Escape and focus return match every other overlay, and Cancel takes focus so Enter is safe.',
        'Row-level deletes and revokes, removing a member, discarding a draft.',
        ['Popover', 'Button', 'Text'],
      ),
    ],
    props: [
      { name: 'trigger', type: 'ReactNode', description: 'The control that asks — usually an IconButton.' },
      { name: 'title / description', type: 'string / ReactNode', description: 'The question and its consequence. title names the panel.' },
      { name: 'confirmLabel / cancelLabel', type: 'string', defaultValue: "'Confirm', 'Cancel'", description: 'Button labels.' },
      { name: 'tone', type: "'default' | 'destructive'", defaultValue: 'default', description: 'destructive reddens the confirm button.' },
      { name: 'onConfirm', type: '() => void | Promise<void>', description: 'A promise holds the panel pending; a rejection shows its message.' },
      { name: 'onCancel', type: '() => void', description: 'Dismissed without confirming.' },
      { name: 'open / defaultOpen / onOpenChange', type: 'boolean', description: 'Open state, controlled or not.' },
      { name: 'placement / align', type: 'PopoverPlacement / PopoverAlign', defaultValue: 'bottom, start', description: 'Where the panel sits.' },
    ],
  },
}
