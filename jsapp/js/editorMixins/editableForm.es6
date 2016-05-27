import React from 'react/addons';
import $ from 'jquery';
import mdl from '../libs/rest_framework/material';
import Select from 'react-select';
import _ from 'underscore';
import DocumentTitle from 'react-document-title';
import SurveyScope from '../models/surveyScope';
import cascadeMixin from './cascadeMixin';

import {
  surveyToValidJson,
  notify,
  assign,
  t,
} from '../utils';

import {
  AVAILABLE_FORM_STYLES,
  update_states,
} from '../constants';

import ui from '../ui';
import bem from '../bem';
import stores from '../stores';
import actions from '../actions';
import dkobo_xlform from '../../xlform/src/_xlform.init';
import {dataInterface} from '../dataInterface';
import ReactTooltip from 'react-tooltip';
import hotkey from 'react-hotkey';

var FormStyle__panel = bem('form-style__panel'),
    FormStyle__row = bem('form-style'),
    FormStyle__panelheader = bem('form-style__panelheader'),
    FormStyle__paneltext = bem('form-style__paneltext');

var webformStylesSupportUrl = "http://support.kobotoolbox.org/customer/en/portal/articles/2108533";

var FormSettingsEditor = React.createClass({
  render () {
    return (
          <div className="mdl-grid">
            <div className="mdl-cell mdl-cell--1-col" />
            <div className="mdl-cell mdl-cell--5-col">
              {this.props.meta.map((mtype) => {
                return (
                    <FormCheckbox htmlFor={mtype} onChange={this.props.onCheckboxChange} {...mtype} />
                  );
              })}
            </div>
            <div className="mdl-cell mdl-cell--5-col">
              {this.props.phoneMeta.map((mtype) => {
                return (
                    <FormCheckbox htmlFor={mtype} onChange={this.props.onCheckboxChange} {...mtype} />
                  );
              })}
            </div>
          </div>
      );
  },
  focusSelect () {
    this.refs.webformStyle.focus();
  },
  componentDidUpdate() {
    mdl.upgradeDom();
  }
});

var FormCheckbox = React.createClass({
  render () {
    return (
        <div className="form-group">
          <label className="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect" htmlFor={this.props.name} >
            <input type="checkbox" className="mdl-checkbox__input" id={this.props.name} checked={this.props.value} onChange={this.props.onChange} />
            <span className="mdl-checkbox__label">{this.props.label}</span>
          </label>
        </div>
      );
  },
  componentDidUpdate() {
    // TODO: upgrade specific element only (as opposed to whole DOM)
    mdl.upgradeDom();
  }
});

var FormSettingsBox = React.createClass({
  getInitialState () {
    var formId = this.props.survey.settings.get('form_id');
    return {
      formSettingsExpanded: false,
      xform_id_string: formId,
      meta: [],
      phoneMeta: [],
      styleValue: 'field-list'
    };
  },
  componentDidUpdate() {
    mdl.upgradeDom();
  },
  componentDidMount () {
    this.updateState();
  },
  updateState (newState={}) {
    'start end today deviceid'.split(' ').forEach(this.passValueIntoObj('meta', newState));
    'username simserial subscriberid phonenumber'.split(' ').map(this.passValueIntoObj('phoneMeta', newState));
    this.setState(newState);
  },
  getSurveyDetail (sdId) {
    return this.props.survey.surveyDetails.filter(function(sd){
      return sd.attributes.name === sdId;
    })[0];
  },
  passValueIntoObj (category, newState) {
    newState[category] = [];
    return (id) => {
      var sd = this.getSurveyDetail(id);
      if (sd) {
        newState[category].push(assign({}, sd.attributes));
      }
    };
  },
  onCheckboxChange (evt) {
    this.getSurveyDetail(evt.target.id).set('value', evt.target.checked);
    this.updateState({
      asset_updated: update_states.UNSAVED_CHANGES,
    });
  },
  onFieldChange (evt) {
    var fieldId = evt.target.id,
        value = evt.target.value;
    if (fieldId === 'form_id') {
      this.props.survey.settings.set('form_id', value);
    }
    this.setState({
      xform_id_string: this.props.survey.settings.get('form_id')
    });
  },
  toggleSettingsEdit () {
    this.setState({
      formSettingsExpanded: !this.state.formSettingsExpanded
    });
  },
  onStyleChange (evt) {
    var newStyle = evt.target.value;
    this.props.survey.settings.set('style', newStyle);
    this.setState({
      styleValue: newStyle
    });
  },
  render () {
    var metaData = [].concat(this.state.meta).concat(this.state.phoneMeta).filter(function(item){
      return item.value;
    }).map(function(item){
      return item.label;
    }).join(', ');

    if (metaData === '') {
      metaData = t('none (0 metadata specified)');
    }

    var metaContent;
    if (!this.state.formSettingsExpanded) {
      metaContent = (
          <bem.FormMeta__button m={'metasummary'} onClick={this.toggleSettingsEdit}>
            {t('metadata:')}
            {metaData}
          </bem.FormMeta__button>
        );
    } else {
      metaContent = (
          <FormSettingsEditor {...this.state} onCheckboxChange={this.onCheckboxChange}
            />
        );
    }
    return (
        <bem.FormMeta>
          <bem.FormMeta__button m='expand' onClick={this.toggleSettingsEdit}>
            <i />
          </bem.FormMeta__button>
          {metaContent}
        </bem.FormMeta>
      );
  },
});

export default assign({
  getInitialState () {
    return {
      asset_updated: update_states.UP_TO_DATE,
      multioptionsExpanded: true,
      surveyAppRendered: false,
      currentName: 'name',
    };
  },
  mixins: [
    hotkey.Mixin('handleHotkey'),
  ],
  componentDidMount() {
    document.querySelector('.page-wrapper__content').addEventListener('scroll', this.handleScroll);
    this.listenTo(stores.surveyState, this.surveyStateChanged);
    this.setBreadcrumb();
  },
  setBreadcrumb (params={}) {
    let isLibrary;
    if (params.asset_type) {
      isLibrary = params.asset_type !== 'survey';
    } else {
      this.isLibrary();
    }
    let bcData = [
      {
        'label': isLibrary ? t('Library List') : t('Projects'),
        'to': isLibrary ? 'library' : 'forms',
      }
    ];
    if (this.editorState === 'new') {
      bcData.push({
        label: t('new'),
        to: isLibrary ? 'add-to-library' : 'new-form',
      });
    } else {
      let uid = params.asset_uid || this.state.asset_uid || this.props.params.assetid,
          asset_type = params.asset_type || this.state.asset_type || 'asset';
      bcData.push({
        label: t(`view-${asset_type}`),
        to: 'form-landing',
        params: {assetid: uid},
      });
      bcData.push({
        label: t(`edit-${asset_type}`),
        to: 'form-edit',
        params: {assetid: uid},
      });
    }

    stores.pageState.setHeaderBreadcrumb(bcData);

  },
  componentWillUnmount () {
    document.querySelector('.page-wrapper__content').removeEventListener('scroll', this.handleScroll);
    if (this.app.survey) {
      this.app.survey.off('change');
    }
    this.unpreventClosingTab();
  },
  componentDidUpdate() {
    // Material Design Lite
    // This upgrades all upgradable components (i.e. with 'mdl-js-*' class)
    mdl.upgradeDom();
  },
  statics: {
    willTransitionTo: function(transition, params, idk, callback) {
      stores.pageState.setAssetNavPresent(true);
      stores.pageState.setFormBuilderFocus(true);
      if (params.assetid && params.assetid[0] === 'c') {
        transition.redirect('collection-page', {uid: params.assetid});
      } else {
        callback();
      }
    }
  },
  handleHotkey: function(e) {
    if (e.altKey && e.keyCode == '69') {
      document.body.classList.toggle('hide-edge');
    }
  },
  componentWillMount() {
    document.body.classList.add('hide-edge');
  },
  surveyStateChanged (state) {
    this.setState(state);
  },
  onStyleChange (value) {
    var newStyle = value;
    this.setState({
      settings__style: newStyle,
    });
  },
  onSurveyChange: _.debounce(function () {
    if (!this.state.asset_updated !== update_states.UNSAVED_CHANGES) {
      this.preventClosingTab();
    }
    this.setState({
      asset_updated: update_states.UNSAVED_CHANGES,
    });
  }, 75),
  preventClosingTab () {
    $(window).on('beforeunload.noclosetab', function(){
      return t('you have unsaved changes');
    });
  },
  unpreventClosingTab () {
    $(window).off('beforeunload.noclosetab');
  },
  openFormStylePanel (evt) {
    evt.target.blur();
    this.setState({
      formStylePanelDisplayed: !this.state.formStylePanelDisplayed,
    });
  },
  nameChange (evt) {
    var name = evt.target.value;
    this.setState({
      name: name,
    });
  },
  groupQuestions () {
    this.app.groupSelectedRows();
  },
  showAll (evt) {
    evt.preventDefault();
    evt.currentTarget.blur();
    this.app.expandMultioptions();
  },
  needsSave () {
    return this.state.asset_updated === update_states.UNSAVED_CHANGES;
  },
  isLibrary () {
    if (this.state.asset_type) {
      return this.state.asset_type !== 'survey';
    } else {
      return !!this.context.router.getCurrentPath().match(/library/);
    }
  },
  previewForm (evt) {
    if (evt && evt.preventDefault) {
      evt.preventDefault();
    }

    if (this.state.settings__style) {
      this.app.survey.settings.set('style', this.state.settings__style);
    }
    var params = {
      source: surveyToValidJson(this.app.survey),
    };
    if (this.state.asset && this.state.asset.url) {
      params.asset = this.state.asset.url;
    }
    if (this.state.name !== this.state.savedName) {
      params.name = this.state.name;
    }
    dataInterface.createAssetSnapshot(params).done((content) => {
      this.setState({
        enketopreviewOverlay: content.enketopreviewlink,
      });
      stores.pageState.setFormBuilderFocus(true);
      stores.pageState.setAssetNavPresent(false);
    }).fail((/* jqxhr */) => {
      notify(t('failed to generate preview. please report this to support@kobotoolbox.org'));
    });
  },
  saveForm (evt) {
    if (evt && evt.preventDefault) {
      evt.preventDefault();
    }

    if (this.state.settings__style !== undefined) {
      this.app.survey.settings.set('style', this.state.settings__style);
    }
    var params = {
      content: surveyToValidJson(this.app.survey),
    };
    if (this.state.name) {
      params.name = this.state.name;
    }
    if (this.editorState === 'new') {
      params.asset_type = this.isLibrary() ? 'block' : 'survey';
      actions.resources.createResource(params)
        .then((asset) => {
          this.transitionTo('form-edit', {assetid: asset.uid});
        })
    } else {
      // update existing
      var assetId = this.props.params.assetid;
      actions.resources.updateAsset(assetId, params)
        .then(() => {
          this.saveFormComplete();
        });
    }
    this.setState({
      asset_updated: update_states.PENDING_UPDATE,
    });
  },
  saveFormComplete () {
    this.unpreventClosingTab();
    this.setState({
      asset_updated: update_states.UP_TO_DATE,
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
  buttonStates () {
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
      ooo.hasSettings = !this.isLibrary();
      ooo.styleValue = this.state.settings__style;
    }
    if (this.editorState === 'new') {
      ooo.saveButtonText = t('create');
    } else {
      ooo.saveButtonText = t('save');
    }
    return ooo;
  },
  toggleLibraryNav() {
    stores.pageState.toggleAssetNavIntentOpen();
  },
  renderSaveAndPreviewButtons () {
    let {
      allButtonsDisabled,
      previewDisabled,
      groupable,
      showAllOpen,
      showAllAvailable,
      name,
      hasSettings,
      styleValue,
      saveButtonText,
    } = this.buttonStates();

    return (
        <bem.FormBuilderHeader>
          <bem.FormBuilderHeader__row m={['first', allButtonsDisabled ? 'disabled' : null]}>

            <bem.FormBuilderHeader__cell m={'project-icon'} >
              <i className="k-icon-projects" />
            </bem.FormBuilderHeader__cell>
            <bem.FormBuilderHeader__cell m={'name'} >
              <ui.SmallInputBox
                  ref='form-name'
                  value={name}
                  onChange={this.nameChange}
                  placeholder={t('form name')}
                />
            </bem.FormBuilderHeader__cell>
            <bem.FormBuilderHeader__cell m={'buttonsTopRight'} >

              <bem.FormBuilderHeader__button m={['share']} className="is-edge">
                {t('share')}
              </bem.FormBuilderHeader__button>

              <bem.FormBuilderHeader__button m={['save', {
                    savepending: this.state.asset_updated === update_states.PENDING_UPDATE,
                    savecomplete: this.state.asset_updated === update_states.UP_TO_DATE,
                    saveneeded: this.state.asset_updated === update_states.UNSAVED_CHANGES,
                  }]} onClick={this.saveForm}>
                <i />
                {saveButtonText}
              </bem.FormBuilderHeader__button>
            </bem.FormBuilderHeader__cell>
            <bem.FormBuilderHeader__cell m={'close'} >
              <bem.FormBuilderHeader__close m={[{
                    'close-warning': this.needsSave(),
                  }]} onClick={this.navigateBack}>
                <i className="k-icon-close"></i>
              </bem.FormBuilderHeader__close>
            </bem.FormBuilderHeader__cell>
          </bem.FormBuilderHeader__row>
          <bem.FormBuilderHeader__row m={'second'} >
            <bem.FormBuilderHeader__cell m={'buttons'} >
              <bem.FormBuilderHeader__button m={['preview', {
                    previewdisabled: previewDisabled
                  }]} onClick={this.previewForm}
                  disabled={previewDisabled}
                  data-tip={t('Preview form')} >
                <i className="k-icon-view" />
              </bem.FormBuilderHeader__button>
              { showAllAvailable ?
                <bem.FormBuilderHeader__button m={['show-all', {
                      open: showAllOpen,
                    }]} 
                    onClick={this.showAll}
                    data-tip={t('Expand / collapse questions')}>
                  <i className="k-icon-view-all" />
                </bem.FormBuilderHeader__button>
              : null }
              { groupable ?
                <bem.FormBuilderHeader__button m={['group', {
                      groupable: groupable
                    }]} onClick={this.groupQuestions}
                    disabled={!groupable}
                    data-tip={t('Create group with selected questions')}>
                  <i className="k-icon-group" />
                </bem.FormBuilderHeader__button>
              : null }
              <bem.FormBuilderHeader__button m={['download']}
                  data-tip={t('Download form')} 
                  className="is-edge">
                <i className="k-icon-download" />
              </bem.FormBuilderHeader__button>

              { hasSettings ?
                <bem.FormBuilderHeader__item>
                  <bem.FormBuilderHeader__button m={{
                    formstyle: true,
                    formstyleactive: this.state.formStylePanelDisplayed,
                  }} onClick={this.openFormStylePanel} 
                    data-tip={t('Web form layout')} >
                    <i className="k-icon-grid" />
                    {t('Layout')}
                    <i className="fa fa-caret-down" />
                  </bem.FormBuilderHeader__button>
                </bem.FormBuilderHeader__item>
              : null }

              <bem.FormBuilderHeader__button m={['attach']}
                  data-tip={t('Attach media files')}
                  className="is-edge">
                <i className="k-icon-attach" />
              </bem.FormBuilderHeader__button>
              { this.toggleCascade !== undefined ?
                <bem.FormBuilderHeader__button m={['cascading']}
                    onClick={this.toggleCascade}
                    data-tip={t('Insert cascading select')}>
                  <i className="k-icon-cascading" />
                </bem.FormBuilderHeader__button>
              : null }

            </bem.FormBuilderHeader__cell>
            <bem.FormBuilderHeader__cell m={'spacer'} />
            <bem.FormBuilderHeader__cell m={'library-toggle'} >
              <bem.FormBuilderHeader__button m={['showLibrary']}
                                             onClick={this.toggleLibraryNav} >
                {t('Search Library')}
              </bem.FormBuilderHeader__button>
            </bem.FormBuilderHeader__cell>
          </bem.FormBuilderHeader__row>
          { this.state.formStylePanelDisplayed ?
            <FormStyle__panel m='formstyle'>
              <FormStyle__panelheader>
                {t('form style')}
              </FormStyle__panelheader>
              <FormStyle__paneltext>
                {t('select the form style that you would like to use. this will only affect web forms.')}
              </FormStyle__paneltext>
              <FormStyle__paneltext>
                <a href={webformStylesSupportUrl}>
                  {t('read more...')}
                </a>
              </FormStyle__paneltext>
              <Select
                name="webform-style"
                ref="webformStyle"
                value={styleValue}
                onChange={this.onStyleChange}
                addLabelText={t('custom form style: "{label}"')}
                allowCreate={true}
                placeholder={AVAILABLE_FORM_STYLES[0].label}
                options={AVAILABLE_FORM_STYLES}
              />
            </FormStyle__panel>
          : null }
          <ReactTooltip effect="float" place="bottom" />
        </bem.FormBuilderHeader>
      );
  },
  renderLoadingNotice () {
    return (
        <bem.Loading>
          <bem.Loading__inner>
            <i />
            {t('loading...')} 
          </bem.Loading__inner>
        </bem.Loading>
      );
  },
  hidePreview () {
    this.setState({
      enketopreviewOverlay: false
    });
    stores.pageState.setFormBuilderFocus(true);
    stores.pageState.setAssetNavPresent(true);
  },
  hideCascade () {
    this.setState({
      showCascadePopup: false
    });
    stores.pageState.setFormBuilderFocus(true);
    stores.pageState.setAssetNavPresent(true);
  },
  launchAppForSurvey (survey, optionalParams={}) {
    var skp = new SurveyScope({
      survey: survey
    });
    this.app = new dkobo_xlform.view.SurveyApp({
      survey: survey,
      stateStore: stores.surveyState,
      ngScope: skp,
    });

    this.app.$el.appendTo(this.refs['form-wrap'].getDOMNode());
    this.app.render();

    survey.rows.on('change', this.onSurveyChange);
    survey.rows.on('sort', this.onSurveyChange);
    survey.on('change', this.onSurveyChange);

    this.setState({
      surveyAppRendered: true,
      name: optionalParams.name,
      savedName: optionalParams.name,
      settings__style: optionalParams.settings__style,
      asset_uid: optionalParams.asset_uid,
      asset_type: optionalParams.asset_type,
    });
    this.setBreadcrumb({
      asset_uid: optionalParams.asset_uid,
      asset_type: optionalParams.asset_type,
    });
  },
  render () {
    var isSurvey = this.app && !this.isLibrary();
    return (
        <DocumentTitle title={this.state.name || t('Untitled')}>
          <ui.Panel m={'transparent'}>
            <bem.FormBuilder m={this.state.formStylePanelDisplayed ? 'formStyleDisplayed': null }>
              {this.renderSaveAndPreviewButtons()}

              <bem.FormBuilder__contents>
                { isSurvey ?
                  <FormSettingsBox survey={this.app.survey} {...this.state} />
                : null }
                  <div ref="form-wrap" className='form-wrap'>
                    { (!this.state.surveyAppRendered) ?
                        this.renderLoadingNotice()
                    : null }
                  </div>
              </bem.FormBuilder__contents>
            </bem.FormBuilder>
            { this.state.enketopreviewOverlay ?
              <ui.Modal open onClose={this.hidePreview} title={t('Form Preview')} className='modal-large'>
                <ui.Modal.Body>
                  <iframe src={this.state.enketopreviewOverlay} />
                </ui.Modal.Body>
              </ui.Modal>

            : null }

            {this.state.showCascadePopup ?
              <ui.Modal open onClose={this.hideCascade} title={t('Import Cascading Select Questions')}>
                <ui.Modal.Body>
                  {this.renderCascadePopup()}
                </ui.Modal.Body>
              </ui.Modal>

            : null}

          </ui.Panel>
        </DocumentTitle>
      );
  },
}, cascadeMixin);
