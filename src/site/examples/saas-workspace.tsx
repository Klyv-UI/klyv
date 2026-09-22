import { useState } from 'react'
import { Bell, CreditCard, Keyboard, LifeBuoy, Settings, User } from 'lucide-react'
import {
  Card,
  InviteMembers,
  MemberList,
  RolePermissions,
  Text,
  UserMenu,
  WorkspaceSwitcher,
  type Member,
} from 'klyvui'
import type { ExampleModule } from './types'
import { rationale } from './shared'
import { MANY_WORKSPACES, MEMBERS, PERMISSION_GROUPS, PERMISSION_ROLES, PERMISSION_VALUE, ROLES, WORKSPACES } from './saas-shared'

function SwitcherExample() {
  const [few, setFew] = useState('northwind')
  const [many, setMany] = useState('orbital')
  const [created, setCreated] = useState(false)
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Text size="caption" weight="semibold" tone="soft">
            Three workspaces
          </Text>
          <WorkspaceSwitcher workspaces={WORKSPACES} value={few} onValueChange={setFew} onCreate={() => setCreated(true)} fullWidth />
        </div>
        <div className="flex flex-col gap-2">
          <Text size="caption" weight="semibold" tone="soft">
            Eight — search appears
          </Text>
          <WorkspaceSwitcher workspaces={MANY_WORKSPACES} value={many} onValueChange={setMany} fullWidth />
        </div>
      </div>
      <Text size="caption" tone="faint" aria-live="polite">
        {created ? 'Create workspace was chosen.' : 'Open with click or ArrowDown; arrows move, Enter chooses, Escape returns focus.'}
      </Text>
    </div>
  )
}

function UserMenuExample() {
  const [last, setLast] = useState<string>()
  const pick = (label: string) => () => setLast(label)
  const items = [
    { id: 'profile', label: 'Profile', icon: User, onSelect: pick('Profile') },
    { id: 'settings', label: 'Settings', icon: Settings, meta: '⌘ ,', onSelect: pick('Settings') },
    { id: 'billing', label: 'Billing', icon: CreditCard, onSelect: pick('Billing') },
    { id: 'notifications', label: 'Notifications', icon: Bell, meta: '3', onSelect: pick('Notifications') },
    'separator' as const,
    { id: 'shortcuts', label: 'Keyboard shortcuts', icon: Keyboard, meta: '?', onSelect: pick('Shortcuts') },
    { id: 'help', label: 'Help and support', icon: LifeBuoy, onSelect: pick('Help') },
  ]
  return (
    <div className="flex w-full flex-wrap items-center justify-between gap-6">
      <div className="flex items-center gap-6">
        <UserMenu name="Alex Morgan" email="alex@northwind.io" badge="Owner" items={items} onSignOut={pick('Sign out')} />
        <UserMenu name="Alex Morgan" email="alex@northwind.io" badge="Owner" items={items} onSignOut={pick('Sign out')} showName />
      </div>
      <Text size="caption" tone="faint" aria-live="polite">
        {last ? `Chose ${last}` : 'Avatar only, and with the name.'}
      </Text>
    </div>
  )
}

function MembersExample() {
  const [members, setMembers] = useState<Member[]>(MEMBERS)
  return (
    <MemberList
      members={members}
      roles={ROLES}
      currentUserId="u2"
      onRoleChange={(id, role) => setMembers((current) => current.map((member) => (member.id === id ? { ...member, role } : member)))}
      onRemove={async (member) => {
        await new Promise((resolve) => window.setTimeout(resolve, 500))
        setMembers((current) => current.filter((item) => item.id !== member.id))
      }}
      onResendInvite={() => undefined}
      searchable
    />
  )
}

function InviteExample() {
  const [sent, setSent] = useState<string[]>([])
  return (
    <div className="flex w-full flex-col gap-3">
      <Card title="Invite people" className="w-full max-w-[640px]">
        <InviteMembers
          roles={ROLES.filter((role) => role.value !== 'owner')}
          defaultRole="member"
          existingEmails={MEMBERS.map((member) => member.email)}
          seats={{ used: 8, total: 10 }}
          allowOverage
          onInvite={async (invites) => {
            await new Promise((resolve) => window.setTimeout(resolve, 600))
            setSent((current) => [...current, ...invites.map((invite) => `${invite.email} (${invite.role})`)])
          }}
        />
      </Card>
      <Text size="caption" tone="faint" leading="normal">
        Try pasting “kim@acme.io, lee@acme.io, sam@northwind.io, not-an-email” — the existing member and the malformed address are caught.
        {sent.length > 0 && ` Sent: ${sent.join(', ')}.`}
      </Text>
    </div>
  )
}

function PermissionsExample() {
  const [value, setValue] = useState(PERMISSION_VALUE)
  return <RolePermissions label="Role permissions" roles={PERMISSION_ROLES} groups={PERMISSION_GROUPS} value={value} onChange={setValue} />
}

export const demos: ExampleModule = {
  'workspace-switcher': {
    description:
      'Switch between the organisations or projects one account belongs to — a listbox in a popover, with the current workspace checked, arrow keys, and a search once the list passes six.',
    sections: [
      { title: 'Example', bare: true, Content: SwitcherExample },
      rationale(
        'Workspace switchers are built as menus with no current value, no keyboard path and no search, and agencies with forty clients live in them.',
        'It is a listbox because choosing changes a value; focus returns to the trigger after choosing or Escape, and Create sits apart from the list.',
        'The top of an app sidebar, an account menu, an admin impersonation picker.',
        ['Popover', 'SearchField', 'Divider', 'Text'],
      ),
    ],
    props: [
      { name: 'workspaces', type: 'Workspace[]', description: '{ id, name, plan?, logo? } — logo falls back to a letter on the accent.' },
      { name: 'value / onValueChange', type: 'string / fn', description: 'The current workspace.' },
      { name: 'onCreate / createLabel', type: 'fn / string', description: 'The create action at the foot.' },
      { name: 'searchThreshold', type: 'number', defaultValue: '6', description: 'Show search past this many.' },
      { name: 'fullWidth', type: 'boolean', description: 'Stretch to the container.' },
    ],
  },

  'user-menu': {
    description:
      'The account menu behind the avatar. Who is signed in sits above the menu rather than in it, and sign out is always last and always there.',
    sections: [
      { title: 'Example', bare: true, Content: UserMenuExample },
      rationale(
        '“Which account am I in?” is the most common reason to open this menu, and most implementations answer it with a name and no email.',
        'Items use menu semantics with roving focus; the destructive sign-out is separated by a rule and coloured with the danger token.',
        'The right of an app header, the foot of a sidebar.',
        ['Popover', 'Avatar', 'Tag', 'Divider'],
      ),
    ],
    props: [
      { name: 'name / email / avatarSrc / badge', type: 'string', description: 'Identity header.' },
      { name: 'items', type: "(UserMenuItem | 'separator')[]", description: '{ id, label, icon?, meta?, href?, onSelect? }.' },
      { name: 'onSignOut / signOutLabel', type: 'fn / string', description: 'Always last.' },
      { name: 'showName', type: 'boolean', description: 'Name beside the avatar in the trigger.' },
    ],
  },

  'member-list': {
    description:
      'The people in a workspace, their roles, and the controls to change both — enforcing the rule most team screens forget: a workspace can never lose its last owner.',
    sections: [
      {
        title: 'Example',
        description: 'You are Sam (admin). Alex is the only owner, so Alex cannot be demoted or removed.',
        bare: true,
        Content: MembersExample,
      },
      rationale(
        'Removing or demoting the last owner locks a customer out of their own billing, and it is usually discovered through an error after the dialog has closed.',
        'The guard is visible and explained in the row; removal confirms and names the person; pending invitations can be resent or revoked in place.',
        'Team settings, an admin customer page.',
        ['Avatar', 'Select', 'SearchField', 'ConfirmDialog', 'Tag'],
      ),
    ],
    props: [
      { name: 'members', type: 'Member[]', description: "{ id, name, email, role, status?: 'active' | 'invited' | 'suspended', lastActive? }." },
      { name: 'roles', type: 'RoleOption[]', description: '{ value, label, description? }.' },
      { name: 'currentUserId / ownerRole', type: 'string', defaultValue: "— / 'owner'", description: 'Marks “You”; the role that cannot reach zero.' },
      { name: 'canManage', type: 'boolean', defaultValue: 'true', description: 'Whether controls are shown.' },
      { name: 'onRoleChange / onRemove / onResendInvite', type: 'fn', description: 'onRemove may return a promise.' },
    ],
  },

  'invite-members': {
    description:
      'Invite several people at once with one role, and see what it costs before sending. Addresses become chips as they are typed or pasted, each checked on the way in.',
    sections: [
      { title: 'Example', bare: true, Content: InviteExample },
      rationale(
        'Invite forms take one address at a time, reject a pasted list, and report seat limits as a failed request.',
        'Bad chips go back into the field when clicked; seats are counted before sending, as a warning with overage or a block without.',
        'Team settings, onboarding, an empty member list.',
        ['Chip', 'Input', 'Select', 'Button', 'InlineMessage'],
      ),
    ],
    props: [
      { name: 'roles / defaultRole', type: 'RoleOption[] / string', description: 'Role for everyone invited.' },
      { name: 'onInvite', type: '(invites) => void | Promise', description: 'Throw to show the error.' },
      { name: 'existingEmails', type: 'string[]', description: 'Caught before sending.' },
      { name: 'seats / allowOverage', type: '{ used, total } / boolean', description: 'Warn or block past the plan.' },
    ],
  },

  'role-permissions': {
    description:
      'Which role can do what, as a checkbox matrix. Every box is named for its intersection, locked roles are shown rather than hidden, and the permission column stays pinned while roles scroll.',
    sections: [
      { title: 'Example', bare: true, Content: PermissionsExample },
      rationale(
        'Permission grids are a wall of unlabelled checkboxes to a screen reader — “checkbox, checked” forty times.',
        'Seeing that Owner can do everything is how people understand what the other roles cannot; each header counts what the role holds.',
        'Roles settings, an enterprise admin console.',
        ['Checkbox', 'Surface', 'Text'],
      ),
    ],
    props: [
      { name: 'roles', type: 'PermissionRole[]', description: '{ id, name, description?, locked? }.' },
      { name: 'groups', type: 'PermissionGroup[]', description: '{ title, permissions: { id, label, description? }[] }.' },
      { name: 'value / onChange', type: 'Record<roleId, permissionId[]> / fn', description: 'Omit onChange for read-only.' },
      { name: 'label', type: 'string', description: 'Table caption.' },
    ],
  },
}
