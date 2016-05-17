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
import {dataInterface} from '../dataInterface';
import {
  t,
} from '../utils';

export var NewForm = React.createClass({
  mixins: [
    Navigation,
    Reflux.ListenerMixin,
  ],
  createAsset () {
    var getNodeVal = (att)=> {
      return this.refs[att].getDOMNode().value;
    }
    dataInterface.createResource({
      name: getNodeVal('name'),
      settings: {
        description: getNodeVal('description'),
        sector: getNodeVal('sector'),
        country: getNodeVal('country'),
        'share-metadata': getNodeVal('share-metadata'),
      },
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
  getInitialState () {
    return {
      sessionLoaded: !!session.currentAccount,
    }
  },
  componentDidMount () {
    this.listenTo(session, (session) => {
      this.setState({
        sessionLoaded: true,
      });
    });
  },
  routeBack () {
    this.transitionTo('forms');
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
    var fromFile = false;
    var sectors = acct.available_sectors;
    var countries = acct.available_countries;
    return (
      <ui.Modal open onClose={this.routeBack} title={t('Create New Project from Scratch')}>
        <ui.Modal.Body>
          <bem.FormModal>
            <bem.FormModal__item>
              <label htmlFor="name">
                {t('Project Name')}
              </label>
              <input type="text"
                  ref="name"
                  id="name"
                  placeholder={t('Enter title of project here')}
                />
            </bem.FormModal__item>
            <bem.FormModal__item>
              <label htmlFor="description">
                {t('Description')}
              </label>
              <textarea type="text" ref="description"
                  id="description"
                  placeholder={t('Enter short description here')}
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
                  id="share-metadata"
                />
              <label htmlFor="share-metadata" className="inline">
                {t('Share the sector and country with developers')}
              </label>
            </bem.FormModal__item>

            <bem.FormModal__item m='actions'>
              <button onClick={this.createAsset} className="mdl-button mdl-js-button mdl-button--raised mdl-button--colored">
                {t('Create project')}
              </button>
            </bem.FormModal__item>
          </bem.FormModal>

        </ui.Modal.Body>
      </ui.Modal>
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
