import React from 'react';
import ReactDOM from 'react-dom';
import clonedeep from 'lodash.clonedeep';
import Select from 'react-select';
import _ from 'underscore';
import DocumentTitle from 'react-document-title';
import SurveyScope from '../models/surveyScope';
import {cascadeMixin} from './cascadeMixin';
import AssetNavigator from './assetNavigator';
import {hashHistory} from 'react-router';
import alertify from 'alertifyjs';
import ProjectSettings from '../components/modalForms/projectSettings';
import MetadataEditor from 'js/components/metadataEditor';
import {assign} from '../utils';
import {
  ASSET_TYPES,
  AVAILABLE_FORM_STYLES,
  PROJECT_SETTINGS_CONTEXTS,
  update_states,
  NAME_MAX_LENGTH,
  META_QUESTION_TYPES,
} from 'js/constants';
import {ROUTES} from 'js/router/routerConstants';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import AccessDeniedMessage from 'js/components/common/accessDeniedMessage';
import Modal from 'js/components/common/modal';
import bem from 'js/bem';
import {stores} from '../stores';
import {actions} from '../actions';
import dkobo_xlform from '../../xlform/src/_xlform.init';
import {dataInterface} from '../dataInterface';
import assetUtils from 'js/assetUtils';
import FormLockedMessage from 'js/components/locking/formLockedMessage';
import {
  hasAssetRestriction,
  hasAssetAnyLocking,
  isAssetAllLocked,
  isAssetLockable,
} from 'js/components/locking/lockingUtils';
import {
  LOCKING_RESTRICTIONS,
  LOCKING_UI_CLASSNAMES,
} from 'js/components/locking/lockingConstants';
import {
  koboMatrixParser,
  surveyToValidJson,
  getFormBuilderAssetType,
  unnullifyTranslations,
} from 'js/components/formBuilder/formBuilderUtils';
import envStore from 'js/envStore';

const ErrorMessage = bem.create('error-message');
const ErrorMessage__strong = bem.create('error-message__header', '<strong>');

const WEBFORM_STYLES_SUPPORT_URL = 'alternative_enketo.html';

const UNSAVED_CHANGES_WARNING = t('You have unsaved changes. Leave form without saving?');

const ASIDE_CACHE_NAME = 'kpi.editable-form.aside';

const LOCKING_SUPPORT_URL = 'library_locking.html';
const RECORDING_SUPPORT_URL = 'recording-interviews.html';

/**
 * This is a component that displays Form Builder's header and aside. It is also
 * responsible for rendering the survey editor app (all our coffee code). See
 * the `launchAppForSurveyContent` method below for all the magic.
 */

export default assign({
  componentDidMount() {
    this.props.router.setRouteLeaveHook(this.props.route, this.routerWillLeave);

    this.loadAsideSettings();

    if (!this.state.isNewAsset) {
      let uid = this.props.params.assetid || this.props.params.uid;
      stores.allAssets.whenLoaded(uid, (originalAsset) => {
        // Store asset object is mutable and there is no way to predict all the
        // bugs that come from this fact. Form Builder code is already changing
        // the content of the object, so we want to cut all the bugs at the
        // very start of the process.
        const asset = clonedeep(originalAsset);

        this.setState({asset: asset});

        // HACK switch to setState callback after updating to React 16+
        //
        // This needs to be called at least a single render after the state's
        // asset is being set, because `.form-wrap` node needs to exist for
        // `launchAppForSurveyContent` to work.
        window.setTimeout(() => {
          this.launchAppForSurveyContent(asset.content, {
            name: asset.name,
            settings__style: asset.settings__style,
            asset_uid: asset.uid,
            asset_type: asset.asset_type,
            asset: asset,
          });
        }, 0);
      });
    } else {
      this.launchAppForSurveyContent();
    }

    document.querySelector('.page-wrapper__content').addEventListener('scroll', this.handleScroll);
    this.listenTo(stores.surveyState, this.surveyStateChanged);
  },

  componentWillUnmount () {
    if (this.app && this.app.survey) {
      document.querySelector('.page-wrapper__content').removeEventListener('scroll', this.handleScroll);
      this.app.survey.off('change');
    }
    this.unpreventClosingTab();
  },

  routerWillLeave() {
    if (this.state.preventNavigatingOut) {
      return UNSAVED_CHANGES_WARNING;
    }
  },

  loadAsideSettings() {
    const asideSettings = sessionStorage.getItem(ASIDE_CACHE_NAME);
    if (asideSettings) {
      this.setState(JSON.parse(asideSettings));
    }
  },

  saveAsideSettings(asideSettings) {
    sessionStorage.setItem(ASIDE_CACHE_NAME, JSON.stringify(asideSettings));
  },

  onMetadataEditorChange() {
    this.onSurveyChange();
  },

  onProjectDetailsChange({fieldName, fieldValue}) {
    const settingsNew = this.state.settingsNew || {};
    settingsNew[fieldName] = fieldValue;
    this.setState({
      settingsNew: settingsNew
    });
    this.onSurveyChange();
  },

  surveyStateChanged(state) {
    this.setState(state);
  },

  onStyleChange(evt) {
    let settingsStyle = null;
    if (evt !== null) {
      settingsStyle = evt.value;
    }

    this.setState({
      settings__style: settingsStyle
    });
    this.onSurveyChange();
  },

  getStyleSelectVal(optionVal) {
    return _.find(AVAILABLE_FORM_STYLES, (option) => {
      return option.value === optionVal;
    });
  },

  onSurveyChange: _.debounce(function () {
    if (!this.state.asset_updated !== update_states.UNSAVED_CHANGES) {
      this.preventClosingTab();
    }
    this.setState({
      asset_updated: update_states.UNSAVED_CHANGES,
    });
  }, 200),

  preventClosingTab() {
    this.setState({preventNavigatingOut: true});
    $(window).on('beforeunload.noclosetab', function(){
      return UNSAVED_CHANGES_WARNING;
    });
  },

  unpreventClosingTab() {
    this.setState({preventNavigatingOut: false});
    $(window).off('beforeunload.noclosetab');
  },

  nameChange(evt) {
    this.setState({
      name: assetUtils.removeInvalidChars(evt.target.value),
    });
    this.onSurveyChange();
  },

  groupQuestions() {
    this.app.groupSelectedRows();
  },

  showAll(evt) {
    evt.preventDefault();
    evt.currentTarget.blur();
    this.app.expandMultioptions();
  },

  hasMetadataAndDetails() {
    return this.app && (
      this.state.asset.asset_type === ASSET_TYPES.survey.id ||
      this.state.asset.asset_type === ASSET_TYPES.template.id ||
      this.state.desiredAssetType === ASSET_TYPES.template.id
    );
  },

  needsSave() {
    return this.state.asset_updated === update_states.UNSAVED_CHANGES;
  },

  previewForm(evt) {
    if (evt && evt.preventDefault) {
      evt.preventDefault();
    }

    if (this.state.settings__style !== undefined) {
      this.app.survey.settings.set('style', this.state.settings__style);
    }

    if (this.state.name) {
      this.app.survey.settings.set('title', this.state.name);
    }

    let surveyJSON = surveyToValidJson(this.app.survey);
    if (this.state.asset) {
      surveyJSON = unnullifyTranslations(surveyJSON, this.state.asset.content);
    }
    let params = {source: surveyJSON};

    params = koboMatrixParser(params);

    if (this.state.asset && this.state.asset.url) {
      params.asset = this.state.asset.url;
    }

    dataInterface.createAssetSnapshot(params).done((content) => {
      this.setState({
        enketopreviewOverlay: content.enketopreviewlink,
      });
    }).fail((jqxhr) => {
      let err;
      if (jqxhr && jqxhr.responseJSON && jqxhr.responseJSON.error) {
        err = jqxhr.responseJSON.error;
      } else {
        err = t('Unknown Enketo preview error');
      }
      this.setState({
        enketopreviewError: err,
      });
    });
  },

  saveForm(evt) {
    if (evt && evt.preventDefault) {
      evt.preventDefault();
    }

    if (this.state.settings__style !== undefined) {
      this.app.survey.settings.set('style', this.state.settings__style);
    }

    let surveyJSON = surveyToValidJson(this.app.survey);
    if (this.state.asset) {
      let surveyJSONWithMatrix = koboMatrixParser({source: surveyJSON}).source;
      surveyJSON = unnullifyTranslations(surveyJSONWithMatrix, this.state.asset.content);
    }
    let params = {content: surveyJSON};

    if (this.state.name) {
      params.name = this.state.name;
    }

    // handle settings update (if any changed)
    if (this.state.settingsNew) {
      let settings = {};
      if (this.state.asset) {
        settings = this.state.asset.settings;
      }

      if (this.state.settingsNew.description) {
        settings.description = this.state.settingsNew.description;
      }
      if (this.state.settingsNew.sector) {
        settings.sector = this.state.settingsNew.sector;
      }
      if (this.state.settingsNew.country) {
        settings.country = this.state.settingsNew.country;
      }
      if (this.state.settingsNew['share-metadata']) {
        settings['share-metadata'] = this.state.settingsNew['share-metadata'];
      }
      params.settings = JSON.stringify(settings);
    }

    if (this.state.isNewAsset) {
      // we're intentionally leaving after creating new asset,
      // so there is nothing unsaved here
      this.unpreventClosingTab();

      // create new asset
      if (this.state.desiredAssetType) {
        params.asset_type = this.state.desiredAssetType;
      } else {
        params.asset_type = 'block';
      }
      if (this.state.parentAsset) {
        params.parent = assetUtils.buildAssetUrl(this.state.parentAsset);
      }
      actions.resources.createResource.triggerAsync(params)
        .then(() => {
          hashHistory.push(this.state.backRoute);
        });
    } else {
      // update existing asset
      const uid = this.props.params.assetid || this.props.params.uid;

      actions.resources.updateAsset.triggerAsync(uid, params)
        .then(() => {
          this.unpreventClosingTab();
          this.setState({
            asset_updated: update_states.UP_TO_DATE,
            surveySaveFail: false,
          });
        })
        .catch((resp) => {
          var errorMsg = `${t('Your changes could not be saved, likely because of a lost internet connection.')}&nbsp;${t('Keep this window open and try saving again while using a better connection.')}`;
          if (resp.statusText !== 'error') {
            errorMsg = resp.statusText;
          }

          alertify.defaults.theme.ok = 'ajs-cancel';
          let dialog = alertify.dialog('alert');
          let opts = {
            title: t('Error saving form'),
            message: errorMsg,
            label: t('Dismiss'),
          };
          dialog.set(opts).show();

          this.setState({
            surveySaveFail: true,
            asset_updated: update_states.SAVE_FAILED
          });
        });
    }
    this.setState({
      asset_updated: update_states.PENDING_UPDATE,
    });
  },

  handleScroll(evt) {
    var scrollTop = evt.target.scrollTop;
    if (!this.state.formHeaderFixed && scrollTop > 40) {
      var fhfh = $('.asset-view__row--header').height();
      this.setState({
        formHeaderFixed: true,
        formHeaderFixedHeight: fhfh,
      });
    } else if (this.state.formHeaderFixed && scrollTop <= 32) {
      this.setState({
        formHeaderFixed: false
      });
    }
  },

  buttonStates() {
    var ooo = {};
    if (!this.app) {
      ooo.allButtonsDisabled = true;
    } else {
      ooo.previewDisabled = true;
      if (this.app && this.app.survey) {
        ooo.previewDisabled = this.app.survey.rows.length < 1;
      }
      ooo.groupable = !!this.state.groupButtonIsActive;
      ooo.showAllOpen = !!this.state.multioptionsExpanded;
      ooo.showAllAvailable = (() => {
        var hasSelect = false;
        this.app.survey.forEachRow(function(row){
          if (row._isSelectQuestion()) {
            hasSelect = true;
          }
        });
        return hasSelect;
      })(); // todo: only true if survey has select questions
      ooo.name = this.state.name;
      ooo.hasSettings = this.state.backRoute === ROUTES.FORMS;
      ooo.styleValue = this.state.settings__style;
    }
    if (this.state.isNewAsset) {
      ooo.saveButtonText = t('create');
    } else if (this.state.surveySaveFail) {
      ooo.saveButtonText = `${t('save')} (${t('retry')}) `;
    } else {
      ooo.saveButtonText = t('save');
    }
    return ooo;
  },

  toggleAsideLibrarySearch(evt) {
    evt.target.blur();
    const asideSettings = {
      asideLayoutSettingsVisible: false,
      asideLibrarySearchVisible: !this.state.asideLibrarySearchVisible,
    };
    this.setState(asideSettings);
    this.saveAsideSettings(asideSettings);
  },

  toggleAsideLayoutSettings(evt) {
    evt.target.blur();
    const asideSettings = {
      asideLayoutSettingsVisible: !this.state.asideLayoutSettingsVisible,
      asideLibrarySearchVisible: false
    };
    this.setState(asideSettings);
    this.saveAsideSettings(asideSettings);
  },

  hidePreview() {
    this.setState({
      enketopreviewOverlay: false
    });
  },

  hideCascade() {
    this.setState({
      showCascadePopup: false
    });
  },

  /**
   * The de facto function that is running our Form Builder survey editor app.
   * It builds `dkobo_xlform.view.SurveyApp` using asset data and then appends
   * it to `.form-wrap` node.
   */
  launchAppForSurveyContent(assetContent, _state = {}) {
    if (_state.name) {
      _state.savedName = _state.name;
    }

    // asset content is being mutated somewhere during form builder initialisation
    // so we need to make sure this stays untouched
    const rawAssetContent = Object.freeze(clonedeep(assetContent));

    let isEmptySurvey = (
        assetContent &&
        (assetContent.settings && Object.keys(assetContent.settings).length === 0) &&
        assetContent.survey.length === 0
      );

    let survey = null;

    try {
      if (!assetContent) {
        survey = dkobo_xlform.model.Survey.create();
      } else {
        survey = dkobo_xlform.model.Survey.loadDict(assetContent);
        if (isEmptySurvey) {
          survey.surveyDetails.importDefaults();
        }
      }
    } catch (err) {
      _state.surveyLoadError = err.message;
      _state.surveyAppRendered = false;
    }

    if (!_state.surveyLoadError) {
      _state.surveyAppRendered = true;

      var skp = new SurveyScope({
        survey: survey,
        rawSurvey: rawAssetContent,
        assetType: getFormBuilderAssetType(this.state.asset.asset_type, this.state.desiredAssetType),
      });
      this.app = new dkobo_xlform.view.SurveyApp({
        survey: survey,
        stateStore: stores.surveyState,
        ngScope: skp,
      });
      this.app.$el.appendTo(ReactDOM.findDOMNode(this.refs['form-wrap']));
      this.app.render();
      survey.rows.on('change', this.onSurveyChange);
      survey.rows.on('sort', this.onSurveyChange);
      survey.on('change', this.onSurveyChange);
    }

    this.setState(_state);
  },

  clearPreviewError() {
    this.setState({
      enketopreviewError: false,
    });
  },

  // navigating out of form builder

  safeNavigateToRoute(route) {
    if (!this.needsSave()) {
      hashHistory.push(route);
    } else {
      let dialog = alertify.dialog('confirm');
      let opts = {
        title: UNSAVED_CHANGES_WARNING,
        message: '',
        labels: {ok: t('Yes, leave form'), cancel: t('Cancel')},
        onok: () => {
          hashHistory.push(route);
        },
        oncancel: dialog.destroy
      };
      dialog.set(opts).show();
    }
  },

  safeNavigateToList() {
    if (this.state.backRoute) {
      this.safeNavigateToRoute(this.state.backRoute);
    } else if (this.props.location.pathname.startsWith(ROUTES.LIBRARY)) {
      this.safeNavigateToRoute(ROUTES.LIBRARY);
    } else {
      this.safeNavigateToRoute(ROUTES.FORMS);
    }
  },

  safeNavigateToAsset() {
    let targetRoute = this.state.backRoute;
    if (this.state.backRoute === ROUTES.FORMS) {
      targetRoute = ROUTES.FORM.replace(':uid', this.state.asset_uid);
    } else if (this.state.backRoute === ROUTES.LIBRARY) {
      targetRoute = ROUTES.LIBRARY_ITEM.replace(':uid', this.state.asset_uid);
    }
    this.safeNavigateToRoute(targetRoute);
  },

  isAddingQuestionsRestricted() {
    return (
      this.state.asset &&
      isAssetLockable(this.state.asset.asset_type) &&
      hasAssetRestriction(this.state.asset.content, LOCKING_RESTRICTIONS.question_add.name)
    );
  },

  isAddingGroupsRestricted() {
    return (
      this.state.asset &&
      isAssetLockable(this.state.asset.asset_type) &&
      hasAssetRestriction(this.state.asset.content, LOCKING_RESTRICTIONS.group_add.name)
    );
  },

  isChangingAppearanceRestricted() {
    return (
      this.state.asset &&
      isAssetLockable(this.state.asset.asset_type) &&
      hasAssetRestriction(this.state.asset.content, LOCKING_RESTRICTIONS.form_appearance.name)
    );
  },

  isChangingMetaQuestionsRestricted() {
    return (
      this.state.asset &&
      isAssetLockable(this.state.asset.asset_type) &&
      hasAssetRestriction(this.state.asset.content, LOCKING_RESTRICTIONS.form_meta_edit.name)
    );
  },

  hasBackgroundAudio() {
    return this.app?.survey?.surveyDetails.filter(
      (sd) => sd.attributes.name === META_QUESTION_TYPES['background-audio']
    )[0].attributes.value;
  },

  // rendering methods

  renderFormBuilderHeader () {
    let {
      previewDisabled,
      groupable,
      showAllOpen,
      showAllAvailable,
      saveButtonText,
    } = this.buttonStates();

    return (
      <bem.FormBuilderHeader>
        <bem.FormBuilderHeader__row m='primary'>
          <bem.FormBuilderHeader__cell
            m={'logo'}
            data-tip={t('Return to list')}
            className='left-tooltip'
            tabIndex='0'
            onClick={this.safeNavigateToList}
          >
            <i className='k-icon k-icon-kobo' />
          </bem.FormBuilderHeader__cell>

          <bem.FormBuilderHeader__cell m={'name'} >
            <bem.FormModal__item>
              {this.renderAssetLabel()}
              <input
                type='text'
                maxLength={NAME_MAX_LENGTH}
                onChange={this.nameChange}
                value={this.state.name}
                title={this.state.name}
                id='nameField'
              />
            </bem.FormModal__item>
          </bem.FormBuilderHeader__cell>

          <bem.FormBuilderHeader__cell m={'buttonsTopRight'} >
            <bem.FormBuilderHeader__button
              m={['save', {
                savepending: this.state.asset_updated === update_states.PENDING_UPDATE,
                savefailed: this.state.asset_updated === update_states.SAVE_FAILED,
                saveneeded: this.needsSave(),
              }]}
              onClick={this.saveForm}
              disabled={!this.state.surveyAppRendered || !!this.state.surveyLoadError}
            >
              <i />
              {saveButtonText}
            </bem.FormBuilderHeader__button>

            <bem.FormBuilderHeader__close
              m={[{'close-warning': this.needsSave()}]}
              onClick={this.safeNavigateToAsset}
            >
              <i className='k-icon k-icon-close'/>
            </bem.FormBuilderHeader__close>
          </bem.FormBuilderHeader__cell>
        </bem.FormBuilderHeader__row>

        <bem.FormBuilderHeader__row m={'secondary'} >
          <bem.FormBuilderHeader__cell m={'toolsButtons'} >
            <bem.FormBuilderHeader__button
              m={['preview', {previewdisabled: previewDisabled}]}
              onClick={this.previewForm}
              disabled={previewDisabled}
              data-tip={t('Preview form')}
            >
              <i className='k-icon k-icon-view' />
            </bem.FormBuilderHeader__button>

            { showAllAvailable &&
              <bem.FormBuilderHeader__button m={['show-all', {
                    open: showAllOpen,
                  }]}
                  onClick={this.showAll}
                  data-tip={t('Expand / collapse questions')}>
                <i className='k-icon k-icon-view-all' />
              </bem.FormBuilderHeader__button>
            }

            <bem.FormBuilderHeader__button
              m={['group', {groupable: groupable}]}
              onClick={this.groupQuestions}
              disabled={!groupable}
              className={this.isAddingGroupsRestricted() ? LOCKING_UI_CLASSNAMES.DISABLED : ''}
              data-tip={groupable ? t('Create group with selected questions') : t('Grouping disabled. Please select at least one question.')}
            >
              <i className='k-icon k-icon-group' />
            </bem.FormBuilderHeader__button>

            { this.toggleCascade !== undefined &&
              <bem.FormBuilderHeader__button
                m={['cascading']}
                onClick={this.toggleCascade}
                data-tip={t('Insert cascading select')}
                className={this.isAddingQuestionsRestricted() ? LOCKING_UI_CLASSNAMES.DISABLED : ''}
              >
                <i className='k-icon k-icon-cascading' />
              </bem.FormBuilderHeader__button>
            }
          </bem.FormBuilderHeader__cell>

          <bem.FormBuilderHeader__cell m='verticalRule'/>

          <bem.FormBuilderHeader__cell m='spacer'/>

          <bem.FormBuilderHeader__cell m='verticalRule'/>

          <bem.FormBuilderHeader__cell>
            <bem.FormBuilderHeader__button
              m={['panel-toggle', this.state.asideLibrarySearchVisible ? 'active' : null]}
              onClick={this.toggleAsideLibrarySearch}
              className={this.isAddingQuestionsRestricted() ? LOCKING_UI_CLASSNAMES.DISABLED : ''}
            >
              <i className={['k-icon', this.state.asideLibrarySearchVisible ? 'k-icon-close' : 'k-icon-library' ].join(' ')} />
              <span className='panel-toggle-name'>{t('Add from Library')}</span>
            </bem.FormBuilderHeader__button>
          </bem.FormBuilderHeader__cell>

          <bem.FormBuilderHeader__cell m={'verticalRule'} />

          <bem.FormBuilderHeader__cell>
            <bem.FormBuilderHeader__button
              m={['panel-toggle', this.state.asideLayoutSettingsVisible ? 'active' : null]}
              onClick={this.toggleAsideLayoutSettings}
            >
              <i className={['k-icon', this.state.asideLayoutSettingsVisible ? 'k-icon-close' : 'k-icon-settings' ].join(' ')} />
              <span className='panel-toggle-name'>
                {this.hasMetadataAndDetails() &&
                  t('Layout & Settings')
                }
                {!this.hasMetadataAndDetails() &&
                  t('Layout')
                }
              </span>
            </bem.FormBuilderHeader__button>
          </bem.FormBuilderHeader__cell>
        </bem.FormBuilderHeader__row>
      </bem.FormBuilderHeader>
    );
  },

  renderBackgroundAudioWarning() {
    return (
      <bem.FormBuilderMessageBox m='warning'>
        <span data-tip={t('background recording')}>
          <i className='k-icon k-icon-form-overview'/>
        </span>

        <p>
          {t('This form will automatically record audio in the background. Consider adding an acknowledgement note to inform respondents or data collectors that they will be recorded while completing this survey. This feature is available in ')}
          <a title="Install KoBoCollect"
            target="_blank"
            href='https://play.google.com/store/apps/details?id=org.koboc.collect.android'>
            {t('Collect version 1.30 and above')}
          </a>
          {'.'}
        </p>

        { envStore.isReady &&
          envStore.data.support_url &&
          <bem.TextBox__labelLink
            // TODO update support article to include background-audio
            href={
              envStore.data.support_url +
              RECORDING_SUPPORT_URL
            }
            target='_blank'
            data-tip={t('help')}
          >
            <i className='k-icon k-icon-help' />
          </bem.TextBox__labelLink>
        }
      </bem.FormBuilderMessageBox>
    );
  },

  renderAside() {
    let {
      styleValue,
      hasSettings
    } = this.buttonStates();

    const isAsideVisible = (
      this.state.asideLayoutSettingsVisible ||
      this.state.asideLibrarySearchVisible
    );

    return (
      <bem.FormBuilderAside m={isAsideVisible ? 'visible' : null}>
        { this.state.asideLayoutSettingsVisible &&
          <bem.FormBuilderAside__content>
            <bem.FormBuilderAside__row>
              <bem.FormBuilderAside__header>
                {t('Form style')}

                { envStore.isReady &&
                  envStore.data.support_url &&
                  <a
                    href={envStore.data.support_url + WEBFORM_STYLES_SUPPORT_URL}
                    target='_blank'
                    data-tip={t('Read more about form styles')}
                  >
                    <i className='k-icon k-icon-help'/>
                  </a>
                }
              </bem.FormBuilderAside__header>

              <label
                className='kobo-select-label'
                htmlFor='webform-style'
              >
                { hasSettings ?
                  t('Select the form style that you would like to use. This will only affect web forms.')
                  :
                  t('Select the form style. This will only affect the Enketo preview, and it will not be saved with the question or block.')
                }
              </label>

              <Select
                className='kobo-select'
                classNamePrefix='kobo-select'
                id='webform-style'
                name='webform-style'
                ref='webformStyle'
                value={this.getStyleSelectVal(styleValue)}
                onChange={this.onStyleChange}
                placeholder={AVAILABLE_FORM_STYLES[0].label}
                options={AVAILABLE_FORM_STYLES}
                menuPlacement='bottom'
                isDisabled={this.isChangingAppearanceRestricted()}
                isSearchable={false}
              />
            </bem.FormBuilderAside__row>

            {this.hasMetadataAndDetails() &&
              <bem.FormBuilderAside__row>
                <bem.FormBuilderAside__header>
                  {t('Metadata')}
                </bem.FormBuilderAside__header>

                <MetadataEditor
                  survey={this.app.survey}
                  onChange={this.onMetadataEditorChange}
                  isDisabled={this.isChangingMetaQuestionsRestricted()}
                  {...this.state}
                />
              </bem.FormBuilderAside__row>
            }

            {this.hasMetadataAndDetails() &&
              <bem.FormBuilderAside__row>
                <bem.FormBuilderAside__header>
                  {t('Details')}
                </bem.FormBuilderAside__header>

                <ProjectSettings
                  context={PROJECT_SETTINGS_CONTEXTS.BUILDER}
                  onProjectDetailsChange={this.onProjectDetailsChange}
                  formAsset={this.state.asset}
                />
              </bem.FormBuilderAside__row>
            }
          </bem.FormBuilderAside__content>
        }

        { this.state.asideLibrarySearchVisible &&
          <bem.FormBuilderAside__content
            className={this.isAddingQuestionsRestricted() ? LOCKING_UI_CLASSNAMES.DISABLED : ''}
          >
            <bem.FormBuilderAside__row>
              <bem.FormBuilderAside__header>
                {t('Search Library')}
              </bem.FormBuilderAside__header>
            </bem.FormBuilderAside__row>

            <bem.FormBuilderAside__row>
              <AssetNavigator/>
            </bem.FormBuilderAside__row>
          </bem.FormBuilderAside__content>
        }
      </bem.FormBuilderAside>
    );
  },

  renderNotLoadedMessage() {
    if (this.state.surveyLoadError) {
      return (
        <ErrorMessage>
          <ErrorMessage__strong>
            {t('Error loading survey:')}
          </ErrorMessage__strong>
          <p>
            {this.state.surveyLoadError}
          </p>
        </ErrorMessage>
      );
    }

    return (<LoadingSpinner/>);
  },

  renderAssetLabel() {
    let assetTypeLabel = getFormBuilderAssetType(this.state.asset.asset_type, this.state.desiredAssetType)?.label;

    // Case 1: there is no asset yet (creting a new) or asset is not locked
    if (
      !this.state.asset ||
      !hasAssetAnyLocking(this.state.asset.content)
    ) {
      return assetTypeLabel;
    // Case 2: asset is locked fully or partially
    } else {
      let lockedLabel = t('Partially locked ##type##').replace('##type##', assetTypeLabel);
      if (isAssetAllLocked(this.state.asset.content)) {
        lockedLabel = t('Fully locked ##type##').replace('##type##', assetTypeLabel);
      }
      return (
        <span className='locked-asset-type-label'>
          <i className='k-icon k-icon-lock'/>

          {lockedLabel}

          { envStore.isReady &&
            envStore.data.support_url &&
            <a
              href={envStore.data.support_url + LOCKING_SUPPORT_URL}
              target='_blank'
              data-tip={t('Read more about Locking')}
            >
              <i className='k-icon k-icon-help'/>
            </a>
          }
        </span>
      );
    }
  },

  render() {
    var docTitle = this.state.name || t('Untitled');

    if (!this.state.isNewAsset && !this.state.asset) {
      return (
        <DocumentTitle title={`${docTitle} | KoboToolbox`}>
          <LoadingSpinner/>
        </DocumentTitle>
      );
    }

    // Only allow user to edit form if they have "Edit Form" permission
    var userCanEditForm = (
      this.state.isNewAsset ||
      assetUtils.isSelfOwned(this.state.asset) ||
      this.userCan('change_asset', this.state.asset)
    );

    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        <bem.uiPanel m={['transparent', 'fixed']}>
          <bem.uiPanel__body>
            {this.renderAside()}

            {userCanEditForm &&
              <bem.FormBuilder>
              {this.renderFormBuilderHeader()}

                <bem.FormBuilder__contents>
                  {this.state.asset &&
                    <FormLockedMessage asset={this.state.asset}/>
                  }

                  {this.hasBackgroundAudio() &&
                    this.renderBackgroundAudioWarning()
                  }

                  <div ref='form-wrap' className='form-wrap'>
                    {!this.state.surveyAppRendered &&
                      this.renderNotLoadedMessage()
                    }
                  </div>
                </bem.FormBuilder__contents>
              </bem.FormBuilder>
            }

            {(!userCanEditForm) &&
              <AccessDeniedMessage/>
            }

            {this.state.enketopreviewOverlay &&
              <Modal
                open
                large
                onClose={this.hidePreview}
                title={t('Form Preview')}
              >
                <Modal.Body>
                  <div className='enketo-holder'>
                    <iframe src={this.state.enketopreviewOverlay} />
                  </div>
                </Modal.Body>
              </Modal>
            }

            {!this.state.enketopreviewOverlay && this.state.enketopreviewError &&
              <Modal
                open
                error
                onClose={this.clearPreviewError}
                title={t('Error generating preview')}
              >
                <Modal.Body>{this.state.enketopreviewError}</Modal.Body>
              </Modal>
            }

            {this.state.showCascadePopup &&
              <Modal
                open
                onClose={this.hideCascade}
                title={t('Import Cascading Select Questions')}
              >
                <Modal.Body>{this.renderCascadePopup()}</Modal.Body>
              </Modal>
            }
          </bem.uiPanel__body>
        </bem.uiPanel>
      </DocumentTitle>
    );
  },
}, cascadeMixin);
