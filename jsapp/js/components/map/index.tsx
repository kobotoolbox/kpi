// Leaflet
// TODO: use something diifferent than leaflet-omnivore as it is not maintained
// and last realease was 8(!) years ago.
import omnivore, { type OmnivoreFunction } from '@mapbox/leaflet-omnivore'
import cx from 'classnames'
import JSZip from 'jszip'
import L, { type LayerGroup } from 'leaflet'
// Libraries
import React from 'react'
import bem from '../../../js/bem'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import { check } from '@placemarkio/check-geojson'

import CenteredMessage from '../../../js/components/common/centeredMessage.component'
import LoadingSpinner from '../../../js/components/common/loadingSpinner'
import Modal from '../../../js/components/common/modal'
// Partial components
import PopoverMenu from '../../../js/popoverMenu'
import MapSettings from './MapSettings'

import { actions } from '../../../js/actions'
import { getRowName, getSurveyFlatPaths } from '../../../js/assetUtils'
// Stores, hooks and utilities
import { dataInterface } from '../../../js/dataInterface'
import pageState from '../../../js/pageState.store'
import { type WithRouterProps, withRouter } from '../../../js/router/legacy'
import { checkLatLng, notify, recordKeys } from '../../../js/utils'

// Constants and types
import { ASSET_FILE_TYPES, MODAL_TYPES, QUERY_LIMIT_DEFAULT, QUESTION_TYPES } from '../../../js/constants'
import type {
  AssetFileResponse,
  AssetMapStyles,
  AssetResponse,
  FailResponse,
  PaginatedResponse,
  SubmissionResponse,
  SurveyChoice,
  SurveyRow,
} from '../../../js/dataInterface'

// Styles
import './map.scss'
import './map.marker-colors.scss'
import { fetchGetUrl } from '../../../js/api'

const STREETS_LAYER = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  subdomains: ['a', 'b', 'c'],
})

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

type IconNoValue = '-novalue'

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
    // This is coming from the external file, so we should expect anything
    properties: { [key: string]: any }
  }
  _icon: HTMLImageElement
  options: LayerOptionsExtended
}

interface LayerOptionsExtended extends L.LayerOptions {
  typeId: number
}

interface FeatureGroupExtended extends L.FeatureGroup {
  eachLayer: (fn: (layer: LayerExtended) => void, context?: any) => this
}

type MarkerMap = Array<{
  count: number
  id: number
  labels: Array<string | null> | undefined
  value: string | undefined
}>

type MapValueCounts = Record<string, { count: number; id: number }>

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
  // Note: In case 2 of requestData(), we have a situation where a selected question exists without updating
  // overridenStyles. It is much easier to pass the selected question like this than doing some hack with AssetMapStyles
  foundSelectedQuestion: string | null
}

class FormMap extends React.Component<FormMapProps, FormMapState> {
  controls: CustomLayerControl = L.control.layers(BASE_LAYERS) as CustomLayerControl

  private unlisteners: Function[] = []

  constructor(props: FormMapProps) {
    super(props)

    const survey = props.asset.content?.survey || []
    const hasGeoPoint = survey.some((row) => row.type === QUESTION_TYPES.geopoint.id)

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
      foundSelectedQuestion: null,
    }
  }

  componentWillUnmount() {
    if (this.state.map) {
      this.state.map.remove()
    }
    this.unlisteners.forEach((clb) => clb())
  }

  componentDidMount() {
    const fields: SurveyRow[] = []
    const fieldTypes = ['select_one', 'select_multiple', 'integer', 'decimal', 'text']
    this.props.asset.content?.survey?.forEach((q) => {
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
          'By default map is limited to the ##number##  most recent submissions for performance reasons. Go to map settings to increase this limit.',
        ).replace('##number##', QUERY_LIMIT_DEFAULT.toString()),
      )
    }

    this.requestData(map, this.props.viewby)
    this.unlisteners.push(
      actions.map.setMapStyles.started.listen(this.onSetMapStylesStarted.bind(this)),
      actions.map.setMapStyles.completed.listen(this.onSetMapStylesCompleted.bind(this)),
      actions.resources.getAssetFiles.completed.listen(this.onGetAssetFiles.bind(this)),
    )

    actions.resources.getAssetFiles(this.props.asset.uid, ASSET_FILE_TYPES.map_layer.id)
  }

  loadOverlayLayers() {
    dataInterface.getAssetFiles(this.props.asset.uid, ASSET_FILE_TYPES.map_layer.id).done(() => {})
  }

  onGetAssetFiles(data: PaginatedResponse<AssetFileResponse>) {
    this.removeUnknownLayers(data.results)
    this.addNewLayers(data.results)
  }

  /**
   * Removes layers from controls if they are no longer in asset files
   */
  removeUnknownLayers(files: AssetFileResponse[]) {
    this.controls._layers.forEach((controlLayer) => {
      if (controlLayer.overlay) {
        const layerMatch = files.filter((file) => file.description === controlLayer.name)
        if (!layerMatch.length) {
          this.controls.removeLayer(controlLayer.layer)
          this.state.map?.removeLayer(controlLayer.layer)
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

      // Step 2. Ensure the layer is not already loaded
      const hasLayer = this.controls._layers.some((controlLayer) => controlLayer.name === layer.description)
      if (hasLayer) {
        return
      }

      // Step 3: Identify omnivore function to be used
      let overlayLayer: LayerGroup | undefined
      let omnivoreFn: OmnivoreFunction | undefined
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
            .then((zip) => zip.file('doc.kml')?.async('string'))
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

      // Step 4: If this wasn't a special case, `omnivoreFn` should be ready to be used here, `onOmnivoreLayerReady`
      // function handles the rest
      if (omnivoreFn) {
        overlayLayer = omnivoreFn(layer.content)
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
    this.setState({ overridenStyles: undefined })
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

    // Map cannot actually show more than one question at a time, so we must always have a question specified.
    // The list below describes the priority to find the question:
    let selectedQuestion: string | null = null
    if (this.state.overridenStyles?.selectedQuestion) {
      // 1. If the user has selected a question themselves but has not refreshed, the state will hold the "overriden"
      //    selected question. We should use this first.
      selectedQuestion = this.state.overridenStyles.selectedQuestion
    } else if (this.props.asset.map_styles.selectedQuestion) {
      // 2. If the user has selected a question before (at any point), the `map_styles` value of the asset is patched
      //    and we should use this if it exists. Will happen on every refresh if the user has ever selected a question
      selectedQuestion = this.props.asset.map_styles.selectedQuestion
    } else if (this.props.asset.content?.survey) {
      // 3. If the user has never selected a question before, a "default" needs to be selected. Since after DEV-1446 we
      //    don't use `_geolocation`, the frontend has to find the first geopoint question and set it as the default
      //    regardless of if that question is answered.
      const firstGeopoint = this.props.asset.content.survey.find(
        (question) => question.type && question.type === 'geopoint',
      )
      if (firstGeopoint) {
        selectedQuestion = getRowName(firstGeopoint)
      } else {
        // This should only happen if the form has no geopoint questions at all
        selectedQuestion = null
      }
    } else {
      // We should never reach here if this component is given the survey correctly
      selectedQuestion = null
    }

    this.setState({ foundSelectedQuestion: selectedQuestion })

    let queryLimit = QUERY_LIMIT_DEFAULT
    if (this.state.overridenStyles?.querylimit) {
      queryLimit = Number.parseInt(this.state.overridenStyles.querylimit)
    } else if (this.props.asset.map_styles.querylimit) {
      queryLimit = Number.parseInt(this.props.asset.map_styles.querylimit)
    }

    const fq = ['_id']
    if (selectedQuestion) {
      fq.push(selectedQuestion)
    }
    if (nextViewBy) {
      fq.push(this.nameOfFieldInGroup(nextViewBy))
    }
    const sort = [{ id: '_id', desc: true }]
    dataInterface
      .getSubmissions(this.props.asset.uid, queryLimit, 0, sort, fq)
      .done((data: PaginatedResponse<SubmissionResponse>) => {
        const results = data.results
        this.setState({ submissions: results }, () => {
          this.buildMarkers(map)
          this.buildHeatMap(map)
        })
      })
      .fail((error: FailResponse) => {
        if (error.responseText) {
          this.setState({ error: error.responseText })
        } else if (error.statusText) {
          this.setState({ error: error.statusText })
        } else {
          this.setState({
            error: t('Error: could not load data.'),
          })
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
    let colorSet
    if (this.state.overridenStyles?.colorSet) {
      colorSet = this.state.overridenStyles.colorSet
    } else {
      const ms = this.props.asset.map_styles
      colorSet = ms.colorSet ? ms.colorSet : undefined
    }

    return colorSet
  }

  buildMarkers(map: L.Map) {
    const prepPoints: L.Marker[] = []
    const viewby = this.props.viewby || undefined
    const colorSet = this.calcColorSet()
    let currentQuestionChoices: SurveyChoice[] = []
    let mapMarkers: MapValueCounts = {}
    let mM: MarkerMap = []

    if (viewby) {
      mapMarkers = this.prepFilteredMarkers(this.state.submissions, this.props.viewby)
      const choices = this.props.asset.content?.choices || []
      const survey = this.props.asset.content?.survey || []

      const question = survey.find((s) => s.name === viewby || s.$autoname === viewby)

      if (question && question.type === 'select_one') {
        currentQuestionChoices = choices.filter((ch) => ch.list_name === question.select_from_list_name)
      }

      recordKeys(mapMarkers).map((m) => {
        let choice
        if (question && question.type === 'select_one') {
          choice = currentQuestionChoices.find((ch) => ch.name === m || ch.$autoname === m)
        }

        mM.push({
          count: mapMarkers[m].count,
          id: mapMarkers[m].id,
          labels: choice?.label || undefined,
          value: m !== 'undefined' ? m : undefined,
        })
      })

      if (colorSet !== undefined && colorSet !== 'a' && question && question.type === 'select_one') {
        // sort by question choice order, when using any other color set (only makes sense for select_ones)
        mM.sort((a, b) => {
          const aIndex = currentQuestionChoices.findIndex((ch) => ch.name === a.value)
          const bIndex = currentQuestionChoices.findIndex((ch) => ch.name === b.value)
          return aIndex - bIndex
        })
      } else {
        // sort by occurrence count
        mM.sort((a, b) => a.count - b.count).reverse()
      }

      // move elements with no data in submission for the disaggregated question to end of marker list
      const emptyEl = mM.find((m) => m.value === undefined)
      if (emptyEl) {
        mM = mM.filter((m) => m !== emptyEl)
        mM.push(emptyEl)
      }
      this.setState({ markerMap: mM })
    } else {
      this.setState({ markerMap: undefined })
    }

    this.state.submissions.forEach((item) => {
      let markerProps = {}

      let parsedCoordinates: string[] = []
      // Safe to cast `null` as a string here as this will result in Array['undefined'] if there are no geopoint submissions
      parsedCoordinates = String(item[this.state.foundSelectedQuestion as string]).split(' ')

      if (this.state.foundSelectedQuestion && checkLatLng(parsedCoordinates)) {
        if (viewby && mM) {
          const vb = this.nameOfFieldInGroup(viewby)
          const itemId = String(item[vb])
          let index: number | IconNoValue = mM.findIndex((m) => m.value === itemId)

          // spread indexes to use full colorset gamut if necessary
          if (colorSet !== undefined && colorSet !== 'a') {
            index = this.calculateIconIndex(index, mM)
          }

          // Previously it was possible that `'-novalue' + 1` would happen resulting in code not knowing what to do.
          // I've changed it to default to 1 in case `index` is not a number.
          let iconNumber = 1
          if (typeof index === 'number') {
            iconNumber = index + 1
          }

          markerProps = {
            icon: this.buildIcon(iconNumber),
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

        if (!!parsedCoordinates.length) {
          prepPoints.push(
            L.marker([Number.parseFloat(parsedCoordinates[0]), Number.parseFloat(parsedCoordinates[1])], markerProps),
          )
        }
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
          iconCreateFunction: (cluster) => {
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
            })
            return divIcon
          },
        })

        markers.addLayers(prepPoints)
      }

      markers.on('click', this.launchSubmissionModal.bind(this)).addTo(map)

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
      this.setState({ error: t('Error: could not load data.') })
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

  buildIcon(index: number | boolean = false) {
    const colorSet = this.calcColorSet() || 'a'
    const iconClass = index ? `map-marker-${colorSet}${index}` : 'map-marker-a'

    return L.divIcon({
      className: `map-marker ${iconClass}`,
      iconSize: [20, 20],
    })
  }

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
        markerMap[subResponseValue]['count'] += 1
      }
    })

    return markerMap
  }

  buildHeatMap(map: L.Map) {
    const heatmapPoints: Array<[number, number, number]> = []
    this.state.submissions.forEach((item) => {
      let parsedCoordinates: string[] = []
      parsedCoordinates = String(item[this.state.foundSelectedQuestion as string]).split(' ')

      if (this.state.foundSelectedQuestion && checkLatLng(parsedCoordinates)) {
        if (!!parsedCoordinates.length) {
          heatmapPoints.push([Number.parseFloat(parsedCoordinates[0]), Number.parseFloat(parsedCoordinates[1]), 1])
        }
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
    if (this.state.map && this.state.markers) {
      this.state.map.addLayer(this.state.markers)
    }
    if (this.state.map && this.state.heatmap) {
      this.state.map.removeLayer(this.state.heatmap)
    }
    this.setState({
      markersVisible: true,
    })
  }

  showLayerControls() {
    this.controls.expand()
  }

  showHeatmap() {
    const map = this.state.map

    if (map && this.state.heatmap) {
      map.addLayer(this.state.heatmap)
    }
    if (map && this.state.markers) {
      map.removeLayer(this.state.markers)
    }
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

    const name = evt.currentTarget.getAttribute('data-name') || undefined
    if (name !== undefined) {
      this.props.router.navigate(`/forms/${this.props.asset.uid}/data/map/${name}`)
    } else {
      this.props.router.navigate(`/forms/${this.props.asset.uid}/data/map`)
    }
  }

  filterLanguage(evt: React.TouchEvent<HTMLAnchorElement>) {
    const dataIndexAttr = evt.currentTarget.getAttribute('data-index')
    if (dataIndexAttr !== null) {
      this.setState({ langIndex: Number.parseInt(dataIndexAttr) })
    }
  }

  static getDerivedStateFromProps(props: FormMapProps, state: FormMapState) {
    const newState: Partial<FormMapState> = {
      previousViewby: props.viewby,
    }
    if (props.viewby !== undefined) {
      newState.markersVisible = true
    }
    if (state.previousViewby !== props.viewby) {
      newState.filteredByMarker = undefined
      newState.componentRefreshed = true
    }
    return newState
  }

  componentDidUpdate(prevProps: FormMapProps) {
    if (prevProps.viewby !== this.props.viewby) {
      const map = this.refreshMap()
      if (map) {
        this.requestData(map, this.props.viewby)
      }
    }
  }

  refreshMap() {
    const map = this.state.map
    if (map && this.state.markers) {
      map.removeLayer(this.state.markers)
    }
    if (map && this.state.heatmap) {
      map.removeLayer(this.state.heatmap)
    }
    return map
  }

  launchSubmissionModal(evt: L.LeafletMouseEvent) {
    const td = this.state.submissions
    const ids: number[] = []
    td.forEach((r) => {
      ids.push(r._id)
    })

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

  /** Note: selected questions are considered a "map style" and is updated in the state here */
  overrideStyles(mapStyles: AssetMapStyles) {
    this.setState(
      {
        filteredByMarker: undefined,
        componentRefreshed: true,
        overridenStyles: mapStyles,
      },
      () => {
        const map = this.refreshMap()

        if (map) {
          this.requestData(map, this.props.viewby)
        }
      },
    )
  }

  toggleFullscreen() {
    this.setState({ isFullscreen: !this.state.isFullscreen }, () => {
      this.state.map?.invalidateSize()
    })
  }

  toggleLegend() {
    this.setState({
      showExpandedLegend: !this.state.showExpandedLegend,
    })
  }

  filterByMarker(markerId: number) {
    const id = String(markerId)
    const markers = this.state.markers
    let filteredByMarker = this.state.filteredByMarker
    const unselectedClass = 'unselected'

    if (!filteredByMarker) {
      filteredByMarker = [id]
    } else if (filteredByMarker.includes(id)) {
      filteredByMarker = filteredByMarker.filter((l) => l !== id)
    } else {
      filteredByMarker.push(id)
    }

    this.setState({ filteredByMarker: filteredByMarker })
    markers?.eachLayer((layer) => {
      if (filteredByMarker.includes(layer.options.typeId.toString())) {
        layer._icon.classList.remove(unselectedClass)
      } else {
        layer._icon.classList.add(unselectedClass)
      }
    })
  }

  resetFilterByMarker() {
    const markers = this.state.markers
    this.setState({ filteredByMarker: undefined })
    markers?.eachLayer((layer) => {
      layer._icon.classList.remove('unselected')
    })
  }

  nameOfFieldInGroup(fieldName: string): string {
    if (this.props.asset.content?.survey) {
      const flatPaths = getSurveyFlatPaths(this.props.asset.content.survey)
      return flatPaths[fieldName]
    }
    // Fallback - should never happen
    return fieldName
  }

  render() {
    if (this.state.error) {
      return (
        <bem.FormView m='ui-panel'>
          <CenteredMessage message={this.state.error} />
        </bem.FormView>
      )
    }

    const fields = this.state.fields
    const langIndex = this.state.langIndex
    let langs: Array<string | null> = []
    if (this.props.asset.content?.translations && this.props.asset.content?.translations.length > 1) {
      langs = this.props.asset.content.translations
    }
    const viewby = this.props.viewby

    const colorSet = this.calcColorSet() || 'a'
    let label = t('Disaggregate by survey responses')

    if (viewby) {
      fields.forEach((f) => {
        if (viewby === f.name || viewby === f.$autoname) {
          label = `${t('Disaggregated using:')} ${f.label?.[langIndex]}`
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
        <bem.FormView__mapButton m={'layers'} onClick={this.showLayerControls.bind(this)} data-tip={t('Toggle layers')}>
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
              onClick={this.filterMap.bind(this)}
              className={viewby ? 'see-all' : 'active see-all'}
            >
              {t('-- See all data --')}
            </bem.PopoverMenu__link>
            {fields.map((f) => {
              const name = f.name || f.$autoname
              const fieldLabel = f.label ? (
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
                <div
                  key='m-reset'
                  className='map-marker-item map-marker-reset'
                  onClick={this.resetFilterByMarker.bind(this)}
                >
                  {t('Reset')}
                </div>
              )}
              {this.state.markerMap.map((m, i) => {
                let markerItemClass = 'map-marker-item '
                if (this.state.filteredByMarker) {
                  markerItemClass += this.state.filteredByMarker.includes(m.id.toString()) ? 'selected' : 'unselected'
                }
                let markerLabel = m.labels ? m.labels[langIndex] : m.value
                if (!markerLabel) {
                  markerLabel = t('not set')
                }
                let index: number | IconNoValue = i
                if (colorSet !== undefined && colorSet !== 'a' && this.state.markerMap) {
                  index = this.calculateIconIndex(index, this.state.markerMap)
                }

                let markerItemSpanClass = ''
                if (typeof index === 'number') {
                  markerItemSpanClass = `map-marker-${colorSet}${index + 1}`
                }

                return (
                  <div key={`m-${i}`} className={markerItemClass}>
                    <span className={`map-marker ${markerItemSpanClass}`}>{m.count}</span>

                    <span
                      className={'map-marker-label'}
                      onClick={() => {
                        this.filterByMarker(m.id)
                      }}
                      title={markerLabel}
                    >
                      {markerLabel}
                    </span>
                  </div>
                )
              })}
            </div>
            <div className='maplist-legend' onClick={this.toggleLegend.bind(this)}>
              <i className={cx('k-icon', this.state.showExpandedLegend ? 'k-icon-angle-down' : 'k-icon-angle-up')} />{' '}
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

export default withRouter(FormMap)
