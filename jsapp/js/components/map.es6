import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import _ from 'underscore';
import {dataInterface} from '../dataInterface';
import {hashHistory} from 'react-router';
import bem from '../bem';
import stores from '../stores';
import ui from '../ui';
import alertify from 'alertifyjs';
import classNames from 'classnames';

import L from 'leaflet/dist/leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat/dist/leaflet-heat';
import 'leaflet.markercluster/dist/leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

import {
  assign,
  t,
  log,
  notify,
} from '../utils';

export class FormMap extends React.Component {
  constructor(props){
    super(props);

    let survey = props.asset.content.survey;
    var hasGeoPoint = false;
    survey.forEach(function(s) {
      if (s.type == 'geopoint')
        hasGeoPoint = true;
    });

    this.state = {
      map: false,
      markers: false,
      heatmap: false,
      markersVisible: true,
      markerMap: false,
      fields: [],
      fieldsToQuery: ['_id', '_geolocation'],
      hasGeoPoint: hasGeoPoint,
      submissions: [],
      error: false,
      showExpandedMap: false,
      showExpandedLegend: true,
      langIndex: 0
    };

    autoBind(this);    
  }

  componentDidMount () {
    if (!this.state.hasGeoPoint)
      return false;

    var fields = [];
    this.props.asset.content.survey.forEach(function(q){
      if (q.type == 'select_one' || q.type == 'select_multiple') {
        fields.push(q);
      }
    });

    var map = L.map('data-map', {maxZoom: 17});

    var streets = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        subdomains: ['a', 'b', 'c']
    });
    streets.addTo(map);

    var outdoors = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: 'Map data: &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
    });

    var satellite = L.tileLayer('http://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
      }
    );

    var humanitarian = L.tileLayer('https://tile-{s}.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
        attribution: 'Tiles &copy; Humanitarian OpenStreetMap Team &mdash; &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
      }
    );

    var baseLayers = {
        "OpenStreetMap": streets,
        "OpenTopoMap": outdoors,
        "ESRI World Imagery": satellite,
        "Humanitarian": humanitarian
    };

    L.control.layers(baseLayers).addTo(map);

    var fq = this.state.fieldsToQuery;
    fields.forEach(function(f){
      if (f.name) {
        fq.push(f.name);
      } else {
        fq.push(f.$autoname);
      }
    });

    this.setState({
        map: map,
        fields: fields,
        fieldsToQuery: fq
      }
    );

    if(this.props.asset.deployment__submission_count > 2000) {
      notify(t('This map display is currently limited to 2000 records for performance reasons.'));
    }

    this.requestData(map);
  }

  requestData(map) {
    // TODO: handle forms with over 2000 results
    dataInterface.getSubmissions(this.props.asset.uid, 2000, 0, [], this.state.fieldsToQuery).done((data) => {
      this.setState({submissions: data});
      this.buildMarkers(map);
      this.buildHeatMap(map);
    }).fail((error)=>{
      if (error.responseText)
        this.setState({error: error.responseText, loading: false});
      else if (error.statusText)
        this.setState({error: error.statusText, loading: false});
      else
        this.setState({error: t('Error: could not load data.'), loading: false});
    });
  } 

  calculateClusterRadius(zoom) {
   if(zoom >=12) {return 12;}
   return 20;
  }

  buildMarkers(map) {
    var prepPoints = [];
    var icon = L.divIcon({
      className: 'map-marker',
      iconSize: [20, 20],
    });

    var viewby = this.props.viewby || undefined;

    if (viewby) {
      var mapMarkers = this.prepFilteredMarkers(this.state.submissions, this.props.viewby);
      var mM = [];
      let choices = this.props.asset.content.choices;

      Object.keys(mapMarkers).map(function(m, i) {
        var lbl = choices.find(o => o.name === m || o.$autoname == m);
        mM.push({
          count: mapMarkers[m].count,
          id: mapMarkers[m].id,
          labels: lbl ? lbl.label : undefined
        });
      });

      mM.sort(function(a, b) {
        return a.count - b.count;
      }).reverse();

      this.setState({markerMap: mM});
    } else {
      this.setState({markerMap: false});
    }

    this.state.submissions.forEach(function(item){
      if (item._geolocation && item._geolocation[0] && item._geolocation[1]) {
        if (viewby && mapMarkers != undefined) {
          var itemId = item[viewby];
          icon = L.divIcon({
            className: `map-marker map-marker-${mapMarkers[itemId].id}`,
            iconSize: [20, 20],
          });
        }
        prepPoints.push(L.marker(item._geolocation, {icon: icon, sId: item._id}));
      }
    });

    if (prepPoints.length > 0) {
      if (viewby) {
        var markers = L.featureGroup(prepPoints);
      } else {
        var markers = L.markerClusterGroup({maxClusterRadius: this.calculateClusterRadius, disableClusteringAtZoom: 16});
        markers.addLayers(prepPoints);
      }

      markers.on('click', this.launchSubmissionModal).addTo(map);
      map.fitBounds(markers.getBounds());

      this.setState({
          markers: markers
        }
      );
    } else {
      this.setState({error: t('Error: could not load data.'), loading: false});
    }
  }

  prepFilteredMarkers (data, viewby) {
    var markerMap = new Object();

    var idcounter = 0;
    data.forEach(function(listitem, i) {
      var m = listitem[viewby];

      if (markerMap[m] == null) {
          markerMap[m] = {count: 1, id: idcounter};
          idcounter++;
      } else {
          markerMap[m]['count'] += 1;
      }
    });

    return markerMap;
  }

  buildHeatMap (map) {
    var heatmapPoints = [];
    this.state.submissions.forEach(function(item){
      if (item._geolocation && item._geolocation[0] && item._geolocation[1])
        heatmapPoints.push([item._geolocation[0], item._geolocation[1], 1]);
    });
    var heatmap = L.heatLayer(heatmapPoints, {
      minOpacity: 0.25,
      radius: 20,
      blur: 8
    });

    if (!this.state.markersVisible) {
      map.addLayer(heatmap);
    }
    this.setState({heatmap: heatmap});
  }

  showMarkers () {
    var map = this.state.map;
    map.addLayer(this.state.markers);
    map.removeLayer(this.state.heatmap);
    this.setState({
        markersVisible: true
      }
    );
  }

  showHeatmap () {
    var map = this.state.map;

    map.addLayer(this.state.heatmap);
    map.removeLayer(this.state.markers);
    this.setState({
        markersVisible: false
      }
    );
  }

  filterMap (evt) {
    let name = evt.target.getAttribute('data-name') || undefined;
    if (name != undefined) {
      hashHistory.push(`/forms/${this.props.asset.uid}/data/map/${name}`);
    } else {
      hashHistory.push(`/forms/${this.props.asset.uid}/data/map`);
    }
  }

  filterLanguage (evt) {
    let index = evt.target.getAttribute('data-index');
    this.setState({
        langIndex: index
      }
    );    
  }

  componentWillReceiveProps (nextProps) {
    if (this.props.viewby != undefined) {
      this.setState({markersVisible: true});
    }
    if (this.props.viewby != nextProps.viewby) {
      var map = this.state.map;
      var markers = this.state.markers;
      var heatmap = this.state.heatmap;
      map.removeLayer(markers);
      map.removeLayer(heatmap);
      this.requestData(map);
    }
  }

  launchSubmissionModal (evt) {
    const td = this.state.submissions;
    var ids = [];
    td.forEach(function(r) {
      ids.push(r._id);
    })

    stores.pageState.showModal({
      type: 'submission',
      sid: evt.layer.options.sId,
      asset: this.props.asset,
      ids: ids
    });
  }

  toggleExpandedMap () {
    stores.pageState.hideDrawerAndHeader(!this.state.showExpandedMap);
    this.setState({
      showExpandedMap: !this.state.showExpandedMap,
    });

    var map = this.state.map;
    setTimeout(function(){ map.invalidateSize()}, 300);
  }

  toggleLegend() {
    this.setState({
      showExpandedLegend: !this.state.showExpandedLegend,
    });

  }

  render () {
    if (!this.state.hasGeoPoint) {
      return (
        <ui.Panel>
          <bem.Loading>
            <bem.Loading__inner>
              {t('This form does not have a "geopoint" field, therefore a map is not available.')}
            </bem.Loading__inner>
          </bem.Loading>
        </ui.Panel>
      );      
    }

    if (this.state.error) {
      return (
        <ui.Panel>
          <bem.Loading>
            <bem.Loading__inner>
              {this.state.error}
            </bem.Loading__inner>
          </bem.Loading>
        </ui.Panel>
        )
    }

    const fields = this.state.fields;
    const langIndex = this.state.langIndex;
    const langs = this.props.asset.content.translations.length > 1 ? this.props.asset.content.translations : [];
    var label = t('View Options');
    const viewby = this.props.viewby;

    if (viewby) {
      fields.forEach(function(f){
        if(viewby === f.name || viewby === f.$autoname)
          label = `${t('Filtered by:')} ${f.label[langIndex]}`;
      });
    }

    return (
      <bem.FormView m='map'>
        <bem.FormView__mapButton m={'expand'} 
          onClick={this.toggleExpandedMap}
          className={this.state.toggleExpandedMap ? 'active': ''}>
          <i className="k-icon-expand" />
        </bem.FormView__mapButton>
        <bem.FormView__mapButton m={'markers'} 
          onClick={this.showMarkers}
          className={this.state.markersVisible ? 'active': ''}>
          <i className="k-icon-pins" />
        </bem.FormView__mapButton>
        {!viewby && 
          <bem.FormView__mapButton m={'heatmap'} 
            onClick={this.showHeatmap}
            className={!this.state.markersVisible ? 'active': ''}>
            <i className="k-icon-heatmap" />
          </bem.FormView__mapButton>
        }
        <ui.PopoverMenu type='viewby-menu' triggerLabel={label} m={'above'}>
            <bem.PopoverMenu__link key={'all'} onClick={this.filterMap} className={!viewby ? 'active': ''}>
              {t('-- See all data --')}
            </bem.PopoverMenu__link>
            {fields.map((f)=>{

              const name = f.name || f.$autoname;
              return (
                  <bem.PopoverMenu__link 
                    data-name={name} key={`f-${name}`} 
                    onClick={this.filterMap}
                    className={viewby == name ? 'active': ''}>
                    {f.label[langIndex]}
                  </bem.PopoverMenu__link>
                );
            })}
            {langs.length > 1 && 
              <bem.PopoverMenu__heading>
                {t('Language')}
              </bem.PopoverMenu__heading>
            }
            {langs.map((l,i)=> {
              return (
                  <bem.PopoverMenu__link 
                    data-index={i} className={this.state.langIndex == i ? 'active': ''}
                    key={`l-${i}`} onClick={this.filterLanguage}>
                    {l ? l : t('Default')}
                  </bem.PopoverMenu__link>
                );
            })}
        </ui.PopoverMenu>
        {this.state.markerMap && this.state.markersVisible && 
          <bem.FormView__mapList className={this.state.showExpandedLegend ? 'expanded' : 'collapsed'}>
            <div className='maplist-contents'>
              {this.state.markerMap.map((m, i)=>{
                return (
                    <div key={`m-${i}`} className="map-marker-item">
                      <span className={`map-marker map-marker-${m.id}`}>
                        {m.count}
                      </span>
                      <span className={`map-marker-label`}>
                        {m.labels ? m.labels[langIndex] : t('not set')}
                      </span>
                    </div>
                  );
              })}
            </div>
            <div className="maplist-legend" onClick={this.toggleLegend}>
              <i className={classNames('fa', this.state.showExpandedLegend ? 'fa-angle-down' : 'fa-angle-up')} /> {t('Legend')}
            </div>
          </bem.FormView__mapList>
        }
        {!this.state.markers && !this.state.heatmap && 
          <bem.Loading>
            <bem.Loading__inner>
              <i />
            </bem.Loading__inner>
          </bem.Loading>
        }
        <div id="data-map"></div>
      </bem.FormView>
      );
  }
};

reactMixin(FormMap.prototype, Reflux.ListenerMixin);

export default FormMap;
