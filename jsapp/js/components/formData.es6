import React from 'react/addons';
import Reflux from 'reflux';
import _ from 'underscore';
import {dataInterface} from '../dataInterface';
import {
  Navigation,
} from 'react-router';
import actions from '../actions';
import bem from '../bem';
import stores from '../stores';
import Select from 'react-select';
import ui from '../ui';
import mixins from '../mixins';
import mdl from '../libs/rest_framework/material';
import {ProjectSettingsEditor} from '../components/formEditors';

import {
  assign,
  t,
  log,
} from '../utils';

var FormData = React.createClass({
  mixins: [
    Navigation,
    Reflux.ListenerMixin,
    mixins.dmix
  ],
  updateRouteState () {
    var currentRoutes = this.context.router.getCurrentRoutes();
    var activeRoute = currentRoutes[currentRoutes.length - 1];
    this.setState(assign({
        currentRoute: activeRoute
      }
    ));
  },
  componentDidMount () {
    this.listenTo(stores.session, this.dmixSessionStoreChange);
    this.listenTo(stores.asset, this.dmixAssetStoreChange);
    var uid = this.props.params.assetid || this.props.uid || this.props.params.uid;
    if (this.props.randdelay && uid) {
      window.setTimeout(()=>{
        actions.resources.loadAsset({id: uid});
      }, Math.random() * 3000);
    } else if (uid) {
      actions.resources.loadAsset({id: uid});
    }

    this.updateRouteState();
  },
  componentWillReceiveProps () {
    this.updateRouteState();
  },
  render () {
    if (this.state.deployment__identifier != undefined) {
      var deployment__identifier = this.state.deployment__identifier;
      var report__base = deployment__identifier.replace('/forms/', '/reports/');
      var iframeUrl = '';   
      switch(this.state.currentRoute.name) {
        case 'form-data-report':
          iframeUrl = report__base+'/digest.html';
          break;
        case 'form-data-table':
          iframeUrl = report__base+'/export.html';
          break;
        case 'form-data-downloads':
          iframeUrl = report__base+'/export/';
          break;
        case 'form-data-gallery':
          iframeUrl = deployment__identifier+'/photos';
          break;
        case 'form-data-map':
          iframeUrl = deployment__identifier+'/map';
          break;
        case 'form-data-settings':
          iframeUrl = deployment__identifier+'/form_settings';
          break;
      }
    }

    return (
            <bem.FormView>
              <bem.FormView__wrapper>
                <bem.FormView__cell m='iframe'>
                  {this.state.name != undefined && this.state.currentRoute.name == 'form-data-settings' ? 
                    <ProjectSettingsEditor asset={this.state} iframeUrl={iframeUrl} />
                  : 
                    <iframe src={iframeUrl} />
                  }
                </bem.FormView__cell>
              </bem.FormView__wrapper>              
            </bem.FormView>
      );
  },
  componentDidUpdate() {
    mdl.upgradeDom();
  }

})

export default FormData;
