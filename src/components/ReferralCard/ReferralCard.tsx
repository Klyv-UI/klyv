import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import type { IconComponent } from '../../lib/types'
import { Avatar } from '../Avatar'
import { Button } from '../Button'
import { CopyButton } from '../CopyButton'
import { Input } from '../Input'
import { Progress } from '../Progress'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { StatusPill } from '../internal/StatusPill'

export type ReferralCardStatus = 'invited' | 'joined' | 'rewarded'

export interface ReferralCardReferral {
  id: string
  name: string
  status: ReferralCardStatus
  /** Short detail after the name — “Joined 3 Sep”. */
  detail?: string
}

export interface ReferralCardTier {
  /** Friends who have to join to reach this tier. */
  count: number
  /** What the tier unlocks — “1 month free”. */
  reward: string
}

export interface ReferralCardShareTarget {
  label: string
  /** A prefilled share URL for the network or mail client. */
  href: string
  icon?: IconComponent
}

export interface ReferralCardProps {
  /** The personal invite link. */
  link: string
  /** The offer in a sentence — both sides of it. */
  reward: ReactNode
  /** Reward tiers, lowest first. */
  tiers?: ReferralCardTier[]
  /** People invited so far. Joined and rewarded both count towards a tier. */
  referrals?: ReferralCardReferral[]
  share?: ReferralCardShareTarget[]
  title?: ReactNode
  /** Merged last, so it wins. */
  className?: string
}

const STATUS: Record<ReferralCardStatus, { tone: 'neutral' | 'accent' | 'success'; label: string }> = {
  invited: { tone: 'neutral', label: 'Invited' },
  joined: { tone: 'accent', label: 'Joined' },
  rewarded: { tone: 'success', label: 'Reward earned' },
}

/**
 * Invite a friend, get something — with the link, the offer and the progress
 * on one card, because a referral programme lives or dies on whether people
 * understand what they get before they bother to share.
 *
 * The reward is stated before the link: nobody copies a link to an offer they
 * have not read. Progress counts friends who actually joined, not invitations
 * sent, and says how many more the next tier needs in words — a bar at 40% is
 * a shape; “2 more friends for 3 months free” is a reason to share again.
 *
 * The link sits in a read-only field so it can be selected by hand where the
 * clipboard is blocked, with a copy button that announces the result.
 */
export function ReferralCard({ link, reward, tiers = [], referrals = [], share = [], title = 'Invite friends', className }: ReferralCardProps) {
  const joined = referrals.filter((referral) => referral.status !== 'invited').length
  const next = tiers.find((tier) => tier.count > joined)
  const previous = [...tiers].reverse().find((tier) => tier.count <= joined)

  return (
    <Surface variant="card" padding="lg" className={cn('flex flex-col gap-5', className)}>
      <div className="flex flex-col gap-1.5">
        <Text as="h3" size="subtitle">
          {title}
        </Text>
        <Text as="div" size="body" weight="medium" tone="soft" leading="normal">
          {reward}
        </Text>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <Input readOnly value={link} aria-label="Your invite link" className="font-mono text-[12px]" containerClassName="min-w-0 flex-1" />
          <CopyButton value={link} label="Copy link" copiedLabel="Link copied" />
        </div>
        {share.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {share.map((target) => {
              const Icon = target.icon
              return (
                <Button key={target.label} as="a" href={target.href} target="_blank" rel="noopener noreferrer" variant="outline" size="sm" className="gap-1.5">
                  {Icon && <Icon size={14} aria-hidden="true" />}
                  {target.label}
                </Button>
              )
            })}
          </div>
        )}
      </div>

      {tiers.length > 0 && (
        <Surface variant="sunken" padding="md" className="flex flex-col gap-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <Text size="label" weight="bold">
              {next ? `${next.count - joined} more ${next.count - joined === 1 ? 'friend' : 'friends'} for ${next.reward}` : 'Every reward unlocked'}
            </Text>
            <Text size="caption" tone="faint" tabular>
              {joined} joined
            </Text>
          </div>
          <Progress
            label={next ? `Progress towards ${next.reward}` : 'All reward tiers reached'}
            value={next ? joined - (previous?.count ?? 0) : 1}
            max={next ? next.count - (previous?.count ?? 0) : 1}
          />
          <ol className="flex flex-wrap gap-x-4 gap-y-1">
            {tiers.map((tier) => (
              <li key={tier.count} className={cn('text-[11px] font-semibold', tier.count <= joined ? 'text-ink' : 'text-ink-faint')}>
                {tier.count <= joined && <span className="sr-only">Unlocked: </span>}
                {tier.count} → {tier.reward}
              </li>
            ))}
          </ol>
        </Surface>
      )}

      {referrals.length > 0 && (
        <div className="flex flex-col gap-2">
          <Text as="h4" size="label" weight="bold" tone="soft">
            Your invites ({referrals.length})
          </Text>
          <ul className="flex flex-col divide-y divide-line">
            {referrals.map((referral) => (
              <li key={referral.id} className="flex items-center gap-3 py-2.5">
                <Avatar name={referral.name} size="xs" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <Text size="label" weight="semibold" truncate>
                    {referral.name}
                  </Text>
                  {referral.detail && (
                    <Text size="caption" tone="faint">
                      {referral.detail}
                    </Text>
                  )}
                </div>
                <StatusPill tone={STATUS[referral.status].tone}>{STATUS[referral.status].label}</StatusPill>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Surface>
  )
}
