import { useState } from 'react'
import { Mail, Rss, Globe } from 'lucide-react'
import {
  AuroraSurface,
  Button,
  CtaSection,
  FeatureGrid,
  HeroHighlight,
  HeroSection,
  Input,
  LogoCloud,
  SectionHeading,
  SegmentedControl,
  SiteFooter,
  SiteHeader,
  TestimonialCard,
  Wordmark,
  type CtaTone,
} from 'citrine'
import type { ExampleModule } from './types'
import { rationale } from './shared'
import { FEATURES, FakeLogo, LOGOS, ProductShot, TESTIMONIALS } from './saas-shared'

const BRAND = <Wordmark name="Acme" size="sm" mark={<span className="text-[13px] font-extrabold">A</span>} />

const LINKS = [
  { label: 'Product', href: '#product', current: true },
  { label: 'Pricing', href: '#pricing' },
  { label: 'Customers', href: '#customers' },
  { label: 'Docs', href: '#docs' },
  { label: 'Changelog', href: '#changelog' },
]

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="w-full overflow-hidden rounded-[var(--radius-card)] border border-line bg-app">{children}</div>
}

function HeaderExample() {
  return (
    <Frame>
      <SiteHeader
        brand={BRAND}
        links={LINKS}
        sticky={false}
        actions={
          <>
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
            <Button size="sm">Start free trial</Button>
          </>
        }
      />
      <div className="h-24" />
    </Frame>
  )
}

function HeroExample() {
  const [layout, setLayout] = useState<'center' | 'split'>('center')
  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="Layout"
        size="sm"
        value={layout}
        onValueChange={setLayout}
        className="self-start"
        options={[
          { value: 'center', label: 'Centred' },
          { value: 'split', label: 'Split' },
        ]}
      />
      <Frame>
        <HeroSection
          layout={layout}
          headingLevel="h2"
          announcement={{ badge: 'New', label: 'Workflows are here', href: '#changelog' }}
          title={
            <>
              Analytics your whole team <HeroHighlight>actually reads</HeroHighlight>
            </>
          }
          description="Acme turns product events into dashboards, alerts and answers — so decisions stop waiting on a data team."
          actions={
            <>
              <Button>Start free trial</Button>
              <Button variant="outline">Book a demo</Button>
            </>
          }
          note="Free for 14 days · No credit card required"
          media={<ProductShot />}
          backdrop={<AuroraSurface className="size-full opacity-60" />}
        />
      </Frame>
    </div>
  )
}

function CtaExample() {
  const [tone, setTone] = useState<CtaTone>('accent')
  return (
    <div className="flex w-full flex-col gap-3">
      <SegmentedControl
        label="Tone"
        size="sm"
        value={tone}
        onValueChange={setTone}
        className="self-start"
        options={[
          { value: 'accent', label: 'Accent' },
          { value: 'ink', label: 'Ink' },
          { value: 'muted', label: 'Muted' },
        ]}
      />
      <CtaSection
        tone={tone}
        title="Start making decisions with the whole team"
        description="Set up in an afternoon. Cancel whenever you like."
        actions={
          <>
            <Button variant="white">Start free trial</Button>
            <Button variant={tone === 'muted' ? 'outline' : 'ghost'} className={tone === 'ink' ? 'text-ink-inverse/80 hover:bg-white/10 hover:text-ink-inverse' : tone === 'accent' ? 'text-accent-ink hover:bg-accent-strong' : undefined}>
              Talk to sales
            </Button>
          </>
        }
        note="14-day trial on every plan"
      />
    </div>
  )
}

function FooterExample() {
  return (
    <Frame>
      <SiteFooter
        brand={BRAND}
        tagline="Product analytics your whole team actually reads."
        columns={[
          { title: 'Product', links: [{ label: 'Features', href: '#f' }, { label: 'Pricing', href: '#p' }, { label: 'Workflows', href: '#w', badge: 'New' }, { label: 'Changelog', href: '#c' }] },
          { title: 'Company', links: [{ label: 'About', href: '#a' }, { label: 'Careers', href: '#j' }, { label: 'Customers', href: '#cu' }] },
          { title: 'Resources', links: [{ label: 'Docs', href: '#d' }, { label: 'API', href: '#api' }, { label: 'Status', href: '#s' }] },
          { title: 'Legal', links: [{ label: 'Security', href: '#sec' }, { label: 'DPA', href: '#dpa' }] },
        ]}
        aside={
          <form className="flex w-full max-w-[320px] gap-2" onSubmit={(event) => event.preventDefault()}>
            <Input type="email" placeholder="you@company.com" aria-label="Email for the newsletter" inputSize="sm" containerClassName="flex-1" />
            <Button type="submit" size="sm">
              Subscribe
            </Button>
          </form>
        }
        legal="© 2026 Acme, Inc."
        bottomLinks={[{ label: 'Terms', href: '#t' }, { label: 'Privacy', href: '#pr' }, { label: 'Cookies', href: '#co' }]}
        social={[{ label: 'Acme blog', href: '#blog', icon: Rss }, { label: 'Email us', href: '#mail', icon: Mail }, { label: 'Language', href: '#lang', icon: Globe }]}
      />
    </Frame>
  )
}

export const demos: ExampleModule = {
  'section-heading': {
    description:
      'The eyebrow, title and lede every marketing section opens with. A landing page is eight of these in a row; eight hand-written ones drift in tracking and measure, so this holds all three.',
    sections: [
      {
        title: 'Alignments',
        stack: true,
        specimens: [
          {
            label: 'center',
            fill: true,
            node: <SectionHeading eyebrow="Features" title="Everything you need to move faster" description="One place for your events, dashboards and the alerts that act on them." className="w-full" />,
          },
          {
            label: 'start, with an action',
            fill: true,
            node: (
              <SectionHeading align="start" eyebrow="Customers" title="Loved by teams that ship" className="w-full">
                <Button variant="outline" size="sm">
                  Read the stories
                </Button>
              </SectionHeading>
            ),
          },
        ],
      },
      rationale(
        'Section headers are the most repeated block on a marketing site and the one most often copied with a different class string each time.',
        'Display type sits above the app scale (which stops at 30px) with the same tightening tracking, and the lede is held to 60ch however wide the section.',
        'Every section of a landing, pricing or customers page.',
        ['Text', 'type scale'],
      ),
    ],
    props: [
      { name: 'eyebrow / title / description', type: 'ReactNode', description: 'The three lines.' },
      { name: 'align', type: "'center' | 'start'", defaultValue: 'center', description: 'start puts children to the right from sm.' },
      { name: 'as', type: "'h1' | 'h2' | 'h3'", defaultValue: 'h2', description: 'Heading level; the size never changes.' },
      { name: 'children', type: 'ReactNode', description: 'Affordances beside or under the heading.' },
    ],
  },

  'site-header': {
    description:
      'The marketing top bar: brand, links out to pages, and a sign-up. Navbar is the signed-in app header; this is the public site’s, transparent over the hero until the page scrolls.',
    sections: [
      {
        title: 'Example',
        description: 'Narrow the window below 768px to fold the links into the disclosure panel.',
        bare: true,
        Content: HeaderExample,
      },
      rationale(
        'The app header and the marketing header answer different questions — “where am I in my workspace” versus “what is this product” — and one component stretched over both serves neither.',
        'It lifts off the page only after scrolling, so the hero stays one image, and the mobile menu is a disclosure rather than a modal: no focus trap needed, Escape closes it.',
        'Every public page: landing, pricing, docs, blog.',
        ['Button', 'internal glyphs'],
      ),
    ],
    props: [
      { name: 'brand', type: 'ReactNode', description: 'Lockup on the left.' },
      { name: 'links', type: 'SiteLink[]', description: '{ label, href, current? }.' },
      { name: 'actions', type: 'ReactNode', description: 'Sign in and the primary CTA.' },
      { name: 'sticky', type: 'boolean', defaultValue: 'true', description: 'Pin to the top and lift once scrolled.' },
    ],
  },

  'hero-section': {
    description:
      'The first screen of a SaaS site: an announcement that links to the latest launch, a promise, two actions, reassurance and the product itself — framed in the same radius and elevation as the app.',
    sections: [
      { title: 'Example', bare: true, Content: HeroExample },
      rationale(
        'PromoBanner is a fixed-height card inside a dashboard. A marketing hero is page-level: it owns the display scale, is the page’s h1, and needs a slot for the product.',
        'HeroHighlight marks the promise with an accent bar behind the words instead of recolouring them, so it reads on any accent, pale or deep.',
        'Landing pages, feature pages, launch pages.',
        ['Badge', 'Text', 'AuroraSurface', 'StatCard', 'Sparkline'],
      ),
    ],
    props: [
      { name: 'title', type: 'ReactNode', description: 'Wrap the key phrase in HeroHighlight.' },
      { name: 'announcement', type: '{ label, badge?, href?, onClick? }', description: 'The pill above the headline.' },
      { name: 'actions / note', type: 'ReactNode', description: 'CTAs and the line under them.' },
      { name: 'media / backdrop', type: 'ReactNode', description: 'Product image, and decoration behind everything.' },
      { name: 'layout', type: "'center' | 'split'", defaultValue: 'center', description: 'Split puts copy and media side by side from lg.' },
    ],
  },

  'logo-cloud': {
    description:
      'Social proof as customer marks, all flattened to one muted tone. In their own colours a row of logos is a row of competing calls to action; in one tone it is a single fact.',
    sections: [
      {
        title: 'Variants',
        stack: true,
        specimens: [
          { label: 'row', fill: true, node: <LogoCloud logos={LOGOS} title="Trusted by 4,000+ teams" className="w-full" /> },
          { label: 'grid', fill: true, node: <LogoCloud logos={LOGOS} variant="grid" className="w-full" /> },
          { label: 'marquee', fill: true, node: <LogoCloud logos={LOGOS} variant="marquee" className="w-full" /> },
        ],
      },
      rationale(
        'Logo strips are usually images with no names, which makes the one piece of evidence on the page invisible to a screen reader.',
        'Each mark is an image named for the company; the marquee reuses Marquee, so it pauses on hover and stops under reduced motion.',
        'Under a hero, above pricing, on a customers page.',
        ['Marquee', 'Text'],
      ),
    ],
    props: [
      { name: 'logos', type: '{ name, logo }[]', description: 'Name is the accessible name; logo draws in currentColor.' },
      { name: 'title', type: 'ReactNode', description: 'The claim the logos support.' },
      { name: 'variant', type: "'row' | 'grid' | 'marquee'", defaultValue: 'row', description: 'Layout.' },
    ],
  },

  'feature-grid': {
    description:
      'Benefit-led features: glyph, name, one sentence, and a link to the page that proves it. Each “Learn more” carries the feature name for assistive tech, so the visible label stays short.',
    sections: [
      { title: 'plain', bare: true, Content: () => <FeatureGrid features={FEATURES} /> },
      { title: 'card, two columns', bare: true, Content: () => <FeatureGrid features={FEATURES.slice(0, 4)} variant="card" columns={2} /> },
      rationale(
        'Nine links all called “Learn more” is the classic unlabelled-link failure, and feature grids are where it happens.',
        'Plain for a landing page, cards where features sit on a busier ground — the same data either way.',
        'Landing pages, product tours, an in-app “what can I do here”.',
        ['IconTile', 'Badge', 'Surface', 'Text'],
      ),
    ],
    props: [
      { name: 'features', type: 'FeatureItem[]', description: '{ icon?, title, description, href?, linkLabel?, badge? }.' },
      { name: 'columns', type: '2 | 3 | 4', defaultValue: '3', description: 'Columns at the widest breakpoint.' },
      { name: 'variant', type: "'plain' | 'card'", defaultValue: 'plain', description: 'Card gives each its own surface.' },
    ],
  },

  'testimonial-card': {
    description:
      'A customer quote with the person attached. A figure holding a blockquote and a figcaption is the only structure that tells assistive tech whose words these are.',
    sections: [
      {
        title: 'A wall',
        bare: true,
        Content: () => (
          <div className="grid gap-4 md:grid-cols-3">
            <TestimonialCard {...TESTIMONIALS[0]!} featured logo={<FakeLogo name="Northwind" />} className="md:col-span-2" />
            <TestimonialCard {...TESTIMONIALS[1]!} />
            <TestimonialCard {...TESTIMONIALS[2]!} />
            <TestimonialCard quote="The only analytics tool our designers open without being asked." name="Leo Brandt" role="Design Director" company="Lumen" className="md:col-span-2" />
          </div>
        ),
      },
      rationale(
        'Quotes styled as big italic paragraphs lose their attribution for anyone not seeing the layout.',
        'The rating is one image named “Rated 5 out of 5”, not five announced stars; featured uses the accent-soft ground so it leads without a new colour.',
        'Landing pages, pricing pages, sign-up side panels.',
        ['Surface', 'Avatar', 'Text'],
      ),
    ],
    props: [
      { name: 'quote', type: 'ReactNode', description: 'The words.' },
      { name: 'name / role / company', type: 'string', description: 'The attribution.' },
      { name: 'rating', type: 'number', description: 'Out of five.' },
      { name: 'featured', type: 'boolean', description: 'Larger quote, accent-soft ground.' },
      { name: 'logo / avatarSrc', type: 'ReactNode / string', description: 'Company mark and photo.' },
    ],
  },

  'cta-section': {
    description:
      'The closing ask at the foot of a page, and the one block on it allowed to be loud. It takes the banner radius so it reads as a sibling of the dashboard’s promo card.',
    sections: [
      { title: 'Tones', bare: true, Content: CtaExample },
      rationale(
        'Closing CTAs are usually a one-off coloured div with hard-coded white text that breaks the moment the brand colour changes.',
        'The accent tone uses accent-ink, which the theme derives from the accent — switch the accent in the header to see the text flip.',
        'The bottom of every marketing page; the end of an onboarding tour.',
        ['Button', 'banner radius', 'accent-ink'],
      ),
    ],
    props: [
      { name: 'title / description / note', type: 'ReactNode', description: 'The copy.' },
      { name: 'actions', type: 'ReactNode', description: 'Usually a white Button and a quieter one.' },
      { name: 'tone', type: "'accent' | 'ink' | 'muted'", defaultValue: 'accent', description: 'Ground colour.' },
      { name: 'aside', type: 'ReactNode', description: 'Artwork on the right from lg.' },
    ],
  },

  'site-footer': {
    description:
      'The site map at the foot of every marketing page, with column titles as real headings — the footer is where people look for “Careers” or “Security” by heading.',
    sections: [
      { title: 'Example', bare: true, Content: FooterExample },
      rationale(
        'Footers are link lists under styled divs, which gives a screen reader nothing to jump between.',
        'Columns collapse from four to two; the aside slot takes a newsletter form, a status badge or a region switcher.',
        'Every public page.',
        ['Text', 'Input', 'Button'],
      ),
    ],
    props: [
      { name: 'brand / tagline', type: 'ReactNode', description: 'The lockup and one line.' },
      { name: 'columns', type: 'FooterColumn[]', description: '{ title, links: { label, href, badge? }[] }.' },
      { name: 'social', type: '{ label, href, icon }[]', description: 'Icon links named for their destination.' },
      { name: 'legal / bottomLinks / aside', type: 'ReactNode / SiteLink[] / ReactNode', description: 'The bottom row, and a slot under the tagline.' },
    ],
  },
}
