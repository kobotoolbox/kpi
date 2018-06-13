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
      url: 'https://',
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
      ]
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
    actions.resources.registerRESTService(this.state.assetUid, {
      name: this.state.name,
      url: this.state.url,
      type: this.state.type
    })
    return false;
  }

  render() {
    return (
      <bem.FormModal__form onSubmit={this.onSubmit}>
        <bem.FormModal__item m='wrapper'>

          <bem.FormModal__item>
            <label htmlFor='rest-service-form--name'>
              {t('Name')}
            </label>
            <input
              type='text'
              id='rest-service-form--name'
              name='name'
              placeholder={t('Service Name')}
              value={this.state.name}
              onChange={this.formItemChange}
            />
          </bem.FormModal__item>

          <bem.FormModal__item>
            <label htmlFor='rest-service-form--url'>
              {t('Endpoint URL')}
            </label>
            <input
              type='text'
              id='rest-service-form--url'
              name='url'
              placeholder={t('https://')}
              value={this.state.url}
              onChange={this.formItemChange}
            />
          </bem.FormModal__item>

          <bem.FormModal__item m='type'>
            <label>
              {t('Type')}
            </label>

            <bem.FormModal__item m={['half-width', 'half-width-left']}>
              <bem.FormModal__radio>
                <bem.FormModal__radioInput
                  type='radio'
                  value='json'
                  name='type'
                  onChange={this.formItemChange}
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
                  onChange={this.formItemChange}
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
              onChange={this.formItemChange}
              options={this.state.securityOptions}
            />
          </bem.FormModal__item>

          {this.state.securityType && this.state.securityType.value == 'basic-auth' &&
            <bem.FormModal__item>
              <label htmlFor='rest-service-form--authorization-header'>
                {t('Authorization Header')}
              </label>
              <input
                type='text'
                id='rest-service-form--authorization-header'
                name='auth_header'
                value={this.state.auth_header}
                onChange={this.formItemChange}
              />
            </bem.FormModal__item>
          }

          <bem.FormModal__item m='actions'>
            <button
              onClick={this.onSubmit}
              className='mdl-button mdl-js-button mdl-button--raised mdl-button--colored'
            >
              { this.state.rsid ? t('Save') : t('Create') }
            </button>
          </bem.FormModal__item>
        </bem.FormModal__item>
      </bem.FormModal__form>
    );
  }
};
