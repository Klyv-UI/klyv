'use client'

import { useMemo, useState } from 'react'
import { cn } from '../../lib/cn'
import { Field } from '../Field'
import { Select } from '../Select'
import { Text } from '../Text'

export interface AccessExplainerRole {
  id: string
  name?: string
  /** Actions this role grants. `*` and `docs:*` style wildcards are allowed. */
  permissions: string[]
}

export interface AccessExplainerGroup {
  id: string
  name?: string
  /** User ids, or other group ids written `group:<id>`. */
  members: string[]
}

export interface AccessExplainerResource {
  id: string
  name?: string
  /** The containing resource. Grants and inheritable rules flow down from it. */
  parent?: string
}

export interface AccessExplainerBinding {
  /** `user:<id>` or `group:<id>`. */
  principal: string
  role: string
  resource: string
}

export interface AccessExplainerRule {
  id: string
  effect: 'allow' | 'deny'
  /** `user:<id>`, `group:<id>` or `*` for everyone. */
  principal: string
  /** An action, or a wildcard such as `billing:*`. */
  action: string
  resource: string
  /** Whether the rule applies to the resource’s descendants too. Defaults to true. */
  inherit?: boolean
  /** Why the rule exists — shown in the trace. */
  reason?: string
}

export interface AccessExplainerPolicy {
  users: { id: string; name?: string }[]
  groups?: AccessExplainerGroup[]
  roles: AccessExplainerRole[]
  resources: AccessExplainerResource[]
  bindings?: AccessExplainerBinding[]
  rules?: AccessExplainerRule[]
}

export interface AccessExplainerQuery {
  user: string
  action: string
  resource: string
}

export type AccessExplainerStepKind = 'principal' | 'hierarchy' | 'grant' | 'rule' | 'override' | 'result'

export interface AccessExplainerStep {
  kind: AccessExplainerStepKind
  /** match: this step granted or denied; skip: checked and did not apply. */
  outcome: 'allow' | 'deny' | 'info' | 'skip'
  text: string
}

export interface AccessExplainerDecision {
  allowed: boolean
  steps: AccessExplainerStep[]
}

export interface AccessExplainerProps {
  policy: AccessExplainerPolicy
  /** The question, controlled. */
  query?: AccessExplainerQuery
  /** The initial question when uncontrolled. */
  defaultQuery?: AccessExplainerQuery
  /** Called when the reader changes the user, action or resource. */
  onQueryChange?: (query: AccessExplainerQuery) => void
  /** Actions offered in the picker. Defaults to every non-wildcard action named in the policy. */
  actions?: string[]
  /** Merged last, so it wins. */
  className?: string
}

/** `*` matches everything; `docs:*` matches `docs:read`; otherwise exact. */
const matches = (pattern: string, action: string) =>
  pattern === '*' || pattern === action || (pattern.endsWith(':*') && action.startsWith(pattern.slice(0, -1)))

/**
 * Evaluates one question against the policy and records why. Deny beats allow;
 * without any allow the answer is the implicit deny.
 */
function evaluate(policy: AccessExplainerPolicy, query: AccessExplainerQuery): AccessExplainerDecision {
  const steps: AccessExplainerStep[] = []
  const say = (kind: AccessExplainerStepKind, outcome: AccessExplainerStep['outcome'], text: string) => steps.push({ kind, outcome, text })
  const label = (list: { id: string; name?: string }[], id: string) => list.find((item) => item.id === id)?.name ?? id
  const groups = policy.groups ?? []
  const userName = label(policy.users, query.user)
  const resourceName = (id: string) => label(policy.resources, id)

  // 1. Who is asking: the user plus every group that contains them, transitively.
  const principals = new Map<string, string>([[`user:${query.user}`, userName]])
  const queue = [`user:${query.user}`]
  while (queue.length) {
    const member = queue.shift() as string
    for (const group of groups) {
      const key = `group:${group.id}`
      const includes = group.members.includes(member) || (member.startsWith('user:') && group.members.includes(member.slice(5)))
      if (includes && !principals.has(key)) {
        principals.set(key, member === `user:${query.user}` ? 'direct member' : `via ${principals.has(member) ? label(groups, member.slice(6)) : member}`)
        queue.push(key)
        say('principal', 'info', `${userName} is in ${group.name ?? group.id} (${principals.get(key)}).`)
      }
    }
  }
  if (principals.size === 1) say('principal', 'info', `${userName} is in no groups; only rules for them directly apply.`)
  const covers = (principal: string) => principal === '*' || principals.has(principal)
  const principalName = (principal: string) =>
    principal === '*' ? 'everyone' : principal.startsWith('group:') ? label(groups, principal.slice(6)) : label(policy.users, principal.slice(5))

  // 2. Where: the resource and its ancestors, nearest first.
  const chain: string[] = []
  for (let id: string | undefined = query.resource; id && !chain.includes(id); id = policy.resources.find((item) => item.id === id)?.parent) chain.push(id)
  if (chain.length > 1) say('hierarchy', 'info', `${resourceName(query.resource)} inherits from ${chain.slice(1).map(resourceName).join(' → ')}.`)

  const allows: string[] = []
  const denies: string[] = []

  chain.forEach((resource, depth) => {
    const at = depth === 0 ? `on ${resourceName(resource)}` : `inherited from ${resourceName(resource)}`
    for (const binding of (policy.bindings ?? []).filter((item) => item.resource === resource)) {
      const role = policy.roles.find((item) => item.id === binding.role)
      const roleName = role?.name ?? binding.role
      if (!covers(binding.principal)) continue
      const grant = role?.permissions.find((permission) => matches(permission, query.action))
      if (grant) {
        const text = `${principalName(binding.principal)} holds ${roleName} ${at}, which grants ${grant === query.action ? query.action : `${grant} (covers ${query.action})`}.`
        allows.push(`${roleName} ${at}`)
        say('grant', 'allow', text)
      } else {
        say('grant', 'skip', `${principalName(binding.principal)} holds ${roleName} ${at}, but it does not include ${query.action}.`)
      }
    }
    for (const rule of (policy.rules ?? []).filter((item) => item.resource === resource)) {
      const name = `${rule.effect === 'deny' ? 'Deny' : 'Allow'} rule “${rule.id}”`
      if (!covers(rule.principal)) continue
      if (!matches(rule.action, query.action)) {
        say('rule', 'skip', `${name} ${at} is for ${rule.action}, not ${query.action}.`)
        continue
      }
      if (depth > 0 && rule.inherit === false) {
        say('rule', 'skip', `${name} on ${resourceName(resource)} matches but does not inherit to children.`)
        continue
      }
      const why = rule.reason ? ` — ${rule.reason}` : ''
      if (rule.effect === 'deny') denies.push(`${name} ${at}`)
      else allows.push(`${name} ${at}`)
      say('rule', rule.effect, `${name} ${at} applies to ${principalName(rule.principal)}${why}.`)
    }
  })

  const allowed = denies.length === 0 && allows.length > 0
  if (denies.length && allows.length) {
    say('override', 'deny', `${denies[0]} overrides ${allows.join(', ')}: an explicit deny always wins.`)
  }
  say(
    'result',
    allowed ? 'allow' : 'deny',
    allowed
      ? `Allowed — ${userName} can ${query.action} ${resourceName(query.resource)} through ${allows[0]}.`
      : denies.length
        ? `Denied by ${denies[0]}.`
        : `Denied — nothing grants ${query.action} on ${resourceName(query.resource)} or its parents, so the default deny applies.`,
  )
  return { allowed, steps }
}

const MARK: Record<AccessExplainerStep['outcome'], { glyph: string; className: string; label: string }> = {
  allow: { glyph: '✓', className: 'bg-[color-mix(in_oklab,var(--color-success)_18%,transparent)] text-[color-mix(in_oklab,var(--color-success)_55%,var(--color-ink))]', label: 'Grants' },
  deny: { glyph: '✕', className: 'bg-[color-mix(in_oklab,var(--color-danger)_14%,transparent)] text-danger', label: 'Denies' },
  info: { glyph: '•', className: 'bg-surface-muted text-ink-soft', label: 'Context' },
  skip: { glyph: '–', className: 'bg-surface-muted text-ink-faint', label: 'Does not apply' },
}

const KIND: Record<AccessExplainerStepKind, string> = {
  principal: 'Identity',
  hierarchy: 'Hierarchy',
  grant: 'Role',
  rule: 'Rule',
  override: 'Override',
  result: 'Decision',
}

/**
 * “Why can’t Priya see this?” answered with the evaluation itself rather than a
 * yes or no.
 *
 * Given a policy — users, nested groups, roles with wildcard permissions, a
 * resource tree, role bindings, and explicit allow and deny rules — it
 * evaluates the question the way the policy engine would and lists every step:
 * which groups the user is in and through whom, which ancestors the resource
 * inherits from, each binding and rule it checked and whether it applied, and,
 * when a deny beats an allow, which one it overrode. Access bugs are almost
 * never the rule someone is looking at; they are the inherited deny three
 * levels up, and a trace shows it.
 */
export function AccessExplainer({ policy, query: controlled, defaultQuery, onQueryChange, actions, className }: AccessExplainerProps) {
  const actionList = useMemo(
    () =>
      actions ??
      [...new Set([...policy.roles.flatMap((role) => role.permissions), ...(policy.rules ?? []).map((rule) => rule.action)])]
        .filter((action) => !action.includes('*'))
        .sort(),
    [actions, policy],
  )
  const [own, setOwn] = useState<AccessExplainerQuery>(
    defaultQuery ?? { user: policy.users[0]?.id ?? '', action: actionList[0] ?? '', resource: policy.resources[0]?.id ?? '' },
  )
  const query = controlled ?? own
  const decision = useMemo(() => evaluate(policy, query), [policy, query])

  const update = (patch: Partial<AccessExplainerQuery>) => {
    const next = { ...query, ...patch }
    if (!controlled) setOwn(next)
    onQueryChange?.(next)
  }

  const depth = (id: string) => {
    let level = 0
    for (let node = policy.resources.find((item) => item.id === id); node?.parent && level < 8; node = policy.resources.find((item) => item.id === node?.parent)) level += 1
    return level
  }

  return (
    <div className={cn('flex min-w-0 flex-col gap-4', className)}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label="User">
          <Select label="User" fullWidth value={query.user} onValueChange={(user) => update({ user })} options={policy.users.map((user) => ({ value: user.id, label: user.name ?? user.id }))} />
        </Field>
        <Field label="Action">
          <Select label="Action" fullWidth value={query.action} onValueChange={(action) => update({ action })} options={actionList.map((action) => ({ value: action, label: action }))} />
        </Field>
        <Field label="Resource">
          <Select
            label="Resource"
            fullWidth
            value={query.resource}
            onValueChange={(resource) => update({ resource })}
            options={policy.resources.map((resource) => ({ value: resource.id, label: `${'  '.repeat(depth(resource.id))}${resource.name ?? resource.id}` }))}
          />
        </Field>
      </div>

      <div
        role="status"
        className={cn(
          'flex items-center gap-3 rounded-[var(--radius-tile)] px-4 py-3',
          decision.allowed ? 'bg-[color-mix(in_oklab,var(--color-success)_14%,transparent)]' : 'bg-[color-mix(in_oklab,var(--color-danger)_11%,transparent)]',
        )}
      >
        <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-full text-[15px] font-bold', decision.allowed ? 'bg-success text-white' : 'bg-danger text-white')} aria-hidden="true">
          {decision.allowed ? '✓' : '✕'}
        </span>
        <Text size="body" weight="semibold" leading="normal">{decision.steps[decision.steps.length - 1].text}</Text>
      </div>

      <ol className="relative flex flex-col gap-2 pl-1" aria-label="Evaluation trace">
        {decision.steps.slice(0, -1).map((step, index) => {
          const mark = MARK[step.outcome]
          return (
            <li key={index} className={cn('flex items-start gap-3', step.outcome === 'skip' && 'opacity-80')}>
              <span className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold', mark.className)} aria-hidden="true">
                {mark.glyph}
              </span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
                  {`${KIND[step.kind]} · `}
                  <span>{mark.label}</span>
                </span>
                <span className={cn('text-[12px] font-medium leading-normal', step.outcome === 'skip' ? 'text-ink-soft' : 'text-ink')}>{step.text}</span>
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
