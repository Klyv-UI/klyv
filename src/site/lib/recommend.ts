import { libraryItems, type LibraryItem, type LibraryItemType } from '../data/library'
import { PROJECT_TYPES, type TagId } from '../data/taxonomy'

/**
 * Recommendations, from tags alone.
 *
 * There is no table of "for a SaaS with billing, show these" — that would be
 * one hand-written list per combination, and it would rot. Instead every item
 * is scored by how many of the chosen needs it carries (the strongest signal),
 * how many of the project type's tags it carries, and whether a template or
 * recipe names the project type outright. Featured items break ties. So a new
 * block with the right tags starts being recommended without anyone touching
 * this file.
 */
export interface Recommendation {
  item: LibraryItem
  score: number
  /** The chosen needs it matched — shown so the reason is visible. */
  matched: TagId[]
}

export type RecommendationSet = Record<LibraryItemType, Recommendation[]>

export const RECOMMENDATION_LIMITS: Record<LibraryItemType, number> = {
  component: 9,
  block: 4,
  template: 3,
  recipe: 4,
  integration: 4,
}

export function recommend(projectId: string | null, needs: TagId[]): RecommendationSet {
  const project = PROJECT_TYPES.find((entry) => entry.id === projectId)
  const needSet = new Set(needs)
  const projectTags = new Set(project?.tags ?? [])

  const scored: Recommendation[] = []
  libraryItems.forEach((item, order) => {
    const matched = item.tags.filter((tag) => needSet.has(tag))
    const projectMatches = item.tags.filter((tag) => projectTags.has(tag)).length
    const named = Boolean(project && item.projectTypes?.includes(project.id))

    // With needs chosen, an item has to meet at least one. Without, the
    // project type alone has to account for it.
    if (needs.length > 0 ? matched.length === 0 : projectMatches === 0 && !named) return
    if (item.status === 'deprecated') return

    const score =
      matched.length * 4 +
      projectMatches * 1.5 +
      (named ? 3 : 0) +
      (item.isFeatured ? 1 : 0) -
      // Keeps catalogue order as the last tie-break, so results are stable.
      order / 100000

    scored.push({ item, score, matched })
  })

  scored.sort((a, b) => b.score - a.score)

  const result: RecommendationSet = { component: [], block: [], template: [], recipe: [], integration: [] }
  for (const recommendation of scored) {
    const bucket = result[recommendation.item.type]
    if (bucket.length < RECOMMENDATION_LIMITS[recommendation.item.type]) bucket.push(recommendation)
  }
  return result
}
