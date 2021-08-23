import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import {actions} from '../actions';
import bem from 'js/bem';
import {stores} from '../stores';
import mixins from '../mixins';
import DocumentTitle from 'react-document-title';
import SharingForm from './permissions/sharingForm';
import ProjectSettings from './modalForms/projectSettings';
import ConnectProjects from 'js/components/dataAttachments/connectProjects';
import FormMedia from './modalForms/formMedia';
import DataTable from 'js/components/submissions/table';
import ProjectDownloads from 'js/components/projectDownloads/projectDownloads';
import {PROJECT_SETTINGS_CONTEXTS} from '../constants';
import FormMap from './map';
import RESTServices from './RESTServices';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import AccessDeniedMessage from 'js/components/common/accessDeniedMessage';
import {ROUTES} from 'js/router/routerConstants';

export class FormSubScreens extends React.Component {
  constructor(props){
    super(props);
    this.state = {};
    autoBind(this);
  }
  componentDidMount () {
    this.listenTo(stores.asset, this.dmixAssetStoreChange);
    var uid = this.props.params.assetid || this.props.uid || this.props.params.uid;
    if (uid) {
      actions.resources.loadAsset({id: uid});
    }
  }
  render () {
    let permAccess = this.userCan('view_submissions', this.state) || this.userCanPartially('view_submissions', this.state);

    if (!this.state.permissions)
      return false;

    if ((this.props.location.pathname == `/forms/${this.state.uid}/settings` || this.props.location.pathname == `/forms/${this.state.uid}/settings/sharing`) &&
        // TODO: Once "Manage Project" permission is added, remove "Edit Form" access here
        !this.userCan('change_asset', this.state)) {
      return (<AccessDeniedMessage/>);
    }

    if (this.props.location.pathname == `/forms/${this.state.uid}/settings/rest` && !permAccess) {
      return (<AccessDeniedMessage/>);
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
        case ROUTES.FORM_TABLE.replace(':uid', this.state.uid):
          return <DataTable asset={this.state} />;
        case ROUTES.FORM_GALLERY.replace(':uid', this.state.uid):
          iframeUrl = deployment__identifier+'/photos';
          break;
        case ROUTES.FORM_MAP.replace(':uid', this.state.uid):
          return <FormMap asset={this.state} />;
        case ROUTES.FORM_MAP_BY
            .replace(':uid', this.state.uid)
            .replace(':viewby', this.props.params.viewby):
          return <FormMap asset={this.state} viewby={this.props.params.viewby}/>;
        case ROUTES.FORM_DOWNLOADS.replace(':uid', this.state.uid):
          return <ProjectDownloads asset={this.state}/>;
        case ROUTES.FORM_SETTINGS.replace(':uid', this.state.uid):
          return this.renderSettingsEditor();
        case ROUTES.FORM_MEDIA.replace(':uid', this.state.uid):
          return this.renderUpload();
        case ROUTES.FORM_SHARING.replace(':uid', this.state.uid):
          return this.renderSharing();
        case ROUTES.FORM_RECORDS.replace(':uid', this.state.uid):
          return this.renderRecords();
        case ROUTES.FORM_REST.replace(':uid', this.state.uid):
          return <RESTServices asset={this.state} />;
        case ROUTES.FORM_REST_HOOK
            .replace(':uid', this.state.uid)
            .replace(':hookUid', this.props.params.hookUid):
          return <RESTServices asset={this.state} hookUid={this.props.params.hookUid}/>;
        case ROUTES.FORM_KOBOCAT.replace(':uid', this.state.uid):
          iframeUrl = deployment__identifier+'/form_settings';
          break;
        case ROUTES.FORM_RESET.replace(':uid', this.state.uid):
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
  renderSharing() {
    const uid = this.props.params.assetid || this.props.params.uid;
    return (
      <bem.FormView m='form-settings-sharing'>
        <SharingForm uid={uid} />
      </bem.FormView>
    );
  }
  renderRecords() {
    return (
      <bem.FormView className='connect-projects'>
        <ConnectProjects asset={this.state}/>
      </bem.FormView>
    );
  }
  renderReset() {
    return (<LoadingSpinner/>);
  }

  renderUpload() {
    return (
      <FormMedia asset={this.state}/>
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
