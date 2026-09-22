import { Mail, Rss, ShieldCheck, Sparkles, Users, Workflow, Zap, BarChart3 } from 'lucide-react'
import {
  Accordion,
  Banner,
  Button,
  CtaSection,
  FeatureComparison,
  FeatureGrid,
  HeroHighlight,
  HeroSection,
  LogoCloud,
  PricingTable,
  SectionHeading,
  SiteFooter,
  SiteHeader,
  StatCard,
  TestimonialCard,
  Wordmark,
} from 'klyvui'

/**
 * A SaaS homepage, top to bottom, from library components only.
 *
 * The order is the one landing pages converge on because it answers questions
 * in the order visitors ask them: what is it, who uses it, what does it do,
 * what does it cost, is it any good, what if — and then the ask.
 */

const BRAND = <Wordmark name="Acme" size="sm" mark={<span className="text-[13px] font-extrabold">A</span>} />

function Logo({ name, variant }: { name: string; variant: number }) {
  const shapes = [<circle key="c" cx="11" cy="14" r="8" />, <rect key="r" x="3" y="6" width="16" height="16" rx="4" />, <path key="p" d="M11 4l9 18H2z" />]
  return (
    <svg viewBox={`0 0 ${30 + name.length * 9.5} 28`} fill="currentColor" aria-hidden="true">
      {shapes[variant % 3]}
      <text x="27" y="19.5" fontSize="15" fontWeight="800" fontFamily="inherit">
        {name}
      </text>
    </svg>
  )
}

const LOGOS = ['Northwind', 'Kestrel', 'Lumen', 'Orbital', 'Fathom', 'Quarry'].map((name, index) => ({
  name,
  logo: <Logo name={name} variant={index} />,
}))

const FEATURES = [
  { icon: Zap, title: 'Real-time by default', description: 'Every chart and list updates as events arrive — no refresh button, no stale numbers.' },
  { icon: Workflow, title: 'Workflows', description: 'Turn a threshold into an action: alert a channel, open a ticket, pause a campaign.', badge: 'New' },
  { icon: ShieldCheck, title: 'Secure by design', description: 'SSO, SCIM, audit logs and data residency in the EU or the US.' },
  { icon: Users, title: 'Built for teams', description: 'Roles, shared views and comments, so everyone reads the same numbers.' },
  { icon: BarChart3, title: 'Reports that explain', description: 'Every metric shows its definition and its source, one click away.' },
  { icon: Sparkles, title: 'Answers, not queries', description: 'Ask in plain language and get a chart you can pin to a dashboard.' },
]

const PLANS = [
  { id: 'free', name: 'Free', description: 'For individuals trying things out.', monthly: 0, yearly: 0, features: ['Up to 3 projects', '10k events a month', 'Community support'], ctaLabel: 'Start for free' },
  { id: 'pro', name: 'Pro', description: 'For small teams shipping every week.', monthly: 24, yearly: 19, featured: true, badge: 'Most popular', featuresTitle: 'Everything in Free, plus', features: ['Unlimited projects', '1M events a month', 'Workflows and alerts', 'Email support'] },
  { id: 'team', name: 'Team', description: 'For growing teams that need control.', monthly: 49, yearly: 39, featuresTitle: 'Everything in Pro, plus', features: ['SSO with SAML', 'Roles and permissions', 'Audit log', 'Priority support'] },
  { id: 'enterprise', name: 'Enterprise', description: 'For organisations with custom needs.', monthly: null, yearly: null, featuresTitle: 'Everything in Team, plus', features: ['Dedicated success manager', '99.99% uptime SLA', 'Custom contract and DPA'] },
]

const TESTIMONIALS = [
  { quote: 'We replaced three internal dashboards in a week. The team argues about decisions now, not about whose numbers are right.', name: 'Maya Okafor', role: 'Head of Growth', company: 'Northwind', rating: 5 },
  { quote: 'The workflows paid for the plan in the first month — churn alerts reach the account owner the same morning.', name: 'Daniel Reyes', role: 'VP Customer Success', company: 'Kestrel', rating: 5 },
  { quote: 'SSO and the audit log got us through security review without a single follow-up.', name: 'Priya Natarajan', role: 'IT Lead', company: 'Orbital', rating: 4 },
]

function ProductShot() {
  return (
    <div className="grid gap-3 bg-app p-4 sm:grid-cols-3 sm:p-5" aria-hidden="true">
      <StatCard title="Active users" value="12,481" delta="+8.2%" trend="up" caption="Last 7 days" />
      <StatCard title="Conversion" value="4.9%" delta="+0.6%" trend="up" caption="Trial to paid" />
      <StatCard title="Churn" value="1.8%" delta="-0.3%" trend="down" caption="Monthly" />
    </div>
  )
}

export default function SaasLandingBlock() {
  return (
    <div className="w-full overflow-hidden rounded-[var(--radius-window)] border border-line bg-app">
      <Banner layout="strip" tone="ink" badge="New" href="#changelog">
        Workflows can now post to any webhook.
      </Banner>
      <SiteHeader
        brand={BRAND}
        sticky={false}
        links={[
          { label: 'Product', href: '#product' },
          { label: 'Pricing', href: '#pricing' },
          { label: 'Customers', href: '#customers' },
          { label: 'Docs', href: '#docs' },
        ]}
        actions={
          <>
            <Button variant="ghost" size="sm">
              Sign in
            </Button>
            <Button size="sm">Start free trial</Button>
          </>
        }
      />
      <HeroSection
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
      />
      <div className="flex flex-col gap-20 px-5 pb-16 sm:px-10">
        <LogoCloud logos={LOGOS} title="Trusted by 4,000+ product teams" />
        <div className="flex flex-col gap-12">
          <SectionHeading eyebrow="Features" title="Everything you need to move faster" description="One place for your events, the dashboards built on them, and the alerts that act on them." />
          <FeatureGrid features={FEATURES} />
        </div>
        <div className="flex flex-col gap-10">
          <SectionHeading eyebrow="Pricing" title="Simple pricing that scales with you" description="Start free. Upgrade when the team does." />
          <PricingTable plans={PLANS} />
          <FeatureComparison
            label="Compare plans"
            plans={[
              { id: 'free', name: 'Free' },
              { id: 'pro', name: 'Pro', highlight: true },
              { id: 'team', name: 'Team' },
              { id: 'enterprise', name: 'Enterprise' },
            ]}
            groups={[
              { title: 'Usage', rows: [{ label: 'Events a month', values: { free: '10k', pro: '1M', team: '10M', enterprise: 'Custom' } }, { label: 'Data retention', values: { free: '30 days', pro: '1 year', team: '3 years', enterprise: 'Custom' } }] },
              { title: 'Security', rows: [{ label: 'SSO with SAML', values: { free: false, pro: false, team: true, enterprise: true } }, { label: 'Audit log', values: { free: false, pro: false, team: true, enterprise: true } }] },
            ]}
          />
        </div>
        <div className="flex flex-col gap-10">
          <SectionHeading eyebrow="Customers" title="Loved by teams that ship" />
          <div className="grid gap-4 md:grid-cols-3">
            {TESTIMONIALS.map((testimonial, index) => (
              <TestimonialCard key={testimonial.name} {...testimonial} featured={index === 0} />
            ))}
          </div>
        </div>
        <div className="mx-auto flex w-full max-w-[760px] flex-col gap-8">
          <SectionHeading eyebrow="FAQ" title="Questions, answered" />
          <Accordion
            divided
            items={[
              { id: 'trial', title: 'What happens when the trial ends?', content: 'You move to the Free plan unless you add a card. Nothing is deleted.' },
              { id: 'seats', title: 'How are seats counted?', content: 'Anyone who can sign in counts as a seat. Viewers on Team are free.' },
              { id: 'cancel', title: 'Can I cancel at any time?', content: 'Yes. You keep access until the end of the period you paid for.' },
            ]}
          />
        </div>
        <CtaSection
          title="Start making decisions with the whole team"
          description="Set up in an afternoon. Cancel whenever you like."
          actions={<Button variant="white">Start free trial</Button>}
          note="14-day trial on every plan"
        />
      </div>
      <SiteFooter
        brand={BRAND}
        tagline="Product analytics your whole team actually reads."
        columns={[
          { title: 'Product', links: [{ label: 'Features', href: '#f' }, { label: 'Pricing', href: '#p' }, { label: 'Changelog', href: '#c', badge: 'New' }] },
          { title: 'Company', links: [{ label: 'About', href: '#a' }, { label: 'Careers', href: '#j' }] },
          { title: 'Resources', links: [{ label: 'Docs', href: '#d' }, { label: 'Status', href: '#s' }] },
          { title: 'Legal', links: [{ label: 'Security', href: '#sec' }, { label: 'Privacy', href: '#pr' }] },
        ]}
        legal="© 2026 Acme, Inc."
        social={[{ label: 'Acme blog', href: '#blog', icon: Rss }, { label: 'Email us', href: '#mail', icon: Mail }]}
      />
    </div>
  )
}
