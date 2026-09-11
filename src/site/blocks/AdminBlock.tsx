import { useMemo, useState } from 'react'
import {
  BarChart3,
  Check,
  LayoutDashboard,
  Plus,
  Settings2,
  Trash2,
  UserRound,
  Users,
} from 'lucide-react'
import {
  AreaChart,
  Avatar,
  Badge,
  Button,
  DataTable,
  DonutChart,
  Field,
  IconButton,
  Input,
  Modal,
  SearchField,
  Select,
  StatCard,
  Surface,
  Switch,
  Tag,
  Text,
  ToastProvider,
  cn,
  useToast,
  type DataTableColumn,
} from 'citrine'

/* ------------------------------------------------------------------- data */

type Role = 'owner' | 'editor' | 'viewer'
type Status = 'active' | 'invited' | 'paused'

interface Member {
  id: string
  name: string
  email: string
  role: Role
  status: Status
  seats: number
  lastSeen: string
}

const ROLES: { value: Role; label: string }[] = [
  { value: 'owner', label: 'Owner' },
  { value: 'editor', label: 'Editor' },
  { value: 'viewer', label: 'Viewer' },
]

const STATUS_TONE: Record<Status, 'accent' | 'neutral' | 'outline'> = {
  active: 'accent',
  invited: 'neutral',
  paused: 'outline',
}

const SEED: Member[] = [
  { id: 'u1', name: 'Ada Lovelace', email: 'ada@analytical.co', role: 'owner', status: 'active', seats: 12, lastSeen: '2 min ago' },
  { id: 'u2', name: 'Grace Hopper', email: 'grace@navy.mil', role: 'editor', status: 'active', seats: 8, lastSeen: '1 hr ago' },
  { id: 'u3', name: 'Alan Turing', email: 'alan@bletchley.uk', role: 'editor', status: 'paused', seats: 3, lastSeen: '3 days ago' },
  { id: 'u4', name: 'Katherine Johnson', email: 'katherine@nasa.gov', role: 'viewer', status: 'active', seats: 5, lastSeen: '20 min ago' },
  { id: 'u5', name: 'Radia Perlman', email: 'radia@spanning.net', role: 'editor', status: 'invited', seats: 0, lastSeen: 'Never' },
  { id: 'u6', name: 'Barbara Liskov', email: 'barbara@mit.edu', role: 'viewer', status: 'active', seats: 2, lastSeen: '5 hr ago' },
  { id: 'u7', name: 'Margaret Hamilton', email: 'margaret@apollo.io', role: 'owner', status: 'active', seats: 9, lastSeen: 'Just now' },
  { id: 'u8', name: 'Karen Sparck Jones', email: 'karen@idf.ac.uk', role: 'viewer', status: 'invited', seats: 0, lastSeen: 'Never' },
]

const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov']
const SIGNUPS = [124, 168, 152, 210, 248, 232, 296, 341]
const ACTIVE = [96, 121, 118, 167, 194, 186, 233, 279]

type Panel = 'overview' | 'members' | 'settings'

const NAV: { id: Panel; label: string; icon: typeof Users }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings2 },
]

/* ------------------------------------------------------------------ shell */

/**
 * A small admin panel that actually works.
 *
 * Everything here is a component from the library and every control does what
 * it says: the table sorts, selects and paginates, the invite dialog adds a
 * real row, the toggles change real state, and the toasts come from the same
 * provider a product would use. It is on the landing page because a list of
 * component names is an inventory, and this is the thing people are actually
 * trying to work out whether they can build.
 */
export default function AdminBlock() {
  return (
    <ToastProvider placement="bottom-right">
      <AdminShell />
    </ToastProvider>
  )
}

function AdminShell() {
  const [panel, setPanel] = useState<Panel>('overview')
  const [members, setMembers] = useState<Member[]>(SEED)
  const [selected, setSelected] = useState<string[]>([])
  const [query, setQuery] = useState('')
  const [inviting, setInviting] = useState(false)
  const { toast } = useToast()

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return members
    return members.filter(
      (member) =>
        member.name.toLowerCase().includes(needle) ||
        member.email.toLowerCase().includes(needle) ||
        member.role.includes(needle),
    )
  }, [members, query])

  const activeCount = members.filter((member) => member.status === 'active').length
  const seats = members.reduce((total, member) => total + member.seats, 0)

  const setRole = (id: string, role: Role) => {
    setMembers((current) =>
      current.map((member) => (member.id === id ? { ...member, role } : member)),
    )
    toast({ title: 'Role updated', description: `Now ${role}.`, tone: 'success' })
  }

  const remove = (ids: string[]) => {
    const gone = members.filter((member) => ids.includes(member.id))
    setMembers((current) => current.filter((member) => !ids.includes(member.id)))
    setSelected([])
    toast({
      title: `Removed ${ids.length} member${ids.length === 1 ? '' : 's'}`,
      description: gone.map((member) => member.name).join(', ').slice(0, 60),
      tone: 'danger',
      action: {
        label: 'Undo',
        onSelect: () => {
          setMembers((current) => [...gone, ...current])
          toast({ title: 'Restored', tone: 'success' })
        },
      },
    })
  }

  const invite = (member: Member) => {
    setMembers((current) => [member, ...current])
    setInviting(false)
    toast({ title: 'Invitation sent', description: member.email, tone: 'success' })
  }

  const columns: DataTableColumn<Member>[] = [
    {
      id: 'name',
      header: 'Member',
      sortValue: (row) => row.name,
      cell: (row) => (
        <div className="flex items-center gap-2.5">
          <Avatar name={row.name} size="sm" />
          <div className="flex min-w-0 flex-col">
            <Text size="caption" weight="bold" truncate>
              {row.name}
            </Text>
            <Text size="micro" tone="faint" truncate>
              {row.email}
            </Text>
          </div>
        </div>
      ),
    },
    {
      id: 'role',
      header: 'Role',
      sortValue: (row) => row.role,
      cell: (row) => (
        <Select
          label={`Role for ${row.name}`}
          size="sm"
          value={row.role}
          onValueChange={(value) => setRole(row.id, value as Role)}
          options={ROLES}
        />
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortValue: (row) => row.status,
      cell: (row) => <Tag size="sm" tone={STATUS_TONE[row.status]}>{row.status}</Tag>,
    },
    {
      id: 'seats',
      header: 'Seats',
      align: 'right',
      tabular: true,
      sortValue: (row) => row.seats,
      cell: (row) => row.seats,
    },
    {
      id: 'seen',
      header: 'Last seen',
      sortValue: (row) => row.lastSeen,
      cell: (row) => (
        <Text size="caption" tone="soft">
          {row.lastSeen}
        </Text>
      ),
    },
    {
      id: 'actions',
      header: '',
      width: '44px',
      cell: (row) => (
        <IconButton
          label={`Remove ${row.name}`}
          icon={Trash2}
          size="sm"
          tone="plain"
          onClick={() => remove([row.id])}
        />
      ),
    },
  ]

  return (
    <Surface variant="card" padding="none" className="overflow-hidden">
      <div className="grid grid-cols-1 md:grid-cols-[188px_1fr]">
        {/* Rail */}
        <div className="flex gap-1 border-b border-line bg-app p-3 md:flex-col md:border-b-0 md:border-r">
          <div className="mb-1 hidden items-center gap-2 px-2 pt-1 md:flex">
            <span
              aria-hidden
              className="grid h-6 w-6 place-items-center rounded-[8px] bg-accent text-accent-ink"
            >
              <span className="text-[11px] font-extrabold leading-none">A</span>
            </span>
            <Text size="caption" weight="extrabold">
              Acme Admin
            </Text>
          </div>
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={panel === item.id ? 'page' : undefined}
              onClick={() => setPanel(item.id)}
              className={cn(
                'flex flex-1 items-center justify-center gap-2 rounded-[10px] px-2.5 py-2 text-[12px] font-semibold transition-colors md:flex-none md:justify-start',
                panel === item.id
                  ? 'bg-accent-soft text-ink'
                  : 'text-ink-soft hover:bg-surface-muted hover:text-ink',
              )}
            >
              <item.icon size={15} aria-hidden />
              {item.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="min-w-0 p-4 sm:p-5">
          {panel === 'overview' && <Overview activeCount={activeCount} seats={seats} total={members.length} />}

          {panel === 'members' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <SearchField
                  value={query}
                  onValueChange={setQuery}
                  inputSize="sm"
                  label="Search members"
                  placeholder="Search members"
                  containerClassName="w-full sm:w-[240px]"
                />
                <div className="ml-auto flex items-center gap-2">
                  {selected.length > 0 && (
                    <Button size="sm" variant="outline" onClick={() => remove(selected)}>
                      Remove {selected.length}
                    </Button>
                  )}
                  <Button size="sm" onClick={() => setInviting(true)}>
                    <Plus size={14} aria-hidden />
                    Invite
                  </Button>
                </div>
              </div>

              <DataTable
                label="Team members"
                columns={columns}
                rows={visible}
                rowId={(row) => row.id}
                selectable
                selected={selected}
                onSelectedChange={setSelected}
                pageSize={5}
                empty={
                  <Text size="caption" tone="faint">
                    Nobody matches “{query}”.
                  </Text>
                }
              />
            </div>
          )}

          {panel === 'settings' && <SettingsPanel />}
        </div>
      </div>

      <InviteDialog open={inviting} onClose={() => setInviting(false)} onInvite={invite} />
    </Surface>
  )
}

/* --------------------------------------------------------------- overview */

function Overview({
  activeCount,
  seats,
  total,
}: {
  activeCount: number
  seats: number
  total: number
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard
          icon={Users}
          title="Members"
          value={String(total)}
          delta={`${activeCount} active`}
          trend="up"
        />
        <StatCard
          icon={UserRound}
          title="Seats in use"
          value={String(seats)}
          caption="of 60 licensed"
          meter={{ value: seats, total: 60, label: 'Seat usage' }}
        />
        <StatCard icon={BarChart3} title="Signups" value="341" delta="+15.2%" trend="up" caption="November" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.6fr_1fr]">
        <Surface variant="tile" padding="md" className="gap-3">
          <Text size="heading">Growth</Text>
          <AreaChart
            label="Signups and active members by month"
            categories={MONTHS}
            height={188}
            showGrid
            showLegend
            series={[
              { id: 'signups', label: 'Signups', values: SIGNUPS },
              { id: 'active', label: 'Active', values: ACTIVE },
            ]}
          />
        </Surface>
        <Surface variant="tile" padding="md" className="items-center justify-center gap-3">
          <Text size="heading" className="self-start">
            By role
          </Text>
          <DonutChart
            label="Members by role"
            size={150}
            slices={[
              { id: 'owner', label: 'Owner', value: 2 },
              { id: 'editor', label: 'Editor', value: 3 },
              { id: 'viewer', label: 'Viewer', value: 3 },
            ]}
          />
        </Surface>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------- settings */

function SettingsPanel() {
  const { toast } = useToast()
  const [digest, setDigest] = useState(true)
  const [seatAlerts, setSeatAlerts] = useState(false)
  const [publicSignup, setPublicSignup] = useState(false)
  const [name, setName] = useState('Acme Corporation')

  return (
    <div className="flex max-w-[520px] flex-col gap-4">
      <Field label="Workspace name" hint="Shown to everyone you invite.">
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </Field>

      <Surface variant="tile" padding="md" className="gap-3">
        <Toggle
          label="Weekly digest"
          hint="A summary of activity every Monday."
          checked={digest}
          onChange={setDigest}
        />
        <Toggle
          label="Seat limit alerts"
          hint="Warn an owner at 90% of licensed seats."
          checked={seatAlerts}
          onChange={setSeatAlerts}
        />
        <Toggle
          label="Open signup"
          hint="Anyone with a company address can join."
          checked={publicSignup}
          onChange={setPublicSignup}
        />
      </Surface>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={() =>
            toast({ title: 'Settings saved', description: name, tone: 'success' })
          }
        >
          <Check size={14} aria-hidden />
          Save changes
        </Button>
        <Text size="caption" tone="faint">
          Nothing leaves the page — this is a demo.
        </Text>
      </div>
    </div>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex flex-col gap-0.5">
        <Text size="caption" weight="bold">
          {label}
        </Text>
        <Text size="micro" tone="faint" leading="normal">
          {hint}
        </Text>
      </div>
      <Switch
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-label={label}
      />
    </div>
  )
}

/* ----------------------------------------------------------------- invite */

function InviteDialog({
  open,
  onClose,
  onInvite,
}: {
  open: boolean
  onClose: () => void
  onInvite: (member: Member) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('editor')

  const valid = name.trim().length > 1 && /.+@.+\..+/.test(email)

  const submit = () => {
    if (!valid) return
    onInvite({
      id: `u${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      role,
      status: 'invited',
      seats: 0,
      lastSeen: 'Never',
    })
    setName('')
    setEmail('')
    setRole('editor')
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Invite a member"
      description="They will get an email with a link to join."
      size="sm"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button size="sm" disabled={!valid} onClick={submit}>
            Send invitation
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Full name">
          <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ada Lovelace" />
        </Field>
        <Field
          label="Email"
          error={email.length > 0 && !/.+@.+\..+/.test(email) ? 'That does not look like an address.' : undefined}
        >
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="ada@example.com"
          />
        </Field>
        <Field label="Role" hint="Editors can change content; viewers cannot.">
          <Select
            label="Role"
            value={role}
            onValueChange={(value) => setRole(value as Role)}
            options={ROLES}
          />
        </Field>
        <div className="flex items-center gap-2 pt-1">
          <Badge>Preview</Badge>
          <Text size="micro" tone="faint">
            Adds a real row to the table behind this dialog.
          </Text>
        </div>
      </div>
    </Modal>
  )
}
