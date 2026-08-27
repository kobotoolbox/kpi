import L from 'leaflet'
import { type PointsBounds, getPointsBounds, getWorldCopyOffsets } from './mapUtils'

/**
 * Budget for the markers on the map, the plotted ones counted in, held below the cap on submissions the map fetches
 * (`MAX_SUBMISSIONS`) on purpose: copies multiply markers, so the biggest projects get just the copy nearest the view.
 */
const MAX_DRAWN_MARKERS = 20000

/**
 * Keeps a group of markers drawn in every copy of the world the map is showing.
 *
 * Leaflet repeats the base map east and west forever, but a marker only exists in the one copy of the world it was
 * plotted in. Without copies, panning past the edge of the world leaves the data behind and ends up showing an empty
 * map. Copies join the group they were cloned from, so clustering, clicks and the legend filter treat them like any
 * other marker. One instance follows one group: call `destroy()` and start a new one when the group is replaced.
 */
export class WorldCopies {
  /** Markers of every copy drawn, keyed by the longitude they were moved by. Never holds the plotted markers. */
  private readonly copies = new Map<number, L.Marker[]>()
  private readonly plottedBounds?: PointsBounds
  private pendingSync = 0

  constructor(
    private readonly map: L.Map,
    private readonly group: L.FeatureGroup,
    private readonly plotted: L.Marker[],
    /** Called after copies were added or removed, with every point now drawn on the map. */
    private readonly onChange: (drawnPoints: L.HeatLatLngTuple[]) => void,
  ) {
    this.plottedBounds = getPointsBounds(plotted.map((marker) => marker.getLatLng()))
    this.map.on('moveend', this.onMoveEnd)
    this.sync()
  }

  /** Every point drawn on the map, the copies included, in the shape the heat map layer takes. */
  getDrawnPoints(): L.HeatLatLngTuple[] {
    return [this.plotted, ...this.copies.values()].flat().map((marker): L.HeatLatLngTuple => {
      const { lat, lng } = marker.getLatLng()
      // The third value is the heat map weight, and every submission weighs the same to us
      return [lat, lng, 1]
    })
  }

  /** Stops following the map. The copies stay in their group, which is on its way out anyway. */
  destroy() {
    window.cancelAnimationFrame(this.pendingSync)
    this.map.off('moveend', this.onMoveEnd)
  }

  private readonly onMoveEnd = () => {
    // The next frame lets the marker clustering handle the move first: it only shows markers inside the bounds it saw
    // last, so copies added any earlier would stay invisible until the next move.
    window.cancelAnimationFrame(this.pendingSync)
    this.pendingSync = window.requestAnimationFrame(this.sync)
  }

  /** Draws the copies that have come into sight and takes down the ones that have gone out of it. */
  private readonly sync = () => {
    if (
      // Nothing plotted, so nothing to copy
      !this.plottedBounds ||
      // A map without a view yet throws when asked about its bounds
      !Number.isFinite(this.map.getZoom())
    ) {
      return
    }

    const view = this.map.getBounds()
    const offsets = getWorldCopyOffsets(
      this.plottedBounds,
      { west: view.getWest(), east: view.getEast() },
      Math.floor(MAX_DRAWN_MARKERS / this.plotted.length),
    )
    let changed = false

    this.copies.forEach((markers, offset) => {
      if (!offsets.includes(offset)) {
        this.removeFromGroup(markers)
        this.copies.delete(offset)
        changed = true
      }
    })

    offsets.forEach((offset) => {
      // Zero is the copy the points were plotted in, already on the map
      if (offset === 0 || this.copies.has(offset)) {
        return
      }
      const copy = this.plotted.map((marker) => {
        const { lat, lng } = marker.getLatLng()
        return L.marker([lat, lng + offset], marker.options)
      })
      this.addToGroup(copy)
      this.copies.set(offset, copy)
      changed = true
    })

    if (changed) {
      this.onChange(this.getDrawnPoints())
    }
  }

  /** `L.MarkerClusterGroup` takes a whole batch much faster than markers one by one. */
  private addToGroup(markers: L.Marker[]) {
    if (this.group instanceof L.MarkerClusterGroup) {
      this.group.addLayers(markers)
    } else {
      markers.forEach((marker) => this.group.addLayer(marker))
    }
  }

  /** See `addToGroup()`. */
  private removeFromGroup(markers: L.Marker[]) {
    if (this.group instanceof L.MarkerClusterGroup) {
      this.group.removeLayers(markers)
    } else {
      markers.forEach((marker) => this.group.removeLayer(marker))
    }
  }
}
