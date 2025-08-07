// NOTE: this project is over decade old and I have no idea how it works. Obviously there are no
// types for it. The types below are just an educated guess and are definitely not complete.
declare module '@mapbox/leaflet-omnivore' {
  import type { LayerGroup, FeatureGroup } from 'leaflet'

  // This seems to be this weird object that is both a function and an object
  // with properties.
  export interface OmnivoreFunction extends Function {
    (url: string, options?: any, layer?: LayerGroup | FeatureGroup): LayerGroup
    parse: (type: string) => LayerGroup
  }

  interface Omnivore {
    csv: OmnivoreFunction
    kml: OmnivoreFunction
    gpx: OmnivoreFunction
    topojson: OmnivoreFunction
    wkt: OmnivoreFunction
    geojson: OmnivoreFunction
  }

  const omnivore: Omnivore
  export default omnivore
}
