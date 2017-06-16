import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import _ from 'underscore';
import {dataInterface} from '../dataInterface';

import actions from '../actions';
import bem from '../bem';
import stores from '../stores';
import Select from 'react-select';
import ui from '../ui';
import mixins from '../mixins';
import DocumentTitle from 'react-document-title';
import SharingForm from '../components/sharingForm';

import {
  ProjectSettingsEditor,
  ProjectDownloads
} from '../components/formEditors';

import {
  assign,
  t,
  log,
  notify,
} from '../utils';

export class FormSubScreens extends React.Component {
  constructor(props){
    super(props);
    this.state = {};
    autoBind(this);
  }
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

  }
  render () {
    var formClass = '', iframeUrl = '', report__base = '', deployment__identifier = '';

    if (this.state.uid != undefined) {
      if (this.state.deployment__identifier != undefined) {
        var deployment__identifier = this.state.deployment__identifier;
        var report__base = deployment__identifier.replace('/forms/', '/reports/');
      }
      switch(this.props.location.pathname) {
        case `/forms/${this.state.uid}/data/report-legacy`:
          iframeUrl = report__base+'/digest.html';
          break;
        case `/forms/${this.state.uid}/data/table`:
          iframeUrl = report__base+'/export.html';
          break;
        case `/forms/${this.state.uid}/data/gallery`:
          iframeUrl = deployment__identifier+'/photos';
          break;
        case `/forms/${this.state.uid}/data/map`:
          iframeUrl = deployment__identifier+'/map';
          break;
        // case `/forms/${this.state.uid}/settings/kobocat`:
        //   iframeUrl = deployment__identifier+'/form_settings';
        //   break;
        case `/forms/${this.state.uid}/data/downloads`:
          return this.renderProjectDownloads();
          break;
        case `/forms/${this.state.uid}/settings`:
          if (deployment__identifier != '')
            iframeUrl = deployment__identifier+'/form_settings';
          return this.renderSettingsEditor(iframeUrl);
          break;
        // case `/forms/${this.state.uid}/settings/sharing`:
        //   return this.renderSharing();
        //   break;
        case `/forms/${this.state.uid}/reset`:
          return this.renderReset();
          break;
      }
    }

    var docTitle = this.state.name || t('Untitled');

    return (
        <DocumentTitle title={`${docTitle} | KoboToolbox`}>      
          <bem.FormView>
            <bem.FormView__cell m='iframe'>
              <iframe src={iframeUrl} />
            </bem.FormView__cell>
          </bem.FormView>
        </DocumentTitle>
      );
  }
  renderSharing() {
    var docTitle = this.state.name || t('Untitled');
    return (
        <DocumentTitle title={`${docTitle} | KoboToolbox`}>
          <bem.FormView m={'settings-sharing'}>
            <SharingForm />
          </bem.FormView>
        </DocumentTitle>
    );
  }
  renderSettingsEditor(iframeUrl) {
    var docTitle = this.state.name || t('Untitled');
    return (
        <DocumentTitle title={`${docTitle} | KoboToolbox`}>
          <bem.FormView m='form-settings'>
            <ProjectSettingsEditor asset={this.state} iframeUrl={iframeUrl} />
          </bem.FormView>
        </DocumentTitle>
    );
  }
  renderProjectDownloads() {
    var docTitle = this.state.name || t('Untitled');
    return (
        <DocumentTitle title={`${docTitle} | KoboToolbox`}>
          <bem.FormView m='form-data-downloads'>
            <ProjectDownloads asset={this.state} />
          </bem.FormView>
        </DocumentTitle>
    );
  }
  renderReset() {
    return (
      <bem.Loading>
        <bem.Loading__inner>
          <i />
          {t('loading...')}
        </bem.Loading__inner>
      </bem.Loading>
    );
  }

};

reactMixin(FormSubScreens.prototype, Reflux.ListenerMixin);
reactMixin(FormSubScreens.prototype, mixins.dmix);
reactMixin(FormSubScreens.prototype, mixins.contextRouter);

FormSubScreens.contextTypes = {
  router: PropTypes.object
};

export default FormSubScreens;
