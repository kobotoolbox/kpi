import { http, HttpResponse } from 'msw'

/**
 * Stand-in map tiles for stories, drawn from a handful of boxes instead of fetched from OpenStreetMap.
 *
 * Real tiles make map stories a poor fit for visual regression testing: they need the network, and they come back with
 * differences too small to see but big enough for Chromatic to flag. These are plain SVG shapes, so every run gets
 * pixel for pixel the same map, and a snapshot still shows which part of the world the story is looking at.
 */

/** Tile size Leaflet works with, in pixels. */
const TILE_SIZE = 256

const OCEAN_COLOR = '#94c7d1'
const LAND_COLOR = '#dbdbbd'
const GRID_COLOR = '#5999a6'
const LABEL_COLOR = '#365c63'
/** The 180th meridian, marked so that it is clear where one copy of the world ends and the next one begins. */
const MERIDIAN_COLOR = '#293a3d'

/**
 * The world as boxes of `[south, west, north, east]` degrees. Nowhere near accurate, and small islands are drawn far
 * bigger than they are so that they don't vanish at low zoom — enough to tell the continents apart and no more.
 */
const LANDMASSES: Array<[number, number, number, number]> = [
  [-85, -180, -63, 180], // Antarctica
  [60, -55, 82, -20], // Greenland
  [55, -168, 70, -142], // Alaska
  [49, -130, 70, -70], // Canada
  [30, -122, 49, -76], // United States
  [12, -105, 30, -85], // Central America
  [-20, -78, 10, -35], // northern South America
  [-55, -75, -20, -55], // southern South America
  [40, -10, 60, 30], // Europe
  [58, 5, 70, 30], // Scandinavia
  [5, -17, 35, 50], // northern Africa
  [-35, 10, 5, 42], // southern Africa
  [-25, 43, -12, 50], // Madagascar
  [15, 35, 40, 60], // Middle East
  [45, 30, 70, 180], // northern Asia
  [8, 68, 30, 88], // India
  [20, 95, 45, 122], // China
  [31, 130, 45, 145], // Japan
  [-10, 95, 5, 140], // Indonesia
  [-10, 132, -2, 150], // New Guinea
  [-38, 113, -12, 153], // Australia
  [-46, 166, -34, 178], // New Zealand!
  [-20, 166, -13, 170], // Vanuatu
  [-19, 177, -16, 180], // Fiji
  [-15, -173, -12, -170], // Samoa
]

/** Web Mercator, the projection Leaflet's tiles use. Returns pixels from the top left corner of the world. */
function project(lat: number, lng: number, worldSize: number) {
  const latRad = (lat * Math.PI) / 180
  const mercator = Math.log(Math.tan(Math.PI / 4 + latRad / 2))
  return {
    x: ((lng + 180) / 360) * worldSize,
    y: (0.5 - mercator / (2 * Math.PI)) * worldSize,
  }
}

/**
 * Coordinates of the top left corner of a tile, written out. Zoomed far enough in, a tile is a single flat colour, and
 * this is then the only thing telling the reader (and whoever compares two snapshots) where in the world they are.
 */
function cornerLabel(zoom: number, tileX: number, tileY: number): string {
  const tiles = 2 ** zoom
  const longitude = (tileX / tiles) * 360 - 180
  // Web Mercator in reverse, undoing the `y` of `project()`
  const latitude = (Math.atan(Math.sinh(Math.PI * (1 - (2 * tileY) / tiles))) * 180) / Math.PI
  // Enough decimals for neighbouring tiles to come out with labels of their own
  const decimals = Math.min(4, Math.max(0, Math.ceil(Math.log10(tiles / 360)) + 1))
  const label = `${degrees(latitude, decimals, 'N', 'S')} ${degrees(longitude, decimals, 'E', 'W')}`

  return `<text x="4" y="13" font-family="monospace" font-size="10" fill="${LABEL_COLOR}">${label}</text>`
}

function degrees(value: number, decimals: number, positive: string, negative: string): string {
  return `${Math.abs(value).toFixed(decimals)}°${value < 0 ? negative : positive}`
}

/** One tile of the blocky world, as an SVG document. */
function drawTile(zoom: number, tileX: number, tileY: number): string {
  const worldSize = TILE_SIZE * 2 ** zoom
  const shapes: string[] = []

  LANDMASSES.forEach(([south, west, north, east]) => {
    const topLeft = project(north, west, worldSize)
    const bottomRight = project(south, east, worldSize)
    const x = topLeft.x - tileX * TILE_SIZE
    const y = topLeft.y - tileY * TILE_SIZE
    // Rounding keeps the SVG short, and a floor of one pixel keeps the smallest islands on the map
    const width = Math.max(1, Math.round(bottomRight.x - topLeft.x))
    const height = Math.max(1, Math.round(bottomRight.y - topLeft.y))

    if (x > TILE_SIZE || y > TILE_SIZE || x + width < 0 || y + height < 0) {
      return
    }
    shapes.push(`<rect x="${Math.round(x)}" y="${Math.round(y)}" width="${width}" height="${height}"/>`)
  })

  // Leaflet asks for the same tile in every copy of the world it draws, so the meridian ends up marked in each of them
  const meridian =
    tileX === 0
      ? `<path d="M0 0V${TILE_SIZE}" stroke="${MERIDIAN_COLOR}" stroke-width="4" stroke-dasharray="4 4"/>`
      : ''

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE_SIZE}" height="${TILE_SIZE}">` +
    `<rect width="${TILE_SIZE}" height="${TILE_SIZE}" fill="${OCEAN_COLOR}"/>` +
    `<g fill="${LAND_COLOR}">${shapes.join('')}</g>` +
    // Tile edges double as a graticule, which is what makes panning visible in a screenshot
    `<path d="M0 0H${TILE_SIZE}M0 0V${TILE_SIZE}" stroke="${GRID_COLOR}"/>${meridian}` +
    `${cornerLabel(zoom, tileX, tileY)}</svg>`
  )
}

/**
 * Serves the stand-in tiles at the OpenStreetMap URLs the map asks for. Include these in the handlers of any story that
 * renders a map, or it will reach out to the real tile servers.
 */
export const mapTileHandlers = [
  http.get<{ zoom: string; tileX: string; tileY: string }>(
    'https://:subdomain.tile.openstreetmap.org/:zoom/:tileX/:tileY.png',
    ({ params }) => {
      const svg = drawTile(Number(params.zoom), Number(params.tileX), Number(params.tileY))
      // Browsers go by the content type, not by the `.png` the URL promises
      return new HttpResponse(svg, { headers: { 'Content-Type': 'image/svg+xml; charset=utf-8' } })
    },
  ),
]
