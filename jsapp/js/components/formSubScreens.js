import React, {Suspense} from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import {actions} from '../actions';
import bem from 'js/bem';
import assetStore from 'js/assetStore';
import mixins from '../mixins';
import DocumentTitle from 'react-document-title';
import SharingForm from './permissions/sharingForm';
import ProjectSettings from './modalForms/projectSettings';
import FormMedia from './modalForms/formMedia';
import {PROJECT_SETTINGS_CONTEXTS} from '../constants';
import FormMap from './map';
import RESTServices from './RESTServices';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {ROUTES} from 'js/router/routerConstants';
import {withRouter} from 'js/router/legacy';

const ConnectProjects = React.lazy(() =>
  import(
    /* webpackPrefetch: true */ 'js/components/dataAttachments/connectProjects'
  )
);
const DataTable = React.lazy(() =>
  import(/* webpackPrefetch: true */ 'js/components/submissions/table')
);
const ProjectDownloads = React.lazy(() =>
  import(
    /* webpackPrefetch: true */ 'js/components/projectDownloads/projectDownloads'
  )
);
const FormGallery = React.lazy(() =>
  import(/* webpackPrefetch: true */ './formGallery/formGallery.component')
);

export class FormSubScreens extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
    autoBind(this);
  }
  componentDidMount() {
    this.listenTo(assetStore, this.dmixAssetStoreChange);
    var uid =
      this.props.params.assetid || this.props.uid || this.props.params.uid;
    if (uid) {
      actions.resources.loadAsset({id: uid});
    }
  }
  render() {
    if (!this.state.permissions) {
      return false;
    }

    var iframeUrl = '';
    var report__base = '';
    var deployment__identifier = '';

    if (this.state.uid != undefined) {
      if (this.state.deployment__identifier != undefined) {
        deployment__identifier = this.state.deployment__identifier;
        report__base = deployment__identifier.replace('/forms/', '/reports/');
      }
      switch (this.props.router.location.pathname) {
        case ROUTES.FORM_TABLE.replace(':uid', this.state.uid):
          return (
            <Suspense fallback={null}>
              <DataTable asset={this.state} />
            </Suspense>
          );
        case ROUTES.FORM_GALLERY.replace(':uid', this.state.uid):
          return (
            <Suspense fallback={<div>Image Gallery</div>}>
              <FormGallery asset={this.state} />
            </Suspense>
          );
        case ROUTES.FORM_MAP.replace(':uid', this.state.uid):
          return <FormMap asset={this.state} />;
        case ROUTES.FORM_MAP_BY.replace(':uid', this.state.uid).replace(
          ':viewby',
          this.props.params.viewby
        ):
          return (
            <FormMap asset={this.state} viewby={this.props.params.viewby} />
          );
        case ROUTES.FORM_DOWNLOADS.replace(':uid', this.state.uid):
          return (
            <Suspense fallback={null}>
              <ProjectDownloads asset={this.state} />
            </Suspense>
          );
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
        case ROUTES.FORM_REST_HOOK.replace(':uid', this.state.uid).replace(
          ':hookUid',
          this.props.params.hookUid
        ):
          return (
            <RESTServices
              asset={this.state}
              hookUid={this.props.params.hookUid}
            />
          );
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
        <Suspense fallback={null}>
          <ConnectProjects asset={this.state} />
        </Suspense>
      </bem.FormView>
    );
  }
  renderReset() {
    return <LoadingSpinner />;
  }

  renderUpload() {
    return <FormMedia asset={this.state} />;
  }
}

reactMixin(FormSubScreens.prototype, Reflux.ListenerMixin);
reactMixin(FormSubScreens.prototype, mixins.dmix);
reactMixin(FormSubScreens.prototype, mixins.contextRouter);

FormSubScreens.contextTypes = {
  router: PropTypes.object,
};

export default withRouter(FormSubScreens);
