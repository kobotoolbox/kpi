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
      hasGeoPoint: hasGeoPoint
    };

    autoBind(this);    
  }

  componentDidMount () {
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

    this.getMarkers(map, fq);
    this.getHeatMap(map, fq);
  }

  getMarkers(map, fields) {
    // TEMPORARY hook-up to KC API (NOT FOR PRODUCTION)
    // Only works with --disable-web-security flag in browser
    dataInterface.getToken().done((t) => {
      if (t && t.token) {
        var kc_server = document.createElement('a');
        kc_server.href = this.props.asset.deployment__identifier;
        let kc_url = kc_server.origin;

        let uid = this.props.asset.uid;
        dataInterface.getKCForm(kc_url, t.token, uid).done((form) => {
          if (form && form.length === 1) {
            dataInterface.getKCMapData(kc_url, t.token, form[0].formid, fields).done((data) => {

              // MARKERS PREP
              var prepPoints = [];
              var icon = L.divIcon({
                className: 'map-marker',
                iconSize: [20, 20],
              });

              var viewby = this.props.viewby || undefined;

              if (viewby) {
                var mapMarkers = this.prepFilteredMarkers(data, this.props.viewby);
                this.setState({markerMap: mapMarkers});
              } else {
                this.setState({markerMap: false});
              }

              data.forEach(function(item){
                if (item._geolocation && item._geolocation[0] && item._geolocation[1]) {
                  if (viewby && mapMarkers != undefined) {
                    var itemId = item[viewby];
                    icon = L.divIcon({
                      className: `map-marker map-marker-${mapMarkers[itemId].id}`,
                      iconSize: [20, 20],
                    });
                  }
                  // console.log(item);
                  prepPoints.push(L.marker(item._geolocation, {icon: icon, sId: item._id}));
                }
              });

              if (viewby) {
                var markers = L.featureGroup(prepPoints);
              } else {
                var markers = L.markerClusterGroup();
                markers.addLayers(prepPoints);
              }

              markers.on('click', this.launchSubmissionModal).addTo(map);
              map.fitBounds(markers.getBounds());

              this.setState({
                  markers: markers
                }
              );
              // END MARKERS PREP


            }).fail((failData)=>{
              console.log(failData);
            });
          }
        }).fail((failData)=>{
          console.log(failData);
        });
      }
    }).fail((failData)=>{
      console.log(failData);
    });
  }

  prepFilteredMarkers (data, viewby) {

    var markerMap = new Object();
    data.forEach(function(listitem, i) {
      var m = listitem[viewby];

      var l = i.toString();
      var c = l[l.length - 1];

      if (markerMap[m] == null) {
          markerMap[m] = {count: 1, id: c};
      } else {
          markerMap[m]['count'] += 1;
      }
    });

    return markerMap;
  }

  getHeatMap (map, fields) {
    var _self = this;

    // TEMPORARY hook-up to KC API (NOT FOR PRODUCTION)
    // Only works with --disable-web-security flag in browser
    dataInterface.getToken().done((t) => {
      if (t && t.token) {
        var kc_server = document.createElement('a');
        kc_server.href = this.props.asset.deployment__identifier;
        let kc_url = kc_server.origin;

        let uid = this.props.asset.uid;
        dataInterface.getKCForm(kc_url, t.token, uid).done((form) => {
          if (form && form.length === 1) {
            dataInterface.getKCMapData(kc_url, t.token, form[0].formid, fields).done((data) => {

              // HEATMAP PREP
              var heatmapPoints = [];
              data.forEach(function(item){
                if (item._geolocation && item._geolocation[0] && item._geolocation[1])
                  heatmapPoints.push([item._geolocation[0], item._geolocation[1], 1]);
              });
              var heatmap = L.heatLayer(heatmapPoints, {
                minOpacity: 0.25,
                radius: 20,
                blur: 8
              });

              if (!_self.state.markersVisible) {
                map.addLayer(heatmap);
              }

              _self.setState({
                  heatmap: heatmap
                }
              );
              // END HEATMAP PREP


            }).fail((failData)=>{
              console.log(failData);
            });
          }
        }).fail((failData)=>{
          console.log(failData);
        });
      }
    }).fail((failData)=>{
      console.log(failData);
    });

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

  componentWillReceiveProps (nextProps) {
    if (this.props.viewby != nextProps.kuid) {
      var map = this.state.map;
      var markers = this.state.markers;
      var heatmap = this.state.heatmap;

      if (map.hasLayer(markers)) {
        map.removeLayer(markers);
      }

      if (map.hasLayer(heatmap)) {
        map.removeLayer(heatmap);
      }

      window.setTimeout(()=>{
        this.getMarkers(map, this.state.fieldsToQuery);
      }, 500);
    }
  }

  launchSubmissionModal (evt) {
    stores.pageState.showModal({
      type: 'submission',
      sid: evt.layer.options.sId,
      asset: this.props.asset
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

    var fields = this.state.fields;
    var label = t('View Options');
    var viewby = this.props.viewby;

    if (viewby) {
      fields.forEach(function(f){
        if(viewby === f.name || viewby === f.$autoname)
          label = `${t('Filtered by:')} ${f.label[0]}`;
      });
    }

    return (
      <bem.FormView m='map'>
        <bem.FormView__mapButton m={'markers'} 
          onClick={this.showMarkers}
          className={this.state.markersVisible ? 'active': ''}>
          <i className="k-icon-pins" />
        </bem.FormView__mapButton>
        <bem.FormView__mapButton m={'heatmap'} 
          onClick={this.showHeatmap}
          className={!this.state.markersVisible ? 'active': ''}>
          <i className="k-icon-heatmap" />
        </bem.FormView__mapButton>
        <ui.PopoverMenu type='viewby-menu' triggerLabel={label} m={'above'}>
            <bem.PopoverMenu__link key={'all'} onClick={this.filterMap}>
              {t('-- See all data --')}
            </bem.PopoverMenu__link>
            {fields.map((f)=>{
              const name = f.name || f.$autoname;
              return (
                  <bem.PopoverMenu__link data-name={name} key={`f-${name}`} onClick={this.filterMap}>
                    {f.label[0]}
                  </bem.PopoverMenu__link>
                );
            })}
        </ui.PopoverMenu>
        {this.state.markerMap && this.state.markersVisible && 
          <bem.FormView__mapList>
            {Object.keys(this.state.markerMap).map((m, i)=>{
              return (
                  <div key={`m-${i}`} className="map-marker-item">
                    <span className={`map-marker map-marker-${this.state.markerMap[m].id}`}>
                      {this.state.markerMap[m].count}
                    </span>
                    <span className={`map-marker-label`}>
                      {m}
                    </span>
                  </div>
                );
            })}
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
