import { catalog, type CatalogEntry } from '../data/catalog'
import { GROUP_IDS, type GroupId } from '../data/groups'

/**
 * Where every component sits on the map.
 *
 * One long flow, in the order the catalogue is browsed — group by group — so
 * neighbours on the map are neighbours in the documentation, and a group is a
 * block you can learn the shape of. Each group starts on its own row so its
 * heading has somewhere to live and no group is split across a seam.
 *
 * The positions are computed once at module load: 617 multiplications, and
 * everything after it — culling, the minimap, flying to a search hit — is
 * arithmetic on the result rather than a measurement of the DOM.
 */

export const TILE = { width: 260, height: 172, gapX: 28, gapY: 76 }
export const COLUMNS = 22
/** Room above each group's first row for its heading. */
const HEADING = 64

export interface AtlasTile {
  entry: CatalogEntry
  x: number
  y: number
  /** Index in the flow, for a stable entrance order. */
  order: number
}

export interface AtlasGroup {
  id: GroupId
  x: number
  y: number
  width: number
  height: number
  count: number
}

function build() {
  const tiles: AtlasTile[] = []
  const groups: AtlasGroup[] = []
  let row = 0
  let order = 0

  for (const id of GROUP_IDS) {
    const members = catalog.filter((entry) => entry.group === id)
    if (members.length === 0) continue
    const rows = Math.ceil(members.length / COLUMNS)
    const top = row * (TILE.height + TILE.gapY) + HEADING

    members.forEach((entry, index) => {
      const column = index % COLUMNS
      const line = Math.floor(index / COLUMNS)
      tiles.push({
        entry,
        x: column * (TILE.width + TILE.gapX),
        y: top + line * (TILE.height + TILE.gapY),
        order: order++,
      })
    })

    groups.push({
      id,
      x: 0,
      y: top - HEADING,
      width: Math.min(members.length, COLUMNS) * (TILE.width + TILE.gapX) - TILE.gapX,
      height: rows * (TILE.height + TILE.gapY) + HEADING,
      count: members.length,
    })
    row += rows
  }

  const width = COLUMNS * (TILE.width + TILE.gapX) - TILE.gapX
  const height = row * (TILE.height + TILE.gapY) + HEADING
  return { tiles, groups, width, height }
}

export const atlas = build()

/** The tiles inside a rectangle of the scene, nearest the middle first. */
export function tilesIn(view: { x: number; y: number; width: number; height: number }, limit = Infinity): AtlasTile[] {
  const centreX = view.x + view.width / 2
  const centreY = view.y + view.height / 2
  const found = atlas.tiles.filter(
    (tile) =>
      tile.x + TILE.width >= view.x && tile.x <= view.x + view.width && tile.y + TILE.height >= view.y && tile.y <= view.y + view.height,
  )
  if (found.length <= limit) return found
  return found
    .sort((a, b) => Math.hypot(a.x - centreX, a.y - centreY) - Math.hypot(b.x - centreX, b.y - centreY))
    .slice(0, limit)
}

