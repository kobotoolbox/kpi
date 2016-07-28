import React from 'react/addons';
import Reflux from 'reflux';

import newFormMixin from '../editorMixins/newForm';
import editableFormMixin from '../editorMixins/editableForm';
import existingFormMixin from '../editorMixins/existingForm';
import Select from 'react-select';
import ui from '../ui';
import bem from '../bem';

import {Navigation} from 'react-router';
import {session} from '../stores';

let newFormMixins = [
    Navigation,
    Reflux.ListenerMixin,
    editableFormMixin,
    newFormMixin,
];
import actions from '../actions';
import {dataInterface} from '../dataInterface';
import {
  t,
} from '../utils';

var ProjectSettings = React.createClass({
  mixins: [
    Reflux.ListenerMixin,
  ],
  nameChange (evt) {
    this.setState({
      nameVal: evt.target.value
    });
  },
  descriptionChange (evt) {
    this.setState({
      descriptionVal: evt.target.value
    });
  },
  countryChange (val) {
    this.setState({
      countryVal: val
    });
  },
  sectorChange (val) {
    this.setState({
      sectorVal: val
    });
  },
  shareMetadataChange (evt) {
    this.setState({
      shareMetadataChecked: evt.target.checked
    });
  },
  getInitialState () {
    var defaultIfUndefined = (obj, attr, def) => {
      if (obj === undefined || obj[attr] === undefined) { return def; }
      return obj[attr];
    };
    var settings = this.props.asset === undefined ?
      undefined : this.props.asset.settings;
    return {
      sessionLoaded: !!session.currentAccount,
      nameVal: defaultIfUndefined(this.props.asset, 'name', ''),
      descriptionVal: defaultIfUndefined(settings, 'description', ''),
      sectorVal: defaultIfUndefined(settings, 'sector', ''),
      countryVal: defaultIfUndefined(settings, 'country', ''),
      shareMetadataChecked: defaultIfUndefined(settings, 'share-metadata', false)
    }
  },
  componentDidMount () {
    this.listenTo(session, (session) => {
      this.setState({
        sessionLoaded: true,
      });
    });
  },
  onSubmit () {
    this.props.onSubmit(this);
  },
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
    return (
      <bem.FormModal>
        <bem.FormModal__item>
          <label htmlFor="name">
            {t('Project Name')}
          </label>
          <input type="text"
              ref="name"
              id="name"
              placeholder={t('Enter title of project here')}
              value={this.state.nameVal}
              onChange={this.nameChange}
            />
        </bem.FormModal__item>
        <bem.FormModal__item>
          <label htmlFor="description">
            {t('Description')}
          </label>
          <textarea type="text" ref="description"
              id="description"
              placeholder={t('Enter short description here')}
              value={this.state.descriptionVal}
              onChange={this.descriptionChange}
            />
        </bem.FormModal__item>

        <bem.FormModal__item>
          <label className="long">
            {t('Please specify the country and the sector where this project will be deployed.')}
            {t('This information will be used to help you filter results on the project list page.')}
          </label>
          <label htmlFor="sector">
            {t('Sector')}
          </label>
          <Select name="sector"
              ref="sector"
              id="sector"
              value={this.state.sectorVal}
              onChange={this.sectorChange}
              options={sectors}
            />
        </bem.FormModal__item>
        <bem.FormModal__item>
          <label htmlFor="country">
            {t('Country')}
          </label>
          <Select name="country"
            id="country"
            ref="country"
            value={this.state.countryVal}
            onChange={this.countryChange}
            options={countries}
          />
        </bem.FormModal__item>
        <bem.FormModal__item>
          <label className="long">
            {t('Help KoboToolbox improve this product by sharing the sector and country where this project will be deployed.')}
            {t('All the information is submitted anonymously, and will not include the project name or description listed above.')}
          </label>

          <input type="checkbox"
              name="share-metadata"
              ref="share-metadata"
              id="share-metadata"
              checked={this.state.shareMetadataChecked}
              onChange={this.shareMetadataChange}
            />
          <label htmlFor="share-metadata" className="inline">
            {t('Share the sector and country with developers')}
          </label>
        </bem.FormModal__item>

        <bem.FormModal__item m='actions'>
          <button onClick={this.onSubmit} className="mdl-button mdl-js-button mdl-button--raised mdl-button--colored">
            {this.props.submitButtonValue}
          </button>
        </bem.FormModal__item>
      </bem.FormModal>
    );
  },
});

export var NewForm = React.createClass({
  mixins: [
    Navigation,
  ],
  createAsset (settingsComponent) {
    dataInterface.createResource({
      name: settingsComponent.state.nameVal,
      settings: JSON.stringify({
        description: settingsComponent.state.descriptionVal,
        sector: settingsComponent.state.sectorVal,
        country: settingsComponent.state.countryVal,
        'share-metadata': settingsComponent.state.shareMetadataChecked
      }),
      asset_type: 'survey',
    }).done((asset) => {
      var isNewForm = false;
      if (isNewForm) {
        this.transitionTo('form-landing', {assetid: asset.uid})
      } else {
        this.transitionTo('form-edit', {assetid: asset.uid})
      }
    });
  },
  routeBack () {
    this.transitionTo('forms');
  },
  render () {
    return (
      <ui.Modal open onClose={this.routeBack} title={t('Create New Project from Scratch')}>
      <ProjectSettings
        onSubmit={this.createAsset}
        submitButtonValue={t('Create project')}
      />
      </ui.Modal>
    );
  },
});

export var ProjectSettingsEditor = React.createClass({
  updateAsset (settingsComponent) {
    actions.resources.updateAsset(
      settingsComponent.props.asset.uid,
      {
        name: settingsComponent.state.nameVal,
        settings: JSON.stringify({
          description: settingsComponent.state.descriptionVal,
          sector: settingsComponent.state.sectorVal,
          country: settingsComponent.state.countryVal,
          'share-metadata': settingsComponent.state.shareMetadataChecked
        }),
      }
    );
  },
  render () {
    return (
      <ProjectSettings
        onSubmit={this.updateAsset}
        submitButtonValue={t('Update project')}
        asset={this.props.asset}
      />
    );
  },
});

export var AddToLibrary = React.createClass({
  mixins: newFormMixins,
  listRoute: 'library',
});

let existingFormMixins = [
    Navigation,
    Reflux.ListenerMixin,
    editableFormMixin,
    existingFormMixin,
];

export var FormPage = React.createClass({
  mixins: existingFormMixins,
  listRoute: 'forms',
});

export var LibraryPage = React.createClass({
  mixins: existingFormMixins,
  listRoute: 'library',
});
