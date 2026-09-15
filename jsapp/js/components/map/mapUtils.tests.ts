import type { DataResponse } from '#/api/models/dataResponse'
import { getPlottedPoints, getPointsBounds, getWorldCopyOffsets, unwrapLongitudes } from './mapUtils'

describe('unwrapLongitudes', () => {
  it('handles having no points at all', () => {
    chai.expect(unwrapLongitudes([])).to.deep.equal([])
  })

  it('leaves a single point alone', () => {
    chai.expect(unwrapLongitudes([-172.75])).to.deep.equal([-172.75])
  })

  it('leaves points that do not straddle the 180th meridian alone', () => {
    // Kathmandu, Nairobi and Lisbon
    chai.expect(unwrapLongitudes([85.324, 36.8219, -9.1393])).to.deep.equal([85.324, 36.8219, -9.1393])
  })

  it('leaves points straddling the prime meridian alone', () => {
    // Greenwich, both sides of it
    chai.expect(unwrapLongitudes([-0.25, 0.25])).to.deep.equal([-0.25, 0.25])
  })

  it('moves points straddling the 180th meridian into a single span', () => {
    // Vanuatu (east of the meridian) and Samoa (west of it), the case this whole function exists for
    chai.expect(unwrapLongitudes([168.25, -172.75])).to.deep.equal([168.25, 187.25])
  })

  it('keeps the order of the points it moves', () => {
    chai.expect(unwrapLongitudes([-172.75, 168.25, -172.5, 168.5])).to.deep.equal([187.25, 168.25, 187.5, 168.5])
  })

  it('moves points that are far apart but still closest across the 180th meridian', () => {
    // Auckland and Santiago de Chile are 244° apart the usual way, but only 116° apart across the Pacific
    chai.expect(unwrapLongitudes([-70.5, 174.75])).to.deep.equal([289.5, 174.75])
  })

  it('leaves points spread around the globe alone', () => {
    // Tokyo, Accra and Mexico City fit in no span narrow enough to be worth moving, so we don't second guess Leaflet
    chai.expect(unwrapLongitudes([139.75, -0.25, -99.25])).to.deep.equal([139.75, -0.25, -99.25])
  })

  it('leaves points alone when both readings are exactly half of the globe', () => {
    chai.expect(unwrapLongitudes([-90, 90])).to.deep.equal([-90, 90])
  })

  it('brings longitudes outside of the [-180, 180] range back into it', () => {
    chai.expect(unwrapLongitudes([200.5, -100])).to.deep.equal([-159.5, -100])
  })

  it('passes values that are not numbers through and still moves the rest', () => {
    chai.expect(unwrapLongitudes([168.25, Number.NaN, -172.75])).to.deep.equal([168.25, Number.NaN, 187.25])
  })
})

describe('getWorldCopyOffsets', () => {
  // Vanuatu and Samoa as `unwrapLongitudes()` leaves them, with the map fitted to them
  const pacificPoints = { west: 168.25, east: 187.25 }

  it('draws the points only where they were plotted when the map shows that part of the world', () => {
    chai.expect(getWorldCopyOffsets(pacificPoints, { west: 160, east: 195 }, 5)).to.deep.equal([0])
  })

  it('draws the points in the copy of the world the map was panned into', () => {
    // The same view, a full rotation to the east
    chai.expect(getWorldCopyOffsets(pacificPoints, { west: 520, east: 555 }, 5)).to.deep.equal([360])
  })

  it('draws the points in every copy of the world a zoomed out map shows', () => {
    chai.expect(getWorldCopyOffsets({ west: 0, east: 0 }, { west: -400, east: 400 }, 5)).to.deep.equal([-360, 0, 360])
  })

  it('draws the points in the closest copy of the world when none of them is in sight', () => {
    // The map is showing the Atlantic, which the Pacific points are closest to going west
    chai.expect(getWorldCopyOffsets(pacificPoints, { west: -20, east: -10 }, 5)).to.deep.equal([-360])
  })

  it('keeps the copies closest to the middle of the map when there are too many of them', () => {
    const view = { west: -1000, east: 1000 }
    chai.expect(getWorldCopyOffsets({ west: 0, east: 0 }, view, 3)).to.deep.equal([-360, 0, 360])
    chai.expect(getWorldCopyOffsets({ west: 0, east: 0 }, view, 1)).to.deep.equal([0])
  })

  it('always draws at least one copy, even when told it can afford none', () => {
    chai.expect(getWorldCopyOffsets(pacificPoints, { west: 160, east: 195 }, 0)).to.deep.equal([0])
  })

  it('leaves the points where they were plotted when it cannot tell where that is', () => {
    chai
      .expect(getWorldCopyOffsets({ west: Number.NaN, east: Number.NaN }, { west: 160, east: 195 }, 5))
      .to.deep.equal([0])
  })
})

describe('getPointsBounds', () => {
  it('has no bounds to give when there are no points', () => {
    chai.expect(getPointsBounds([])).to.equal(undefined)
  })

  it('gives a single point as its own bounds', () => {
    chai.expect(getPointsBounds([{ lat: -17.73, lng: 168.32 }])).to.deep.equal({
      south: -17.73,
      north: -17.73,
      west: 168.32,
      east: 168.32,
    })
  })

  it('covers every point given, whatever order they come in', () => {
    const points = [
      { lat: -13.83, lng: 187.25 },
      { lat: -17.73, lng: 168.32 },
      { lat: -14.03, lng: 188.51 },
    ]
    chai.expect(getPointsBounds(points)).to.deep.equal({ south: -17.73, north: -13.83, west: 168.32, east: 188.51 })
  })
})

describe('getPlottedPoints', () => {
  // Only the fields the function reads; the rest of a submission is of no interest to it
  const submission = (id: number, location?: string) => ({ _id: id, location: location }) as unknown as DataResponse

  it('reads the coordinates of the selected question', () => {
    chai
      .expect(getPlottedPoints([submission(1, '-17.7333 168.3273 0 0')], 'location'))
      .to.deep.equal([{ submission: submission(1, '-17.7333 168.3273 0 0'), lat: -17.7333, lng: 168.3273 }])
  })

  it('skips submissions that have no answer for the selected question', () => {
    const points = getPlottedPoints([submission(1, '-17.7333 168.3273 0 0'), submission(2)], 'location')
    chai.expect(points.map((point) => point.submission._id)).to.deep.equal([1])
  })

  it('has nothing to plot when no question is selected', () => {
    chai.expect(getPlottedPoints([submission(1, '-17.7333 168.3273 0 0')], null)).to.deep.equal([])
  })

  it('unwraps the longitudes of points straddling the 180th meridian', () => {
    // Port Vila and Apia end up in one span, which is what puts them next to each other on the map
    const points = getPlottedPoints(
      [submission(1, '-17.7333 168.3273 0 0'), submission(2, '-13.8333 -171.7667 0 0')],
      'location',
    )
    chai.expect(points.map((point) => point.lng)).to.deep.equal([168.3273, 188.2333])
  })
})
