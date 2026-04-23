import { Dialog, Menu, type TooltipProps } from '@mantine/core'
// Leaflet
// TODO: use something diifferent than leaflet-omnivore as it is not maintained
// and last realease was 8(!) years ago.
import omnivore, { type OmnivoreFunction } from '@mapbox/leaflet-omnivore'
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

import ActionIcon from '../../../js/components/common/ActionIcon'
import ButtonNew from '../../../js/components/common/ButtonNew'
import CenteredMessage from '../../../js/components/common/centeredMessage.component'
import Modal from '../../../js/components/common/modal'
// Partial components
import MapSettings from './MapSettings'

import { actions } from '../../../js/actions'
import { getRowName, getSurveyFlatPaths } from '../../../js/assetUtils'
// Stores, hooks and utilities
import { dataInterface } from '../../../js/dataInterface'
import pageState from '../../../js/pageState.store'
import { type WithRouterProps, withRouter } from '../../../js/router/legacy'
import { findFirstGeopoint, notify, parseLatLng, recordKeys } from '../../../js/utils'

// Constants and types
import { ASSET_FILE_TYPES, MODAL_TYPES, QUERY_LIMIT_DEFAULT, QUESTION_TYPES } from '../../../js/constants'
import type {
  AssetFileResponse,
  AssetMapStyles,
  AssetResponse,
  PaginatedResponse,
  SurveyChoice,
  SurveyRow,
} from '../../../js/dataInterface'

// Styles
import './map.scss'
import './map.marker-colors.scss'
import type { DataResponse } from '#/api/models/dataResponse'
import { fetchGetUrl } from '../../../js/api'

const SUBMISSIONS_PER_PAGE = 1000
const MAX_SUBMISSIONS = 30 * SUBMISSIONS_PER_PAGE // Don't want more than 30 parallel queries

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
  pageCount: number
  setPageCount: Function
  isLoading: boolean
  allData: DataResponse[]
  setFields: Function
  totalCount: number | undefined
}

interface FormMapState {
  map: L.Map | undefined
  markers: FeatureGroupExtended | undefined
  heatmap: L.HeatLayer | undefined
  markersVisible: boolean
  markerMap?: MarkerMap
  fields: SurveyRow[]
  hasGeoPoint: boolean
  error: string | undefined
  isFullscreen: boolean
  showExpandedLegend: boolean
  langIndex: number
  filteredByMarker: string[] | undefined
  componentRefreshed: boolean
  showMapSettings: boolean
  overridenStyles?: AssetMapStyles
  noData: boolean
  previousViewby?: string
  // Note: In case 2 of createDataQuery(), we have a situation where a selected question exists without updating
  // overridenStyles. It is much easier to pass the selected question like this than doing some hack with AssetMapStyles
  foundSelectedQuestion: string | null
}

class FormMap extends React.Component<FormMapProps, FormMapState> {
  controls: CustomLayerControl = L.control.layers(BASE_LAYERS) as CustomLayerControl
  private legendControlRef = React.createRef<HTMLDivElement>()
  private readonly onViewportChange = () => {
    this.forceUpdate()
  }

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
      error: undefined,
      isFullscreen: false,
      showExpandedLegend: true,
      langIndex: 0,
      filteredByMarker: undefined,
      componentRefreshed: false,
      showMapSettings: false,
      overridenStyles: undefined,
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

    this.createDataQuery(this.props.viewby)
    this.rebuildMapLayers(map)
    this.unlisteners.push(
      actions.map.setMapStyles.started.listen(this.onSetMapStylesStarted.bind(this)),
      actions.map.setMapStyles.completed.listen(this.onSetMapStylesCompleted.bind(this)),
      actions.resources.getAssetFiles.completed.listen(this.onGetAssetFiles.bind(this)),
    )
    window.addEventListener('resize', this.onViewportChange)
    window.addEventListener('scroll', this.onViewportChange, true)
    this.unlisteners.push(
      () => window.removeEventListener('resize', this.onViewportChange),
      () => window.removeEventListener('scroll', this.onViewportChange, true),
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

  getQueryLimit() {
    // If totalCount hasn't populated yet, return 1000 (one page of submissions)
    if (this.props.totalCount === undefined) {
      return QUERY_LIMIT_DEFAULT
    }
    // If the user has more than 30,000 submissions, display 30,000 as the max anyways
    const userMaxPages = Math.ceil(this.props.totalCount / SUBMISSIONS_PER_PAGE) * SUBMISSIONS_PER_PAGE
    const MaxPages = Math.ceil(MAX_SUBMISSIONS / SUBMISSIONS_PER_PAGE) * SUBMISSIONS_PER_PAGE
    return Math.min(userMaxPages, MaxPages)
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

  updateWrapperQuery(selectedQuestion: string | null, nextViewBy: string, pageLimit: number) {
    const fq = ['_id']
    if (selectedQuestion) {
      fq.push(selectedQuestion)
    }
    if (nextViewBy) {
      fq.push(this.nameOfFieldInGroup(nextViewBy))
    }
    this.props.setPageCount(pageLimit)
    this.props.setFields(JSON.stringify(fq))
  }

  /**
   * Updates the wrapper with new query params in the following sequence:
   * 1. Check if the selectedQuestion is updated
   * 2. Compute the amount of pages to request
   * 3. If there is a disaggregation, add the disaggregated question to the query
   * 4. Send all the changes up to the wrapper
   */
  createDataQuery(nextViewBy = '') {
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
      const firstGeopoint = findFirstGeopoint(this.props.asset.content.survey)

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

    // We set the selected question in this state as well for the display in the MapSettings modal
    this.setState({ foundSelectedQuestion: selectedQuestion })

    // If totalCount hasn't populated yet, set pageLimit to 1
    if (this.props.totalCount === undefined) {
      this.updateWrapperQuery(selectedQuestion, nextViewBy, 1)
      return
    }

    let queryLimit = QUERY_LIMIT_DEFAULT
    if (this.state.overridenStyles?.querylimit) {
      queryLimit = Number.parseInt(this.state.overridenStyles.querylimit)
    } else if (this.props.asset.map_styles.querylimit) {
      queryLimit = Number.parseInt(this.props.asset.map_styles.querylimit)
    }

    // If the user has an overriden limit greater than the actual submission count, lower the limit
    const maxSubmissions = this.getQueryLimit()
    if (queryLimit > maxSubmissions) {
      queryLimit = maxSubmissions
    }

    const pageLimit = queryLimit / SUBMISSIONS_PER_PAGE

    this.updateWrapperQuery(selectedQuestion, nextViewBy, pageLimit)
  }

  rebuildMapLayers(map: L.Map) {
    this.buildMarkers(map)
    // TODO: when heat map is selected and the user refteches data (changes question or selects a disaggregation) the
    // map will rebuild and display both markers and heat map. See DEV-1960
    this.buildHeatMap(map)
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
    const submissions: DataResponse[] = this.props.allData

    if (viewby) {
      mapMarkers = this.prepFilteredMarkers(submissions, this.props.viewby)
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

    submissions.forEach((item) => {
      let markerProps = {}

      const parsedCoordinates: number[] = parseLatLng(item, this.state.foundSelectedQuestion)

      if (!!parsedCoordinates.length) {
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

        prepPoints.push(L.marker([parsedCoordinates[0], parsedCoordinates[1]], markerProps))
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

      if (prepPoints.length === 0) {
        map.fitBounds([[42.373, -71.124]])
        this.setState({ noData: true })
      } else {
        // Note: this is a bit confusing. For some reason (possibly performance related), we didn't want the map to
        // reset the zoom when switching between disaggregated questions. This is the reason for the first two guards.
        // The last condition is only possible if we are coming from having no points to having points in the same page,
        // i.e., we are done waiting for the `allData` prop to populate. We can then reset the zoom once.
        const shouldFitBounds = !viewby || !this.state.componentRefreshed || this.state.noData
        if (shouldFitBounds) {
          map.fitBounds(markers.getBounds())
        }
        this.setState({ noData: false })
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

  prepFilteredMarkers(data: DataResponse[], viewby: string): MapValueCounts {
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
    const submissions: DataResponse[] = this.props.allData
    submissions.forEach((item) => {
      const parsedCoordinates: number[] = parseLatLng(item, this.state.foundSelectedQuestion)
      if (!!parsedCoordinates.length) {
        heatmapPoints.push([parsedCoordinates[0], parsedCoordinates[1], 1])
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
    const layersContainer = this.controls.getContainer()
    const isExpanded = layersContainer?.classList.contains('leaflet-control-layers-expanded')

    if (isExpanded) {
      this.controls.collapse()
    } else {
      this.controls.expand()
    }
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

  filterMap(name?: string) {
    if (name !== undefined) {
      this.props.router.navigate(`/forms/${this.props.asset.uid}/data/map/${name}`)
    } else {
      this.props.router.navigate(`/forms/${this.props.asset.uid}/data/map`)
    }
  }

  filterLanguage(langIndex: number) {
    this.setState({ langIndex: langIndex })
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
    const totalCountPopulated = prevProps.totalCount === undefined && this.props.totalCount !== undefined
    const dataChanged =
      (prevProps.allData !== this.props.allData || prevProps.pageCount !== this.props.pageCount) &&
      this.props.allData.length > 0
    const viewbyChanged = prevProps.viewby !== this.props.viewby

    // We get the first page of results in order to get the total count, then we call createDataQuery again to update
    // the maximum queryLimit based on the amount of submissions the project has
    if (totalCountPopulated) {
      this.createDataQuery(this.props.viewby)
    }

    if (dataChanged && !viewbyChanged) {
      if (!this.state.foundSelectedQuestion) {
        this.createDataQuery()
      }
      this.refreshMapLayers()
    } else if (viewbyChanged) {
      this.createDataQuery(this.props.viewby)
      this.refreshMapLayers()
    }
  }

  refreshMapLayers() {
    const map = this.removeOldMapLayers()
    if (map) {
      this.rebuildMapLayers(map)
    }
  }

  /**
   * If map needs to display a new set of markers, either from changing the question or selecting a disaggregation, we
   * need to remove the old markers and return an empty map to be populated.
   */
  removeOldMapLayers() {
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
    const td = this.props.allData
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
        this.createDataQuery(this.props.viewby)
        this.refreshMapLayers()
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

    // If there exists geopoint questions at all AND the currently selected geopoint question has data
    const hasGeopointAndData = this.state.hasGeoPoint && !this.state.noData

    // Keep this value aligned with jsapp/scss/z-indexes.scss.
    // We duplicate it here because TS cannot import SCSS variables.
    const Z_MAP_SETTINGS = 700 // = $z-map-settings (default map buttons)
    const Z_MAP_SETTINGS_DISABLED = 999 // = $z-map-settings-disabled (under overlay)
    const Z_MAP_SETTINGS_OVERLAY = 1001 // = $z-map-settings-overlay (overlay layer)
    const Z_MAP_LIST = 689 // = $z-map-list (legend)
    const Z_LEGEND_DIALOG = 1000 // above map controls/layers, below legacy modal backdrop (1101)
    const Z_TOOLTIP_PORTAL = 4000 // above app overlays/modals ($z-modal is 3000)

    const mapSettingsAboveOverlay = this.state.noData && this.state.hasGeoPoint
    const mapActionsStyle: React.CSSProperties = {
      position: 'absolute',
      top: '12px',
      right: '12px',
      zIndex: hasGeopointAndData ? Z_MAP_SETTINGS : Z_MAP_SETTINGS_DISABLED,
      display: 'grid',
      gridTemplateColumns: 'repeat(3, auto)',
      gridTemplateRows: 'repeat(3, auto)',
      gap: '12px',
      pointerEvents: 'none',
    }

    const mapActionItemStyle: React.CSSProperties = {
      position: 'relative',
      pointerEvents: 'auto',
    }

    const mapSettingsStyle: React.CSSProperties = {
      ...mapActionItemStyle,
      // Keep map-settings above overlay when geopoint question exists but has no responses.
      zIndex: this.state.hasGeoPoint
        ? mapSettingsAboveOverlay
          ? Z_MAP_SETTINGS_OVERLAY + 1
          : Z_MAP_SETTINGS
        : Z_MAP_SETTINGS_DISABLED,
    }

    const mapTooltipProps: Partial<TooltipProps> = {
      withinPortal: true,
      // In portal + high z-index to stay above map controls and all UI overlays.
      zIndex: Z_TOOLTIP_PORTAL,
      position: 'left',
      offset: 8,
    }

    const MAP_CONTROL_GAP = 'var(--mantine-spacing-sm)'
    const MAP_MENU_OFFSET = 'calc(var(--mantine-spacing-sm) - 4px)'
    const MAP_BUTTON_HEIGHT_MD = '32px'

    const mapBottomControlsStyle: React.CSSProperties = {
      position: 'absolute',
      bottom: '15px',
      left: '15px',
      zIndex: Z_MAP_LIST,
      display: 'flex',
      flexDirection: 'column-reverse',
      gap: MAP_CONTROL_GAP,
      pointerEvents: 'none',
      alignItems: 'flex-start',
    }

    const mapBottomControlItemStyle: React.CSSProperties = {
      position: 'relative',
      pointerEvents: 'auto',
      maxWidth: '90%',
    }

    const legendControlRect = this.legendControlRef.current?.getBoundingClientRect()
    const legendDialogPosition = legendControlRect
      ? {
          left: legendControlRect.left,
          bottom: `calc(${window.innerHeight - legendControlRect.top}px + ${MAP_MENU_OFFSET})`,
        }
      : {
          left: 15,
          bottom: `calc(15px + ${MAP_BUTTON_HEIGHT_MD} + ${MAP_CONTROL_GAP} + ${MAP_BUTTON_HEIGHT_MD} + ${MAP_MENU_OFFSET})`,
        }

    return (
      <bem.FormView m={formViewModifiers}>
        <div style={mapActionsStyle}>
          <div style={{ ...mapActionItemStyle, gridColumn: 3, gridRow: 1 }}>
            <ActionIcon
              onClick={this.toggleFullscreen.bind(this)}
              tooltip={t('Toggle Fullscreen')}
              tooltipProps={mapTooltipProps}
              iconName='expand'
              size='lg'
              variant='outline'
              disabled={!hasGeopointAndData}
              aria-label={t('Toggle Fullscreen')}
            />
          </div>
          <div style={{ ...mapActionItemStyle, gridColumn: 3, gridRow: 2 }}>
            <ActionIcon
              onClick={this.showMarkers.bind(this)}
              tooltip={t('Show as points')}
              tooltipProps={mapTooltipProps}
              iconName='pins'
              size='lg'
              variant='outline'
              disabled={!hasGeopointAndData}
              aria-label={t('Show as points')}
            />
          </div>
          <div style={{ ...mapActionItemStyle, gridColumn: 2, gridRow: 1 }}>
            <ActionIcon
              onClick={this.showLayerControls.bind(this)}
              tooltip={t('Toggle layers')}
              tooltipProps={mapTooltipProps}
              iconName='layer'
              size='lg'
              variant='outline'
              disabled={!hasGeopointAndData}
              aria-label={t('Toggle layers')}
            />
          </div>
          <div style={{ ...mapSettingsStyle, gridColumn: 1, gridRow: 1 }}>
            <ActionIcon
              onClick={this.toggleMapSettings.bind(this)}
              tooltip={t('Map display settings')}
              tooltipProps={mapTooltipProps}
              iconName='settings'
              size='lg'
              variant='outline'
              disabled={!this.state.hasGeoPoint}
              aria-label={t('Map display settings')}
            />
          </div>
          {!viewby && (
            <div style={{ ...mapActionItemStyle, gridColumn: 3, gridRow: 3 }}>
              <ActionIcon
                onClick={this.showHeatmap.bind(this)}
                tooltip={t('Show as heatmap')}
                tooltipProps={mapTooltipProps}
                iconName='heatmap'
                size='lg'
                variant='outline'
                disabled={!hasGeopointAndData}
                aria-label={t('Show as heatmap')}
              />
            </div>
          )}
        </div>

        {(hasGeopointAndData || (this.state.markerMap && this.state.markersVisible)) && (
          <div style={mapBottomControlsStyle}>
            {hasGeopointAndData && (
              <div style={mapBottomControlItemStyle}>
                <Menu
                  closeOnClickOutside
                  closeOnItemClick
                  position='top-start'
                  offset={8}
                  width={240}
                  withinPortal
                  zIndex={Z_TOOLTIP_PORTAL}
                >
                  <Menu.Target>
                    <ButtonNew
                      variant='outline'
                      size='md'
                      style={{
                        minWidth: 180,
                      }}
                    >
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          padding: '5px 0',
                        }}
                      >
                        {label}
                      </span>
                    </ButtonNew>
                  </Menu.Target>

                  <Menu.Dropdown>
                    {langs.length > 1 && <Menu.Label>{t('Language')}</Menu.Label>}
                    {langs.map((l, i) => (
                      <Menu.Item
                        key={`l-${i}`}
                        onClick={() => this.filterLanguage(i)}
                        style={this.state.langIndex === i ? { fontWeight: 500 } : undefined}
                      >
                        {l ? l : t('Default')}
                      </Menu.Item>
                    ))}
                    <Menu.Divider />
                    <Menu.Item
                      key='all'
                      onClick={() => this.filterMap()}
                      style={{
                        fontWeight: viewby ? undefined : 700,
                      }}
                    >
                      {t('-- See all data --')}
                    </Menu.Item>
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
                        <Menu.Item
                          key={`f-${name}`}
                          onClick={() => this.filterMap(name)}
                          style={viewby === name ? { fontWeight: 700 } : undefined}
                        >
                          {fieldLabel}
                        </Menu.Item>
                      )
                    })}
                  </Menu.Dropdown>
                </Menu>
              </div>
            )}

            {this.state.markerMap && this.state.markersVisible && (
              <div style={mapBottomControlItemStyle} ref={this.legendControlRef}>
                <ButtonNew
                  variant='outline'
                  size='md'
                  leftIcon={this.state.showExpandedLegend ? 'angle-down' : 'angle-up'}
                  onClick={this.toggleLegend.bind(this)}
                >
                  {t('Legend')}
                </ButtonNew>

                <Dialog
                  opened={this.state.showExpandedLegend}
                  onClose={this.toggleLegend.bind(this)}
                  position={legendDialogPosition}
                  withCloseButton={false}
                  withBorder={false}
                  shadow='md'
                  radius='md'
                  p='xs'
                  classNames={{ root: 'map-legend-dialog' }}
                  withinPortal
                  zIndex={Z_LEGEND_DIALOG}
                >
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
                        markerItemClass += this.state.filteredByMarker.includes(m.id.toString())
                          ? 'selected'
                          : 'unselected'
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
                </Dialog>
              </div>
            )}
          </div>
        )}

        {this.state.noData && !this.state.hasGeoPoint && !this.props.isLoading && (
          <div className='map-transparent-background'>
            <div className='map-no-geopoint-wrapper'>
              <p className='map-no-geopoint'>{t('This project does not include geographical data.')}</p>
              <p className='map-no-geopoint'>{t('To visualize data in the map, create a "geopoint" question.')}</p>
            </div>
          </div>
        )}

        {this.state.noData && this.state.hasGeoPoint && !this.props.isLoading && (
          <div className='map-transparent-background'>
            <div className='map-no-geopoint-wrapper'>
              <p className='map-no-geopoint'>
                {t('No "geopoint" responses have been received for the selected question.')}
              </p>
            </div>
          </div>
        )}

        {this.props.isLoading && (
          <div className='map-transparent-background'>
            <div className='map-no-geopoint-wrapper'>
              <p className='map-no-geopoint'>{t('Fetching points…')}</p>
            </div>
          </div>
        )}

        {this.state.showMapSettings && (
          <Modal open onClose={this.toggleMapSettings.bind(this)} title={t('Map Settings')}>
            <MapSettings
              asset={this.props.asset}
              toggleMapSettings={this.toggleMapSettings.bind(this)}
              overrideStyles={this.overrideStyles.bind(this)}
              overridenStyles={this.state.overridenStyles}
              queryLimit={this.getQueryLimit()}
            />
          </Modal>
        )}

        <div id='data-map' />
      </bem.FormView>
    )
  }
}

export default withRouter(FormMap)
