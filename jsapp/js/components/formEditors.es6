import React from 'react/addons';
import Reflux from 'reflux';
import alertify from 'alertifyjs';

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
      name: evt.target.value
    });
  },
  descriptionChange (evt) {
    this.setState({
      description: evt.target.value
    });
  },
  countryChange (val) {
    this.setState({
      country: val
    });
  },
  sectorChange (val) {
    this.setState({
      sector: val
    });
  },
  shareMetadataChange (evt) {
    this.setState({
      'share-metadata': evt.target.checked
    });
  },
  getInitialState () {
    let state = {
      sessionLoaded: !!session.currentAccount,
      name: '',
      description: '',
      sector: '',
      country: '',
      'share-metadata': false
    }
    if (this.props.initialData !== undefined) {
      Object.assign(state, this.props.initialData);
    }
    return state;
  },
  componentDidMount () {
    this.listenTo(session, (session) => {
      this.setState({
        sessionLoaded: true,
      });
    });
  },
  onSubmit (evt) {
    evt.preventDefault();
    if (!this.state.name.trim()) {
      alertify.error(t('Please enter a title for your project'));
    } else {
      this.props.onSubmit(this);
    }
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
        <bem.FormModal__form onSubmit={this.onSubmit}>
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
            <textarea type="text"
                id="description"
                placeholder={t('Enter short description here')}
                value={this.state.description}
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
            <Select
                id="sector"
                value={this.state.sector}
                onChange={this.sectorChange}
                options={sectors}
              />
          </bem.FormModal__item>
          <bem.FormModal__item>
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
          <bem.FormModal__item>
            <label className="long">
              {t('Help KoboToolbox improve this product by sharing the sector and country where this project will be deployed.')}
              {t('All the information is submitted anonymously, and will not include the project name or description listed above.')}
            </label>

            <input type="checkbox"
                id="share-metadata"
                checked={this.state['share-metadata']}
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
        </bem.FormModal__form>
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
      name: settingsComponent.state.name,
      settings: JSON.stringify({
        description: settingsComponent.state.description,
        sector: settingsComponent.state.sector,
        country: settingsComponent.state.country,
        'share-metadata': settingsComponent.state['share-metadata']
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
  },
  render () {
    let initialData = {name: this.props.asset.name};
    Object.assign(initialData, this.props.asset.settings);
    return (
      <ProjectSettings
        onSubmit={this.updateAsset}
        submitButtonValue={t('Update project')}
        initialData={initialData}
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
