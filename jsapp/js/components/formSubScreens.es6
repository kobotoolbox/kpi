import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import actions from '../actions';
import bem from '../bem';
import stores from '../stores';
import mixins from '../mixins';
import DocumentTitle from 'react-document-title';
import SharingForm from '../components/modalForms/sharingForm';
import ProjectSettings from '../components/modalForms/projectSettings';
import DataTable from '../components/table';

import {ProjectDownloads} from '../components/formEditors';

import {PROJECT_SETTINGS_CONTEXTS} from '../constants';

import FormMap from '../components/map';
import RESTServices from '../components/RESTServices';

import {
  t
} from '../utils';

export class FormSubScreens extends React.Component {
  constructor(props){
    super(props);
    this.state = {};
    autoBind(this);
  }
  componentDidMount () {
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
    if (!this.state.permissions)
      return false;

    if (this.props.location.pathname != `/forms/${this.state.uid}/settings` &&
        !this.userCan('view_submissions', this.state)) {
      return this.renderDenied();
    }

    if (this.props.location.pathname == `/forms/${this.state.uid}/settings` &&
        !this.userCan('change_asset', this.state)) {
      return this.renderDenied();
    }

    var iframeUrl = '';
    var report__base = '';
    var deployment__identifier = '';

    if (this.state.uid != undefined) {
      if (this.state.deployment__identifier != undefined) {
        deployment__identifier = this.state.deployment__identifier;
        report__base = deployment__identifier.replace('/forms/', '/reports/');
      }
      switch(this.props.location.pathname) {
        case `/forms/${this.state.uid}/data/report-legacy`:
          iframeUrl = report__base+'/digest.html';
          break;
        case `/forms/${this.state.uid}/data/table`:
          return <DataTable asset={this.state} />;
        case `/forms/${this.state.uid}/data/table-legacy`:
          iframeUrl = report__base+'/export.html';
          break;
        case `/forms/${this.state.uid}/data/gallery`:
          iframeUrl = deployment__identifier+'/photos';
          break;
        case `/forms/${this.state.uid}/data/map`:
          return <FormMap asset={this.state} />;
        case `/forms/${this.state.uid}/data/map/${this.props.params.viewby}`:
          return <FormMap asset={this.state} viewby={this.props.params.viewby}/>;
        case `/forms/${this.state.uid}/data/downloads`:
          return this.renderProjectDownloads();
        case `/forms/${this.state.uid}/settings`:
          return this.renderSettingsEditor();
        case `/forms/${this.state.uid}/settings/media`:
          iframeUrl = deployment__identifier+'/form_settings';
          break;
        case `/forms/${this.state.uid}/settings/sharing`:
          return this.renderSharing();
        case `/forms/${this.state.uid}/settings/rest`:
          return <RESTServices asset={this.state} />;
        case `/forms/${this.state.uid}/settings/rest/${this.props.params.hookUid}`:
          return <RESTServices asset={this.state} hookUid={this.props.params.hookUid}/>;
        case `/forms/${this.state.uid}/settings/kobocat`:
          iframeUrl = deployment__identifier+'/form_settings';
          break;
        case `/forms/${this.state.uid}/reset`:
          return this.renderReset();
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
  renderSettingsEditor() {
    var docTitle = this.state.name || t('Untitled');
    return (
        <DocumentTitle title={`${docTitle} | KoboToolbox`}>
          <bem.FormView m='form-settings'>
            <ProjectSettings
              context={PROJECT_SETTINGS_CONTEXTS.EXISTING}
              formAsset={this.state}
            />
          </bem.FormView>
        </DocumentTitle>
    );
  }
  renderProjectDownloads() {
    var docTitle = this.state.name || t('Untitled');
    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        <ProjectDownloads asset={this.state} />
      </DocumentTitle>
    );
  }
  renderSharing() {
    return (
      <bem.FormView m='form-settings-sharing'>
        <SharingForm uid={this.props.params.assetid} />
      </bem.FormView>
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
  renderDenied() {
    return (
      <bem.FormView>
        <bem.Loading>
          <bem.Loading__inner>
            <h3>
              {t('Access Denied')}
            </h3>
            {t('You do not have permission to view this page.')}
          </bem.Loading__inner>
        </bem.Loading>
      </bem.FormView>
    );
  }
}

reactMixin(FormSubScreens.prototype, Reflux.ListenerMixin);
reactMixin(FormSubScreens.prototype, mixins.dmix);
reactMixin(FormSubScreens.prototype, mixins.permissions);
reactMixin(FormSubScreens.prototype, mixins.contextRouter);

FormSubScreens.contextTypes = {
  router: PropTypes.object
};

export default FormSubScreens;
