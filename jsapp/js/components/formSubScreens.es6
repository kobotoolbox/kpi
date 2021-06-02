import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Dropzone from 'react-dropzone';
import Reflux from 'reflux';
import {actions} from '../actions';
import {bem} from '../bem';
import {stores} from '../stores';
import mixins from '../mixins';
import DocumentTitle from 'react-document-title';
import SharingForm from './permissions/sharingForm';
import ProjectSettings from './modalForms/projectSettings';
import DataTable from 'js/components/submissions/table';
import ProjectExportsCreator from 'js/components/projectDownloads/projectExportsCreator';
import ProjectExportsList from 'js/components/projectDownloads/projectExportsList';
import {PROJECT_SETTINGS_CONTEXTS} from '../constants';
import FormMap from './map';
import RESTServices from './RESTServices';
import ui from '../ui';

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
    let permAccess = this.userCan('view_submissions', this.state) || this.userCan('partial_submissions', this.state);

    if (!this.state.permissions)
      return false;

    if ((this.props.location.pathname == `/forms/${this.state.uid}/settings` || this.props.location.pathname == `/forms/${this.state.uid}/settings/sharing`) &&
        // TODO: Once "Manage Project" permission is added, remove "Edit Form" access here
        !this.userCan('change_asset', this.state)) {
      return (<ui.AccessDeniedMessage/>);
    }

    if (this.props.location.pathname == `/forms/${this.state.uid}/settings/rest` && !permAccess) {
      return (<ui.AccessDeniedMessage/>);
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
        case `/forms/${this.state.uid}/data/table`:
          return <DataTable asset={this.state} />;
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
          //iframeUrl = deployment__identifier+'/form_settings';
          //break;
		  return this.renderUpload();
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
        <React.Fragment>
          {!stores.session.isLoggedIn &&
            <ui.AccessDeniedMessage/>
          }
          {stores.session.isLoggedIn &&
            <bem.FormView className='project-downloads'>
              <ProjectExportsCreator asset={this.state} />
              <ProjectExportsList asset={this.state} />
            </bem.FormView>
          }
        </React.Fragment>
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
  renderReset() {
    return (<ui.LoadingSpinner/>);
  }

  renderUpload() {
    return (
      <bem.FormModal__form className='project-settings project-settings--upload-file media-settings--upload-file'>

	  <div className='form-media__upload'>
        {!this.state.isUploadFilePending &&
          <Dropzone
              onDrop={this.renderUpload}
              className='dropzone'
          >
            <i className='k-icon-upload' />
            {t(' Drag and drop files here or click to browse')}
          </Dropzone>
        }
        {this.state.isUploadFilePending &&
          <div className='dropzone'>
          {this.renderLoading(t('Uploading file…'))}
          </div>
        }
        <div className='form-media__upload-url'>
            <label className='form-media__label'>{t('You can also add files using a URL')}</label>
            <input className='form-media__url-input' placeholder={t('Paste URL here')}/><button onClick={this.uploadFromURL} className='mdl-button mdl-button--raised mdl-button--colored form-media__url-button'>{t('ADD')}</button>
        </div>
      </div>

        {/* Temporary just for designing UI */}
        <div className='form-media__file-list'>
          <label className='form-media__list-label'>Files uploaded to this project</label>
            <ul>
                <li className='form-media__list-item'>
                  <i className='k-icon-pdf'/>
                  <a href='#'>This_is_the_name_of_a_file_01.jpg</a>
                  <i className='k-icon-trash'/>
                </li>
                <li className='form-media__list-item'>
                  <i className='k-icon-pdf'/>
                  <a href='#'>This_is_the_name_of_a_file_02.jpg</a>
                  <i className='k-icon-trash'/>
                </li>
                <li className='form-media__list-item'>
                  <i className='k-icon-pdf'/>
                  <a href='#'>This_is_the_name_of_a_file_03.jpg</a>
                  <i className='k-icon-trash'/>
                </li>
                <li className='form-media__list-item'>
                  <i className='k-icon-pdf'/>
                  <a href='#'>This_is_the_name_of_a_file_04.jpg</a>
                  <i className='k-icon-trash'/>
                </li>
            </ul>
        </div>

        {/* TODO: set filesToShow after successful upload and display uploadedFiles taken from asset

          {this.state.filesToShow &&
            <div className='form-media__file-list'>
              <label className='form-media__labelist'>Files uploaded to this project</label>
              {this.state.uploadedFiles.map((item, n) => {
                return (
                  <li className='form-media__list-item'>
                    <i className={dyanmically set icon for file type}/>
                    <a href='#'>This_is_the_name_of_a_file_01.jpg</a>
                    <i className='k-icon-trash' onClick={delete this file}/>
                  </li>
                );
              })}
            </div>
          }

        */}

      </bem.FormModal__form>
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
