import type { DataResponse } from '#/api/models/dataResponse'
import { parseLatLng } from '#/utils'

/** Degrees of longitude in a full trip around the globe. */
const FULL_ROTATION = 360

/**
 * The widest span we are willing to move across the 180th meridian. Anything wider is data spread all over the globe,
 * where no reading of it brings the points together, so we leave those coordinates as Leaflet always displayed them.
 */
const MAX_UNWRAPPED_SPAN = FULL_ROTATION / 2

/** A range of longitudes, which is not limited to [-180, 180] — see `unwrapLongitudes()`. */
export interface LongitudeSpan {
  west: number
  east: number
}

/** The corners of the smallest rectangle holding a set of points. */
export interface PointsBounds extends LongitudeSpan {
  south: number
  north: number
}

/** A submission with an answer for the selected geopoint question. `lng` can fall outside [-180, 180], see below. */
export interface PlottedPoint {
  submission: DataResponse
  lat: number
  lng: number
}

/** The area the given points cover, or `undefined` when there are none. */
export function getPointsBounds(points: Array<{ lat: number; lng: number }>): PointsBounds | undefined {
  if (!points.length) {
    return undefined
  }
  const bounds: PointsBounds = { south: points[0].lat, north: points[0].lat, west: points[0].lng, east: points[0].lng }
  points.forEach(({ lat, lng }) => {
    bounds.south = Math.min(bounds.south, lat)
    bounds.north = Math.max(bounds.north, lat)
    bounds.west = Math.min(bounds.west, lng)
    bounds.east = Math.max(bounds.east, lng)
  })
  return bounds
}

/** Brings any longitude back into the [-180, 180) range. */
function wrapLongitude(longitude: number): number {
  // Returning in-range values untouched (the usual case) avoids the rounding error the modulo below introduces
  if (longitude >= -180 && longitude < 180) {
    return longitude
  }
  return ((((longitude + 180) % FULL_ROTATION) + FULL_ROTATION) % FULL_ROTATION) - 180
}

/**
 * Rewrites longitudes so that points on both sides of the 180th meridian can be displayed next to each other.
 *
 * Vanuatu (168°) and Samoa (-172°) are either a 340° span across Africa or a 20° span across the Pacific. Leaflet
 * assumes the first, so we pick the narrowest reading, which puts some longitudes outside [-180, 180] (-172° becomes
 * 188°). Leaflet draws such a marker in the copy of the world east of the meridian, right next to Vanuatu.
 *
 * Order is kept. Values that are not finite, and projects whose narrowest reading is the one Leaflet would have used
 * anyway (nearly all of them), are passed through untouched.
 */
export function unwrapLongitudes(longitudes: number[]): number[] {
  const wrapped = longitudes.map((longitude) => (Number.isFinite(longitude) ? wrapLongitude(longitude) : longitude))
  const sorted = wrapped.filter((longitude) => Number.isFinite(longitude)).sort((a, b) => a - b)

  if (!sorted.length) {
    return wrapped
  }

  // Walking east, the narrowest span holding every point starts right after the widest gap between two neighbours. We
  // start with the gap crossing the 180th meridian, so data that needs no shifting keeps its longitudes as they are.
  let spanStart = sorted[0]
  let widestGap = sorted[0] + FULL_ROTATION - sorted[sorted.length - 1]
  for (let index = 1; index < sorted.length; index++) {
    const gap = sorted[index] - sorted[index - 1]
    if (gap > widestGap) {
      widestGap = gap
      spanStart = sorted[index]
    }
  }

  if (FULL_ROTATION - widestGap > MAX_UNWRAPPED_SPAN) {
    return wrapped
  }

  // Everything west of the span start belongs to the next copy of the world, east of the 180th meridian.
  return wrapped.map((longitude) => (longitude < spanStart ? longitude + FULL_ROTATION : longitude))
}

/**
 * Full rotations to add to the plotted longitudes, so that the points are drawn in every copy of the world on screen
 * (Leaflet repeats the base map east and west forever, markers it does not).
 *
 * Sorted west to east, and never empty: with no copy near the view, the closest one is still worth drawing.
 *
 * @param view longitudes of the left and of the right edge of the map
 * @param maxCopies how many copies we can afford to draw; the ones closest to the middle of the map win
 */
export function getWorldCopyOffsets(plotted: LongitudeSpan, view: LongitudeSpan, maxCopies: number): number[] {
  // Without a span to compare against the view, the copy the points were plotted in is the only one we can place
  if (![plotted.west, plotted.east, view.west, view.east].every(Number.isFinite)) {
    return [0]
  }

  // The nth copy covers the plotted span moved by n full rotations, and is worth drawing when that overlaps the view.
  const westmostVisible = Math.ceil((view.west - plotted.east) / FULL_ROTATION)
  const eastmostVisible = Math.floor((view.east - plotted.west) / FULL_ROTATION)
  const nearest = Math.round((view.west + view.east - plotted.west - plotted.east) / (2 * FULL_ROTATION))

  const copies: number[] = []
  for (let copy = westmostVisible; copy <= eastmostVisible; copy++) {
    copies.push(copy)
  }
  if (!copies.length) {
    copies.push(nearest)
  }

  if (copies.length > maxCopies) {
    copies.sort((a, b) => Math.abs(a - nearest) - Math.abs(b - nearest))
    copies.splice(Math.max(1, maxCopies))
    copies.sort((a, b) => a - b)
  }

  // The `copy === 0` check is only there to avoid a negative zero, which reads badly in logs and tests
  return copies.map((copy) => (copy === 0 ? 0 : copy * FULL_ROTATION))
}

/**
 * Coordinates of the selected geopoint question, from every submission that has an answer for it. Longitudes come
 * unwrapped, see `unwrapLongitudes()`.
 */
export function getPlottedPoints(submissions: DataResponse[], selectedQuestion: string | null): PlottedPoint[] {
  const points: PlottedPoint[] = []

  submissions.forEach((submission) => {
    const parsedCoordinates: number[] = parseLatLng(submission, selectedQuestion)
    if (parsedCoordinates.length) {
      points.push({ submission: submission, lat: parsedCoordinates[0], lng: parsedCoordinates[1] })
    }
  })

  const unwrapped = unwrapLongitudes(points.map((point) => point.lng))
  points.forEach((point, index) => {
    point.lng = unwrapped[index]
  })
  return points
}
