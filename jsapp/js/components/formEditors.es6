import React from 'react/addons';
import Reflux from 'reflux';

import newFormMixin from '../editorMixins/newForm';
import editableFormMixin from '../editorMixins/editableForm';
import existingFormMixin from '../editorMixins/existingForm';
import Select from 'react-select';

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
  render () {
    if (!this.state.sessionLoaded) {
      // TODO: use standardized loading wheel
      return (
          <p>{t('loading')}</p>
        )
    }
    var acct = session.currentAccount;
    var fromFile = false;
    var sectors = acct.available_sectors;
    var countries = acct.available_countries;
    return (
      <div>
        <p>
          <label htmlFor="name">
            {t('Project Name')}
          </label>
          <br />
          <input type="text"
              ref="name"
              id="name"
              placeholder={t('Enter title of project here')}
            />
        </p>
        <p>
          <label htmlFor="description">
            {t('Description')}
          </label>
          <br />
          <textarea type="text" ref="description"
              id="description"
              placeholder={t('Enter short description here')}
            />
        </p>
        <p>
          <label htmlFor="sector">
            {t('Sector')}
          </label>
          <br />
          <Select name="sector"
              ref="sector"
              id="sector"
              options={sectors}
            />
        </p>
        <label htmlFor="country">
          {t('Country')}
        </label>
        <br />
        <Select name="country"
            id="country"
            ref="country"
            options={countries}
          />
        <p>
          <input type="checkbox"
              name="share-metadata"
              id="share-metadata"
            />
          <label htmlFor="share-metadata">
            {t('Help kobotoolbox improve this tool by sharing project and sector.')}
          </label>
        </p>
        <button onClick={this.createAsset}>
          {t('Create project')}
        </button>
      </div>
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
