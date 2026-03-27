// Leaflet
// TODO: use something diifferent than leaflet-omnivore as it is not maintained
// and last realease was 8(!) years ago.
import omnivore, { type OmnivoreFunction } from '@mapbox/leaflet-omnivore'
import cx from 'classnames'
import JSZip from 'jszip'
import L, { type LayerGroup } from 'leaflet'
// Libraries
import React, {useEffect, useRef, useState} from 'react'
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
import { findFirstGeopoint, notify, parseLatLng, recordKeys } from '../../../js/utils'

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

//class FormMap extends React.Component<FormMapProps, FormMapState> {
export default function FormMap(props: FormMapProps) {
  const unlisteners: Function[] = []
  const controls: CustomLayerControl = L.control.layers(BASE_LAYERS) as CustomLayerControl

  const survey = props.asset.content?.survey || []
  const hasGeoPoint = survey.some((row) => row.type === QUESTION_TYPES.geopoint.id)
  //const [state, setState] = useState<FormMapState>({
  //  map: undefined,
  //  markers: undefined,
  //  heatmap: undefined,
  //  markersVisible: true,
  //  markerMap: undefined,
  //  fields: [],
  //  hasGeoPoint: hasGeoPoint,
  //  submissions: [],
  //  error: undefined,
  //  isFullscreen: false,
  //  showExpandedLegend: true,
  //  langIndex: 0,
  //  filteredByMarker: undefined,
  //  componentRefreshed: false,
  //  showMapSettings: false,
  //  overridenStyles: undefined,
  //  clearDisaggregatedPopover: false,
  //  noData: false,
  //  foundSelectedQuestion: null,
  //})

  // Note:
  // Old "state" was acting like a global variable
  // But some things seem to need to be out of the useState hook and some seem to need to be in it.
  // foundSelectedQuestion doesn't work in a useState hook and therefor no points exist on the map unless it is updated
  // in this kind of variable
  // toggleFullscreen doesn't work when it is updated in this variable and needs to be updated in a useState hook
  let vars: FormMapState = {
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

  useEffect(() => {
      const fields: SurveyRow[] = []
      const fieldTypes = ['select_one', 'select_multiple', 'integer', 'decimal', 'text']
      props.asset.content?.survey?.forEach((q) => {
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

      //setState({
      //  ...state,
      //  map: map,
      //  fields: fields,
      //})
      vars.map = map
      vars.fields = fields

      if (props.asset.deployment__submission_count > QUERY_LIMIT_DEFAULT) {
        notify(
          t(
            'By default map is limited to the ##number##  most recent submissions for performance reasons. Go to map settings to increase this limit.',
          ).replace('##number##', QUERY_LIMIT_DEFAULT.toString()),
        )
      }

      requestData(map, props.viewby)
      unlisteners.push(
        actions.map.setMapStyles.started.listen(onSetMapStylesStarted),
        actions.map.setMapStyles.completed.listen(onSetMapStylesCompleted),
        actions.resources.getAssetFiles.completed.listen(onGetAssetFiles),
      )

      actions.resources.getAssetFiles(props.asset.uid, ASSET_FILE_TYPES.map_layer.id)

      //return () => {
      //  if (state.map) {
      //    state.map.remove()
      //  }
      //  unlisteners.forEach((clb) => clb())
      //}
  }, [])

  dataInterface.getAssetFiles(props.asset.uid, ASSET_FILE_TYPES.map_layer.id).done(() => {})

  const onGetAssetFiles = (data: PaginatedResponse<AssetFileResponse>) => {
    removeUnknownLayers(data.results)
    addNewLayers(data.results)
  }

  /**
   * Removes layers from controls if they are no longer in asset files
   */
  const removeUnknownLayers = (files: AssetFileResponse[]) => {
    controls._layers.forEach((controlLayer) => {
      if (controlLayer.overlay) {
        const layerMatch = files.filter((file) => file.description === controlLayer.name)
        if (!layerMatch.length) {
          controls.removeLayer(controlLayer.layer)
          vars.map?.removeLayer(controlLayer.layer)
        }
      }
    })
  }

  /**
   * Adds new layers to controls (if they haven't been added already)
   */
  const addNewLayers = (files: AssetFileResponse[]) => {
    files.forEach((layer) => {
      // Step 1. Verify file type is ok - we are only interested in files that are map layers
      if (layer.file_type !== 'map_layer') {
        return
      }

      // Step 2. Ensure the layer is not already loaded
      const hasLayer = controls._layers.some((controlLayer) => controlLayer.name === layer.description)
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
                      onOmnivoreLayerReady(overlayLayer, layer.description)
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
              if (kmlContent && vars.map) {
                // We don't need to react to `.on('ready')` here, as KML file is already loaded and we just need to
                // parse it (works synchronously)
                const parsedOverlayLayer = omnivore.kml.parse(kmlContent)
                onOmnivoreLayerReady(parsedOverlayLayer, layer.description)
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
            onOmnivoreLayerReady(overlayLayer, layer.description)
          })
      }
    })
  }

  /**
   * Handle map layer successfully loaded by omnivore.
   */
  const onOmnivoreLayerReady = (overlayLayer: LayerGroup | undefined, description: string) => {
    if (overlayLayer && vars.map) {
      controls.addOverlay(overlayLayer, description)
      overlayLayer.addTo(vars.map)

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

  const onSetMapStylesCompleted = () => {
    // asset is updated, no need to store oberriden styles as they are identical
    //setState({ ...state, overridenStyles: undefined })
    vars.overridenStyles = undefined
  }

  /**
   * We don't want to wait for the asset (`asset.map_styles`) to be updated
   * we use the settings being saved and fetch data with them
   */
  const onSetMapStylesStarted = (_assetUid: string, upcomingMapSettings: AssetMapStyles) => {
    if (!upcomingMapSettings.colorSet) {
      upcomingMapSettings.colorSet = 'a'
    }

    if (!upcomingMapSettings.querylimit) {
      upcomingMapSettings.querylimit = QUERY_LIMIT_DEFAULT.toString()
    }

    overrideStyles(upcomingMapSettings)
  }

  const requestData = (map: L.Map, nextViewBy = '') => {
    // TODO: support area / line geodata questions
    // See: https://github.com/kobotoolbox/kpi/issues/3913

    // Map cannot actually show more than one question at a time, so we must always have a question specified.
    // The list below describes the priority to find the question:
    let selectedQuestion: string | null = null
    if (vars.overridenStyles?.selectedQuestion) {
      // 1. If the user has selected a question themselves but has not refreshed, the state will hold the "overriden"
      //    selected question. We should use this first.
      selectedQuestion = vars.overridenStyles.selectedQuestion
    } else if (props.asset.map_styles.selectedQuestion) {
      // 2. If the user has selected a question before (at any point), the `map_styles` value of the asset is patched
      //    and we should use this if it exists. Will happen on every refresh if the user has ever selected a question
      selectedQuestion = props.asset.map_styles.selectedQuestion
    } else if (props.asset.content?.survey) {
      // 3. If the user has never selected a question before, a "default" needs to be selected. Since after DEV-1446 we
      //    don't use `_geolocation`, the frontend has to find the first geopoint question and set it as the default
      //    regardless of if that question is answered.
      const firstGeopoint = findFirstGeopoint(props.asset.content.survey)

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

    //setState({ ...state, foundSelectedQuestion: selectedQuestion })
    vars.foundSelectedQuestion = selectedQuestion

    let queryLimit = QUERY_LIMIT_DEFAULT
    if (vars.overridenStyles?.querylimit) {
      queryLimit = Number.parseInt(vars.overridenStyles.querylimit)
    } else if (props.asset.map_styles.querylimit) {
      queryLimit = Number.parseInt(props.asset.map_styles.querylimit)
    }

    const fq = ['_id']
    if (selectedQuestion) {
      fq.push(selectedQuestion)
    }
    if (nextViewBy) {
      fq.push(nameOfFieldInGroup(nextViewBy))
    }
    const sort = [{ id: '_id', desc: true }]
    dataInterface
      .getSubmissions(props.asset.uid, queryLimit, 0, sort, fq)
      .done((data: PaginatedResponse<SubmissionResponse>) => {
        const results = data.results
        //setState({ ...state, submissions: results })
        vars.submissions = results
        buildMarkers(map, results)
        buildHeatMap(map, results)
      })
      .fail((error: FailResponse) => {
        if (error.responseText) {
          //setState({ ...state, error: error.responseText })
          vars.error = error.responseText
        } else if (error.statusText) {
          //setState({ ...state, error: error.statusText })
          vars.error = error.statusText
        } else {
          //setState({
          //  ...state,
          //  error: t('Error: could not load data.'),
          //})
          vars.error = t('Error: could not load data.')
        }
      })
  }

  const calculateClusterRadius = (zoom: number) => {
    if (zoom >= 12) {
      return 12
    }
    return 20
  }

  const calcColorSet = () => {
    let colorSet
    if (vars.overridenStyles?.colorSet) {
      colorSet = vars.overridenStyles.colorSet
    } else {
      const ms = props.asset.map_styles
      colorSet = ms.colorSet ? ms.colorSet : undefined
    }

    return colorSet
  }

  const buildMarkers = (map: L.Map, submissions: SubmissionResponse[]) => {
    const prepPoints: L.Marker[] = []
    const viewby = props.viewby || undefined
    const colorSet = calcColorSet()
    let currentQuestionChoices: SurveyChoice[] = []
    let mapMarkers: MapValueCounts = {}
    let mM: MarkerMap = []

    if (viewby) {
      mapMarkers = prepFilteredMarkers(vars.submissions, props.viewby)
      const choices = props.asset.content?.choices || []
      const survey = props.asset.content?.survey || []

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
      //setState({...state, markerMap: mM })
      vars.markerMap = mM
    } else {
      //setState({...state, markerMap: undefined })
      vars.markerMap = undefined
    }

    submissions.forEach((item) => {
      let markerProps = {}

      const parsedCoordinates: number[] = parseLatLng(item, vars.foundSelectedQuestion)

      if (!!parsedCoordinates.length) {
        if (viewby && mM) {
          const vb = nameOfFieldInGroup(viewby)
          const itemId = String(item[vb])
          let index: number | IconNoValue = mM.findIndex((m) => m.value === itemId)

          // spread indexes to use full colorset gamut if necessary
          if (colorSet !== undefined && colorSet !== 'a') {
            index = calculateIconIndex(index, mM)
          }

          // Previously it was possible that `'-novalue' + 1` would happen resulting in code not knowing what to do.
          // I've changed it to default to 1 in case `index` is not a number.
          let iconNumber = 1
          if (typeof index === 'number') {
            iconNumber = index + 1
          }

          markerProps = {
            icon: buildIcon(iconNumber),
            sId: item._id,
            typeId: mapMarkers[itemId].id,
          }
        } else {
          markerProps = {
            icon: buildIcon(),
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
          maxClusterRadius: calculateClusterRadius,
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

      markers.on('click', launchSubmissionModal).addTo(map)

      if (prepPoints.length > 0 && (!viewby || !vars.componentRefreshed)) {
        map.fitBounds(markers.getBounds())
      }
      if (prepPoints.length === 0) {
        map.fitBounds([[42.373, -71.124]])
        //setState({...state, noData: true })
        vars.noData = true
      }
      //setState({
      //  ...state,
      //  markers: markers as FeatureGroupExtended,
      //})
      vars.markers = markers as FeatureGroupExtended
    } else {
      //setState({...state, error: t('Error: could not load data.') })
      vars.error = t('Error: could not load data.')
    }
  }

  /**
   * Note: this function sometimes returns IconNoValue string.
   */
  const calculateIconIndex = (index: number, mM: MarkerMap): number | IconNoValue => {
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

  const buildIcon = (index: number | boolean = false) => {
    const colorSet = calcColorSet() || 'a'
    const iconClass = index ? `map-marker-${colorSet}${index}` : 'map-marker-a'

    return L.divIcon({
      className: `map-marker ${iconClass}`,
      iconSize: [20, 20],
    })
  }

  const prepFilteredMarkers = (data: SubmissionResponse[], viewby: string): MapValueCounts => {
    const markerMap: MapValueCounts = {}
    const currentViewBy = nameOfFieldInGroup(viewby)
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

  const buildHeatMap = (map: L.Map, submissions: SubmissionResponse[]) => {
    const heatmapPoints: Array<[number, number, number]> = []
    submissions.forEach((item) => {
      const parsedCoordinates: number[] = parseLatLng(item, vars.foundSelectedQuestion)
      if (!!parsedCoordinates.length) {
        heatmapPoints.push([parsedCoordinates[0], parsedCoordinates[1], 1])
      }
    })
    const heatmap = L.heatLayer(heatmapPoints, {
      minOpacity: 0.25,
      radius: 20,
      blur: 8,
    })

    if (!vars.markersVisible) {
      map.addLayer(heatmap)
    }
    //setState({ ...state, heatmap: heatmap })
    vars.heatmap = heatmap
  }

  const showMarkers = () => {
    if (vars.map && vars.markers) {
      vars.map.addLayer(vars.markers)
    }
    if (vars.map && vars.heatmap) {
      vars.map.removeLayer(vars.heatmap)
    }
    //setState({
    //  ...state,
    //  markersVisible: true,
    //})
    vars.markersVisible = true
  }

  const showLayerControls = () => {
    controls.expand()
  }

  const showHeatmap = () => {
    const map = vars.map

    if (map && vars.heatmap) {
      map.addLayer(vars.heatmap)
    }
    if (map && vars.markers) {
      map.removeLayer(vars.markers)
    }
    //setState({
    //  ...state,
    //  markersVisible: false,
    //})
    vars.markersVisible = false
  }

  const filterMap = (evt: React.TouchEvent<HTMLAnchorElement>) => {
    // roundabout solution for https://github.com/kobotoolbox/kpi/issues/1678
    //
    // when blurEventDisabled prop is set, no blur event takes place in PopoverMenu
    // hence, dropdown stays visible when invoking other click events (like filterLanguage below)
    // but when changing question, dropdown needs to be removed, clearDisaggregatedPopover does this via props
    //setState({...state, clearDisaggregatedPopover: true })
    vars.clearDisaggregatedPopover = true
    // reset clearDisaggregatedPopover in order to maintain same behaviour on subsequent clicks
    window.setTimeout(() => {
      //setState({ ...state, clearDisaggregatedPopover: false })
      vars.clearDisaggregatedPopover = false
    }, 1000)

    const name = evt.currentTarget.getAttribute('data-name') || undefined
    if (name !== undefined) {
      props.router.navigate(`/forms/${props.asset.uid}/data/map/${name}`)
    } else {
      props.router.navigate(`/forms/${props.asset.uid}/data/map`)
    }
  }

  const filterLanguage = (evt: React.TouchEvent<HTMLAnchorElement>) => {
    const dataIndexAttr = evt.currentTarget.getAttribute('data-index')
    if (dataIndexAttr !== null) {
      //setState({ ...state, langIndex: Number.parseInt(dataIndexAttr) })
      vars.langIndex = Number.parseInt(dataIndexAttr)
    }
  }

  // FIXME: what does this do?
  //const getDerivedStateFromProps = (props: FormMapProps, state: FormMapState) => {
  ////static getDerivedStateFromProps = (props: FormMapProps, state: FormMapState) => {
  //  const newState: Partial<FormMapState> = {
  //    previousViewby: props.viewby,
  //  }
  //  if (props.viewby !== undefined) {
  //    newState.markersVisible = true
  //  }
  //  if (vars.previousViewby !== props.viewby) {
  //    newState.filteredByMarker = undefined
  //    newState.componentRefreshed = true
  //  }
  //  return newState
  //}

  const refreshMap = () => {
    const map = vars.map
    if (map && vars.markers) {
      map.removeLayer(vars.markers)
    }
    if (map && vars.heatmap) {
      map.removeLayer(vars.heatmap)
    }
    return map
  }

  const launchSubmissionModal = (evt: L.LeafletMouseEvent) => {
    const td = vars.submissions
    const ids: number[] = []
    td.forEach((r) => {
      ids.push(r._id)
    })

    pageState.showModal({
      type: MODAL_TYPES.SUBMISSION,
      sid: evt.layer.options.sId,
      asset: props.asset,
      ids: ids,
    })
  }

  const toggleMapSettings = () => {
    //setState({
    //  ...state,
    //  showMapSettings: !state.showMapSettings,
    //})
    vars.showMapSettings = !vars.showMapSettings
  }

  /** Note: selected questions are considered a "map style" and is updated in the state here */
  const overrideStyles = (mapStyles: AssetMapStyles) => {
    //setState(
    //  {
    //    ...state,
    //    filteredByMarker: undefined,
    //    componentRefreshed: true,
    //    overridenStyles: mapStyles,
    //  })
    vars.filteredByMarker = undefined
    vars.componentRefreshed = true
    vars.overridenStyles = mapStyles
    const map = refreshMap()

    if (map) {
      requestData(map, props.viewby)
    }
  }

  const toggleFullscreen = () => {
    //setState({ ...state, isFullscreen: !state.isFullscreen })
    console.log('a', vars.isFullscreen)
    vars.isFullscreen = !vars.isFullscreen
    console.log('b', vars.isFullscreen)

    vars.map?.invalidateSize()
  }

  const toggleLegend = () => {
    //setState({
    //  ...state,
    //  showExpandedLegend: !state.showExpandedLegend,
    //})
    vars.showExpandedLegend = vars.showExpandedLegend
  }

  const filterByMarker = (markerId: number) => {
    const id = String(markerId)
    const markers = vars.markers
    let filteredByMarker = vars.filteredByMarker
    const unselectedClass = 'unselected'

    if (!filteredByMarker) {
      filteredByMarker = [id]
    } else if (filteredByMarker.includes(id)) {
      filteredByMarker = filteredByMarker.filter((l) => l !== id)
    } else {
      filteredByMarker.push(id)
    }

    //setState({ ...state, filteredByMarker: filteredByMarker })
    vars.filteredByMarker = filteredByMarker
    markers?.eachLayer((layer) => {
      if (filteredByMarker.includes(layer.options.typeId.toString())) {
        layer._icon.classList.remove(unselectedClass)
      } else {
        layer._icon.classList.add(unselectedClass)
      }
    })
  }

  const resetFilterByMarker = () => {
    const markers = vars.markers
    //setState({ ...state, filteredByMarker: undefined })
    vars.filteredByMarker = undefined
    markers?.eachLayer((layer) => {
      layer._icon.classList.remove('unselected')
    })
  }

  const nameOfFieldInGroup = (fieldName: string): string => {
    if (props.asset.content?.survey) {
      const flatPaths = getSurveyFlatPaths(props.asset.content.survey)
      return flatPaths[fieldName]
    }
    // Fallback - should never happen
    return fieldName
  }

  if (vars.error) {
    return (
      <bem.FormView m='ui-panel'>
        <CenteredMessage message={vars.error} />
      </bem.FormView>
    )
  }

  const fields = vars.fields
  const langIndex = vars.langIndex
  let langs: Array<string | null> = []
  if (props.asset.content?.translations && props.asset.content?.translations.length > 1) {
    langs = props.asset.content.translations
  }
  const viewby = props.viewby

  const colorSet = calcColorSet() || 'a'
  let label = t('Disaggregate by survey responses')

  if (viewby) {
    fields.forEach((f) => {
      if (viewby === f.name || viewby === f.$autoname) {
        label = `${t('Disaggregated using:')} ${f.label?.[langIndex]}`
      }
    })
  } else if (vars.noData && vars.hasGeoPoint) {
    label = `${t('No "geopoint" responses have been received')}`
  } else if (!vars.hasGeoPoint) {
    label = `${t('The map does not show data because this form does not have a "geopoint" field.')}`
  }

  const formViewModifiers = ['map']
  if (vars.isFullscreen) {
    formViewModifiers.push('fullscreen')
  }
  return (
    <bem.FormView m={formViewModifiers} className='right-tooltip'>
      <bem.FormView__mapButton
        m={'expand'}
        onClick={toggleFullscreen}
        data-tip={t('Toggle Fullscreen')}
        className={vars.isFullscreen ? 'active' : ''}
      >
        <i className='k-icon k-icon-expand' />
      </bem.FormView__mapButton>
      <bem.FormView__mapButton
        m={'markers'}
        onClick={showMarkers}
        data-tip={t('Show as points')}
        className={vars.markersVisible ? 'active' : ''}
      >
        <i className='k-icon k-icon-pins' />
      </bem.FormView__mapButton>
      <bem.FormView__mapButton m={'layers'} onClick={showLayerControls} data-tip={t('Toggle layers')}>
        <i className='k-icon k-icon-layer' />
      </bem.FormView__mapButton>
      <bem.FormView__mapButton
        m={'map-settings'}
        onClick={toggleMapSettings}
        data-tip={t('Map display settings')}
      >
        <i className='k-icon k-icon-settings' />
      </bem.FormView__mapButton>
      {!viewby && (
        <bem.FormView__mapButton
          m={'heatmap'}
          onClick={showHeatmap}
          data-tip={t('Show as heatmap')}
          className={vars.markersVisible ? '' : 'active'}
        >
          <i className='k-icon k-icon-heatmap' />
        </bem.FormView__mapButton>
      )}

      {vars.hasGeoPoint && !vars.noData && (
        <PopoverMenu
          type='viewby-menu'
          triggerLabel={label}
          clearPopover={vars.clearDisaggregatedPopover}
          blurEventDisabled
        >
          {langs.length > 1 && <bem.PopoverMenu__heading>{t('Language')}</bem.PopoverMenu__heading>}
          {langs.map((l, i) => (
            <bem.PopoverMenu__link
              data-index={i}
              className={vars.langIndex === i ? 'active' : ''}
              key={`l-${i}`}
              onClick={filterLanguage}
            >
              {l ? l : t('Default')}
            </bem.PopoverMenu__link>
          ))}
          <bem.PopoverMenu__link
            key={'all'}
            onClick={filterMap}
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
                onClick={filterMap}
                className={viewby === name ? 'active' : ''}
              >
                {fieldLabel}
              </bem.PopoverMenu__link>
            )
          })}
        </PopoverMenu>
      )}

      {vars.noData && !vars.hasGeoPoint && (
        <div className='map-transparent-background'>
          <div className='map-no-geopoint-wrapper'>
            <p className='map-no-geopoint'>
              {t('The map does not show data because this form does not have a "geopoint" field.')}
            </p>
          </div>
        </div>
      )}

      {vars.noData && vars.hasGeoPoint && (
        <div className='map-transparent-background'>
          <div className='map-no-geopoint-wrapper'>
            <p className='map-no-geopoint'>{t('No "geopoint" responses have been received')}</p>
          </div>
        </div>
      )}

      {vars.markerMap && vars.markersVisible && (
        <bem.FormView__mapList className={vars.showExpandedLegend ? 'expanded' : 'collapsed'}>
          <div className='maplist-contents'>
            {vars.filteredByMarker && (
              <div
                key='m-reset'
                className='map-marker-item map-marker-reset'
                onClick={resetFilterByMarker}
              >
                {t('Reset')}
              </div>
            )}
            {vars.markerMap.map((m, i) => {
              let markerItemClass = 'map-marker-item '
              if (vars.filteredByMarker) {
                markerItemClass += vars.filteredByMarker.includes(m.id.toString()) ? 'selected' : 'unselected'
              }
              let markerLabel = m.labels ? m.labels[langIndex] : m.value
              if (!markerLabel) {
                markerLabel = t('not set')
              }
              let index: number | IconNoValue = i
              if (colorSet !== undefined && colorSet !== 'a' && vars.markerMap) {
                index = calculateIconIndex(index, vars.markerMap)
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
                      filterByMarker(m.id)
                    }}
                    title={markerLabel}
                  >
                    {markerLabel}
                  </span>
                </div>
              )
            })}
          </div>
          <div className='maplist-legend' onClick={toggleLegend}>
            <i className={cx('k-icon', vars.showExpandedLegend ? 'k-icon-angle-down' : 'k-icon-angle-up')} />{' '}
            {t('Legend')}
          </div>
        </bem.FormView__mapList>
      )}
      {!vars.markers && !vars.heatmap && <LoadingSpinner message={false} />}
      {vars.showMapSettings && (
        <Modal open onClose={toggleMapSettings} title={t('Map Settings')}>
          <MapSettings
            asset={props.asset}
            toggleMapSettings={toggleMapSettings}
            overrideStyles={overrideStyles}
            overridenStyles={vars.overridenStyles}
          />
        </Modal>
      )}
      <div id='data-map' />
    </bem.FormView>
  )
}
