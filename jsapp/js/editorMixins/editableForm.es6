import React from 'react/addons';
import $ from 'jquery';
import mdl from '../libs/rest_framework/material';
import Select from 'react-select';
import _ from 'underscore';
import DocumentTitle from 'react-document-title';
import SurveyScope from '../models/surveyScope';

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

var FormHeader__panel = bem('form-header__panel'),
    FormHeader__row = bem('form-header__row'),
    FormHeader__panelheader = bem('form-header__panelheader'),
    FormHeader__paneltext = bem('form-header__paneltext');

var FormSettingsEditor = React.createClass({
  render () {
    return (
          <div className="mdl-grid">
            {/* offset? */}
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

export default {
  getInitialState () {
    return {
      asset_updated: update_states.UP_TO_DATE,
      multioptionsExpanded: true,
      surveyAppRendered: false,
      currentName: 'name',
    };
  },
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
        'label': isLibrary ? t('library') : t('forms'),
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
      if (params.assetid && params.assetid[0] === 'c') {
        transition.redirect('collection-page', {uid: params.assetid});
      } else {
        callback();
      }
    }
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
      return !!this.state.asset_type !== 'survey';
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
      stores.pageState.setAssetNavPresent(false);
    }).fail((/* jqxhr */) => {
      notify(t('failed to generate preview. please report this to support@kobotoolbox.org'));
    });
  },
  saveForm (evt) {
    if (evt && evt.preventDefault) {
      evt.preventDefault();
    }

    if (this.state.settings__style) {
      this.app.survey.settings.set('style', this.state.settings__style);
    }
    var params = {
      content: surveyToValidJson(this.app.survey, this.isLibrary()),
    };
    if (this.state.name) {
      params.name = this.state.name;
    }
    if (this.editorState === 'new') {
      // create
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
        <bem.FormHeader>
          <ui.SmallInputBox
              ref='form-name'
              value={name}
              onChange={this.nameChange}
              placeholder={t('form name')}
            />
          <FormHeader__row m={allButtonsDisabled ? 'disabled' : null}>
            <bem.FormHeader__button m={['save', {
                  savepending: this.state.asset_updated === update_states.PENDING_UPDATE,
                  savecomplete: this.state.asset_updated === update_states.UP_TO_DATE,
                  saveneeded: this.state.asset_updated === update_states.UNSAVED_CHANGES,
                }]} onClick={this.saveForm}>
              <i />
              {saveButtonText}
            </bem.FormHeader__button>
            <bem.FormHeader__button m={['close', {
                  'close-warning': this.needsSave(),
                }]} onClick={this.navigateBack}>
              <i />
              {t('close')}
            </bem.FormHeader__button>
            <bem.FormHeader__button m={['preview', {
                  previewdisabled: previewDisabled
                }]} onClick={this.previewForm}
                disabled={previewDisabled}>
              <i />
              {t('preview')}
            </bem.FormHeader__button>
            { showAllAvailable ?
              <bem.FormHeader__button m={['show-all', {
                    open: showAllOpen,
                  }]} onClick={this.showAll}>
                <i />
                {t('show all responses')}
              </bem.FormHeader__button>
            : null }
            { groupable ?
              <bem.FormHeader__button m={['group', {
                    groupable: groupable
                  }]} onClick={this.groupQuestions}
                  disabled={!groupable}>
                <i />
                {t('group questions')}
              </bem.FormHeader__button>
            : null }
            { hasSettings ?
              <bem.FormHeader__button m={{
                formstyle: true,
                formstyleactive: this.state.formStylePanelDisplayed,
              }} onClick={this.openFormStylePanel}>
                {t('form-style')}
              </bem.FormHeader__button>
            : null }
          </FormHeader__row>
          { this.state.formStylePanelDisplayed ?
            <FormHeader__panel m='formstyle'>
              <FormHeader__panelheader>
                {t('form style')}
              </FormHeader__panelheader>
              <FormHeader__paneltext>
                {t('select the form style that you would like to use.')}
                {t('for more info, see: ')}
              </FormHeader__paneltext>
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
            </FormHeader__panel>
          : null }
        </bem.FormHeader>
      );
  },
  renderLoadingNotice () {
    return (
        <bem.AssetView__content>
          <bem.AssetView__message m={'loading'}>
            <i />
            {t('loading...')}
          </bem.AssetView__message>
        </bem.AssetView__content>
      );
  },
  hidePreview () {
    this.setState({
      enketopreviewOverlay: false
    });
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
    //this.state.asset && this.state.asset.asset_type === 'survey';
    var formHeaderFixed = this.state.formHeaderFixed,
        placeHolder = formHeaderFixed && (
            <bem.AssetView__row m={['header', 'placeholder']}
                  style={{height: this.state.formHeaderFixedHeight}} />
          );
    return (
        <DocumentTitle title={this.state.name || t('Untitled')}>
          <bem.AssetView>
            <ui.Panel>
              <bem.AssetView__content>
                <bem.AssetView__row m={['header', {
                      fixed: formHeaderFixed,
                    }]}
                    ref={'fixableHeader'}>
                  {this.renderSaveAndPreviewButtons()}
                </bem.AssetView__row>
                {formHeaderFixed ?
                  placeHolder
                : null}
                { isSurvey ?
                  <bem.AssetView__row>
                    <FormSettingsBox survey={this.app.survey} {...this.state} />
                  </bem.AssetView__row>
                : null }
                <bem.AssetView__row>
                  <div ref="form-wrap" className='form-wrap'>
                    { (!this.state.surveyAppRendered) ?
                        this.renderLoadingNotice()
                    : null }
                  </div>
                </bem.AssetView__row>
              </bem.AssetView__content>
            </ui.Panel>
            { this.state.enketopreviewOverlay ?
              <ui.Modal open onClose={this.hidePreview} title={t('Form Preview')}>
                <ui.Modal.Body>
                  <iframe src={this.state.enketopreviewOverlay} />
                </ui.Modal.Body>
                <ui.Modal.Footer>
                </ui.Modal.Footer>
              </ui.Modal>
            : null }
          </bem.AssetView>
        </DocumentTitle>
      );
  },
};
