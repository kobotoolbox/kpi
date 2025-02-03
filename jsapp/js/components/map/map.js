import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import {dataInterface} from 'js/dataInterface';
import bem from 'js/bem';
import {actions} from 'js/actions';
import PopoverMenu from 'js/popoverMenu';
import Modal from 'js/components/common/modal';
import classNames from 'classnames';
import omnivore from '@mapbox/leaflet-omnivore';
import {withRouter} from 'js/router/legacy';
import JSZip from 'jszip';
import './map.scss';
import './map.marker-colors.scss';
import L from 'leaflet/dist/leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat/dist/leaflet-heat';
import 'leaflet.markercluster/dist/leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import pageState from 'js/pageState.store';

import {
  ASSET_FILE_TYPES,
  MODAL_TYPES,
  QUESTION_TYPES,
  QUERY_LIMIT_DEFAULT,
} from 'js/constants';

import {notify, checkLatLng} from 'js/utils';
import {getSurveyFlatPaths} from 'js/assetUtils';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import CenteredMessage from 'js/components/common/centeredMessage.component';

import MapSettings from './mapSettings';

const streets = L.tileLayer(
  'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    subdomains: ['a', 'b', 'c'],
  }
);

const baseLayers = {
  OpenStreetMap: streets,
  OpenTopoMap: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution:
      'Map data: &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)',
  }),
  'ESRI World Imagery': L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      attribution:
        'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    }
  ),
  Humanitarian: L.tileLayer(
    'https://tile-{s}.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    {
      attribution:
        'Tiles &copy; Humanitarian OpenStreetMap Team &mdash; &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }
  ),
};

const controls = L.control.layers(baseLayers);

export class FormMap extends React.Component {
  constructor(props) {
    super(props);

    const survey = props.asset.content.survey;
    let hasGeoPoint = false;
    survey.forEach(function (s) {
      if (s.type === QUESTION_TYPES.geopoint.id) {
        hasGeoPoint = true;
      }
    });

    this.state = {
      map: false,
      markers: false,
      heatmap: false,
      markersVisible: true,
      markerMap: false,
      fields: [],
      hasGeoPoint: hasGeoPoint,
      submissions: [],
      error: false,
      isFullscreen: false,
      showExpandedLegend: true,
      langIndex: 0,
      filteredByMarker: false,
      componentRefreshed: false,
      showMapSettings: false,
      overridenStyles: false,
      clearDisaggregatedPopover: false,
      noData: false,
    };

    autoBind(this);
  }

  componentWillUnmount() {
    if (this.state.map) {
      this.state.map.remove();
    }
  }

  componentDidMount() {
    const fields = [];
    const fieldTypes = [
      'select_one',
      'select_multiple',
      'integer',
      'decimal',
      'text',
    ];
    this.props.asset.content.survey.forEach(function (q) {
      if (fieldTypes.includes(q.type)) {
        fields.push(q);
      }
    });

    L.Marker.prototype.options.icon = L.divIcon({
      className: 'map-marker default-overlay-marker',
      iconSize: [12, 12],
    });

    const map = L.map('data-map', {
      maxZoom: 17,
      scrollWheelZoom: false,
      preferCanvas: true,
    });

    streets.addTo(map);
    controls.addTo(map);

    this.setState({
      map: map,
      fields: fields,
    });

    if (this.props.asset.deployment__submission_count > QUERY_LIMIT_DEFAULT) {
      notify(
        t(
          'By default map is limited to the ##number##  most recent submissions for performance reasons. Go to map settings to increase this limit.'
        ).replace('##number##', QUERY_LIMIT_DEFAULT)
      );
    }

    this.requestData(map, this.props.viewby);
    this.listenTo(actions.map.setMapStyles.started, this.onSetMapStylesStarted);
    this.listenTo(
      actions.map.setMapStyles.completed,
      this.onSetMapStylesCompleted
    );
    this.listenTo(
      actions.resources.getAssetFiles.completed,
      this.updateOverlayList
    );
    actions.resources.getAssetFiles(
      this.props.asset.uid,
      ASSET_FILE_TYPES.map_layer.id
    );
  }

  loadOverlayLayers() {
    dataInterface
      .getAssetFiles(this.props.asset.uid, ASSET_FILE_TYPES.map_layer.id)
      .done(() => {});
  }

  updateOverlayList(data) {
    const map = this.state.map;

    // remove layers from controls if they are no longer in asset files
    controls._layers.forEach(function (controlLayer) {
      if (controlLayer.overlay) {
        const layerMatch = data.results.filter(
          (result) => result.name === controlLayer.name
        );
        if (!layerMatch.length) {
          controls.removeLayer(controlLayer.layer);
          map.removeLayer(controlLayer.layer);
        }
      }
    });

    // add new layers to controls (if they haven't been added already)
    data.results.forEach(function (layer) {
      if (layer.file_type !== 'map_layer') {
        return false;
      }
      const layerMatch = controls._layers.filter(
        (controlLayer) => controlLayer.name === layer.name
      );
      if (layerMatch.length) {
        return false;
      }

      let overlayLayer = false;
      switch (layer.metadata.type) {
        case 'kml':
          overlayLayer = omnivore.kml(layer.content);
          break;
        case 'csv':
          overlayLayer = omnivore.csv(layer.content);
          break;
        case 'json':
        case 'geojson':
          overlayLayer = omnivore.geojson(layer.content);
          break;
        case 'wkt':
          overlayLayer = omnivore.wkt(layer.content);
          break;
        case 'kmz':
          // KMZ files are zipped KMLs, therefore
          // unzip the KMZ file in the browser
          // and feed the resulting text to map and controls
          fetch(layer.content)
            .then(function (response) {
              if (response.status === 200 || response.status === 0) {
                return Promise.resolve(response.blob());
              } else {
                return Promise.reject(new Error(response.statusText));
              }
            })
            .then(JSZip.loadAsync)
            .then(function (zip) {
              return zip.file('doc.kml').async('string');
            })
            .then(function success(kml) {
              overlayLayer = omnivore.kml.parse(kml);
              controls.addOverlay(overlayLayer, layer.name);
              overlayLayer.addTo(map);
            });
          break;
      }

      if (overlayLayer) {
        overlayLayer.on('ready', function () {
          overlayLayer.eachLayer(function (l) {
            const fprops = l.feature.properties;
            const name =
              fprops.name || fprops.title || fprops.NAME || fprops.TITLE;
            if (name) {
              l.bindPopup(name);
            } else {
              // when no name or title, load full list of feature's properties
              l.bindPopup(
                '<pre>' +
                  JSON.stringify(fprops, null, 2).replace(/[{}"]/g, '') +
                  '</pre>'
              );
            }
          });
        });
        controls.addOverlay(overlayLayer, layer.name);
        overlayLayer.addTo(map);
      }
    });
  }

  onSetMapStylesCompleted() {
    // asset is updated, no need to store oberriden styles as they are identical
    this.setState({overridenStyles: false});
  }

  /**
   * We don't want to wait for the asset (`asset.map_styles`) to be updated
   * we use the settings being saved and fetch data with them
   */
  onSetMapStylesStarted(assetUid, upcomingMapSettings) {
    if (!upcomingMapSettings.colorSet) {
      upcomingMapSettings.colorSet = 'a';
    }

    if (!upcomingMapSettings.querylimit) {
      upcomingMapSettings.querylimit = QUERY_LIMIT_DEFAULT.toString();
    }

    this.overrideStyles(upcomingMapSettings);
  }

  requestData(map, nextViewBy = '') {
    // TODO: support area / line geodata questions
    // See: https://github.com/kobotoolbox/kpi/issues/3913
    let selectedQuestion = this.props.asset.map_styles.selectedQuestion || null;

    this.props.asset.content.survey.forEach(function (row) {
      if (
        typeof row.label !== 'undefined' &&
        row.label !== null &&
        selectedQuestion === row.label[0] &&
        row.type !== QUESTION_TYPES.geopoint.id
      ) {
        selectedQuestion = null; //Ignore if not a geopoint question type
      }
    });

    let queryLimit = QUERY_LIMIT_DEFAULT;
    if (this.state.overridenStyles && this.state.overridenStyles.querylimit) {
      queryLimit = this.state.overridenStyles.querylimit;
    } else if (this.props.asset.map_styles.querylimit) {
      queryLimit = this.props.asset.map_styles.querylimit;
    }

    const fq = ['_id', '_geolocation'];
    if (selectedQuestion) {
      fq.push(selectedQuestion);
    }
    if (nextViewBy) {
      fq.push(this.nameOfFieldInGroup(nextViewBy));
    }
    const sort = [{id: '_id', desc: true}];
    dataInterface
      .getSubmissions(this.props.asset.uid, queryLimit, 0, sort, fq)
      .done((data) => {
        const results = data.results;
        if (selectedQuestion) {
          results.forEach(function (row, i) {
            if (row[selectedQuestion]) {
              const coordsArray = row[selectedQuestion].split(' ');
              results[i]._geolocation[0] = coordsArray[0];
              results[i]._geolocation[1] = coordsArray[1];
            }
          });
        }

        this.setState({submissions: results}, () => {
          this.buildMarkers(map);
          this.buildHeatMap(map);
        });
      })
      .fail((error) => {
        if (error.responseText) {
          this.setState({error: error.responseText, loading: false});
        } else if (error.statusText) {
          this.setState({error: error.statusText, loading: false});
        } else {
          this.setState({
            error: t('Error: could not load data.'),
            loading: false,
          });
        }
      });
  }
  calculateClusterRadius(zoom) {
    if (zoom >= 12) {
      return 12;
    }
    return 20;
  }
  calcColorSet() {
    let colorSet;
    if (this.state.overridenStyles && this.state.overridenStyles.colorSet) {
      colorSet = this.state.overridenStyles.colorSet;
    } else {
      const ms = this.props.asset.map_styles;
      colorSet = ms.colorSet ? ms.colorSet : undefined;
    }

    return colorSet;
  }
  buildMarkers(map) {
    const _this = this;
    const prepPoints = [];
    const viewby = this.props.viewby || undefined;
    const colorSet = this.calcColorSet();
    let currentQuestionChoices = [];
    let mapMarkers = {};
    let mM = [];

    if (viewby) {
      mapMarkers = this.prepFilteredMarkers(
        this.state.submissions,
        this.props.viewby
      );
      const choices = this.props.asset.content.choices;
      const survey = this.props.asset.content.survey;

      const question = survey.find(
        (s) => s.name === viewby || s.$autoname === viewby
      );

      if (question && question.type === 'select_one') {
        currentQuestionChoices = choices.filter(
          (ch) => ch.list_name === question.select_from_list_name
        );
      }

      Object.keys(mapMarkers).map(function (m) {
        let choice;
        if (question && question.type === 'select_one') {
          choice = currentQuestionChoices.find(
            (ch) => ch.name === m || ch.$autoname === m
          );
        }

        mM.push({
          count: mapMarkers[m].count,
          id: mapMarkers[m].id,
          labels: choice ? choice.label : undefined,
          value: m !== 'undefined' ? m : undefined,
        });
      });

      if (
        colorSet !== undefined &&
        colorSet !== 'a' &&
        question &&
        question.type === 'select_one'
      ) {
        // sort by question choice order, when using any other color set (only makes sense for select_ones)
        mM.sort(function (a, b) {
          const aIndex = currentQuestionChoices.findIndex(
            (ch) => ch.name === a.value
          );
          const bIndex = currentQuestionChoices.findIndex(
            (ch) => ch.name === b.value
          );
          return aIndex - bIndex;
        });
      } else {
        // sort by occurrence count
        mM.sort(function (a, b) {
          return a.count - b.count;
        }).reverse();
      }

      // move elements with no data in submission for the disaggregated question to end of marker list
      const emptyEl = mM.find((m) => m.value === undefined);
      if (emptyEl) {
        mM = mM.filter((m) => m !== emptyEl);
        mM.push(emptyEl);
      }
      this.setState({markerMap: mM});
    } else {
      this.setState({markerMap: false});
    }

    this.state.submissions.forEach(function (item) {
      let markerProps = {};
      if (checkLatLng(item._geolocation)) {
        if (viewby && mM) {
          const vb = _this.nameOfFieldInGroup(viewby);
          const itemId = item[vb];
          let index = mM.findIndex((m) => m.value === itemId);

          // spread indexes to use full colorset gamut if necessary
          if (colorSet !== undefined && colorSet !== 'a') {
            index = _this.calculateIconIndex(index, mM);
          }

          markerProps = {
            icon: _this.buildIcon(index + 1),
            sId: item._id,
            typeId: mapMarkers[itemId].id,
          };
        } else {
          markerProps = {
            icon: _this.buildIcon(),
            sId: item._id,
            typeId: null,
          };
        }

        prepPoints.push(L.marker(item._geolocation, markerProps));
      }
    });

    if (prepPoints.length >= 0) {
      let markers;
      if (viewby) {
        markers = L.featureGroup(prepPoints);
      } else {
        markers = L.markerClusterGroup({
          maxClusterRadius: this.calculateClusterRadius,
          disableClusteringAtZoom: 16,
          iconCreateFunction: function (cluster) {
            const childCount = cluster.getChildCount();

            let markerClass = 'marker-cluster marker-cluster-';
            if (childCount < 10) {
              markerClass += 'small';
            } else if (childCount < 100) {
              markerClass += 'medium';
            } else {
              markerClass += 'large';
            }

            return new L.divIcon({
              html: '<div><span>' + childCount + '</span></div>',
              className: markerClass,
              iconSize: new L.Point(30, 30),
            });
          },
        });

        markers.addLayers(prepPoints);
      }

      markers.on('click', this.launchSubmissionModal).addTo(map);

      if (
        prepPoints.length > 0 &&
        (!viewby || !this.state.componentRefreshed)
      ) {
        map.fitBounds(markers.getBounds());
      }
      if (prepPoints.length === 0) {
        map.fitBounds([[42.373, -71.124]]);
        this.setState({noData: true});
      }
      this.setState({
        markers: markers,
      });
    } else {
      this.setState({error: t('Error: could not load data.'), loading: false});
    }
  }

  calculateIconIndex(index, mM) {
    // use neutral color for items with no set value
    if (mM[index] && mM[index].value === undefined) {
      return '-novalue';
    }

    // if there are submissions with unset values, reset the local marker array
    // this helps us use the full gamut of colors in the set
    const emptyEl = mM.find((m) => m.value === undefined);
    if (emptyEl) {
      mM = mM.filter((m) => m !== emptyEl);
    }

    // return regular index for list >= 9 items
    if (mM.length >= 9) {
      return index;
    }

    // spread index fairly evenly from 1 to 9 when less than 9 items in list
    const num = (index / mM.length) * 9.5;
    return Math.round(num);
  }

  buildIcon(index = false) {
    const colorSet = this.calcColorSet() || 'a';
    const iconClass = index ? `map-marker-${colorSet}${index}` : 'map-marker-a';

    return L.divIcon({
      className: `map-marker ${iconClass}`,
      iconSize: [20, 20],
    });
  }

  prepFilteredMarkers(data, viewby) {
    const markerMap = new Object();
    const vb = this.nameOfFieldInGroup(viewby);
    let idcounter = 1;

    data.forEach(function (listitem) {
      const m = listitem[vb];

      if (markerMap[m] === undefined) {
        markerMap[m] = {count: 1, id: idcounter};
        idcounter++;
      } else {
        markerMap[m]['count'] += 1;
      }
    });

    return markerMap;
  }

  buildHeatMap(map) {
    const heatmapPoints = [];
    this.state.submissions.forEach(function (item) {
      if (checkLatLng(item._geolocation)) {
        heatmapPoints.push([item._geolocation[0], item._geolocation[1], 1]);
      }
    });
    const heatmap = L.heatLayer(heatmapPoints, {
      minOpacity: 0.25,
      radius: 20,
      blur: 8,
    });

    if (!this.state.markersVisible) {
      map.addLayer(heatmap);
    }
    this.setState({heatmap: heatmap});
  }

  showMarkers() {
    const map = this.state.map;
    map.addLayer(this.state.markers);
    map.removeLayer(this.state.heatmap);
    this.setState({
      markersVisible: true,
    });
  }

  showLayerControls() {
    controls.expand();
  }

  showHeatmap() {
    const map = this.state.map;

    map.addLayer(this.state.heatmap);
    map.removeLayer(this.state.markers);
    this.setState({
      markersVisible: false,
    });
  }
  filterMap(evt) {
    // roundabout solution for https://github.com/kobotoolbox/kpi/issues/1678
    //
    // when blurEventDisabled prop is set, no blur event takes place in PopoverMenu
    // hence, dropdown stays visible when invoking other click events (like filterLanguage below)
    // but when changing question, dropdown needs to be removed, clearDisaggregatedPopover does this via props
    this.setState({clearDisaggregatedPopover: true});
    // reset clearDisaggregatedPopover in order to maintain same behaviour on subsequent clicks
    window.setTimeout(() => {
      this.setState({clearDisaggregatedPopover: false});
    }, 1000);

    const name = evt.target.getAttribute('data-name') || undefined;
    if (name !== undefined) {
      this.props.router.navigate(
        `/forms/${this.props.asset.uid}/data/map/${name}`
      );
    } else {
      this.props.router.navigate(`/forms/${this.props.asset.uid}/data/map`);
    }
  }
  filterLanguage(evt) {
    const index = +evt.target.getAttribute('data-index');
    this.setState({langIndex: index});
  }
  static getDerivedStateFromProps(props, state) {
    const newState = {
      previousViewby: props.viewby,
    };
    if (props.viewby !== undefined) {
      newState.markersVisible = true;
    }
    if (state.previousViewby !== props.viewby) {
      newState.filteredByMarker = false;
      newState.componentRefreshed = true;
    }
    return newState;
  }
  componentDidUpdate(prevProps) {
    if (prevProps.viewby !== this.props.viewby) {
      const map = this.refreshMap();
      this.requestData(map, this.props.viewby);
    }
  }
  refreshMap() {
    const map = this.state.map;
    map.removeLayer(this.state.markers);
    map.removeLayer(this.state.heatmap);
    return map;
  }
  launchSubmissionModal(evt) {
    const td = this.state.submissions;
    const ids = [];
    td.forEach(function (r) {
      ids.push(r._id);
    });

    pageState.showModal({
      type: MODAL_TYPES.SUBMISSION,
      sid: evt.layer.options.sId,
      asset: this.props.asset,
      ids: ids,
    });
  }
  toggleMapSettings() {
    this.setState({
      showMapSettings: !this.state.showMapSettings,
    });
  }
  overrideStyles(mapStyles) {
    this.setState({
      filteredByMarker: false,
      componentRefreshed: true,
      overridenStyles: mapStyles,
    });

    const map = this.refreshMap();

    // HACK switch to setState callback after updating to React 16+
    window.setTimeout(() => {
      this.requestData(map, this.props.viewby);
    }, 0);
  }
  toggleFullscreen() {
    this.setState({isFullscreen: !this.state.isFullscreen});

    const map = this.state.map;
    setTimeout(function () {
      map.invalidateSize();
    }, 300);
  }

  toggleLegend() {
    this.setState({
      showExpandedLegend: !this.state.showExpandedLegend,
    });
  }

  filterByMarker(evt) {
    const markers = this.state.markers;
    const id = evt.target.getAttribute('data-id');
    let filteredByMarker = this.state.filteredByMarker;
    const unselectedClass = 'unselected';

    if (!filteredByMarker) {
      filteredByMarker = [id];
    } else if (!filteredByMarker.includes(id)) {
      filteredByMarker.push(id);
    } else {
      filteredByMarker = filteredByMarker.filter((l) => l !== id);
    }

    this.setState({filteredByMarker: filteredByMarker});
    markers.eachLayer(function (layer) {
      if (!filteredByMarker.includes(layer.options.typeId.toString())) {
        layer._icon.classList.add(unselectedClass);
      } else {
        layer._icon.classList.remove(unselectedClass);
      }
    });
  }

  resetFilterByMarker() {
    const markers = this.state.markers;
    this.setState({filteredByMarker: false});
    markers.eachLayer(function (layer) {
      layer._icon.classList.remove('unselected');
    });
  }

  nameOfFieldInGroup(fieldName) {
    const flatPaths = getSurveyFlatPaths(this.props.asset.content.survey);
    return flatPaths[fieldName];
  }

  render() {
    if (this.state.error) {
      return (
        <bem.FormView m='ui-panel'>
          <CenteredMessage message={this.state.error} />
        </bem.FormView>
      );
    }

    const fields = this.state.fields;
    const langIndex = this.state.langIndex;
    const langs =
      this.props.asset.content.translations?.length > 1
        ? this.props.asset.content.translations
        : [];
    const viewby = this.props.viewby;

    const colorSet = this.calcColorSet() || 'a';
    let label = t('Disaggregate by survey responses');

    if (viewby) {
      fields.forEach(function (f) {
        if (viewby === f.name || viewby === f.$autoname) {
          label = `${t('Disaggregated using:')} ${f.label[langIndex]}`;
        }
      });
    } else if (this.state.noData && this.state.hasGeoPoint) {
      label = `${t('No "geopoint" responses have been received')}`;
    } else if (!this.state.hasGeoPoint) {
      label = `${t(
        'The map does not show data because this form does not have a "geopoint" field.'
      )}`;
    }

    const formViewModifiers = ['map'];
    if (this.state.isFullscreen) {
      formViewModifiers.push('fullscreen');
    }

    return (
      <bem.FormView m={formViewModifiers} className='right-tooltip'>
        <bem.FormView__mapButton
          m={'expand'}
          onClick={this.toggleFullscreen}
          data-tip={t('Toggle Fullscreen')}
          className={this.state.toggleFullscreen ? 'active' : ''}
        >
          <i className='k-icon k-icon-expand' />
        </bem.FormView__mapButton>
        <bem.FormView__mapButton
          m={'markers'}
          onClick={this.showMarkers}
          data-tip={t('Show as points')}
          className={this.state.markersVisible ? 'active' : ''}
        >
          <i className='k-icon k-icon-pins' />
        </bem.FormView__mapButton>
        <bem.FormView__mapButton
          m={'layers'}
          onClick={this.showLayerControls}
          data-tip={t('Toggle layers')}
        >
          <i className='k-icon k-icon-layer' />
        </bem.FormView__mapButton>
        <bem.FormView__mapButton
          m={'map-settings'}
          onClick={this.toggleMapSettings}
          data-tip={t('Map display settings')}
        >
          <i className='k-icon k-icon-settings' />
        </bem.FormView__mapButton>
        {!viewby && (
          <bem.FormView__mapButton
            m={'heatmap'}
            onClick={this.showHeatmap}
            data-tip={t('Show as heatmap')}
            className={!this.state.markersVisible ? 'active' : ''}
          >
            <i className='k-icon k-icon-heatmap' />
          </bem.FormView__mapButton>
        )}

        {this.state.hasGeoPoint && !this.state.noData && (
          <PopoverMenu
            type='viewby-menu'
            triggerLabel={label}
            m={'above'}
            clearPopover={this.state.clearDisaggregatedPopover}
            blurEventDisabled
          >
            {langs.length > 1 && (
              <bem.PopoverMenu__heading>
                {t('Language')}
              </bem.PopoverMenu__heading>
            )}
            {langs.map((l, i) => (
              <bem.PopoverMenu__link
                data-index={i}
                className={this.state.langIndex === i ? 'active' : ''}
                key={`l-${i}`}
                onClick={this.filterLanguage}
              >
                {l ? l : t('Default')}
              </bem.PopoverMenu__link>
            ))}
            <bem.PopoverMenu__link
              key={'all'}
              onClick={this.filterMap}
              className={!viewby ? 'active see-all' : 'see-all'}
            >
              {t('-- See all data --')}
            </bem.PopoverMenu__link>
            {fields.map((f) => {
              const name = f.name || f.$autoname;
              const label = f.label ? (
                f.label[langIndex] ? (
                  f.label[langIndex]
                ) : (
                  <em>{t('untranslated: ') + name}</em>
                )
              ) : (
                t('Question label not set')
              );
              return (
                <bem.PopoverMenu__link
                  data-name={name}
                  key={`f-${name}`}
                  onClick={this.filterMap}
                  className={viewby === name ? 'active' : ''}
                >
                  {label}
                </bem.PopoverMenu__link>
              );
            })}
          </PopoverMenu>
        )}

        {this.state.noData && !this.state.hasGeoPoint && (
          <div className='map-transparent-background'>
            <div className='map-no-geopoint-wrapper'>
              <p className='map-no-geopoint'>
                {t(
                  'The map does not show data because this form does not have a "geopoint" field.'
                )}
              </p>
            </div>
          </div>
        )}

        {this.state.noData && this.state.hasGeoPoint && (
          <div className='map-transparent-background'>
            <div className='map-no-geopoint-wrapper'>
              <p className='map-no-geopoint'>
                {t('No "geopoint" responses have been received')}
              </p>
            </div>
          </div>
        )}

        {this.state.markerMap && this.state.markersVisible && (
          <bem.FormView__mapList
            className={this.state.showExpandedLegend ? 'expanded' : 'collapsed'}
          >
            <div className='maplist-contents'>
              {this.state.filteredByMarker && (
                <div
                  key='m-reset'
                  className='map-marker-item map-marker-reset'
                  onClick={this.resetFilterByMarker}
                >
                  {t('Reset')}
                </div>
              )}
              {this.state.markerMap.map((m, i) => {
                let markerItemClass = 'map-marker-item ';
                if (this.state.filteredByMarker) {
                  markerItemClass += this.state.filteredByMarker.includes(
                    m.id.toString()
                  )
                    ? 'selected'
                    : 'unselected';
                }
                const label = m.labels
                  ? m.labels[langIndex]
                  : m.value
                  ? m.value
                  : t('not set');
                let index = i;
                if (colorSet !== undefined && colorSet !== 'a') {
                  index = this.calculateIconIndex(index, this.state.markerMap);
                }

                return (
                  <div key={`m-${i}`} className={markerItemClass}>
                    <span
                      className={`map-marker map-marker-${colorSet}${
                        index + 1
                      }`}
                    >
                      {m.count}
                    </span>
                    <span
                      className={'map-marker-label'}
                      onClick={this.filterByMarker}
                      data-id={m.id}
                      title={label}
                    >
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
            <div className='maplist-legend' onClick={this.toggleLegend}>
              <i
                className={classNames(
                  'k-icon',
                  this.state.showExpandedLegend
                    ? 'k-icon-angle-down'
                    : 'k-icon-angle-up'
                )}
              />{' '}
              {t('Legend')}
            </div>
          </bem.FormView__mapList>
        )}
        {!this.state.markers && !this.state.heatmap && (
          <LoadingSpinner message={false} />
        )}
        {this.state.showMapSettings && (
          <Modal
            open
            onClose={this.toggleMapSettings}
            title={t('Map Settings')}
          >
            <MapSettings
              asset={this.props.asset}
              toggleMapSettings={this.toggleMapSettings}
              overrideStyles={this.overrideStyles}
              overridenStyles={this.state.overridenStyles}
            />
          </Modal>
        )}

        <div id='data-map' />
      </bem.FormView>
    );
  }
}

reactMixin(FormMap.prototype, Reflux.ListenerMixin);

export default withRouter(FormMap);
