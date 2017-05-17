import React from 'react';
import L from 'leaflet/dist/leaflet';
import Reflux from 'reflux';
import _ from 'underscore';
import {dataInterface} from '../dataInterface';
import {hashHistory} from 'react-router';
import bem from '../bem';
import stores from '../stores';
import ui from '../ui';

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

var FormMap = React.createClass({
  mixins: [
    Reflux.ListenerMixin
  ],
  getInitialState () {
  	let survey = this.props.asset.content.survey;
  	var hasGeoPoint = false;
  	survey.forEach(function(s) {
  		if (s.type == 'geopoint')
  			hasGeoPoint = true;
  	});

    return {
      map: false,
      markers: false,
      heatmap: false,
      markersVisible: true,
      markerMap: false,
      fields: [],
      hasGeoPoint: hasGeoPoint
    };
  },
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

		var baseLayers = {
		    "OpenStreetMap": streets,
		    "OpenTopoMap": outdoors,
		    "ESRI World Imagery": satellite
		};

		L.control.layers(baseLayers).addTo(map);

    this.setState({
        map: map,
        fields: fields
      }
    );

		this.getMarkers(map);
		this.getHeatMap(map);
  },
  getMarkers (map) {
  	var params = {
  		kuid: this.props.kuid || undefined
  	};

  	var _self = this;
	  dataInterface.getMapSubmissions(params)
      .done(function(data) {
				var prepPoints = [];
				var icon = L.divIcon({
					className: 'map-marker',
					iconSize: [20, 20],
				});

				if (params.kuid) {
					var mapMarkers = _self.prepFilteredMarkers(data, params.kuid);
			    _self.setState({
			        markerMap: mapMarkers
			      }
			    );
				} else {
			    _self.setState({
			        markerMap: false
			      }
			    );					
				}

		    data.forEach(function(item){
		    	if (item._geolocation && item._geolocation[0] && item._geolocation[1]) {
						if (params.kuid && mapMarkers != undefined) {
							var itemId = item[params.kuid];
							icon = L.divIcon({
								className: `map-marker map-marker-${mapMarkers[itemId].id}`,
								iconSize: [20, 20],
							});
						}

		    		prepPoints.push(L.marker(item._geolocation, {icon: icon}));
		    	}
		    });
        if(params.kuid != undefined) {
          var markers = L.featureGroup(prepPoints);
        } else {
          var markers = L.markerClusterGroup();
          markers.addLayers(prepPoints);
        }
				markers.addTo(map);
				map.fitBounds(markers.getBounds());

		    _self.setState({
		        markers: markers
		      }
		    );
      });

  },
  prepFilteredMarkers (data, kuid) {
		var markerMap = new Object();
		data.forEach(function(listitem, i) {
	    var m = listitem[kuid];

    	var l = i.toString();
    	var c = l[l.length - 1];

	    if (markerMap[m] == null) {
	        markerMap[m] = {count: 1, id: c};
	    } else {
	        markerMap[m]['count'] += 1;
	    }
		});

		return markerMap;

  },
  getHeatMap (map) {
  	var params = {
  		kuid: this.props.kuid || undefined
  	};
  	var _self = this;

	  dataInterface.getMapSubmissions(params)
      .done(function(data) {
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

      })
      .fail(function(err) {
      	console.log(err);
      });
  },
  showMarkers () {
  	var map = this.state.map;
  	var markers = this.state.markers;
  	var heatmap = this.state.heatmap;

  	if (map.hasLayer(heatmap)) {
	  	map.addLayer(markers);
	  	map.removeLayer(heatmap);
	    this.setState({
	        markersVisible: true
	      }
	    );
  	}
  },
  showHeatmap () {
  	var map = this.state.map;
  	var markers = this.state.markers;
  	var heatmap = this.state.heatmap;

  	if (map.hasLayer(markers)) {
	  	map.addLayer(heatmap);
	  	map.removeLayer(markers);
	    this.setState({
	        markersVisible: false
	      }
	    );
  	}
  },
  filterMap (evt) {
    let kuid = evt.target.getAttribute('data-kuid') || undefined;
    if (kuid != undefined) {
      hashHistory.push(`/forms/${this.props.asset.uid}/data/map/${kuid}`);
    } else {
      hashHistory.push(`/forms/${this.props.asset.uid}/data/map`);
    }
  },
  componentWillReceiveProps (nextProps) {
  	if (this.props.kuid != nextProps.kuid) {
	  	var map = this.state.map;
	  	var markers = this.state.markers;
	  	var heatmap = this.state.heatmap;

	  	if (map.hasLayer(markers)) {
	  		map.removeLayer(markers);
	      window.setTimeout(()=>{
	        this.getMarkers(map);
	      }, 500);

	  	}
	  	if (map.hasLayer(heatmap)) {
	  		map.removeLayer(heatmap);
	      window.setTimeout(()=>{
	        this.getHeatMap(map);
	      }, 500);
	  	}
  	}
  },
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
  	var label = t('View Options')
  	if (this.props.kuid != undefined) {
	  	var kuid = this.props.kuid;
	    fields.forEach(function(f){
	    	if(kuid == f.$kuid)
	    		label = f.label[0];
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
              return (
                  <bem.PopoverMenu__link data-kuid={f.$kuid} key={`f-${f.$kuid}`} onClick={this.filterMap}>
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
})

export default FormMap;
