import $ from 'jquery';
import React from 'react';
import PropTypes from 'prop-types'
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import alertify from 'alertifyjs';
import moment from 'moment';
import ui from '../ui';
import bem from '../bem';
import actions from '../actions';
import stores from '../stores';
import Select from 'react-select';
import {dataInterface} from '../dataInterface';
import {
  t,
  redirectTo,
  assign,
  formatTime
} from '../utils';

import DocumentTitle from 'react-document-title';

export default class RESTServices extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      services: false
    };
    autoBind(this);
  }

  newServiceModal() {
    stores.pageState.showModal({
      type: 'RESTservice', 
      sid: false
    });
  }

  render () {
    var docTitle = this.props.asset.name || t('Untitled');
    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>        
        <bem.FormView m={this.state.services ? 'form-settings-REST' : 'form-settings-REST-empty'}>
          {this.state.services &&
            <div className="REST-services-list-wrapper">
              <RESTServiceList/>
              <button className="mdl-button mdl-button--raised mdl-button--colored"
                      onClick={this.newServiceModal}>
                {t('Register a New Service')}
              </button>
            </div>
          }

          {!this.state.services &&
        	<bem.Empty>
        		<bem.Empty__inner>
        			<i className="k-icon-settings" />
        			<h2>{t('This project does not have any REST services yet!')}</h2>
        			<p>
        				{t('You can use REST services to automatically post submissions to a third-party application.')}
        				&nbsp;
        				<a href="">
        					{t('Learn more')}
        				</a>
        			</p>
        			<button className="mdl-button mdl-button--raised mdl-button--colored"
        							onClick={this.newServiceModal}>
        				{t('Register a New Service')}
        			</button>
        		</bem.Empty__inner>
        	</bem.Empty>
          }
        </bem.FormView>
      </DocumentTitle>
    );
  }
};

export class RESTServiceForm extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      name: '',
      url: 'https://',
      type: 'json',
      securityType: 'oauth',
      securityOptions: [
        {
          value: 'oauth',
          label: t('OAuth')
        },
        {
          value: 'auth_header',
          label: t('Authorization Header')
        }
      ],
      auth_header: ''
    };
    autoBind(this);
  }

  formItemChange(evt) {
    if (evt.target) {
      var val = evt.target.value;
      var attr = evt.target.name;
    } else {
      var val = evt;
      var attr = 'securityType';
    }

    this.setState({
      [attr]: val
    })
  }

  onSubmit(evt) {
    evt.preventDefault();
    console.log(this.state);
    // TODO: send request to Backend
    return false;
  }

  render() {
  	return (
      <bem.FormModal__form onSubmit={this.onSubmit}>
        <bem.FormModal__item m='wrapper'>
          <bem.FormModal__item>
            <label htmlFor="name">
              {t('Name')}
            </label>
            <input type="text"
                name="name"
                placeholder={t('Service Name')}
                value={this.state.name}
                onChange={this.formItemChange}
              />
          </bem.FormModal__item>
          <bem.FormModal__item>
            <label htmlFor="url">
              {t('Endpoint URL')}
            </label>
            <input type="text"
                name="url"
                placeholder={t('https://')}
                value={this.state.url}
                onChange={this.formItemChange}
              />
          </bem.FormModal__item>

          <bem.FormModal__item m='type'>
            <label htmlFor="url">
              {t('Type')}
            </label>
        		<label className="radio-label">
              <input type="radio" value="json" 
                     name="type" onChange={this.formItemChange}
                     checked={this.state.type === 'json'} />
              <span>{t('JSON')}</span>
            </label>
        		<label className="radio-label">
              <input type="radio" value="xml" 
                     name="type" onChange={this.formItemChange} 
                     checked={this.state.type === 'xml'} />
              <span>{t('XML')}</span>
            </label>
          </bem.FormModal__item>


          <bem.FormModal__item m='security'>
            <label htmlFor="security">
              {t('Security')}
            </label>
            <Select
                name="securityType"
                value={this.state.securityType}
                onChange={this.formItemChange}
                options={this.state.securityOptions}
              />
          </bem.FormModal__item>

          {this.state.securityType && this.state.securityType.value == 'auth_header' &&
            <bem.FormModal__item>
              <label htmlFor="url">
                {t('Authorization Header')}
              </label>
              <input type="text"
                  name="auth_header"
                  value={this.state.auth_header}
                  onChange={this.formItemChange}
                />
            </bem.FormModal__item>
          }

          <bem.FormModal__item m='fields'>
            <label className="long">
              {t('Advanced Users')}
            </label>
            <label htmlFor="fields">
              {t('Post selected questions only (use question names, comma-delimited)')}
            </label>
            <textarea
              className="questions"
              name="questions"
              value={this.state.questions}
              onChange={this.formItemChange}
            />
          </bem.FormModal__item>

          <bem.FormModal__item m='actions'>
            <button onClick={this.onSubmit} className="mdl-button mdl-js-button mdl-button--raised mdl-button--colored">
              {t('Create')}
            </button>
          </bem.FormModal__item>
        </bem.FormModal__item>
      </bem.FormModal__form>

  	);
  }
};

export class RESTServiceList extends React.Component {
  constructor(props){
    super(props);
    this.state = {};
    autoBind(this);
  }

  render() {
    let services = [
      {
        name: 'Service 1',
        count: 20
      },
      {
        name: 'Service 2',
        count: 20
      },
      {
        name: 'Service 3',
        count: 20
      }
    ];
    return (
      <bem.FormView__cell m='REST-services-list'>
        <bem.FormView__group m="headings">
          <bem.FormView__cell m='label'>
            X Services
          </bem.FormView__cell>
        </bem.FormView__group>
        <bem.FormView__cell m={['REST-services-table', 'box']}>
          <bem.FormView__group>
            <bem.FormView__group m={['items', 'headings']}>
              <bem.FormView__label m='name'>{t('Service Name')}</bem.FormView__label>
              <bem.FormView__label m='count'>{t('Count')}</bem.FormView__label>
              <bem.FormView__label m='actions'></bem.FormView__label>
            </bem.FormView__group>

            {services.map((item, n) => {
              return (
                <bem.FormView__group m="items" key={n} >
                  <bem.FormView__label m='name'>
                    {item.name}
                  </bem.FormView__label>
                  <bem.FormView__label m='count'>
                    {item.count}
                  </bem.FormView__label>
                  <bem.FormView__label m='actions'>
                    ACTIONS
                  </bem.FormView__label>
                </bem.FormView__group>
              );
            })}
          </bem.FormView__group>
        </bem.FormView__cell>
      </bem.FormView__cell>
    );
  }
}