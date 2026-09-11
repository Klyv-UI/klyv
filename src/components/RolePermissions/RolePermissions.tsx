'use client'

import { cn } from '../../lib/cn'
import { Checkbox } from '../Checkbox'
import { Surface } from '../Surface'
import { Text } from '../Text'
import { VisuallyHidden } from '../VisuallyHidden'
import { LockIcon } from '../internal/icons'

export interface PermissionRole {
  id: string
  name: string
  description?: string
  /** A built-in role whose permissions cannot be edited — Owner, usually. */
  locked?: boolean
}

export interface PermissionGroup {
  title: string
  permissions: { id: string; label: string; description?: string }[]
}

export interface RolePermissionsProps {
  roles: PermissionRole[]
  groups: PermissionGroup[]
  /** role id → the permission ids it holds. */
  value: Record<string, string[]>
  /** Omit for a read-only matrix. */
  onChange?: (value: Record<string, string[]>) => void
  /** Caption for the table. */
  label: string
  className?: string
}

/**
 * Which role can do what, as a grid of checkboxes.
 *
 * Every checkbox is named for its intersection — "Admin: Delete projects" — since
 * a column of unlabelled boxes gives a screen reader nothing but "checkbox,
 * checked" forty times. Locked roles are shown, not hidden: seeing that Owner
 * can do everything is how people understand what the other roles cannot.
 *
 * The permission column stays pinned while the roles scroll, which is what
 * makes a six-role matrix usable on a laptop.
 */
export function RolePermissions({ roles, groups, value, onChange, label, className }: RolePermissionsProps) {
  const total = groups.reduce((sum, group) => sum + group.permissions.length, 0)

  const toggle = (roleId: string, permissionId: string, granted: boolean) => {
    if (!onChange) return
    const current = new Set(value[roleId] ?? [])
    if (granted) current.add(permissionId)
    else current.delete(permissionId)
    onChange({ ...value, [roleId]: [...current] })
  }

  return (
    <Surface variant="card" className={cn('relative overflow-x-auto', className)}>
      <table className="w-full min-w-[560px] border-collapse text-left">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr className="border-b border-line">
            <td className="sticky left-0 z-[1] min-w-[200px] bg-surface px-5 py-4" />
            {roles.map((role) => (
              <th key={role.id} scope="col" className="min-w-[110px] px-3 py-4 text-center align-bottom">
                <span className="flex flex-col items-center gap-1">
                  <span className="inline-flex items-center gap-1">
                    {role.locked && <LockIcon size={11} className="text-ink-faint" />}
                    <Text as="span" size="label" weight="bold">
                      {role.name}
                    </Text>
                  </span>
                  <Text as="span" size="micro" weight="semibold" tone="faint" tabular>
                    {(value[role.id] ?? []).length}/{total}
                  </Text>
                  {role.locked && <VisuallyHidden>, cannot be edited</VisuallyHidden>}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.title}>
            <tr>
              <th
                scope="colgroup"
                colSpan={roles.length + 1}
                className="sticky left-0 bg-surface-sunken px-5 py-2.5 text-[11px] font-bold uppercase tracking-wider text-ink-faint"
              >
                {group.title}
              </th>
            </tr>
            {group.permissions.map((permission) => (
              <tr key={permission.id} className="border-b border-line last:border-0">
                <th scope="row" className="sticky left-0 z-[1] bg-surface px-5 py-3 align-top font-normal">
                  <span className="flex flex-col gap-0.5">
                    <Text as="span" size="label" weight="semibold">
                      {permission.label}
                    </Text>
                    {permission.description && (
                      <Text as="span" size="caption" tone="faint" leading="normal">
                        {permission.description}
                      </Text>
                    )}
                  </span>
                </th>
                {roles.map((role) => {
                  const granted = (value[role.id] ?? []).includes(permission.id)
                  return (
                    <td key={role.id} className="px-3 py-3 text-center align-middle">
                      <Checkbox
                        checked={granted}
                        disabled={role.locked || !onChange}
                        onChange={(event) => toggle(role.id, permission.id, event.target.checked)}
                        aria-label={`${role.name}: ${permission.label}`}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        ))}
      </table>
    </Surface>
  )
}
