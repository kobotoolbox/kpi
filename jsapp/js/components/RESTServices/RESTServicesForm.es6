import React from 'react';
import autoBind from 'react-autobind';
import bem from '../../bem';
import actions from '../../actions';
import Select from 'react-select';
import {t} from '../../utils';

export default class RESTServicesForm extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      assetUid: props.assetUid,
      // used for determining if editing or creating new
      rsid: props.rsid,
      name: '',
      url: '',
      type: 'json',
      securityType: null,
      securityOptions: [
        {
          value: 'no-auth',
          label: t('No Authorization')
        },
        {
          value: 'basic-auth',
          label: t('Basic Authorization')
        }
      ],
      httpHeaderName: '',
      httpHeaderValue: '',
      httpHeaders: []
    };
    autoBind(this);
  }

  formSecurityTypeChange(evt) {
    this.setState({'securityType': evt});
  }

  formItemChange(evt) {
    this.setState({[evt.target.name]: evt.target.value})
  }

  onSubmit(evt) {
    evt.preventDefault();
    actions.resources.registerRESTService(this.state.assetUid, {
      name: this.state.name,
      url: this.state.url,
      type: this.state.type
    })
    return false;
  }

  addHttpHeader(evt) {
    evt.preventDefault();
    const newHttpHeaders = this.state.httpHeaders;
    newHttpHeaders.push({
      name: this.state.httpHeaderName,
      value: this.state.httpHeaderValue
    });
    this.setState({
      httpHeaders: newHttpHeaders,
      httpHeaderName: '',
      httpHeaderValue: ''
    });
  }

  removeHttpHeader(httpHeader, evt) {
    evt.preventDefault();
    const newHttpHeaders = this.state.httpHeaders;
    newHttpHeaders.splice(this.state.httpHeaders.indexOf(httpHeader), 1);
    this.setState({httpHeaders: newHttpHeaders});
  }

  renderCustomHttpHeaders() {
    const isAddButtonEnabled = this.state.httpHeaderName !== '';

    return (
      <bem.FormModal__item>
        <label className='formModal__item'>{t('Custom HTTP Headers')}</label>

        {this.state.httpHeaders.map((item, n) => {
          return (
            <bem.FormModal__item>
              {item.name} - {item.value}

              <button
                className='mdl-button mdl-button--icon'
                onClick={this.removeHttpHeader.bind(this, item)}
              >
                <i className='k-icon-trash' />
              </button>
            </bem.FormModal__item>
          );
        })}

        <input
          className='form-modal__item'
          type='text'
          placeholder={t('Name')}
          name='httpHeaderName'
          value={this.state.httpHeaderName}
          onChange={this.formItemChange.bind(this)}
        />

        <input
          className='form-modal__item'
          type='text'
          placeholder={t('Value')}
          name='httpHeaderValue'
          value={this.state.httpHeaderValue}
          onChange={this.formItemChange.bind(this)}
        />

        <button
          onClick={this.addHttpHeader.bind(this)}
          disabled={!isAddButtonEnabled}
          className='mdl-button mdl-button--raised mdl-button--colored'
        >
          {t('Add HTTP Header')}
        </button>
      </bem.FormModal__item>
    )
  }

  render() {
    const isNew = Boolean(this.state.rsid);

    return (
      <bem.FormModal__form onSubmit={this.onSubmit.bind(this)}>
        <bem.FormModal__item m='wrapper'>
          <bem.FormModal__item>
            <label htmlFor='rest-service-form--name'>{t('Name')}</label>

            <input
              type='text'
              id='rest-service-form--name'
              name='name'
              placeholder={t('Service Name')}
              value={this.state.name}
              onChange={this.formItemChange.bind(this)}
            />
          </bem.FormModal__item>

          <bem.FormModal__item>
            <label htmlFor='rest-service-form--url'>{t('Endpoint URL')}</label>

            <input
              type='text'
              id='rest-service-form--url'
              name='url'
              placeholder={t('https://')}
              value={this.state.url}
              onChange={this.formItemChange.bind(this)}
            />
          </bem.FormModal__item>

          <bem.FormModal__item m='type'>
            <label>{t('Type')}</label>

            <bem.FormModal__item m={['half-width', 'half-width-left']}>
              <bem.FormModal__radio>
                <bem.FormModal__radioInput
                  type='radio'
                  value='json'
                  name='type'
                  onChange={this.formItemChange.bind(this)}
                  checked={this.state.type === 'json'}
                />

                <bem.FormModal__radioText>
                  {t('JSON')}
                </bem.FormModal__radioText>
              </bem.FormModal__radio>
            </bem.FormModal__item>

            <bem.FormModal__item m='half-width'>
              <bem.FormModal__radio>
                <bem.FormModal__radioInput
                  type='radio'
                  value='xml'
                  name='type'
                  onChange={this.formItemChange.bind(this)}
                  checked={this.state.type === 'xml'}
                />

                <bem.FormModal__radioText>
                  {t('XML')}
                </bem.FormModal__radioText>
              </bem.FormModal__radio>
            </bem.FormModal__item>
          </bem.FormModal__item>

          <bem.FormModal__item m='security'>
            <label htmlFor='rest-service-form--security'>
              {t('Security')}
            </label>

            <Select
              id='rest-service-form--security'
              name='securityType'
              value={this.state.securityType}
              onChange={this.formSecurityTypeChange.bind(this)}
              options={this.state.securityOptions}
            />
          </bem.FormModal__item>

          {this.state.securityType && this.state.securityType.value === 'basic-auth' &&
            <bem.FormModal__item>
              <label htmlFor='rest-service-form--username'>
                {t('Username')}
              </label>

              <input
                type='text'
                id='rest-service-form--username'
                name='security-username'
                value={this.state.securityUsername}
                onChange={this.formItemChange.bind(this)}
              />

              <label htmlFor='rest-service-form--password'>
                {t('Password')}
              </label>

              <input
                type='text'
                id='rest-service-form--password'
                name='security-password'
                value={this.state.securityPassword}
                onChange={this.formItemChange.bind(this)}
              />
            </bem.FormModal__item>
          }

          {this.state.securityType &&
            this.renderCustomHttpHeaders()
          }

          <bem.FormModal__item m='actions'>
            <button
              onClick={this.onSubmit}
              className='mdl-button mdl-js-button mdl-button--raised mdl-button--colored'
            >
              { isNew ? t('Create') : t('Save') }
            </button>
          </bem.FormModal__item>
        </bem.FormModal__item>
      </bem.FormModal__form>
    );
  }
};
