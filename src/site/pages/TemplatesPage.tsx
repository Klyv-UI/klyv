import { Badge, Text } from 'citrine'
import { ItemCard } from '../components/ItemCard'
import { PageIntro } from '../components/PageIntro'
import { findItem } from '../data/library'
import { templateBlocks, templateComponents, templates } from '../data/templates'

/**
 * The templates index. Templates are filed under what they make, and each card
 * lists the screens inside it — the thing someone choosing between them
 * actually needs to compare.
 */
export default function TemplatesPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageIntro title="Templates" meta={`${templates.length} templates`}>
        Starting points larger than one screen. A template is the set of blocks a product needs together —
        nothing in one is new, so what you see is exactly what the library produces, and all of it is one CLI
        command away.
      </PageIntro>

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
        {templates.map((template) => {
          const item = findItem(`template:${template.slug}`)
          if (!item) return null
          const screens = templateBlocks(template)
          return (
            <ItemCard
              key={template.slug}
              item={item}
              showType={false}
              headingLevel="h2"
              footer={
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap gap-1">
                    {screens.map((block) => (
                      <Badge key={block.slug} tone="neutral">
                        {block.name}
                      </Badge>
                    ))}
                  </div>
                  <Text size="micro" weight="semibold" tone="faint" tabular>
                    {screens.length} screens · {templateComponents(template).length} components
                  </Text>
                </div>
              }
            />
          )
        })}
      </div>
    </div>
  )
}
