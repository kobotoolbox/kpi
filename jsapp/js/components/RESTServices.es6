import $ from 'jquery';
import React from 'react';
import PropTypes from 'prop-types'
import reactMixin from 'react-mixin';
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
    this.state = {};
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
        <bem.FormView m='form-settings-REST'>
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
        </bem.FormView>
      </DocumentTitle>
    );
  }
};

export class RESTServiceForm extends React.Component {
  constructor(props){
    super(props);
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
                id="name"
                placeholder={t('Service Name')}
                //value={this.state.name}
                //onChange={this.nameChange}
              />
          </bem.FormModal__item>
          <bem.FormModal__item>
            <label htmlFor="url">
              {t('Endpoint URL')}
            </label>
            <input type="text"
                id="url"
                placeholder={t('https://')}
                //value={this.state.name}
                //onChange={this.nameChange}
              />
          </bem.FormModal__item>

          <bem.FormModal__item m='type'>
        		<label><input type="radio" value="json" defaultChecked name="type"/> JSON</label>
        		<label><input type="radio" value="xml" name="type"/> XML</label>
          </bem.FormModal__item>


          <bem.FormModal__item m='security'>
            <label htmlFor="security">
              {t('Security')}
            </label>
            <Select
                id="security"
                //value={this.state.sector}
                //onChange={this.sectorChange}
                //options={sectors}
              />
          </bem.FormModal__item>

          <bem.FormModal__item m='fields'>
            <label htmlFor="fields">
              {t('Fields (optional)')}
            </label>
            <Select
                id="fields"
                //value={this.state.sector}
                //onChange={this.sectorChange}
                //options={sectors}
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