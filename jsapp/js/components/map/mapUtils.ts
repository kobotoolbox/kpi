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

/**
 * A submission with an answer for the selected geopoint question. `lng` can fall outside [-180, 180], see
 * `unwrapLongitudes()`.
 */
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
 * Rewrites longitudes so that points on both sides of the 180th meridian read as neighbours.
 *
 * Longitude wraps around at that meridian, which makes nearby places look far apart: Vanuatu (168°) and Samoa (-172°)
 * are 20° from each other on the ground, but 340° apart as plain numbers. Code that only compares the numbers — fitting
 * the map to its points, say — reads that as opposite sides of the globe and zooms out to show all of it.
 *
 * So we add 360° to the points on the far side of the meridian, which leaves the numbers as close as the places are:
 * -172° becomes 188°. Going past 180° is deliberate. Leaflet reads it as the copy of the world next door to the east
 * and draws the marker there, right beside Vanuatu.
 *
 * Order is kept, and points nowhere near the meridian — nearly every project — come back untouched.
 */
export function unwrapLongitudes(longitudes: number[]): number[] {
  const wrapped = longitudes.map((longitude) => (Number.isFinite(longitude) ? wrapLongitude(longitude) : longitude))
  const sorted = wrapped.filter((longitude) => Number.isFinite(longitude)).sort((a, b) => a - b)

  if (!sorted.length) {
    return wrapped
  }

  // Picture the longitudes as marks around a circle: the tightest arc holding all of them begins right after the widest
  // empty stretch between two neighbouring marks. The search starts from the stretch that crosses the 180th meridian,
  // so that data needing no shift at all keeps the longitudes it came with.
  let spanStart = sorted[0]
  let widestGap = sorted[0] + FULL_ROTATION - sorted[sorted.length - 1]
  for (let index = 1; index < sorted.length; index++) {
    const gap = sorted[index] - sorted[index - 1]
    if (gap > widestGap) {
      widestGap = gap
      spanStart = sorted[index]
    }
  }

  // Whatever the widest gap leaves over is the span the points cover. Too wide, and no shifting can bring them together
  if (FULL_ROTATION - widestGap > MAX_UNWRAPPED_SPAN) {
    return wrapped
  }

  // Points west of where the span starts are the ones on the far side of the meridian, so they move a rotation east
  return wrapped.map((longitude) => (longitude < spanStart ? longitude + FULL_ROTATION : longitude))
}

/**
 * Works out where to draw copies of the plotted points, as degrees to add to their longitudes.
 *
 * Leaflet repeats the base map east and west without end, so panning past the 180th meridian brings the same world
 * round again. A marker, though, only exists in the one copy it was plotted in, and panning leaves it behind. The way
 * out is to draw extra sets of markers, each moved by a whole trip around the globe. A return of `[-360, 0, 360]` means
 * three sets: one a rotation to the west, the plotted one where it already is, one a rotation to the east.
 *
 * Sorted west to east, and never empty — with no copy in sight the nearest one is drawn anyway, since the alternative
 * is points nowhere on screen.
 *
 * @param view longitudes of the left and of the right edge of the map
 * @param maxCopies how many copies we can afford to draw; the ones closest to the middle of the map win
 */
export function getWorldCopyOffsets(plotted: LongitudeSpan, view: LongitudeSpan, maxCopies: number): number[] {
  // A missing or broken longitude leaves nothing to compare against the view, so stay with the copy already plotted
  if (![plotted.west, plotted.east, view.west, view.east].every(Number.isFinite)) {
    return [0]
  }

  // Copy number n sits n whole rotations east of where the points were plotted, and is worth drawing when it lands in
  // the view. These two are the westmost and the eastmost copy that do.
  const westmostVisible = Math.ceil((view.west - plotted.east) / FULL_ROTATION)
  const eastmostVisible = Math.floor((view.east - plotted.west) / FULL_ROTATION)
  // The copy whose middle is closest to the middle of the view. Comes in when the view has no copy in it at all.
  const nearest = Math.round((view.west + view.east - plotted.west - plotted.east) / (2 * FULL_ROTATION))

  const copies: number[] = []
  for (let copy = westmostVisible; copy <= eastmostVisible; copy++) {
    copies.push(copy)
  }
  if (!copies.length) {
    copies.push(nearest)
  }

  // More copies than we can afford: line them up by how far they are from the middle of the view, drop the far ones,
  // then put the survivors back in west to east order. One always survives, so even a budget of none leaves the points
  // somewhere the user can see them.
  if (copies.length > maxCopies) {
    copies.sort((a, b) => Math.abs(a - nearest) - Math.abs(b - nearest))
    copies.splice(Math.max(1, maxCopies))
    copies.sort((a, b) => a - b)
  }

  // The `copy === 0` check is only there to avoid a negative zero, which reads badly in logs and tests
  return copies.map((copy) => (copy === 0 ? 0 : copy * FULL_ROTATION))
}

/**
 * Reads the answers to one geopoint question and turns them into points to plot. Submissions that skipped the question
 * give `parseLatLng()` nothing to parse and are left out.
 *
 * Longitudes are unwrapped in one go rather than point by point, because how far each one has to move depends on where
 * all the others are — see `unwrapLongitudes()`.
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
