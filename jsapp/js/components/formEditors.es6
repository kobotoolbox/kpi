import $ from 'jquery';
import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import alertify from 'alertifyjs';
import editableFormMixin from '../editorMixins/editableForm';
import Select from 'react-select';
import Dropzone from 'react-dropzone';
import moment from 'moment';
import ui from '../ui';
import bem from '../bem';
import DocumentTitle from 'react-document-title';
import TextareaAutosize from 'react-autosize-textarea';
import stores from '../stores';
import {hashHistory} from 'react-router';
import {DebounceInput} from 'react-debounce-input';

import {session} from '../stores';
import mixins from '../mixins';

let newFormMixins = [
    Reflux.ListenerMixin,
    editableFormMixin
];
import TemplatesList from './formEditors/templatesList';

import actions from '../actions';
import {dataInterface} from '../dataInterface';
import {
  t,
  redirectTo,
  assign,
  formatTime,
  validFileTypes,
  isAValidUrl
} from '../utils';

import {
  update_states,
} from '../constants';

var formViaUrlHelpLink = 'http://help.kobotoolbox.org/creating-forms/importing-an-xlsform-via-url';

export class ProjectSettings extends React.Component {
  constructor(props){
    super(props);
    let state = {
      sessionLoaded: !!session.currentAccount,
      name: '',
      description: '',
      sector: '',
      country: '',
      'share-metadata': false,
      step3: false,
      importUrl: '',
      importUrlButtonEnabled: false,
      importUrlButton: t('Import'),
      chooseTemplateButtonEnabled: false,
      chooseTemplateButton: t('Choose'),
      chosenTemplateUid: null
    }
    if (this.props.initialData !== undefined) {
      assign(state, this.props.initialData);
    }
    this.state = state;
    autoBind(this);
  }
  componentDidMount () {
    this.listenTo(session, (session) => {
      this.setState({
        sessionLoaded: true,
      });
    });
  }
  nameChange (evt) {
    this.setState({
      name: evt.target.value
    });
  }
  descriptionChange (evt) {
    this.setState({
      description: evt.target.value
    });
  }
  countryChange (val) {
    this.setState({
      country: val
    });
  }
  sectorChange (val) {
    this.setState({
      sector: val
    });
  }
  shareMetadataChange (evt) {
    this.setState({
      'share-metadata': evt.target.checked
    });
  }
  importUrlChange (value) {
    this.setState({
      importUrl: value,
      importUrlButtonEnabled: value.length > 6 ? true : false,
      importUrlButton: t('Import')
    });
  }
  goToFormBuilder() {
    hashHistory.push(`/forms/${this.props.newFormAsset.uid}/edit`);
    stores.pageState.hideModal();
  }
  goToFormLanding() {
    hashHistory.push(`/forms/${this.props.newFormAsset.uid}/landing`);
    stores.pageState.hideModal();
  }
  displayChooseTemplate() {
    this.setState({step3: 'template'});
  }
  displayUpload() {
    this.setState({step3: 'upload'});
  }
  displayImport() {
    this.setState({step3: 'import'});
  }
  resetStep3() {
    this.setState({step3: false});
  }
  chooseTemplate(evt) {
    evt.preventDefault();

    this.setState({
      chooseTemplateButtonEnabled: false,
      chooseTemplateButton: t('Creating…')
    });

    dataInterface.patchAsset(this.props.newFormAsset.uid, {
      clone_from: this.state.chosenTemplateUid,
      asset_type: 'template'
    }).done(() => {
      // open created project
      this.goToFormLanding();
    }).fail((data) => {
      // reset button and display error notification
      this.setState({
        chooseTemplateButtonEnabled: true,
        chooseTemplateButton: t('Choose')
      });
      alertify.error(t('Could not create project!'));
    });
  }
  handleTemplateSelected(templateUid) {
    this.setState({
      chooseTemplateButtonEnabled: true,
      chosenTemplateUid: templateUid
    });
  }
  importFromURL(evt) {
    evt.preventDefault();
    let validUrl = isAValidUrl(this.state.importUrl);

    if (!validUrl) {
      alertify.error(t('Please enter a valid URL'));
    } else {
      let asset = this.props.newFormAsset;
      let params = {
        destination: asset.url,
        url: this.state.importUrl,
        name: asset.name,
        assetUid: asset.uid
      };
      this._forEachDroppedFile(params);

      this.setState({
        importUrlButtonEnabled: false,
        importUrlButton: t('Retrieving form, please wait...')
      });
    }
  }
  onDrop (files, rejectedFiles, evt) {
    if (files.length === 0)
      return;

    let asset = this.props.newFormAsset;
    this.dropFiles(files, [], evt, { destination: asset.url });
  }

  onSubmit (evt) {
    evt.preventDefault();
    if (!this.state.name.trim()) {
      alertify.error(t('Please enter a title for your project'));
    } else {
      this.props.onSubmit(this);
    }
  }
  render () {
    if (!this.state.sessionLoaded) {
      return (
          <bem.Loading>
            <bem.Loading__inner>
              <i />
              {t('loading...')}
            </bem.Loading__inner>
          </bem.Loading>
        )
    }
    var acct = session.currentAccount;
    var sectors = acct.available_sectors;
    var countries = acct.available_countries;

    if (this.state.permissions && this.state.owner) {
      var perms = this.state.permissions;
      var owner = this.state.owner;

      var sharedWith = [];
      perms.forEach(function(perm) {
        if (perm.user__username != owner && perm.user__username != 'AnonymousUser' && sharedWith.indexOf(perm.user__username) < 0)
          sharedWith.push(perm.user__username);
      });
    }

    if (!this.props.newFormAsset) {
      return (
        <bem.FormModal__form onSubmit={this.onSubmit}>
          {this.props.context != 'existingForm' &&
            <bem.FormModal__item m='upload-note'>
              <i className="k-icon-alert" />
              <label className="long">
                {t('Enter your project details below. In the next step, you can import an XLSForm (via upload or URL) or design the form from scratch in the Form Builder. ')}
              </label>
            </bem.FormModal__item>
          }

          {this.props.context == 'existingForm' &&
            <bem.FormModal__item m={['actions', 'fixed']}>
              <button onClick={this.onSubmit} className="mdl-button mdl-js-button mdl-button--raised mdl-button--colored">
                {this.props.submitButtonValue}
              </button>
            </bem.FormModal__item>
          }
          <bem.FormModal__item m='wrapper'>
            <bem.FormModal__item>
              <label htmlFor="name">
                {t('Project Name')}
              </label>
              <input type="text"
                  id="name"
                  placeholder={t('Enter title of project here')}
                  value={this.state.name}
                  onChange={this.nameChange}
                />
            </bem.FormModal__item>
            <bem.FormModal__item>
              <label htmlFor="description">
                {t('Description')}
              </label>
              <TextareaAutosize
                onChange={this.descriptionChange}
                value={this.state.description}
                placeholder={t('Enter short description here')} />
            </bem.FormModal__item>
            <bem.FormModal__item>
              <label className="long">
                {t('Please specify the country and the sector where this project will be deployed. ')}
                {/*t('This information will be used to help you filter results on the project list page.')*/}
              </label>
            </bem.FormModal__item>

            <bem.FormModal__item m='sector'>
              <label htmlFor="sector">
                {t('Sector')}
              </label>
              <Select
                  id="sector"
                  value={this.state.sector}
                  onChange={this.sectorChange}
                  options={sectors}
                />
            </bem.FormModal__item>
            <bem.FormModal__item  m='country'>
              <label htmlFor="country">
                {t('Country')}
              </label>
              <Select
                id="country"
                value={this.state.country}
                onChange={this.countryChange}
                options={countries}
              />
            </bem.FormModal__item>
            <bem.FormModal__item m='metadata-share'>
              <input type="checkbox"
                  id="share-metadata"
                  checked={this.state['share-metadata']}
                  onChange={this.shareMetadataChange}
                />
              <label htmlFor="share-metadata">
                {t('Help KoboToolbox improve this product by sharing the sector and country where this project will be deployed.')}
                &nbsp;
                {t('All the information is submitted anonymously, and will not include the project name or description listed above.')}
              </label>
            </bem.FormModal__item>

            {this.props.context != 'existingForm' &&
              <bem.FormModal__item m='actions'>
                <button onClick={this.onSubmit} className="mdl-button mdl-js-button mdl-button--raised mdl-button--colored">
                  {this.props.submitButtonValue}
                </button>
              </bem.FormModal__item>
            }

            {this.props.context == 'existingForm' && this.props.iframeUrl &&
              <bem.FormView__cell m='iframe'>
                <iframe src={this.props.iframeUrl} />
              </bem.FormView__cell>

            }
          </bem.FormModal__item>
        </bem.FormModal__form>
      );
    } else {
      return (
        <bem.FormModal__form>
          {!this.state.step3 &&
            <bem.FormModal__item m='newForm-step2'>
              {this.props.context !== 'replaceXLS' &&
                <bem.FormModal__item m='upload-note'>
                  <label className="long">
                    {t('Project "##" has been created. Choose one of the options below to continue.').replace('##', this.props.newFormAsset.name)}
                  </label>
                </bem.FormModal__item>
              }
              <bem.FormModal__item m='new-project-buttons'>
                {this.props.context !== 'replaceXLS' &&
                  <button onClick={this.goToFormBuilder}>
                    <i className="k-icon-edit" />
                    {t('Design in Form Builder')}
                  </button>
                }
                {this.props.context !== 'replaceXLS' &&
                  <button onClick={this.displayChooseTemplate}>
                    <i className="k-icon-template" />
                    {t('Use a Template')}
                  </button>
                }
                <button onClick={this.displayUpload}>
                  <i className="k-icon-upload" />
                  {t('Upload an XLSForm')}
                </button>
                <button onClick={this.displayImport}>
                  <i className="k-icon-link" />
                  {t('Import an XLSForm via URL')}
                </button>
              </bem.FormModal__item>
            </bem.FormModal__item>
          }
          {this.state.step3 == 'template' &&
            <bem.FormModal__item m='newForm-step3'>
              <bem.FormModal__item m='template'>
                <TemplatesList onSelectTemplate={this.handleTemplateSelected}/>

                <button
                  onClick={this.chooseTemplate}
                  disabled={!this.state.chooseTemplateButtonEnabled}
                  className="mdl-button mdl-js-button mdl-button--raised mdl-button--colored"
                >
                  {this.state.chooseTemplateButton}
                </button>
              </bem.FormModal__item>

              <bem.FormView__link m='step3-back' onClick={this.resetStep3}>
                {t('Back')}
              </bem.FormView__link>
            </bem.FormModal__item>
          }
          {this.state.step3 == 'upload' &&
            <bem.FormModal__item m='newForm-step3'>
              <div className="intro">
                {t('Import an XLSForm from your computer.')}
              </div>
              <Dropzone onDrop={this.onDrop.bind(this)}
                            multiple={false}
                            className='dropzone'
                            activeClassName='dropzone-active'
                            rejectClassName='dropzone-reject'
                            accept={validFileTypes()}>
                <i className="k-icon-xls-file" />
                {t(' Drag and drop the XLSForm file here or click to browse')}
              </Dropzone>
              <bem.FormView__link m='step3-back' onClick={this.resetStep3}>
                {t('back')}
              </bem.FormView__link>
            </bem.FormModal__item>
          }
          {this.state.step3 == 'import' &&
            <bem.FormModal__item m='newForm-step3'>
              <div className="intro">
                {t('Enter a valid XLSForm URL in the field below.')}<br/>
                <a href={formViaUrlHelpLink}
                  target="_blank">
                  {t('Having issues? See this help article.')}
                </a>
              </div>
              <bem.FormModal__item m='url-import'>
                <label htmlFor="url">
                  {t('URL')}
                </label>
                <DebounceInput
                  type="text"
                  id="importUrl"
                  debounceTimeout={300}
                  value={this.state.importUrl}
                  placeholder='https://'
                  onChange={event => this.importUrlChange(event.target.value)} />
                <button onClick={this.importFromURL}
                        disabled={!this.state.importUrlButtonEnabled}
                        className="mdl-button mdl-js-button mdl-button--raised mdl-button--colored">
                  {this.state.importUrlButton}
                </button>
              </bem.FormModal__item>

              <bem.FormView__link m='step3-back' onClick={this.resetStep3}>
                {t('Back')}
              </bem.FormView__link>
            </bem.FormModal__item>
          }

        </bem.FormModal__form>
      );
    }
  }
};

reactMixin(ProjectSettings.prototype, Reflux.ListenerMixin);
reactMixin(ProjectSettings.prototype, mixins.droppable);

ProjectSettings.contextTypes = {
  router: PropTypes.object
};

export class ProjectSettingsEditor extends React.Component {
  constructor(props){
    super(props);
    autoBind(this);
  }
  updateAsset (settingsComponent) {
    actions.resources.updateAsset(
      this.props.asset.uid,
      {
        name: settingsComponent.state.name,
        settings: JSON.stringify({
          description: settingsComponent.state.description,
          sector: settingsComponent.state.sector,
          country: settingsComponent.state.country,
          'share-metadata': settingsComponent.state['share-metadata']
        }),
      }
    );
  }
  render () {
    let initialData = {
      name: this.props.asset.name,
      permissions: this.props.asset.permissions,
      owner: this.props.asset.owner__username,
      assetid: this.props.asset.uid
    };
    assign(initialData, this.props.asset.settings);

    return (
      <ProjectSettings
        onSubmit={this.updateAsset}
        submitButtonValue={t('Save Changes')}
        initialData={initialData}
        context='existingForm'
        iframeUrl={this.props.iframeUrl}
      />
    );
  }
};

export class ProjectDownloads extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      type: 'xls',
      lang: '_default',
      hierInLabels: false,
      groupSep: '/',
      // If there's only one version, the resulting file will be the same
      // regardless of whether this is true or false, but we'll use this to
      // report if the export was "multi-versioned" later
      fieldsFromAllVersions: this.props.asset.deployed_versions.count > 1,
      exports: false,
      formSubmitDisabled: false
    };

    autoBind(this);
  }
  handleChange (e, attr) {
    if (e.target) {
      if (e.target.type == 'checkbox') {
        var val = e.target.checked;
      } else {
        var val = e.target.value;
      }
    } else {
      // react-select just passes a string
      var val = e;
    }
    this.setState({[attr]: val});
  }
  typeChange (e) {this.handleChange(e, 'type');}
  langChange (e) {this.handleChange(e, 'lang');}
  fieldFromAllVersionsChange (e) {this.handleChange(e, 'fieldsFromAllVersions');}
  hierInLabelsChange (e) {this.handleChange(e, 'hierInLabels');}
  groupSepChange (e) {this.handleChange(e, 'groupSep');}
  handleSubmit (e) {
    e.preventDefault();
    this.setState({
      formSubmitDisabled: true
    });

    setTimeout(function() {
      if(!this._calledComponentWillUnmount)
        this.setState({'formSubmitDisabled': false});
    }.bind(this), 5000);

    if (this.state.type.indexOf('_legacy') < 0) {
      let url = this.props.asset.deployment__data_download_links[
        this.state.type
      ];
      if (this.state.type == 'xls' || this.state.type == 'csv') {
        url = `${dataInterface.rootUrl}/exports/`; // TODO: have the backend pass the URL in the asset
        let postData = {
          source: this.props.asset.url,
          type: this.state.type,
          lang: this.state.lang,
          hierarchy_in_labels: this.state.hierInLabels,
          group_sep: this.state.groupSep,
          fields_from_all_versions: this.state.fieldsFromAllVersions
        };
        $.ajax({
          method: 'POST',
          url: url,
          data: postData
        }).done((data) => {
          $.ajax({url: data.url}).then((taskData) => {
            // this.checkForFastExport(data.url);
            this.getExports();
          }).fail((taskFail) => {
            alertify.error(t('Failed to retrieve the export task.'));
            log('export task retrieval failed', taskFail);
          });
        }).fail((failData) => {
          alertify.error(t('Failed to create the export.'));
          log('export creation failed', failData);
        });
      } else {
        redirectTo(url);
      }
    }
  }

  componentDidMount() {
    let translations = this.props.asset.content.translations;
    if (translations.length > 1) {
      this.setState({lang: translations[0]});
    }
    this.getExports();
  }

  componentWillUnmount() {
    clearInterval(this.pollingInterval);
  }

  refreshExport(url) {
    $.ajax({url: url}).then((taskData) => {
      if (taskData.status !== 'created' && taskData.status !== 'processing') {
        this.getExports();
      }
    });
  }

  // checkForFastExport(exportUrl) {
  //   // Save the user some time and an extra click if their export completes
  //   // very quickly
  //   const maxChecks = 3;
  //   const checkDelay = 500;

  //   let checksDone = 0;
  //   let checkInterval;
  //   let checkFunc = () => {
  //     $.ajax({url: exportUrl}).then((data) => {
  //       if(++checksDone >= maxChecks || (data.status !== 'created' &&
  //                                        data.status !== 'processing'))
  //       {
  //         clearInterval(checkInterval);
  //         if(data.status === 'complete') {
  //           redirectTo(data.result);
  //         }
  //       }
  //     });
  //   };
  //   checkInterval = setInterval(checkFunc, checkDelay);
  // }

  getExports() {
    clearInterval(this.pollingInterval);

    dataInterface.getAssetExports(this.props.asset.uid).done((data)=>{
      if (data.count > 0) {
        data.results.reverse();
        this.setState({exports: data.results});

        // Start a polling Interval if there is at least one export is not yet complete
        data.results.every((item) => {
          if(item.status === 'created' || item.status === 'processing'){
            this.pollingInterval = setInterval(this.refreshExport, 4000, item.url);
            return false;
          } else {
            return true;
          }
        });
      } else {
        this.setState({exports: false});
      }
    });
  }

  deleteExport(evt) {
    let el = $(evt.target).closest('[data-euid]').get(0);
    let euid = el.getAttribute('data-euid');

    let dialog = alertify.dialog('confirm');
    let opts = {
      title: t('Delete export?'),
      message: t('Are you sure you want to delete this export? This action is not reversible.'),
      labels: {ok: t('Delete'), cancel: t('Cancel')},
      onok: () => {
        dataInterface.deleteAssetExport(euid).then(()=> {
          this.getExports();
        }).fail((jqxhr)=> {
          alertify.error(t('Failed to delete export.'));
        });
      },
      oncancel: () => {dialog.destroy()}
    };
    dialog.set(opts).show();

  }

  render () {
    let translations = this.props.asset.content.translations;
    let dvcount = this.props.asset.deployed_versions.count;
    var docTitle = this.props.asset.name || t('Untitled');
    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        <bem.FormView m='form-data-downloads'>
          <bem.FormView__row>
              <bem.FormView__cell m='label'>
                {t('Download Data')}
              </bem.FormView__cell>
              <bem.FormView__cell m={['box', 'padding']}>
                <bem.FormModal__form onSubmit={this.handleSubmit}>
                  {[
                    <bem.FormModal__item key={'t'} m='export-type'>
                      <label htmlFor="type">{t('Select export type')}</label>
                      <select name="type" value={this.state.type}
                          onChange={this.typeChange}>
                        <option value="xls">{t('XLS')}</option>
                        <option value="xls_legacy">{t('XLS (legacy)')}</option>
                        <option value="csv">{t('CSV')}</option>
                        <option value="csv_legacy">{t('CSV (legacy)')}</option>
                        <option value="zip_legacy">{t('Media Attachments (ZIP)')}</option>
                        <option value="kml_legacy">{t('GPS coordinates (KML)')}</option>
                        <option value="analyser_legacy">{t('Excel Analyser')}</option>
                        <option value="spss_labels">{t('SPSS Labels')}</option>
                      </select>
                    </bem.FormModal__item>
                  , this.state.type == 'xls' || this.state.type == 'csv' ? [
                      <bem.FormModal__item key={'x'} m='export-format'>
                        <label htmlFor="lang">{t('Value and header format')}</label>
                        <select name="lang" value={this.state.lang}
                            onChange={this.langChange}>
                          <option value="xml">{t('XML values and headers')}</option>
                          { translations.length < 2 &&
                            <option value="_default">{t('Labels')}</option>
                          }
                          {
                            translations && translations.map((t, i) => {
                              if (t) {
                                return <option value={t} key={i}>{t}</option>;
                              }
                            })
                          }
                        </select>
                      </bem.FormModal__item>,
                      <bem.FormModal__item key={'h'} m='export-group-headers'>
                        <input type="checkbox" id="hierarchy_in_labels"
                          value={this.state.hierInLabels}
                          onChange={this.hierInLabelsChange}
                        />
                        <label htmlFor="hierarchy_in_labels">
                          {t('Include groups in headers')}
                        </label>
                      </bem.FormModal__item>,
                      this.state.hierInLabels ?
                        <bem.FormModal__item key={'g'}>
                          <label htmlFor="group_sep">{t('Group separator')}</label>
                          <input type="text" name="group_sep"
                            value={this.state.groupSep}
                            onChange={this.groupSepChange}
                          />
                        </bem.FormModal__item>
                      : null,
                      dvcount > 1 ?
                        <bem.FormModal__item key={'v'} m='export-fields-from-all-versions'>
                          <input type="checkbox" id="fields_from_all_versions"
                            checked={this.state.fieldsFromAllVersions}
                            onChange={this.fieldFromAllVersionsChange}
                          />
                          <label htmlFor="fields_from_all_versions">
                            {t('Include fields from all ___ deployed versions').replace('___', dvcount)}
                          </label>
                        </bem.FormModal__item>
                      : null
                    ] : null
                  , this.state.type.indexOf('_legacy') > 0 ?
                    <bem.FormModal__item m='downloads' key={'d'}>
                      <iframe src={
                          this.props.asset.deployment__data_download_links[
                            this.state.type]
                      }>
                      </iframe>
                    </bem.FormModal__item>
                  :
                    <bem.FormModal__item key={'s'} m='export-submit'>
                      <input type="submit"
                        value={t('Export')}
                        className="mdl-button mdl-js-button mdl-button--raised mdl-button--colored"
                        disabled={this.state.formSubmitDisabled}/>
                    </bem.FormModal__item>
                  ]}
                </bem.FormModal__form>
              </bem.FormView__cell>
          </bem.FormView__row>
          {this.state.exports && !this.state.type.endsWith('_legacy') &&
            <bem.FormView__row>
                <bem.FormView__cell m='label'>
                  {t('Exports')}
                </bem.FormView__cell>
                <bem.FormView__cell m={['box', 'exports-table']}>
                  <bem.FormView__group m={['items', 'headings']}>
                    <bem.FormView__label m='type'>{t('Type')}</bem.FormView__label>
                    <bem.FormView__label m='date'>{t('Created')}</bem.FormView__label>
                    <bem.FormView__label m='lang'>{t('Language')}</bem.FormView__label>
                    <bem.FormView__label m='include-groups'>{t('Include Groups')}</bem.FormView__label>
                    <bem.FormView__label m='multi-versioned'>{t('Multiple Versions')}</bem.FormView__label>
                    <bem.FormView__label></bem.FormView__label>
                  </bem.FormView__group>
                  {this.state.exports.map((item, n) => {
                    let timediff = moment().diff(moment(item.date_created), 'seconds');
                    return (
                      <bem.FormView__group m="items" key={item.uid}
                        className={timediff < 45 ? 'recent' : ''}>
                        <bem.FormView__label m='type'>
                          {item.data.type}
                        </bem.FormView__label>
                        <bem.FormView__label m='date'>
                          {formatTime(item.date_created)}
                        </bem.FormView__label>
                        <bem.FormView__label m='lang'>
                        {item.data.lang === "_default" ? t('Default') : item.data.lang}
                        </bem.FormView__label>
                        <bem.FormView__label m='include-groups'>
                          {item.data.hierarchy_in_labels === "false" ? t('No') : t("Yes")}
                        </bem.FormView__label>
                        <bem.FormView__label m='multi-versioned'>
                          {
                            // Old exports won't have this field, and we should
                            // assume they *were* multi-versioned
                            item.data.fields_from_all_versions === "false" ? t('No') : t('Yes')
                          }
                        </bem.FormView__label>
                        <bem.FormView__label m='action'>
                          {item.status == 'complete' &&
                            <a className="form-view__link form-view__link--export-download"
                              href={item.result} data-tip={t('Download')}>
                              <i className="k-icon-download" />
                            </a>
                          }
                          {item.status == 'error' &&
                            <span data-tip={item.messages.error}>
                              {t('Export Failed')}
                            </span>
                          }
                          {item.status != 'error' && item.status != 'complete' &&
                            <span className="animate-processing">{t('processing...')}</span>
                          }
                          <a className="form-view__link form-view__link--export-delete"
                            onClick={this.deleteExport} data-euid={item.uid} data-tip={t('Delete')}>
                            <i className="k-icon-trash" />
                          </a>

                        </bem.FormView__label>
                      </bem.FormView__group>
                    );
                  })}
                </bem.FormView__cell>
            </bem.FormView__row>
          }
        </bem.FormView>
      </DocumentTitle>
    );
  }
};

export class AddToLibrary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      asset_updated: update_states.UP_TO_DATE,
      multioptionsExpanded: true,
      surveyAppRendered: false,
      name: '',
      kind: 'asset',
      asset: false,
      editorState: 'new',
      backRoute: '/library'
    };

    if (this.props.location.pathname === '/library/new/template') {
      this.state.desiredAssetType = 'template';
    }

    autoBind(this);
  }
}

newFormMixins.forEach(function(mixin) {
  reactMixin(AddToLibrary.prototype, mixin);
});

let existingFormMixins = [
    Reflux.ListenerMixin,
    editableFormMixin
];

let contextTypes = {
  router: PropTypes.object
};

export class FormPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      asset_updated: update_states.UP_TO_DATE,
      multioptionsExpanded: true,
      surveyAppRendered: false,
      name: '',
      editorState: 'existing',
      backRoute: '/forms'
    };
    autoBind(this);
  }
}

export class LibraryPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      asset_updated: update_states.UP_TO_DATE,
      multioptionsExpanded: true,
      surveyAppRendered: false,
      name: '',
      editorState: 'existing',
      backRoute: '/library'
    };
    autoBind(this);
  }
}

existingFormMixins.forEach(function(mixin) {
  reactMixin(FormPage.prototype, mixin);
  reactMixin(LibraryPage.prototype, mixin);
});

FormPage.contextTypes = contextTypes;
LibraryPage.contextTypes = contextTypes;
