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
import TextBox from './textBox';
import ui from '../ui';
import bem from '../bem';
import DocumentTitle from 'react-document-title';
import TextareaAutosize from 'react-autosize-textarea';
import stores from '../stores';
import {hashHistory} from 'react-router';
import {DebounceInput} from 'react-debounce-input';

import {session} from '../stores';
import mixins from '../mixins';

const newFormMixins = [
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
  PROJECT_SETTINGS_CONTEXTS,
  ASSET_TYPES
} from '../constants';

var formViaUrlHelpLink = 'http://help.kobotoolbox.org/creating-forms/importing-an-xlsform-via-url';

/*
This is used for multiple different purposes:

1. When creating new project
2. When replacing project with new one
3. When editing project in /settings
4. When editing or creating asset in Form Builder

Identifying the purpose is done by checking `context` and `formAsset`.

You can listen to field changes by `onProjectDetailsChange` prop function.
*/
export class ProjectSettings extends React.Component {
  constructor(props){
    super(props);

    this.STEPS = {
      FORM_SOURCE: 'form-source',
      CHOOSE_TEMPLATE: 'choose-template',
      UPLOAD_FILE: 'upload-file',
      IMPORT_URL: 'import-url',
      PROJECT_DETAILS: 'project-details'
    }

    const formAsset = this.props.formAsset;

    this.state = {
      isSessionLoaded: !!session.currentAccount,
      isSubmitPending: false,
      formAsset: formAsset,
      // project details
      name: formAsset ? formAsset.name : '',
      description: formAsset ? formAsset.settings.description : '',
      sector: formAsset ? formAsset.settings.sector : null,
      country: formAsset ? formAsset.settings.country : null,
      'share-metadata': formAsset ? formAsset.settings['share-metadata'] : false,
      // steps
      currentStep: null,
      previousStep: null,
      // importing url
      isImportFromURLPending: false,
      importUrl: '',
      importUrlButtonEnabled: false,
      importUrlButton: t('Import'),
      // template
      isApplyTemplatePending: false,
      applyTemplateButton: t('Next'),
      chosenTemplateUid: null,
      // upload files
      isUploadFilePending: false
    };

    autoBind(this);
  }

  /*
   * setup
   */

  componentDidMount() {
    this.setInitialStep();
    this.listenTo(session, (session) => {
      this.setState({
        isSessionLoaded: true,
      });
    });
  }

  setInitialStep() {
    switch (this.props.context) {
      case PROJECT_SETTINGS_CONTEXTS.NEW:
      case PROJECT_SETTINGS_CONTEXTS.REPLACE:
        return this.displayStep(this.STEPS.FORM_SOURCE);
      case PROJECT_SETTINGS_CONTEXTS.EXISTING:
      case PROJECT_SETTINGS_CONTEXTS.BUILDER:
        return this.displayStep(this.STEPS.PROJECT_DETAILS);
      default:
        throw new Error(`Unknown context: ${this.props.context}!`);
    }
  }

  getBaseTitle() {
    switch (this.props.context) {
      case PROJECT_SETTINGS_CONTEXTS.NEW:
        return t('Create project');
      case PROJECT_SETTINGS_CONTEXTS.REPLACE:
        return t('Replace project');
      case PROJECT_SETTINGS_CONTEXTS.EXISTING:
      case PROJECT_SETTINGS_CONTEXTS.BUILDER:
      default:
        return t('Project settings');
    }
  }

  getStepTitle(step) {
    switch (step) {
      case this.STEPS.FORM_SOURCE: return t('Choose a source');
      case this.STEPS.CHOOSE_TEMPLATE: return t('Choose template');
      case this.STEPS.UPLOAD_FILE: return t('Upload XLSForm');
      case this.STEPS.IMPORT_URL: return t('Import XLSForm');
      case this.STEPS.PROJECT_DETAILS: return t('Project details');
      default: return '';
    }
  }

  getFilenameFromURI(url) {
    return decodeURIComponent(new URL(url).pathname.split('/').pop().split('.')[0]);
  }

  /*
   * handling user input
   */

  onAnyDataChange(fieldName, fieldValue) {
    if (typeof this.props.onProjectDetailsChange === 'function') {
      this.props.onProjectDetailsChange({fieldName, fieldValue});
    }
  }

  onNameChange(evt) {
    this.setState({name: evt.target.value});
    this.onAnyDataChange('name', evt.target.value);
  }

  onDescriptionChange(evt) {
    this.setState({description: evt.target.value});
    this.onAnyDataChange('description', evt.target.value);
  }

  onCountryChange(val) {
    this.setState({country: val});
    this.onAnyDataChange('country', val);
  }

  onSectorChange(val) {
    this.setState({sector: val});
    this.onAnyDataChange('sector', val);
  }

  onShareMetadataChange(evt) {
    this.setState({'share-metadata': evt.target.checked});
    this.onAnyDataChange('share-metadata', evt.target.checked);
  }

  onImportUrlChange(value) {
    this.setState({
      importUrl: value,
      importUrlButtonEnabled: isAValidUrl(value),
      importUrlButton: t('Import')
    });
  }

  onTemplateChange(templateUid) {
    this.setState({
      chosenTemplateUid: templateUid
    });
  }

  resetApplyTemplateButton() {
    this.setState({
      isApplyTemplatePending: false,
      applyTemplateButton: t('Choose')
    });
  }

  resetImportUrlButton() {
    this.setState({
      isImportFromURLPending: false,
      importUrlButtonEnabled: false,
      importUrlButton: t('Import'),
    });
  }

  /*
   * routes navigation
   */

  goToFormBuilder(assetUid) {
    stores.pageState.hideModal();
    hashHistory.push(`/forms/${assetUid}/edit`);
  }

  goToFormLanding() {
    stores.pageState.hideModal();
    hashHistory.push(`/forms/${this.state.formAsset.uid}/landing`);
  }

  /*
   * modal steps navigation
   */

  displayStep(targetStep) {
    const currentStep = this.state.currentStep;
    const previousStep = this.state.previousStep;

    if (targetStep === currentStep) {
      return;
    } else if (targetStep === previousStep) {
      this.setState({
        currentStep: previousStep,
        previousStep: null
      });
    } else {
      this.setState({
        currentStep: targetStep,
        previousStep: currentStep
      });
    }

    if (this.props.onSetModalTitle) {
      const stepTitle = this.getStepTitle(targetStep);
      const baseTitle = this.getBaseTitle();
      this.props.onSetModalTitle(`${baseTitle}: ${stepTitle}`);
    }
  }

  displayPreviousStep() {
    if (this.state.previousStep) {
      this.displayStep(this.state.previousStep);
    }
  }

  /*
   * handling asset creation
   */

  getOrCreateFormAsset() {
    const assetPromise = new Promise((resolve, reject) => {
      if (this.state.formAsset) {
        resolve(this.state.formAsset);
      } else {
        dataInterface.createResource({
          name: 'Untitled',
          asset_type: 'survey',
          settings: JSON.stringify({
            description: '',
            sector: null,
            country: null,
            'share-metadata': false
          })
        }).done((asset) => {
          resolve(asset);
        }).fail(function(r){
          reject(t('Error: asset could not be created.') + ` (code: ${r.statusText})`);
        });
      }
    });
    return assetPromise;
  }

  createAssetAndOpenInBuilder() {
    dataInterface.createResource({
      name: this.state.name,
      settings: JSON.stringify({
        description: this.state.description,
        sector: this.state.sector,
        country: this.state.country,
        'share-metadata': this.state['share-metadata']
      }),
      asset_type: 'survey',
    }).done((asset) => {
      this.goToFormBuilder(asset.uid);
    }).fail(function(r){
      alertify.error(t('Error: new project could not be created.') + ` (code: ${r.statusText})`);
    });
  }

  updateAndOpenAsset() {
    actions.resources.updateAsset(
      this.state.formAsset.uid,
      {
        name: this.state.name,
        settings: JSON.stringify({
          description: this.state.description,
          sector: this.state.sector,
          country: this.state.country,
          'share-metadata': this.state['share-metadata']
        }),
      }, {
        onComplete: () => {
          // no need to open asset from within asset's settings view
          if (this.props.context !== PROJECT_SETTINGS_CONTEXTS.EXISTING) {
            this.goToFormLanding();
          }
        }
      }
    );
  }

  applyTemplate(evt) {
    evt.preventDefault();

    this.setState({
      isApplyTemplatePending: true,
      applyTemplateButton: t('Please wait…')
    });

    actions.resources.cloneAsset({
      uid: this.state.chosenTemplateUid,
      new_asset_type: 'survey'
    }, {
      onComplete: (asset) => {
        if (this.props.context === PROJECT_SETTINGS_CONTEXTS.REPLACE) {
          // when replacing, we omit PROJECT_DETAILS step
          this.handleReplaceDone();
        } else {
          this.setState({
            formAsset: asset,
            name: asset.name,
            description: asset.settings.description,
            sector: asset.settings.sector,
            country: asset.settings.country,
            'share-metadata': asset.settings['share-metadata'] || false,
          });
          this.resetApplyTemplateButton();
          this.displayStep(this.STEPS.PROJECT_DETAILS);
        }
      },
      onFailed: (asset) => {
        this.resetApplyTemplateButton();
        alertify.error(t('Could not create project!'));
      }
    });
  }

  importFromURL(evt) {
    evt.preventDefault();

    if (isAValidUrl(this.state.importUrl)) {
      this.setState({
        isImportFromURLPending: true,
        importUrlButtonEnabled: false,
        importUrlButton: t('Retrieving form, please wait...')
      });

      this.getOrCreateFormAsset().then(
        (asset) => {
          this.setState({formAsset: asset});

          this.applyUrlToAsset(this.state.importUrl, asset).then(
            (data) => {
              dataInterface.getAsset({id: data.uid}).done((finalAsset) => {
                if (this.props.context === PROJECT_SETTINGS_CONTEXTS.REPLACE) {
                  // when replacing, we omit PROJECT_DETAILS step
                  this.handleReplaceDone();
                } else {
                  // try proposing something more meaningful than "Untitled"
                  const newName = decodeURIComponent(new URL(this.state.importUrl).pathname.split('/').pop().split('.')[0]);

                  this.setState({
                    formAsset: finalAsset,
                    name: newName,
                    description: finalAsset.settings.description,
                    sector: finalAsset.settings.sector,
                    country: finalAsset.settings.country,
                    'share-metadata': finalAsset.settings['share-metadata'],
                    isImportFromURLPending: false
                  });
                  this.displayStep(this.STEPS.PROJECT_DETAILS);
                }
              }).fail(() => {
                this.resetImportUrlButton();
                alertify.error(t('Failed to reload project after import!'));
              });
            },
            () => {
              this.resetImportUrlButton();
              alertify.error(t('XLSForm Import failed. Check that the XLSForm and/or the URL are valid, and try again.'));
            }
          );
        },
        () => {
          alertify.error(t('Could not initialize XLSForm import!'));
        }
      );
    }
  }

  onFileDrop(files, rejectedFiles, evt) {
    if (files.length >= 1) {
      this.setState({isUploadFilePending: true});

      this.getOrCreateFormAsset().then(
        (asset) => {
          this.applyFileToAsset(files[0], asset).then(
            (data) => {
              dataInterface.getAsset({id: data.uid}).done((finalAsset) => {
                if (this.props.context === PROJECT_SETTINGS_CONTEXTS.REPLACE) {
                  // when replacing, we omit PROJECT_DETAILS step
                  this.handleReplaceDone();
                } else {
                  // try proposing something more meaningful than "Untitled"
                  const newName = files[0].name.split('.')[0];
                  this.setState({
                    formAsset: finalAsset,
                    name: newName,
                    description: finalAsset.settings.description,
                    sector: finalAsset.settings.sector,
                    country: finalAsset.settings.country,
                    'share-metadata': finalAsset.settings['share-metadata'],
                    isUploadFilePending: false
                  });
                  this.displayStep(this.STEPS.PROJECT_DETAILS);
                }
              }).fail(() => {
                this.setState({isUploadFilePending: false});
                alertify.error(t('Failed to reload project after upload!'));
              });
            },
            (response) => {
              if (response && response.messages && response.messages.error) {
                alertify.error(response.messages.error);
              } else {
                alertify.error(t('Could not initialize XLSForm upload!'));
              }
            }
          );
        },
        () => {
          this.setState({isUploadFilePending: false});
          alertify.error(t('Could not import XLSForm!'))
        }
      );
    }
  }

  handleReplaceDone() {
    this.updateAndOpenAsset();
  }

  handleSubmit(evt) {
    evt.preventDefault();

    // simple non-empty name validation
    if (!this.state.name.trim()) {
      alertify.error(t('Please enter a title for your project!'));
      return
    }

    this.setState({isSubmitPending: true});

    if (this.state.formAsset) {
      this.updateAndOpenAsset();
    } else {
      this.createAssetAndOpenInBuilder();
    }
  }

  /*
   * rendering
   */

  renderStepFormSource() {
    return (
      <bem.FormModal__form className='project-settings project-settings--form-source'>
        {this.props.context !== PROJECT_SETTINGS_CONTEXTS.REPLACE &&
          <bem.Modal__subheader>
            {t('Choose one of the options below to continue. You will be prompted to enter name and other details in further steps.')}
          </bem.Modal__subheader>
        }

        <bem.FormModal__item m='form-source-buttons'>
          {this.props.context === PROJECT_SETTINGS_CONTEXTS.NEW &&
            <button onClick={this.displayStep.bind(this, this.STEPS.PROJECT_DETAILS)}>
              <i className='k-icon-edit' />
              {t('Build from scratch')}
            </button>
          }

          {this.props.context !== PROJECT_SETTINGS_CONTEXTS.REPLACE &&
            <button onClick={this.displayStep.bind(this, this.STEPS.CHOOSE_TEMPLATE)}>
              <i className='k-icon-template' />
              {t('Use a template')}
            </button>
          }

          <button onClick={this.displayStep.bind(this, this.STEPS.UPLOAD_FILE)}>
            <i className='k-icon-upload' />
            {t('Upload an XLSForm')}
          </button>

          <button onClick={this.displayStep.bind(this, this.STEPS.IMPORT_URL)}>
            <i className='k-icon-link' />
            {t('Import an XLSForm via URL')}
          </button>
        </bem.FormModal__item>
      </bem.FormModal__form>
    );
  }

  renderStepChooseTemplate() {
    return (
      <bem.FormModal__form className='project-settings project-settings--choose-template'>
        <TemplatesList onSelectTemplate={this.onTemplateChange}/>

        <bem.Modal__footer>
          {this.renderBackButton()}

          <bem.Modal__footerButton
            m='primary'
            type='submit'
            onClick={this.applyTemplate}
            disabled={!this.state.chosenTemplateUid || this.state.isApplyTemplatePending}
            className='mdl-js-button'
          >
            {this.state.applyTemplateButton}
          </bem.Modal__footerButton>
        </bem.Modal__footer>
      </bem.FormModal__form>
    );
  }

  renderStepUploadFile() {
    return (
      <bem.FormModal__form className='project-settings project-settings--upload-file'>
        <bem.Modal__subheader>
          {t('Import an XLSForm from your computer.')}
        </bem.Modal__subheader>

        {!this.state.isUploadFilePending &&
          <Dropzone
            onDrop={this.onFileDrop.bind(this)}
            multiple={false}
            className='dropzone'
            activeClassName='dropzone-active'
            rejectClassName='dropzone-reject'
            accept={validFileTypes()}
          >
            <i className='k-icon-xls-file' />
            {t(' Drag and drop the XLSForm file here or click to browse')}
          </Dropzone>
        }
        {this.state.isUploadFilePending &&
          <div className='dropzone'>
            {this.renderLoading(t('Uploading file…'))}
          </div>
        }

        <bem.Modal__footer>
          {this.renderBackButton()}
        </bem.Modal__footer>
      </bem.FormModal__form>
    );
  }

  renderStepImportUrl() {
    return (
      <bem.FormModal__form className='project-settings project-settings--import-url'>
        <div className='intro'>
          {t('Enter a valid XLSForm URL in the field below.')}<br/>
          <a href={formViaUrlHelpLink} target='_blank'>
            {t('Having issues? See this help article.')}
          </a>
        </div>

        <bem.FormModal__item>
          <TextBox
            type='url'
            label={t('URL')}
            placeholder='https://'
            value={this.state.importUrl}
            onChange={this.onImportUrlChange}
          />
        </bem.FormModal__item>

        <bem.Modal__footer>
          {this.renderBackButton()}

          <bem.Modal__footerButton
            m='primary'
            type='submit'
            onClick={this.importFromURL}
            disabled={!this.state.importUrlButtonEnabled}
            className='mdl-js-button'
          >
            {this.state.importUrlButton}
          </bem.Modal__footerButton>
        </bem.Modal__footer>
      </bem.FormModal__form>
    );
  }

  renderStepProjectDetails() {
    const sectors = session.currentAccount.available_sectors;
    const countries = session.currentAccount.available_countries;

    return (
      <bem.FormModal__form
        onSubmit={this.handleSubmit}
        onChange={this.onProjectDetailsFormChange}
        className={[
          'project-settings',
          'project-settings--project-details',
          this.props.context === PROJECT_SETTINGS_CONTEXTS.BUILDER ? 'project-settings--narrow' : null
        ].join(' ')}
      >
        {this.props.context === PROJECT_SETTINGS_CONTEXTS.EXISTING &&
          <bem.Modal__footer>
            <bem.Modal__footerButton
              m='primary'
              onClick={this.handleSubmit}
              className='mdl-js-button'
            >
              {t('Save Changes')}
            </bem.Modal__footerButton>
          </bem.Modal__footer>
        }

        <bem.FormModal__item m='wrapper'>
          {/* form builder displays name in different place */}
          {this.props.context !== PROJECT_SETTINGS_CONTEXTS.BUILDER &&
            <bem.FormModal__item>
              <label htmlFor='name'>
                {t('Project Name')}
              </label>
              <input type='text'
                id='name'
                placeholder={t('Enter title of project here')}
                value={this.state.name}
                onChange={this.onNameChange}
              />
            </bem.FormModal__item>
          }

          <bem.FormModal__item>
            <label htmlFor='description'>
              {t('Description')}
            </label>
            <TextareaAutosize
              onChange={this.onDescriptionChange}
              value={this.state.description}
              placeholder={t('Enter short description here')}
            />
          </bem.FormModal__item>

          <bem.FormModal__item>
            <label className='long'>
              {t('Please specify the country and the sector where this project will be deployed. ')}
              {/*t('This information will be used to help you filter results on the project list page.')*/}
            </label>
          </bem.FormModal__item>

          <bem.FormModal__item m='sector'>
            <label htmlFor='sector'>
              {t('Sector')}
            </label>
            <Select
              id='sector'
              value={this.state.sector}
              onChange={this.onSectorChange}
              options={sectors}
              className='kobo-select'
              classNamePrefix='kobo-select'
              menuPlacement='auto'
            />
          </bem.FormModal__item>

          <bem.FormModal__item  m='country'>
            <label htmlFor='country'>
              {t('Country')}
            </label>
            <Select
              id='country'
              value={this.state.country}
              onChange={this.onCountryChange}
              options={countries}
              className='kobo-select'
              classNamePrefix='kobo-select'
              menuPlacement='auto'
            />
          </bem.FormModal__item>

          <bem.FormModal__item m='metadata-share'>
            <input
              type='checkbox'
              id='share-metadata'
              checked={this.state['share-metadata']}
              onChange={this.onShareMetadataChange}
            />
            <label htmlFor='share-metadata'>
              {t('Help KoboToolbox improve this product by sharing the sector and country where this project will be deployed.')}
              &nbsp;
              {t('All the information is submitted anonymously, and will not include the project name or description listed above.')}
            </label>
          </bem.FormModal__item>

          {(this.props.context === PROJECT_SETTINGS_CONTEXTS.NEW || this.props.context === PROJECT_SETTINGS_CONTEXTS.REPLACE) &&
            <bem.Modal__footer>
              {/* Don't allow going back if asset already exist */}
              {!this.state.formAsset &&
                this.renderBackButton()
              }

              <bem.Modal__footerButton
                m='primary'
                type='submit'
                onClick={this.handleSubmit}
                className='mdl-js-button'
                disabled={this.state.isSubmitPending}
              >
                {this.state.isSubmitPending && t('Please wait…')}
                {!this.state.isSubmitPending && this.props.context === PROJECT_SETTINGS_CONTEXTS.NEW && t('Create project')}
                {!this.state.isSubmitPending && this.props.context === PROJECT_SETTINGS_CONTEXTS.REPLACE && t('Save')}
              </bem.Modal__footerButton>
            </bem.Modal__footer>
          }

          {this.props.context === PROJECT_SETTINGS_CONTEXTS.EXISTING && this.props.iframeUrl &&
            <bem.FormView__cell m='iframe'>
              <iframe src={this.props.iframeUrl} />
            </bem.FormView__cell>
          }
        </bem.FormModal__item>
      </bem.FormModal__form>
    );
  }

  renderBackButton() {
    if (this.state.previousStep) {
      const isBackButtonDisabled = (
        this.state.isSubmitPending ||
        this.state.isApplyTemplatePending ||
        this.state.isImportFromURLPending ||
        this.state.isUploadFilePending
      )
      return (
        <bem.Modal__footerButton
          m='back'
          type='button'
          onClick={this.displayPreviousStep}
          disabled={isBackButtonDisabled}
        >
          {t('Back')}
        </bem.Modal__footerButton>
      )
    } else {
      return false;
    }
  }

  renderLoading(message = t('loading…')) {
    return (
      <bem.Loading>
        <bem.Loading__inner>
          <i />
          {message}
        </bem.Loading__inner>
      </bem.Loading>
    );
  }

  render() {
    if (!this.state.isSessionLoaded || !this.state.currentStep) {
      return this.renderLoading();
    }

    switch (this.state.currentStep) {
      case this.STEPS.FORM_SOURCE: return this.renderStepFormSource();
      case this.STEPS.CHOOSE_TEMPLATE: return this.renderStepChooseTemplate();
      case this.STEPS.UPLOAD_FILE: return this.renderStepUploadFile();
      case this.STEPS.IMPORT_URL: return this.renderStepImportUrl();
      case this.STEPS.PROJECT_DETAILS: return this.renderStepProjectDetails();
      default:
        throw new Error(`Unknown step: ${this.state.currentStep}!`);
    }
  }
};

reactMixin(ProjectSettings.prototype, Reflux.ListenerMixin);
reactMixin(ProjectSettings.prototype, mixins.droppable);

ProjectSettings.contextTypes = {
  router: PropTypes.object
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
                      <label htmlFor='type'>{t('Select export type')}</label>
                      <select name='type' value={this.state.type}
                          onChange={this.typeChange}>
                        <option value='xls'>{t('XLS')}</option>
                        <option value='xls_legacy'>{t('XLS (legacy)')}</option>
                        <option value='csv'>{t('CSV')}</option>
                        <option value='csv_legacy'>{t('CSV (legacy)')}</option>
                        <option value='zip_legacy'>{t('Media Attachments (ZIP)')}</option>
                        <option value='kml_legacy'>{t('GPS coordinates (KML)')}</option>
                        <option value='analyser_legacy'>{t('Excel Analyser')}</option>
                        <option value='spss_labels'>{t('SPSS Labels')}</option>
                      </select>
                    </bem.FormModal__item>
                  , this.state.type == 'xls' || this.state.type == 'csv' ? [
                      <bem.FormModal__item key={'x'} m='export-format'>
                        <label htmlFor='lang'>{t('Value and header format')}</label>
                        <select name='lang' value={this.state.lang}
                            onChange={this.langChange}>
                          <option value='xml'>{t('XML values and headers')}</option>
                          { translations.length < 2 &&
                            <option value='_default'>{t('Labels')}</option>
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
                        <input type='checkbox' id='hierarchy_in_labels'
                          value={this.state.hierInLabels}
                          onChange={this.hierInLabelsChange}
                        />
                        <label htmlFor='hierarchy_in_labels'>
                          {t('Include groups in headers')}
                        </label>
                      </bem.FormModal__item>,
                      this.state.hierInLabels ?
                        <bem.FormModal__item key={'g'}>
                          <label htmlFor='group_sep'>{t('Group separator')}</label>
                          <input type='text' name='group_sep'
                            value={this.state.groupSep}
                            onChange={this.groupSepChange}
                          />
                        </bem.FormModal__item>
                      : null,
                      dvcount > 1 ?
                        <bem.FormModal__item key={'v'} m='export-fields-from-all-versions'>
                          <input type='checkbox' id='fields_from_all_versions'
                            checked={this.state.fieldsFromAllVersions}
                            onChange={this.fieldFromAllVersionsChange}
                          />
                          <label htmlFor='fields_from_all_versions'>
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
                      } />
                    </bem.FormModal__item>
                  :
                    <bem.FormModal__item key={'s'} m='export-submit'>
                      <input type='submit'
                        value={t('Export')}
                        className='mdl-button mdl-js-button mdl-button--raised mdl-button--colored'
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
                    <bem.FormView__label />
                  </bem.FormView__group>
                  {this.state.exports.map((item, n) => {
                    let timediff = moment().diff(moment(item.date_created), 'seconds');
                    return (
                      <bem.FormView__group m='items' key={item.uid}
                        className={timediff < 45 ? 'recent' : ''}>
                        <bem.FormView__label m='type'>
                          {item.data.type}
                        </bem.FormView__label>
                        <bem.FormView__label m='date'>
                          {formatTime(item.date_created)}
                        </bem.FormView__label>
                        <bem.FormView__label m='lang'>
                        {item.data.lang === '_default' ? t('Default') : item.data.lang}
                        </bem.FormView__label>
                        <bem.FormView__label m='include-groups'>
                          {item.data.hierarchy_in_labels === 'false' ? t('No') : t('Yes')}
                        </bem.FormView__label>
                        <bem.FormView__label m='multi-versioned'>
                          {
                            // Old exports won't have this field, and we should
                            // assume they *were* multi-versioned
                            item.data.fields_from_all_versions === 'false' ? t('No') : t('Yes')
                          }
                        </bem.FormView__label>
                        <bem.FormView__label m='action'>
                          {item.status == 'complete' &&
                            <a className='form-view__link form-view__link--export-download'
                              href={item.result} data-tip={t('Download')}>
                              <i className='k-icon-download' />
                            </a>
                          }
                          {item.status == 'error' &&
                            <span data-tip={item.messages.error}>
                              {t('Export Failed')}
                            </span>
                          }
                          {item.status != 'error' && item.status != 'complete' &&
                            <span className='animate-processing'>{t('processing...')}</span>
                          }
                          <a className='form-view__link form-view__link--export-delete'
                            onClick={this.deleteExport} data-euid={item.uid} data-tip={t('Delete')}>
                            <i className='k-icon-trash' />
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
      this.state.desiredAssetType = ASSET_TYPES.template.id;
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
