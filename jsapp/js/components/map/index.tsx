<<<<<<<< HEAD:jsapp/js/components/map/map.js
import './map.scss'
import './map.marker-colors.scss'
import L from 'leaflet/dist/leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat/dist/leaflet-heat'
import 'leaflet.markercluster/dist/leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'

import React from 'react'

import omnivore from '@mapbox/leaflet-omnivore'
import classNames from 'classnames'
import JSZip from 'jszip'
import autoBind from 'react-autobind'
import reactMixin from 'react-mixin'
import Reflux from 'reflux'
import { actions } from '#/actions'
import { getSurveyFlatPaths } from '#/assetUtils'
import bem from '#/bem'
import CenteredMessage from '#/components/common/centeredMessage.component'
import LoadingSpinner from '#/components/common/loadingSpinner'
import Modal from '#/components/common/modal'
import { ASSET_FILE_TYPES, MODAL_TYPES, QUERY_LIMIT_DEFAULT, QUESTION_TYPES } from '#/constants'
import { dataInterface } from '#/dataInterface'
import pageState from '#/pageState.store'
import PopoverMenu from '#/popoverMenu'
import { withRouter } from '#/router/legacy'
import { checkLatLng, notify } from '#/utils'
import MapSettings from './mapSettings'

const streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  subdomains: ['a', 'b', 'c'],
})
========
// Libraries
import React from 'react'
import bem from 'js/bem'
import cx from 'classnames'
import JSZip from 'jszip'
// Leaflet
// TODO: use something diifferent than leaflet-omnivore as it is not maintained
// and last realease was 8(!) years ago.
import omnivore, { OmnivoreFunction } from '@mapbox/leaflet-omnivore'
import L, { type LayerGroup } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import { check } from '@placemarkio/check-geojson'

// Partial components
import PopoverMenu from 'js/popoverMenu'
import Modal from 'js/components/common/modal'
import LoadingSpinner from 'js/components/common/loadingSpinner'
import CenteredMessage from 'js/components/common/centeredMessage.component'
import MapSettings from './MapSettings'

// Stores, hooks and utilities
import { dataInterface } from 'js/dataInterface'
import { actions } from 'js/actions'
import { withRouter, type WithRouterProps } from 'js/router/legacy'
import pageState from 'js/pageState.store'
import { notify, checkLatLng } from 'js/utils'
import { getSurveyFlatPaths } from 'js/assetUtils'

// Constants and types
import { ASSET_FILE_TYPES, MODAL_TYPES, QUESTION_TYPES, QUERY_LIMIT_DEFAULT } from 'js/constants'
import type {
  AssetFileResponse,
  AssetMapStyles,
  AssetResponse,
  FailResponse,
  PaginatedResponse,
  SubmissionResponse,
  SurveyChoice,
  SurveyRow,
} from 'js/dataInterface'

// Styles
import './map.scss'
import './map.marker-colors.scss'
import { fetchGetUrl } from 'jsapp/js/api'

<<<<<<< HEAD
<<<<<<< HEAD
const streets = L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    subdomains: ['a', 'b', 'c'],
  }
);
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
=======
const streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
=======
const STREETS_LAYER = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
>>>>>>> a7467789f (move controls inside component)
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  subdomains: ['a', 'b', 'c'],
})
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)

const BASE_LAYERS = {
  OpenStreetMap: STREETS_LAYER,
  OpenTopoMap: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution:
      'Map data: &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
  }),
  'ESRI World Imagery': L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      attribution:
        'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    },
  ),
  Humanitarian: L.tileLayer('https://tile-{s}.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
    attribution:
      'Tiles &copy; Humanitarian OpenStreetMap Team &mdash; &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }),
}

<<<<<<< HEAD
<<<<<<<< HEAD:jsapp/js/components/map/map.js
const controls = L.control.layers(baseLayers)

export class FormMap extends React.Component {
  constructor(props) {
    super(props)

    const survey = props.asset.content.survey
    let hasGeoPoint = false
    survey.forEach((s) => {
========
=======
type IconNoValue = '-novalue'

>>>>>>> 815f740d0 (cleanup todo comments)
// We need to extend the types (which are not perfect), to make sure the internal properties are accessible. It is true
// that we should not access those, but this file is quite old, and I am only migrating it to TypeScript without changing.
interface CustomLayerControl extends L.Control.Layers {
  _layers: Array<{
    name: string
    layer: L.Layer
    overlay: boolean
  }>
}

interface LayerExtended extends L.Layer {
  feature: {
    properties: any
  }
  _icon: any
  options: LayerOptionsExtended
}

interface LayerOptionsExtended extends L.LayerOptions {
  typeId: any
}

interface FeatureGroupExtended extends L.FeatureGroup {
  eachLayer: (fn: (layer: LayerExtended) => void, context?: any) => this
}

type MarkerMap = Array<{
  count: number
  id: number
  labels: any
  value: any
}>

interface MapValueCounts {
  [key: string]: { count: number; id: number }
}

// Function to validate GeoJSON object
function isValidGeoJSON(geojson: string): boolean {
  try {
    return Boolean(check(geojson))
  } catch (e) {
    console.error(e)
    return false
  }
}

const OVERLAY_ERROR = t('Error loading overlay layer "##name##"')
const OVERLAY_ERROR_INVALID_GEOJSON = t('Error loading overlay layer "##name##" (invalid GeoJSON)')
const OVERLAY_ERROR_OMNIVORE = t('Error loading overlay layer "##name##" (omnivore error)')

interface FormMapProps extends WithRouterProps {
  asset: AssetResponse
  /** A question/row name for map to focus on given question data */
  viewby: string
}

interface FormMapState {
  map: L.Map | undefined
  markers: FeatureGroupExtended | undefined
  heatmap: L.HeatLayer | undefined
  markersVisible: boolean
  markerMap?: MarkerMap
  fields: SurveyRow[]
  hasGeoPoint: boolean
  submissions: SubmissionResponse[]
  error: string | undefined
  isFullscreen: boolean
  showExpandedLegend: boolean
  langIndex: number
  filteredByMarker: string[] | undefined
  componentRefreshed: boolean
  showMapSettings: boolean
  overridenStyles?: AssetMapStyles
  clearDisaggregatedPopover: boolean
  noData: boolean
  previousViewby?: string
}

export class FormMap extends React.Component<FormMapProps, FormMapState> {
  controls: CustomLayerControl = L.control.layers(BASE_LAYERS) as CustomLayerControl

  constructor(props: FormMapProps) {
    super(props)

    const survey = props.asset.content?.survey || []
<<<<<<< HEAD
    let hasGeoPoint = false
    survey.forEach(function (s) {
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
      if (s.type === QUESTION_TYPES.geopoint.id) {
        hasGeoPoint = true
      }
    })
=======
    const hasGeoPoint = survey.some((row) => row.type === QUESTION_TYPES.geopoint.id)
>>>>>>> a7467789f (move controls inside component)

    this.state = {
      map: undefined,
      markers: undefined,
      heatmap: undefined,
      markersVisible: true,
      markerMap: undefined,
      fields: [],
      hasGeoPoint: hasGeoPoint,
      submissions: [],
      error: undefined,
      isFullscreen: false,
      showExpandedLegend: true,
      langIndex: 0,
      filteredByMarker: undefined,
      componentRefreshed: false,
      showMapSettings: false,
      overridenStyles: undefined,
      clearDisaggregatedPopover: false,
      noData: false,
<<<<<<< HEAD
<<<<<<<< HEAD:jsapp/js/components/map/map.js
    }

    autoBind(this)
========
    };
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
=======
    }
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
  }

  componentWillUnmount() {
    if (this.state.map) {
      this.state.map.remove()
    }
  }

  componentDidMount() {
<<<<<<< HEAD
<<<<<<<< HEAD:jsapp/js/components/map/map.js
    const fields = []
    const fieldTypes = ['select_one', 'select_multiple', 'integer', 'decimal', 'text']
    this.props.asset.content.survey.forEach((q) => {
========
    const fields: SurveyRow[] = [];
    const fieldTypes = [
      'select_one',
      'select_multiple',
      'integer',
      'decimal',
      'text',
    ];
=======
    const fields: SurveyRow[] = []
    const fieldTypes = ['select_one', 'select_multiple', 'integer', 'decimal', 'text']
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
    this.props.asset.content?.survey?.forEach((q) => {
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
      if (fieldTypes.includes(q.type)) {
        fields.push(q)
      }
    })

    L.Marker.prototype.options.icon = L.divIcon({
      className: 'map-marker default-overlay-marker',
      iconSize: [12, 12],
    })

    const map = L.map('data-map', {
      maxZoom: 17,
      scrollWheelZoom: false,
      preferCanvas: true,
    })

    STREETS_LAYER.addTo(map)
    this.controls.addTo(map)

    this.setState({
      map: map,
      fields: fields,
    })

    if (this.props.asset.deployment__submission_count > QUERY_LIMIT_DEFAULT) {
      notify(
        t(
<<<<<<< HEAD
<<<<<<<< HEAD:jsapp/js/components/map/map.js
          'By default map is limited to the ##number##  most recent submissions for performance reasons. Go to map settings to increase this limit.',
        ).replace('##number##', QUERY_LIMIT_DEFAULT),
      )
    }

    this.requestData(map, this.props.viewby)
    this.listenTo(actions.map.setMapStyles.started, this.onSetMapStylesStarted)
    this.listenTo(actions.map.setMapStyles.completed, this.onSetMapStylesCompleted)
    this.listenTo(actions.resources.getAssetFiles.completed, this.updateOverlayList)
    actions.resources.getAssetFiles(this.props.asset.uid, ASSET_FILE_TYPES.map_layer.id)
========
          'By default map is limited to the ##number##  most recent submissions for performance reasons. Go to map settings to increase this limit.'
        ).replace('##number##', QUERY_LIMIT_DEFAULT.toString())
      );
=======
          'By default map is limited to the ##number##  most recent submissions for performance reasons. Go to map settings to increase this limit.',
        ).replace('##number##', QUERY_LIMIT_DEFAULT.toString()),
      )
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
    }

    this.requestData(map, this.props.viewby)
    actions.map.setMapStyles.started.listen(this.onSetMapStylesStarted.bind(this))
    actions.map.setMapStyles.completed.listen(this.onSetMapStylesCompleted.bind(this))
    actions.resources.getAssetFiles.completed.listen(this.onGetAssetFiles.bind(this))

<<<<<<< HEAD
    actions.resources.getAssetFiles(
      this.props.asset.uid,
      ASSET_FILE_TYPES.map_layer.id
    );
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
=======
    actions.resources.getAssetFiles(this.props.asset.uid, ASSET_FILE_TYPES.map_layer.id)
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
  }

  loadOverlayLayers() {
    dataInterface.getAssetFiles(this.props.asset.uid, ASSET_FILE_TYPES.map_layer.id).done(() => {})
  }

<<<<<<< HEAD
<<<<<<<< HEAD:jsapp/js/components/map/map.js
  updateOverlayList(data) {
    const map = this.state.map
========
  onGetAssetFiles(data: PaginatedResponse<AssetFileResponse>) {
<<<<<<< HEAD
    const map = this.state.map;
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
=======
    const map = this.state.map
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
=======
  onGetAssetFiles(data: PaginatedResponse<AssetFileResponse>) {
    this.removeUnknownLayers(data.results)
    this.addNewLayers(data.results)
  }
>>>>>>> a41ccbd32 (add check-geojson and final fixes)

  /**
   * Removes layers from controls if they are no longer in asset files
   */
  removeUnknownLayers(files: AssetFileResponse[]) {
    this.controls._layers.forEach((controlLayer) => {
      if (controlLayer.overlay) {
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<<< HEAD:jsapp/js/components/map/map.js
        const layerMatch = data.results.filter((result) => result.name === controlLayer.name)
        if (!layerMatch.length) {
          controls.removeLayer(controlLayer.layer)
          map.removeLayer(controlLayer.layer)
========
        const layerMatch = data.results.filter(
          // TODO: there is no `name` in AssetFileResponse. Should this be `description`?
          (result) => result.description === controlLayer.name,
        )
=======
        const layerMatch = data.results.filter((result) => result.description === controlLayer.name)
>>>>>>> 60ac1e840 (map ts WIP (mostly working))
        if (!layerMatch.length) {
<<<<<<< HEAD
          controls.removeLayer(controlLayer.layer);
          map?.removeLayer(controlLayer.layer);
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
=======
          controls.removeLayer(controlLayer.layer)
          map?.removeLayer(controlLayer.layer)
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
=======
        const layerMatch = files.filter((file) => file.description === controlLayer.name)
        if (!layerMatch.length) {
          this.controls.removeLayer(controlLayer.layer)
          this.state.map?.removeLayer(controlLayer.layer)
>>>>>>> a41ccbd32 (add check-geojson and final fixes)
        }
      }
    })
  }

  /**
   * Adds new layers to controls (if they haven't been added already)
   */
  addNewLayers(files: AssetFileResponse[]) {
    files.forEach((layer) => {
      // Step 1. Verify file type is ok - we are only interested in files that are map layers
      if (layer.file_type !== 'map_layer') {
        return
      }

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<<< HEAD:jsapp/js/components/map/map.js
      let overlayLayer = false
========
      let overlayLayer: LayerGroup | undefined;
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
=======
      let overlayLayer: LayerGroup | undefined
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
=======
      // Step 2. Ensure the layer is not already loaded
      const hasLayer = this.controls._layers.some((controlLayer) => controlLayer.name === layer.description)
      if (hasLayer) {
        return
      }

      // Step 3: Identify omnivore function to be used
      let overlayLayer: LayerGroup | undefined
      let omnivoreFn: OmnivoreFunction | undefined
>>>>>>> a41ccbd32 (add check-geojson and final fixes)
      switch (layer.metadata.type) {
        case 'kml':
          omnivoreFn = omnivore.kml
          break
        case 'csv':
          omnivoreFn = omnivore.csv
          break
        case 'json':
        case 'geojson':
          // Step 3.1: Special case for GeoJSON files
          // We need to ensure the file is valid before passing it to omnivore, as omnivore doesn't handle invalid
          // GeoJSON well, resulting in UI crashing.
          try {
            fetchGetUrl<object>(layer.content)
              .then((response) => {
                if (isValidGeoJSON(JSON.stringify(response))) {
                  overlayLayer = omnivore
                    // We have already loaded file content, but unfortunately omnivore doesn't support parsing JSON
                    // strings for GeoJSON (it does support most of other types though…). So unfortunately we need to
                    // make it load the file second time (`.geojson` does a call to fetch URL)
                    .geojson(layer.content)
                    .on('error', () => {
                      notify.error(OVERLAY_ERROR_OMNIVORE.replace('##name##', layer.description))
                    })
                    .on('ready', () => {
                      this.onOmnivoreLayerReady(overlayLayer, layer.description)
                    })
                } else {
                  notify.error(OVERLAY_ERROR_INVALID_GEOJSON.replace('##name##', layer.description))
                }
              })
              .catch((err) => {
                console.error(err)
                notify.error(OVERLAY_ERROR.replace('##name##', layer.description) + ' 1')
              })
          } catch (err) {
            notify.error(OVERLAY_ERROR.replace('##name##', layer.description) + ' 2')
          }
          break
        case 'wkt':
          omnivoreFn = omnivore.wkt
          break
        case 'kmz':
          // Step 3.2: Special case for KMZ files
          // KMZ files are zipped KMLs, therefore we need to unzip the KMZ file in the browser and then feed
          // the resulting text to map and controls
          fetch(layer.content)
            .then((response) => {
              if (response.status === 200 || response.status === 0) {
                return Promise.resolve(response.blob())
              } else {
                return Promise.reject(new Error(response.statusText))
              }
            })
            .then(JSZip.loadAsync)
<<<<<<<< HEAD:jsapp/js/components/map/map.js
            .then((zip) => zip.file('doc.kml').async('string'))
            .then(function success(kml) {
              overlayLayer = omnivore.kml.parse(kml)
              controls.addOverlay(overlayLayer, layer.name)
              overlayLayer.addTo(map)
            })
          break
      }

      if (overlayLayer) {
        overlayLayer.on('ready', () => {
          overlayLayer.eachLayer((l) => {
            const fprops = l.feature.properties
            const name = fprops.name || fprops.title || fprops.NAME || fprops.TITLE
========
            .then(function (zip) {
              return zip.file('doc.kml')?.async('string')
            })
            .then((kmlContent) => {
              if (kmlContent && this.state.map) {
                // We don't need to react to `.on('ready')` here, as KML file is already loaded and we just need to
                // parse it (works synchronously)
                const parsedOverlayLayer = omnivore.kml.parse(kmlContent)
                this.onOmnivoreLayerReady(parsedOverlayLayer, layer.description)
              }
            })
            .catch((err) => {
              console.error(err)
              notify.error(OVERLAY_ERROR.replace('##name##', layer.description) + ' 3')
            })
          break
        default:
          notify.error(OVERLAY_ERROR.replace('##name##', layer.description) + ' 4')
          break
      }

<<<<<<< HEAD
      if (overlayLayer && map) {
<<<<<<< HEAD
        overlayLayer.on('ready', () => {
          overlayLayer?.eachLayer((l) => {
<<<<<<< HEAD
            const fprops = l.feature.properties;
            const name =
              fprops.name || fprops.title || fprops.NAME || fprops.TITLE;
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
=======
            const fprops = l.feature.properties
            const name = fprops.name || fprops.title || fprops.NAME || fprops.TITLE
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
            if (name) {
              l.bindPopup(name)
            } else {
              // when no name or title, load full list of feature's properties
              l.bindPopup('<pre>' + JSON.stringify(fprops, null, 2).replace(/[{}"]/g, '') + '</pre>')
            }
=======
        overlayLayer
          .on('ready', () => {
            overlayLayer?.eachLayer((l) => {
              const fprops = (l as LayerExtended).feature.properties
              const name = fprops.name || fprops.title || fprops.NAME || fprops.TITLE
              if (name) {
                l.bindPopup(name)
              } else {
                // when no name or title, load full list of feature's properties
                l.bindPopup('<pre>' + JSON.stringify(fprops, null, 2).replace(/[{}"]/g, '') + '</pre>')
              }
            })
>>>>>>> 60ac1e840 (map ts WIP (mostly working))
          })
=======
      // Step 4: If this wasn't a special case, `omnivoreFn` should be ready to be used here, `onOmnivoreLayerReady`
      // function handles the rest
      if (omnivoreFn) {
        overlayLayer = omnivoreFn(layer.content)
>>>>>>> a41ccbd32 (add check-geojson and final fixes)
          .on('error', () => {
            notify.error(OVERLAY_ERROR_OMNIVORE.replace('##name##', layer.description))
          })
          .on('ready', () => {
            this.onOmnivoreLayerReady(overlayLayer, layer.description)
          })
      }
    })
  }

  /**
   * Handle map layer successfully loaded by omnivore.
   */
  onOmnivoreLayerReady(overlayLayer: LayerGroup | undefined, description: string) {
    if (overlayLayer && this.state.map) {
      this.controls.addOverlay(overlayLayer, description)
      overlayLayer.addTo(this.state.map)

      // Add popups to each layer feature (i.e. each point)
      overlayLayer.eachLayer((l) => {
        const fprops = (l as LayerExtended).feature.properties
        const name = fprops.name || fprops.title || fprops.NAME || fprops.TITLE
        if (name) {
          l.bindPopup(name)
        } else {
          // when no name or title, load full list of feature's properties
          l.bindPopup('<pre>' + JSON.stringify(fprops, null, 2).replace(/[{}"]/g, '') + '</pre>')
        }
      })
    }
  }

  onSetMapStylesCompleted() {
    // asset is updated, no need to store oberriden styles as they are identical
<<<<<<< HEAD
<<<<<<<< HEAD:jsapp/js/components/map/map.js
    this.setState({ overridenStyles: false })
========
    this.setState({overridenStyles: undefined});
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
=======
    this.setState({ overridenStyles: undefined })
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
  }

  /**
   * We don't want to wait for the asset (`asset.map_styles`) to be updated
   * we use the settings being saved and fetch data with them
   */
  onSetMapStylesStarted(_assetUid: string, upcomingMapSettings: AssetMapStyles) {
    if (!upcomingMapSettings.colorSet) {
      upcomingMapSettings.colorSet = 'a'
    }

    if (!upcomingMapSettings.querylimit) {
      upcomingMapSettings.querylimit = QUERY_LIMIT_DEFAULT.toString()
    }

    this.overrideStyles(upcomingMapSettings)
  }

  requestData(map: L.Map, nextViewBy = '') {
    // TODO: support area / line geodata questions
    // See: https://github.com/kobotoolbox/kpi/issues/3913
    let selectedQuestion = this.props.asset.map_styles.selectedQuestion || null

<<<<<<<< HEAD:jsapp/js/components/map/map.js
    this.props.asset.content.survey.forEach((row) => {
========
    this.props.asset.content?.survey?.forEach(function (row) {
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
      if (
        typeof row.label !== 'undefined' &&
        row.label !== null &&
        selectedQuestion === row.label[0] &&
        row.type !== QUESTION_TYPES.geopoint.id
      ) {
        selectedQuestion = null //Ignore if not a geopoint question type
      }
    })

<<<<<<< HEAD
<<<<<<<< HEAD:jsapp/js/components/map/map.js
    let queryLimit = QUERY_LIMIT_DEFAULT
    if (this.state.overridenStyles && this.state.overridenStyles.querylimit) {
      queryLimit = this.state.overridenStyles.querylimit
    } else if (this.props.asset.map_styles.querylimit) {
      queryLimit = this.props.asset.map_styles.querylimit
========
    let queryLimit = QUERY_LIMIT_DEFAULT;
=======
    let queryLimit = QUERY_LIMIT_DEFAULT
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
    if (this.state.overridenStyles?.querylimit) {
      queryLimit = parseInt(this.state.overridenStyles.querylimit)
    } else if (this.props.asset.map_styles.querylimit) {
<<<<<<< HEAD
      queryLimit = parseInt(this.props.asset.map_styles.querylimit);
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
=======
      queryLimit = parseInt(this.props.asset.map_styles.querylimit)
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
    }

    const fq = ['_id', '_geolocation']
    if (selectedQuestion) {
      fq.push(selectedQuestion)
    }
    if (nextViewBy) {
      fq.push(this.nameOfFieldInGroup(nextViewBy))
    }
    const sort = [{ id: '_id', desc: true }]
    dataInterface
      .getSubmissions(this.props.asset.uid, queryLimit, 0, sort, fq)
<<<<<<<< HEAD:jsapp/js/components/map/map.js
      .done((data) => {
        const results = data.results
        if (selectedQuestion) {
          results.forEach((row, i) => {
            if (row[selectedQuestion]) {
              const coordsArray = row[selectedQuestion].split(' ')
              results[i]._geolocation[0] = coordsArray[0]
              results[i]._geolocation[1] = coordsArray[1]
========
      .done((data: PaginatedResponse<SubmissionResponse>) => {
        const results = data.results
        if (selectedQuestion) {
          results.forEach((row, i) => {
            if (selectedQuestion && row[selectedQuestion]) {
<<<<<<< HEAD
              const coordsArray: string[] = String(row[selectedQuestion]).split(' ');
              results[i]._geolocation[0] = parseInt(coordsArray[0]);
              results[i]._geolocation[1] = parseInt(coordsArray[1]);
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
=======
              const coordsArray: string[] = String(row[selectedQuestion]).split(' ')
              results[i]._geolocation[0] = parseInt(coordsArray[0])
              results[i]._geolocation[1] = parseInt(coordsArray[1])
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
            }
          })
        }

        this.setState({ submissions: results }, () => {
          this.buildMarkers(map)
          this.buildHeatMap(map)
        })
      })
      .fail((error: FailResponse) => {
        if (error.responseText) {
<<<<<<< HEAD
<<<<<<<< HEAD:jsapp/js/components/map/map.js
          this.setState({ error: error.responseText, loading: false })
        } else if (error.statusText) {
          this.setState({ error: error.statusText, loading: false })
        } else {
          this.setState({
            error: t('Error: could not load data.'),
            loading: false,
          })
========
          this.setState({error: error.responseText});
=======
          this.setState({ error: error.responseText })
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
        } else if (error.statusText) {
          this.setState({ error: error.statusText })
        } else {
          this.setState({
            error: t('Error: could not load data.'),
<<<<<<< HEAD
          });
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
=======
          })
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
        }
      })
  }

  calculateClusterRadius(zoom: number) {
    if (zoom >= 12) {
      return 12
    }
    return 20
  }

  calcColorSet() {
<<<<<<< HEAD
<<<<<<<< HEAD:jsapp/js/components/map/map.js
    let colorSet
    if (this.state.overridenStyles && this.state.overridenStyles.colorSet) {
      colorSet = this.state.overridenStyles.colorSet
========
    let colorSet;
    if (this.state.overridenStyles?.colorSet) {
      colorSet = this.state.overridenStyles.colorSet;
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
=======
    let colorSet
    if (this.state.overridenStyles?.colorSet) {
      colorSet = this.state.overridenStyles.colorSet
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
    } else {
      const ms = this.props.asset.map_styles
      colorSet = ms.colorSet ? ms.colorSet : undefined
    }

    return colorSet
  }
<<<<<<<< HEAD:jsapp/js/components/map/map.js
  buildMarkers(map) {
    const prepPoints = []
    const viewby = this.props.viewby || undefined
    const colorSet = this.calcColorSet()
    let currentQuestionChoices = []
    let mapMarkers = {}
    let mM = []

    if (viewby) {
      mapMarkers = this.prepFilteredMarkers(this.state.submissions, this.props.viewby)
      const choices = this.props.asset.content.choices
      const survey = this.props.asset.content.survey
========

  buildMarkers(map: L.Map) {
    const _this = this
    const prepPoints: L.Marker[] = []
    const viewby = this.props.viewby || undefined
    const colorSet = this.calcColorSet()
    let currentQuestionChoices: SurveyChoice[] = []
    let mapMarkers: MapValueCounts = {}
    let mM: MarkerMap = []

    if (viewby) {
<<<<<<< HEAD
      mapMarkers = this.prepFilteredMarkers(
        this.state.submissions,
        this.props.viewby
      );
      const choices = this.props.asset.content?.choices || [];
      const survey = this.props.asset.content?.survey || [];
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
=======
      mapMarkers = this.prepFilteredMarkers(this.state.submissions, this.props.viewby)
      const choices = this.props.asset.content?.choices || []
      const survey = this.props.asset.content?.survey || []
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)

      const question = survey.find((s) => s.name === viewby || s.$autoname === viewby)

      if (question && question.type === 'select_one') {
        currentQuestionChoices = choices.filter((ch) => ch.list_name === question.select_from_list_name)
      }

<<<<<<< HEAD
      Object.keys(mapMarkers).map((m) => {
=======
      Object.keys(mapMarkers).map(function (m) {
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
        let choice
        if (question && question.type === 'select_one') {
          choice = currentQuestionChoices.find((ch) => ch.name === m || ch.$autoname === m)
        }

        mM.push({
          count: mapMarkers[m].count,
          id: mapMarkers[m].id,
          labels: choice ? choice.label : undefined,
          value: m !== 'undefined' ? m : undefined,
        })
      })

      if (colorSet !== undefined && colorSet !== 'a' && question && question.type === 'select_one') {
        // sort by question choice order, when using any other color set (only makes sense for select_ones)
<<<<<<< HEAD
        mM.sort((a, b) => {
=======
        mM.sort(function (a, b) {
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
          const aIndex = currentQuestionChoices.findIndex((ch) => ch.name === a.value)
          const bIndex = currentQuestionChoices.findIndex((ch) => ch.name === b.value)
          return aIndex - bIndex
        })
      } else {
        // sort by occurrence count
<<<<<<< HEAD
        mM.sort((a, b) => a.count - b.count).reverse()
=======
        mM.sort(function (a, b) {
          return a.count - b.count
        }).reverse()
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
      }

      // move elements with no data in submission for the disaggregated question to end of marker list
      const emptyEl = mM.find((m) => m.value === undefined)
      if (emptyEl) {
        mM = mM.filter((m) => m !== emptyEl)
        mM.push(emptyEl)
      }
      this.setState({ markerMap: mM })
    } else {
<<<<<<< HEAD
<<<<<<<< HEAD:jsapp/js/components/map/map.js
      this.setState({ markerMap: false })
    }

    this.state.submissions.forEach((item) => {
      let markerProps = {}
      if (checkLatLng(item._geolocation)) {
        if (viewby && mM) {
          const vb = this.nameOfFieldInGroup(viewby)
          const itemId = item[vb]
          let index = mM.findIndex((m) => m.value === itemId)
========
      this.setState({markerMap: undefined});
=======
      this.setState({ markerMap: undefined })
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
    }

    this.state.submissions.forEach((item) => {
      let markerProps = {}
      if (checkLatLng(item._geolocation)) {
        if (viewby && mM) {
<<<<<<< HEAD
          const vb = _this.nameOfFieldInGroup(viewby);
          const itemId = String(item[vb]);
          let index: number | '-novalue' = mM.findIndex((m) => m.value === itemId);
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx

          // spread indexes to use full colorset gamut if necessary
          if (colorSet !== undefined && colorSet !== 'a') {
            index = this.calculateIconIndex(index, mM)
=======
          const vb = _this.nameOfFieldInGroup(viewby)
          const itemId = String(item[vb])
          let index: number | IconNoValue = mM.findIndex((m) => m.value === itemId)

          // spread indexes to use full colorset gamut if necessary
          if (colorSet !== undefined && colorSet !== 'a') {
            index = _this.calculateIconIndex(index, mM)
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
          }

          // Previously it was possible that `'-novalue' + 1` would happen resulting in code not knowing what to do.
          // I've changed it to default to 1 in case `index` is not a number.
          let iconNumber = 1
          if (typeof index === 'number') {
            iconNumber = index + 1
          }

          markerProps = {
<<<<<<<< HEAD:jsapp/js/components/map/map.js
            icon: this.buildIcon(index + 1),
========
            icon: _this.buildIcon(iconNumber),
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
            sId: item._id,
            typeId: mapMarkers[itemId].id,
          }
        } else {
          markerProps = {
            icon: this.buildIcon(),
            sId: item._id,
            typeId: null,
          }
        }

<<<<<<< HEAD
<<<<<<<< HEAD:jsapp/js/components/map/map.js
        prepPoints.push(L.marker(item._geolocation, markerProps))
========
        const geo0 = item._geolocation[0];
        const geo1 = item._geolocation[1];
=======
        const geo0 = item._geolocation[0]
        const geo1 = item._geolocation[1]
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
        if (geo0 !== null && geo1 !== null) {
          prepPoints.push(L.marker([geo0, geo1], markerProps))
        }
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
      }
    })

    if (prepPoints.length >= 0) {
      let markers
      if (viewby) {
        markers = L.featureGroup(prepPoints)
      } else {
        markers = L.markerClusterGroup({
          maxClusterRadius: this.calculateClusterRadius,
          disableClusteringAtZoom: 16,
<<<<<<< HEAD
          iconCreateFunction: (cluster) => {
=======
          iconCreateFunction: function (cluster) {
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
            const childCount = cluster.getChildCount()

            let markerClass = 'marker-cluster marker-cluster-'
            if (childCount < 10) {
              markerClass += 'small'
            } else if (childCount < 100) {
              markerClass += 'medium'
            } else {
              markerClass += 'large'
            }

            const divIcon = L.divIcon({
              html: '<div><span>' + childCount + '</span></div>',
              className: markerClass,
              iconSize: new L.Point(30, 30),
<<<<<<< HEAD
<<<<<<<< HEAD:jsapp/js/components/map/map.js
            })
========
            });
            return divIcon;
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
=======
            })
            return divIcon
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
          },
        })

        markers.addLayers(prepPoints)
      }

<<<<<<< HEAD
<<<<<<< HEAD
      markers.on('click', this.launchSubmissionModal).addTo(map)
=======
      markers.on('click', this.launchSubmissionModal.bind(this)).addTo(map);
>>>>>>> e6e6b071c (further improvements to map types (WIP))
=======
      markers.on('click', this.launchSubmissionModal.bind(this)).addTo(map)
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)

      if (prepPoints.length > 0 && (!viewby || !this.state.componentRefreshed)) {
        map.fitBounds(markers.getBounds())
      }
      if (prepPoints.length === 0) {
        map.fitBounds([[42.373, -71.124]])
        this.setState({ noData: true })
      }
      this.setState({
        markers: markers as FeatureGroupExtended,
      })
    } else {
<<<<<<< HEAD
<<<<<<<< HEAD:jsapp/js/components/map/map.js
      this.setState({ error: t('Error: could not load data.'), loading: false })
========
      this.setState({error: t('Error: could not load data.')});
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
=======
      this.setState({ error: t('Error: could not load data.') })
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
    }
  }

  /**
   * Note: this function sometimes returns IconNoValue string.
   */
  calculateIconIndex(index: number, mM: MarkerMap): number | IconNoValue {
    // use neutral color for items with no set value
    if (mM[index] && mM[index].value === undefined) {
      return '-novalue'
    }

    // if there are submissions with unset values, reset the local marker array
    // this helps us use the full gamut of colors in the set
    const emptyEl = mM.find((m) => m.value === undefined)
    if (emptyEl) {
      mM = mM.filter((m) => m !== emptyEl)
    }

    // return regular index for list >= 9 items
    if (mM.length >= 9) {
      return index
    }

    // spread index fairly evenly from 1 to 9 when less than 9 items in list
    const num = (index / mM.length) * 9.5
    return Math.round(num)
  }

<<<<<<<< HEAD:jsapp/js/components/map/map.js
  buildIcon(index = false) {
    const colorSet = this.calcColorSet() || 'a'
    const iconClass = index ? `map-marker-${colorSet}${index}` : 'map-marker-a'
========
  buildIcon(index: number | boolean = false) {
<<<<<<< HEAD
    const colorSet = this.calcColorSet() || 'a';
    const iconClass = index ? `map-marker-${colorSet}${index}` : 'map-marker-a';
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
=======
    const colorSet = this.calcColorSet() || 'a'
    const iconClass = index ? `map-marker-${colorSet}${index}` : 'map-marker-a'
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)

    return L.divIcon({
      className: `map-marker ${iconClass}`,
      iconSize: [20, 20],
    })
  }

<<<<<<<< HEAD:jsapp/js/components/map/map.js
  prepFilteredMarkers(data, viewby) {
    const markerMap = new Object()
    const vb = this.nameOfFieldInGroup(viewby)
    let idcounter = 1

    data.forEach((listitem) => {
      const m = listitem[vb]

      if (markerMap[m] === undefined) {
        markerMap[m] = { count: 1, id: idcounter }
        idcounter++
      } else {
        markerMap[m]['count'] += 1
========
  prepFilteredMarkers(data: SubmissionResponse[], viewby: string): MapValueCounts {
    const markerMap: MapValueCounts = {}
    const currentViewBy = this.nameOfFieldInGroup(viewby)
    let idCounter = 1

    data.forEach((submission) => {
      const subResponseValue = String(submission[currentViewBy])

      if (markerMap[subResponseValue] === undefined) {
        markerMap[subResponseValue] = { count: 1, id: idCounter }
        idCounter++
      } else {
<<<<<<< HEAD
        markerMap[subResponseValue]['count'] += 1;
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
=======
        markerMap[subResponseValue]['count'] += 1
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
      }
    })

    return markerMap
  }

<<<<<<<< HEAD:jsapp/js/components/map/map.js
  buildHeatMap(map) {
    const heatmapPoints = []
    this.state.submissions.forEach((item) => {
      if (checkLatLng(item._geolocation)) {
        heatmapPoints.push([item._geolocation[0], item._geolocation[1], 1])
========
  buildHeatMap(map: L.Map) {
    const heatmapPoints: Array<[number, number, number]> = []
    this.state.submissions.forEach((item) => {
      if (checkLatLng(item._geolocation)) {
        const geo0 = item._geolocation[0]
        const geo1 = item._geolocation[1]
        if (geo0 !== null && geo1 !== null) {
          heatmapPoints.push([geo0, geo1, 1])
        }
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
      }
    })
    const heatmap = L.heatLayer(heatmapPoints, {
      minOpacity: 0.25,
      radius: 20,
      blur: 8,
    })

    if (!this.state.markersVisible) {
      map.addLayer(heatmap)
    }
    this.setState({ heatmap: heatmap })
  }

  showMarkers() {
<<<<<<<< HEAD:jsapp/js/components/map/map.js
    const map = this.state.map
    map.addLayer(this.state.markers)
    map.removeLayer(this.state.heatmap)
========
    if (this.state.map && this.state.markers) {
      this.state.map.addLayer(this.state.markers)
    }
    if (this.state.map && this.state.heatmap) {
      this.state.map.removeLayer(this.state.heatmap)
    }
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
    this.setState({
      markersVisible: true,
    })
  }

  showLayerControls() {
    this.controls.expand()
  }

  showHeatmap() {
    const map = this.state.map

<<<<<<<< HEAD:jsapp/js/components/map/map.js
    map.addLayer(this.state.heatmap)
    map.removeLayer(this.state.markers)
========
    if (map && this.state.heatmap) {
      map.addLayer(this.state.heatmap)
    }
    if (map && this.state.markers) {
      map.removeLayer(this.state.markers)
    }
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
    this.setState({
      markersVisible: false,
    })
  }

  filterMap(evt: React.TouchEvent<HTMLAnchorElement>) {
    // roundabout solution for https://github.com/kobotoolbox/kpi/issues/1678
    //
    // when blurEventDisabled prop is set, no blur event takes place in PopoverMenu
    // hence, dropdown stays visible when invoking other click events (like filterLanguage below)
    // but when changing question, dropdown needs to be removed, clearDisaggregatedPopover does this via props
    this.setState({ clearDisaggregatedPopover: true })
    // reset clearDisaggregatedPopover in order to maintain same behaviour on subsequent clicks
    window.setTimeout(() => {
      this.setState({ clearDisaggregatedPopover: false })
    }, 1000)

<<<<<<< HEAD
<<<<<<<< HEAD:jsapp/js/components/map/map.js
    const name = evt.target.getAttribute('data-name') || undefined
========
    const name = evt.currentTarget.getAttribute('data-name') || undefined;
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
=======
    const name = evt.currentTarget.getAttribute('data-name') || undefined
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
    if (name !== undefined) {
      this.props.router.navigate(`/forms/${this.props.asset.uid}/data/map/${name}`)
    } else {
      this.props.router.navigate(`/forms/${this.props.asset.uid}/data/map`)
    }
  }
<<<<<<<< HEAD:jsapp/js/components/map/map.js
  filterLanguage(evt) {
    const index = +evt.target.getAttribute('data-index')
    this.setState({ langIndex: index })
========

  filterLanguage(evt: React.TouchEvent<HTMLAnchorElement>) {
    const dataIndexAttr = evt.currentTarget.getAttribute('data-index')
    if (dataIndexAttr !== null) {
      this.setState({ langIndex: parseInt(dataIndexAttr) })
    }
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
  }

  static getDerivedStateFromProps(props: FormMapProps, state: FormMapState) {
    const newState: Partial<FormMapState> = {
      previousViewby: props.viewby,
    }
    if (props.viewby !== undefined) {
      newState.markersVisible = true
    }
    if (state.previousViewby !== props.viewby) {
<<<<<<< HEAD
<<<<<<<< HEAD:jsapp/js/components/map/map.js
      newState.filteredByMarker = false
      newState.componentRefreshed = true
========
      newState.filteredByMarker = undefined;
      newState.componentRefreshed = true;
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
=======
      newState.filteredByMarker = undefined
      newState.componentRefreshed = true
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
    }
    return newState
  }

  componentDidUpdate(prevProps: FormMapProps) {
    if (prevProps.viewby !== this.props.viewby) {
<<<<<<< HEAD
<<<<<<<< HEAD:jsapp/js/components/map/map.js
      const map = this.refreshMap()
      this.requestData(map, this.props.viewby)
========
      const map = this.refreshMap();
=======
      const map = this.refreshMap()
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
      if (map) {
        this.requestData(map, this.props.viewby)
      }
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
    }
  }

  refreshMap() {
<<<<<<< HEAD
<<<<<<<< HEAD:jsapp/js/components/map/map.js
    const map = this.state.map
    map.removeLayer(this.state.markers)
    map.removeLayer(this.state.heatmap)
    return map
========
    const map = this.state.map;
=======
    const map = this.state.map
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
    if (map && this.state.markers) {
      map.removeLayer(this.state.markers)
    }
    if (map && this.state.heatmap) {
      map.removeLayer(this.state.heatmap)
    }
<<<<<<< HEAD
    return map;
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
=======
    return map
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
  }

<<<<<<< HEAD
  launchSubmissionModal(evt) {
<<<<<<<< HEAD:jsapp/js/components/map/map.js
    const td = this.state.submissions
    const ids = []
    td.forEach((r) => {
      ids.push(r._id)
    })
========
=======
  launchSubmissionModal(evt: L.LeafletMouseEvent) {
<<<<<<< HEAD
>>>>>>> e6e6b071c (further improvements to map types (WIP))
    const td = this.state.submissions;
    const ids: number[] = [];
    td.forEach(function (r) {
      ids.push(r._id);
    });
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
=======
    const td = this.state.submissions
    const ids: number[] = []
    td.forEach(function (r) {
      ids.push(r._id)
    })
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)

    pageState.showModal({
      type: MODAL_TYPES.SUBMISSION,
      sid: evt.layer.options.sId,
      asset: this.props.asset,
      ids: ids,
    })
  }

  toggleMapSettings() {
    this.setState({
      showMapSettings: !this.state.showMapSettings,
    })
  }

  overrideStyles(mapStyles: AssetMapStyles) {
<<<<<<< HEAD
    this.setState({
      filteredByMarker: undefined,
      componentRefreshed: true,
      overridenStyles: mapStyles,
<<<<<<< HEAD
    })

    const map = this.refreshMap()

    // HACK switch to setState callback after updating to React 16+
    window.setTimeout(() => {
      this.requestData(map, this.props.viewby)
    }, 0)
  }

  toggleFullscreen() {
    this.setState({ isFullscreen: !this.state.isFullscreen })

    const map = this.state.map
    setTimeout(() => {
      map.invalidateSize()
    }, 300)
=======
    }, () => {
      const map = this.refreshMap();
=======
    this.setState(
      {
        filteredByMarker: undefined,
        componentRefreshed: true,
        overridenStyles: mapStyles,
      },
      () => {
        const map = this.refreshMap()
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)

        if (map) {
          this.requestData(map, this.props.viewby)
        }
      },
    )
  }

  toggleFullscreen() {
<<<<<<< HEAD
    this.setState({isFullscreen: !this.state.isFullscreen}, () => {
      this.state.map?.invalidateSize();
    });
>>>>>>> e6e6b071c (further improvements to map types (WIP))
=======
    this.setState({ isFullscreen: !this.state.isFullscreen }, () => {
      this.state.map?.invalidateSize()
    })
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
  }

  toggleLegend() {
    this.setState({
      showExpandedLegend: !this.state.showExpandedLegend,
    })
  }

<<<<<<< HEAD
  filterByMarker(evt) {
    const markers = this.state.markers
    const id = evt.target.getAttribute('data-id')
    let filteredByMarker = this.state.filteredByMarker
    const unselectedClass = 'unselected'
=======
  filterByMarker(markerId: number) {
<<<<<<< HEAD
    const id = String(markerId);
    const markers = this.state.markers;
    let filteredByMarker = this.state.filteredByMarker;
    const unselectedClass = 'unselected';
>>>>>>> e6e6b071c (further improvements to map types (WIP))

    if (!filteredByMarker) {
      filteredByMarker = [id]
    } else if (filteredByMarker.includes(id)) {
      filteredByMarker = filteredByMarker.filter((l) => l !== id)
    } else {
      filteredByMarker.push(id)
    }

<<<<<<<< HEAD:jsapp/js/components/map/map.js
    this.setState({ filteredByMarker: filteredByMarker })
    markers.eachLayer((layer) => {
      if (filteredByMarker.includes(layer.options.typeId.toString())) {
        layer._icon.classList.remove(unselectedClass)
========
    this.setState({filteredByMarker: filteredByMarker});
    markers?.eachLayer(function (layer) {
      if (!filteredByMarker.includes(layer.options.typeId.toString())) {
        layer._icon.classList.add(unselectedClass);
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
      } else {
        layer._icon.classList.add(unselectedClass)
=======
    const id = String(markerId)
    const markers = this.state.markers
    let filteredByMarker = this.state.filteredByMarker
    const unselectedClass = 'unselected'

    if (!filteredByMarker) {
      filteredByMarker = [id]
    } else if (!filteredByMarker.includes(id)) {
      filteredByMarker.push(id)
    } else {
      filteredByMarker = filteredByMarker.filter((l) => l !== id)
    }

    this.setState({ filteredByMarker: filteredByMarker })
    markers?.eachLayer((layer) => {
      if (!filteredByMarker.includes(layer.options.typeId.toString())) {
        layer._icon.classList.add(unselectedClass)
      } else {
        layer._icon.classList.remove(unselectedClass)
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
      }
    })
  }

  resetFilterByMarker() {
<<<<<<< HEAD
<<<<<<<< HEAD:jsapp/js/components/map/map.js
    const markers = this.state.markers
    this.setState({ filteredByMarker: false })
    markers.eachLayer((layer) => {
      layer._icon.classList.remove('unselected')
    })
  }

  nameOfFieldInGroup(fieldName) {
    const flatPaths = getSurveyFlatPaths(this.props.asset.content.survey)
    return flatPaths[fieldName]
========
    const markers = this.state.markers;
    this.setState({filteredByMarker: undefined});
=======
    const markers = this.state.markers
    this.setState({ filteredByMarker: undefined })
<<<<<<< HEAD
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
    markers.eachLayer(function (layer) {
=======
    markers?.eachLayer(function (layer) {
>>>>>>> c070193b8 (ts fix)
      layer._icon.classList.remove('unselected')
    })
  }

  nameOfFieldInGroup(fieldName: string): string {
    if (this.props.asset.content?.survey) {
      const flatPaths = getSurveyFlatPaths(this.props.asset.content.survey)
      return flatPaths[fieldName]
    }
    // Fallback - should never happen
<<<<<<< HEAD
    return fieldName;
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
=======
    return fieldName
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
  }

  render() {
    if (this.state.error) {
      return (
        <bem.FormView m='ui-panel'>
          <CenteredMessage message={this.state.error} />
        </bem.FormView>
      )
    }

<<<<<<< HEAD
<<<<<<< HEAD
    const fields = this.state.fields
    const langIndex = this.state.langIndex
    const langs = this.props.asset.content.translations?.length > 1 ? this.props.asset.content.translations : []
    const viewby = this.props.viewby
=======
    const fields = this.state.fields;
    const langIndex = this.state.langIndex;
    let langs: Array<string | null> = [];
    if (
      this.props.asset.content?.translations &&
      this.props.asset.content?.translations.length > 1
    ) {
      langs = this.props.asset.content.translations;
    }
    const viewby = this.props.viewby;
>>>>>>> e6e6b071c (further improvements to map types (WIP))
=======
    const fields = this.state.fields
    const langIndex = this.state.langIndex
    let langs: Array<string | null> = []
    if (this.props.asset.content?.translations && this.props.asset.content?.translations.length > 1) {
      langs = this.props.asset.content.translations
    }
    const viewby = this.props.viewby
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)

    const colorSet = this.calcColorSet() || 'a'
    let label = t('Disaggregate by survey responses')

    if (viewby) {
      fields.forEach((f) => {
        if (viewby === f.name || viewby === f.$autoname) {
<<<<<<< HEAD
<<<<<<< HEAD
          label = `${t('Disaggregated using:')} ${f.label[langIndex]}`
=======
          label = `${t('Disaggregated using:')} ${f.label?.[langIndex]}`;
>>>>>>> e6e6b071c (further improvements to map types (WIP))
=======
          label = `${t('Disaggregated using:')} ${f.label?.[langIndex]}`
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
        }
      })
    } else if (this.state.noData && this.state.hasGeoPoint) {
      label = `${t('No "geopoint" responses have been received')}`
    } else if (!this.state.hasGeoPoint) {
      label = `${t('The map does not show data because this form does not have a "geopoint" field.')}`
    }

    const formViewModifiers = ['map']
    if (this.state.isFullscreen) {
      formViewModifiers.push('fullscreen')
    }

    return (
      <bem.FormView m={formViewModifiers} className='right-tooltip'>
        <bem.FormView__mapButton
          m={'expand'}
          onClick={this.toggleFullscreen.bind(this)}
          data-tip={t('Toggle Fullscreen')}
          className={this.state.isFullscreen ? 'active' : ''}
        >
          <i className='k-icon k-icon-expand' />
        </bem.FormView__mapButton>
        <bem.FormView__mapButton
          m={'markers'}
          onClick={this.showMarkers.bind(this)}
          data-tip={t('Show as points')}
          className={this.state.markersVisible ? 'active' : ''}
        >
          <i className='k-icon k-icon-pins' />
        </bem.FormView__mapButton>
<<<<<<< HEAD
<<<<<<<< HEAD:jsapp/js/components/map/map.js
        <bem.FormView__mapButton m={'layers'} onClick={this.showLayerControls} data-tip={t('Toggle layers')}>
========
        <bem.FormView__mapButton
          m={'layers'}
          onClick={this.showLayerControls.bind(this)}
          data-tip={t('Toggle layers')}
        >
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
=======
        <bem.FormView__mapButton m={'layers'} onClick={this.showLayerControls.bind(this)} data-tip={t('Toggle layers')}>
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
          <i className='k-icon k-icon-layer' />
        </bem.FormView__mapButton>
        <bem.FormView__mapButton
          m={'map-settings'}
          onClick={this.toggleMapSettings.bind(this)}
          data-tip={t('Map display settings')}
        >
          <i className='k-icon k-icon-settings' />
        </bem.FormView__mapButton>
        {!viewby && (
          <bem.FormView__mapButton
            m={'heatmap'}
            onClick={this.showHeatmap.bind(this)}
            data-tip={t('Show as heatmap')}
            className={this.state.markersVisible ? '' : 'active'}
          >
            <i className='k-icon k-icon-heatmap' />
          </bem.FormView__mapButton>
        )}

        {this.state.hasGeoPoint && !this.state.noData && (
          <PopoverMenu
            type='viewby-menu'
            triggerLabel={label}
            clearPopover={this.state.clearDisaggregatedPopover}
            blurEventDisabled
          >
            {langs.length > 1 && <bem.PopoverMenu__heading>{t('Language')}</bem.PopoverMenu__heading>}
            {langs.map((l, i) => (
              <bem.PopoverMenu__link
                data-index={i}
                className={this.state.langIndex === i ? 'active' : ''}
                key={`l-${i}`}
                onClick={this.filterLanguage.bind(this)}
              >
                {l ? l : t('Default')}
              </bem.PopoverMenu__link>
            ))}
            <bem.PopoverMenu__link
              key={'all'}
<<<<<<<< HEAD:jsapp/js/components/map/map.js
              onClick={this.filterMap}
              className={viewby ? 'see-all' : 'active see-all'}
========
              onClick={this.filterMap.bind(this)}
              className={!viewby ? 'active see-all' : 'see-all'}
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
            >
              {t('-- See all data --')}
            </bem.PopoverMenu__link>
            {fields.map((f) => {
<<<<<<< HEAD
<<<<<<<< HEAD:jsapp/js/components/map/map.js
              const name = f.name || f.$autoname
              const label = f.label ? (
========
              const name = f.name || f.$autoname;
=======
              const name = f.name || f.$autoname
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
              const fieldLabel = f.label ? (
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
                f.label[langIndex] ? (
                  f.label[langIndex]
                ) : (
                  <em>{t('untranslated: ') + name}</em>
                )
              ) : (
                t('Question label not set')
              )
              return (
                <bem.PopoverMenu__link
                  data-name={name}
                  key={`f-${name}`}
                  onClick={this.filterMap.bind(this)}
                  className={viewby === name ? 'active' : ''}
                >
                  {fieldLabel}
                </bem.PopoverMenu__link>
              )
            })}
          </PopoverMenu>
        )}

        {this.state.noData && !this.state.hasGeoPoint && (
          <div className='map-transparent-background'>
            <div className='map-no-geopoint-wrapper'>
              <p className='map-no-geopoint'>
                {t('The map does not show data because this form does not have a "geopoint" field.')}
              </p>
            </div>
          </div>
        )}

        {this.state.noData && this.state.hasGeoPoint && (
          <div className='map-transparent-background'>
            <div className='map-no-geopoint-wrapper'>
              <p className='map-no-geopoint'>{t('No "geopoint" responses have been received')}</p>
            </div>
          </div>
        )}

        {this.state.markerMap && this.state.markersVisible && (
          <bem.FormView__mapList className={this.state.showExpandedLegend ? 'expanded' : 'collapsed'}>
            <div className='maplist-contents'>
              {this.state.filteredByMarker && (
<<<<<<<< HEAD:jsapp/js/components/map/map.js
                <div key='m-reset' className='map-marker-item map-marker-reset' onClick={this.resetFilterByMarker}>
========
                <div
                  key='m-reset'
                  className='map-marker-item map-marker-reset'
                  onClick={this.resetFilterByMarker.bind(this)}
                >
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
                  {t('Reset')}
                </div>
              )}
              {this.state.markerMap.map((m, i) => {
                let markerItemClass = 'map-marker-item '
                if (this.state.filteredByMarker) {
                  markerItemClass += this.state.filteredByMarker.includes(m.id.toString()) ? 'selected' : 'unselected'
                }
<<<<<<< HEAD
<<<<<<<< HEAD:jsapp/js/components/map/map.js
                const label = m.labels ? m.labels[langIndex] : m.value ? m.value : t('not set')
                let index = i
                if (colorSet !== undefined && colorSet !== 'a') {
                  index = this.calculateIconIndex(index, this.state.markerMap)
========
                const markerLabel = m.labels
                  ? m.labels[langIndex]
                  : m.value
                  ? m.value
                  : t('not set');
                let index: number | '-novalue' = i;
                if (colorSet !== undefined && colorSet !== 'a' && this.state.markerMap) {
                  index = this.calculateIconIndex(index, this.state.markerMap);
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
=======
                const markerLabel = m.labels ? m.labels[langIndex] : m.value ? m.value : t('not set')
                let index: number | IconNoValue = i
                if (colorSet !== undefined && colorSet !== 'a' && this.state.markerMap) {
                  index = this.calculateIconIndex(index, this.state.markerMap)
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
                }

                let markerItemSpanClass = ''
                if (typeof index === 'number') {
                  markerItemSpanClass = `map-marker-${colorSet}${index + 1}`
                }

                return (
                  <div key={`m-${i}`} className={markerItemClass}>
<<<<<<< HEAD
<<<<<<<< HEAD:jsapp/js/components/map/map.js
                    <span className={`map-marker map-marker-${colorSet}${index + 1}`}>{m.count}</span>
                    <span className={'map-marker-label'} onClick={this.filterByMarker} data-id={m.id} title={label}>
                      {label}
========
                    <span className={`map-marker ${markerItemSpanClass}`}>
                      {m.count}
                    </span>
=======
                    <span className={`map-marker ${markerItemSpanClass}`}>{m.count}</span>
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)

                    <span
                      className={'map-marker-label'}
                      onClick={() => {
                        this.filterByMarker(m.id)
                      }}
                      title={markerLabel}
                    >
                      {markerLabel}
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
                    </span>
                  </div>
                )
              })}
            </div>
            <div className='maplist-legend' onClick={this.toggleLegend.bind(this)}>
<<<<<<< HEAD
              <i
                className={cx(
                  'k-icon',
                  this.state.showExpandedLegend ? 'k-icon-angle-down' : 'k-icon-angle-up',
                )}
              />{' '}
=======
              <i className={cx('k-icon', this.state.showExpandedLegend ? 'k-icon-angle-down' : 'k-icon-angle-up')} />{' '}
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
              {t('Legend')}
            </div>
          </bem.FormView__mapList>
        )}
        {!this.state.markers && !this.state.heatmap && <LoadingSpinner message={false} />}
        {this.state.showMapSettings && (
          <Modal open onClose={this.toggleMapSettings.bind(this)} title={t('Map Settings')}>
            <MapSettings
              asset={this.props.asset}
              toggleMapSettings={this.toggleMapSettings.bind(this)}
              overrideStyles={this.overrideStyles.bind(this)}
              overridenStyles={this.state.overridenStyles}
            />
          </Modal>
        )}

        <div id='data-map' />
      </bem.FormView>
    )
  }
}

<<<<<<< HEAD
<<<<<<<< HEAD:jsapp/js/components/map/map.js
reactMixin(FormMap.prototype, Reflux.ListenerMixin)

export default withRouter(FormMap)
========
export default withRouter(FormMap);
>>>>>>>> 72a264fd6 (WIP migrating map to TS):jsapp/js/components/map/map.tsx
=======
export default withRouter(FormMap)
>>>>>>> 8a147c543 (run biome on jsapp/js/components/map files)
