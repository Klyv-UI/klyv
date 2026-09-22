import { MapPin, MessageSquare, Phone } from 'lucide-react'
import {
  Avatar,
  Badge,
  Button,
  Card,
  DescriptionList,
  Metric,
  StatusDot,
  Surface,
  Text,
  Timeline,
} from 'klyvui'

/**
 * A person's profile.
 *
 * The header is a Surface rather than a photographic banner: the accent already
 * carries the identity, and a cover image would be the one thing on the screen
 * that no token describes. Facts sit in a DescriptionList so they are a real
 * definition list, not a grid of divs that reads as one run-on sentence.
 */
export default function ProfileBlock() {
  return (
    <div className="mx-auto flex w-full max-w-[860px] flex-col gap-4 px-4 py-6">
      <Surface variant="card" padding="lg" className="gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar name="Priya Raman" size="lg" ring />
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <Text as="h1" size="subtitle">
                  Priya Raman
                </Text>
                <Badge>Dispatch lead</Badge>
              </div>
              <Text size="caption" tone="soft">
                Head of Operations · Northern corridor
              </Text>
              <div className="flex items-center gap-1.5">
                <StatusDot tone="success" />
                <Text as="span" size="micro" weight="semibold" tone="faint">
                  On shift until 18:00 CET
                </Text>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm">
              <Phone size={14} aria-hidden />
              Call
            </Button>
            <Button size="sm">
              <MessageSquare size={14} aria-hidden />
              Message
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label="On-time rate" value="96.2%" delta="+2.1pts" trend="up" size="sm" />
          <Metric label="Loads dispatched" value="8,412" caption="this year" size="sm" />
          <Metric label="Avg response" value="3m 20s" delta="-40s" trend="down" size="sm" />
          <Metric label="Exceptions" value="14" caption="last 30 days" size="sm" />
        </div>
      </Surface>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1.3fr]">
        <Card title="Details">
          <div className="mt-3">
            <DescriptionList
              divided
              items={[
                { term: 'Depot', description: 'Rotterdam Botlek' },
                { term: 'Team', description: 'Northern corridor' },
                { term: 'Reports to', description: 'Anneke de Vries' },
                { term: 'Started', description: 'March 2014' },
                {
                  term: 'Coverage',
                  description: (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={13} aria-hidden className="text-ink-faint" />
                      NL · BE · DE
                    </span>
                  ),
                },
              ]}
            />
          </div>
        </Card>

        <Card title="Recent activity">
          <div className="mt-3">
            <Timeline
              label="Recent activity"
              items={[
                {
                  id: 'a1',
                  meta: 'Today, 12:04',
                  title: 'Cleared a customs hold',
                  description: 'MF-40182 released at Lyon after 22 minutes.',
                  tone: 'success',
                },
                {
                  id: 'a2',
                  meta: 'Today, 09:15',
                  title: 'Re-timed three consignments',
                  description: 'Weather advisory on the A4 near Metz.',
                  tone: 'warning',
                },
                {
                  id: 'a3',
                  meta: 'Yesterday',
                  title: 'Handover to night shift',
                  description: 'Signed off with two open exceptions.',
                  tone: 'neutral',
                },
                {
                  id: 'a4',
                  meta: 'Monday',
                  title: 'Added two drivers to the corridor',
                  description: 'Both cleared for cross-border runs.',
                  tone: 'accent',
                },
              ]}
            />
          </div>
        </Card>
      </div>
    </div>
  )
}
