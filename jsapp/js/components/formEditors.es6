import $ from 'jquery';
import React from 'react/addons';
import Reflux from 'reflux';
import alertify from 'alertifyjs';

import newFormMixin from '../editorMixins/newForm';
import editableFormMixin from '../editorMixins/editableForm';
import existingFormMixin from '../editorMixins/existingForm';
import Select from 'react-select';
import ui from '../ui';
import bem from '../bem';
import DocumentTitle from 'react-document-title';

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
  redirectTo,
  assign,
} from '../utils';

var ProjectSettings = React.createClass({
  mixins: [
    Navigation,
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
      assign(state, this.props.initialData);
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

    if (this.state.permissions && this.state.owner) {
      var perms = this.state.permissions;
      var owner = this.state.owner;

      var sharedWith = [];
      perms.forEach(function(perm) {
        if (perm.user__username != owner && perm.user__username != 'AnonymousUser' && sharedWith.indexOf(perm.user__username) < 0)
          sharedWith.push(perm.user__username);
      });
    }

    return (
      <bem.FormModal__form onSubmit={this.onSubmit}>
        {this.props.context == 'existingForm' && 
          <bem.FormModal__item m='actions'>
          <button onClick={this.onSubmit} className="mdl-button mdl-js-button mdl-button--bordered">
              {this.props.submitButtonValue}
            </button>
          </bem.FormModal__item>
        }

        <bem.FormModal__item m='wrapper'>
          {this.props.context == 'existingForm' && 
            <bem.FormModal__item m='sharing'>
              <a href={this.makeHref('form-sharing', {assetid: this.state.assetid})} className="mdl-button mdl-js-button mdl-button--bordered mdl-button--gray-border">
                {t('Share')}
              </a>
              <label>{t('Sharing Permissions')}</label>
              <label className="long">
                {t('Allow others to access your project.')}
              </label>
              {sharedWith.length > 0 &&
                t('Shared with ')
              }
              {sharedWith.map((user)=> {
                return (<span className="shared-with">{user}</span>);
              })}
            </bem.FormModal__item>
          }
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
            <label className="long">
              {t('Please specify the country and the sector where this project will be deployed. ')}
              {t('This information will be used to help you filter results on the project list page.')}
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

          {this.props.context == 'existingForm' && this.props.iframeUrl &&
            <iframe src={this.props.iframeUrl} className="kc-settings-iframe" />
          }
          {this.props.context == 'newForm' &&
            <bem.FormModal__item m='actions'>
            <button onClick={this.onSubmit} className="mdl-button mdl-js-button mdl-button--bordered">
                {this.props.submitButtonValue}
              </button>
            </bem.FormModal__item>
          }
        </bem.FormModal__item>
      </bem.FormModal__form>
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
        <ui.Modal.Body>
          <ProjectSettings
            onSubmit={this.createAsset}
            submitButtonValue={t('Create project')}
            context='newForm'
          />
        </ui.Modal.Body>
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
        iframeUrl={this.props.iframeUrl}
        context='existingForm'
      />
    );
  },
});

export var ProjectDownloads = React.createClass({
  getInitialState () {
    return {
      type: 'xls',
      lang: '_default',
      hierInLabels: false,
      groupSep: '/',
    };
  },
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
  },
  typeChange (e) {this.handleChange(e, 'type');},
  langChange (e) {this.handleChange(e, 'lang');},
  hierInLabelsChange (e) {this.handleChange(e, 'hierInLabels');},
  groupSepChange (e) {this.handleChange(e, 'groupSep');},
  handleSubmit (e) {
    e.preventDefault();

    if (this.state.type.indexOf('_legacy') < 0) {
      let url = this.props.asset.deployment__data_download_links[
        this.state.type
      ];
      if (this.state.type == 'xls' || this.state.type == 'csv') {
        let params = $.param({
          lang: this.state.lang,
          hierarchy_in_labels: this.state.hierInLabels,
          group_sep: this.state.groupSep,
        });
        redirectTo(`${url}?${params}`);
      } else {
        redirectTo(url);
      }
    }
  },
  render () {
    let translations = this.props.asset.content.translations;
    var docTitle = this.props.asset.name || t('Untitled');

    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
      <bem.FormView>
        <bem.FormView__cell>
          <bem.FormModal__form onSubmit={this.handleSubmit}>
            {[
              <bem.FormModal__item>
                <label htmlFor="type">{t('Select export type')}</label>
                <select name="type" value={this.state.type}
                    onChange={this.typeChange}>
                  <option value="xls">XLS</option>
                  <option value="xls_legacy">XLS (legacy)</option>
                  <option value="csv">CSV</option>
                  <option value="csv_legacy">CSV (legacy)</option>
                  <option value="zip_legacy">Media Attachments (ZIP)</option>
                  <option value="kml_legacy">GPS coordinates (KML)</option>
                  <option value="analyser_legacy">Excel Analyser</option>
                  <option value="spss_labels">SPSS Labels</option>
                </select>
              </bem.FormModal__item>
            , this.state.type == 'xls' || this.state.type == 'csv' ? [
                <bem.FormModal__item>
                  <label htmlFor="lang">{t('Value and header format')}</label>
                  <select name="lang" value={this.state.lang}
                      onChange={this.langChange}>
                    <option value="xml">XML values and headers</option>
                    <option value="_default">Labels</option>
                    {
                      translations && translations.map((t) => {
                        if (t) {
                          return <option value={t}>{t}</option>;
                        }
                      })
                    }
                  </select>
                </bem.FormModal__item>,
                <bem.FormModal__item>
                  <label htmlFor="hierarchy_in_labels">
                    {t('Include groups in headers')}
                  </label>
                  <input type="checkbox" name="hierarchy_in_labels"
                    value={this.state.hierInLabels}
                    onChange={this.hierInLabelsChange}
                  />
                </bem.FormModal__item>,
                this.state.hierInLabels ?
                  <bem.FormModal__item>
                    <label htmlFor="group_sep">{t('Group separator')}</label>
                    <input type="text" name="group_sep"
                      value={this.state.groupSep}
                      onChange={this.groupSepChange}
                    />
                  </bem.FormModal__item>
                : null
              ] : null
            , this.state.type.indexOf('_legacy') > 0 ?
              <bem.FormModal__item m='downloads'>
                <iframe src={
                    this.props.asset.deployment__data_download_links[
                      this.state.type]
                }>
                </iframe>
              </bem.FormModal__item>
            :
              <bem.FormModal__item>
                <input type="submit" 
                       value={t('Download')} 
                       className="mdl-button mdl-js-button mdl-button--raised mdl-button--colored"/>
              </bem.FormModal__item>
            ]}
          </bem.FormModal__form>
        </bem.FormView__cell>
      </bem.FormView>
      </DocumentTitle>
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
