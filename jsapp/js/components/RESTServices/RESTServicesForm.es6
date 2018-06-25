import React from 'react';
import autoBind from 'react-autobind';
import alertify from 'alertifyjs';
import bem from '../../bem';
import {dataInterface} from '../../dataInterface';
import actions from '../../actions';
import stores from '../../stores';
import Select from 'react-select';
import {t} from '../../utils';

const EXPORT_TYPES = {
  JSON: 'json',
  XML: 'xml'
};
const SECURITY_OPTIONS = {
  no_auth: {
    value: 'no_auth',
    label: t('No Authorization')
  },
  basic_auth: {
    value: 'basic_auth',
    label: t('Basic Authorization')
  }
};

export default class RESTServicesForm extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      isLoadingExternalService: true,
      isSubmitPending: false,
      assetUid: props.assetUid,
      // will be empty if creating new service
      esid: props.esid,
      name: '',
      url: '',
      type: EXPORT_TYPES.JSON,
      isActive: true,
      securityLevel: null,
      securityOptions: [
        SECURITY_OPTIONS.no_auth,
        SECURITY_OPTIONS.basic_auth
      ],
      securityUsername: '',
      securityPassword: '',
      customHeaders: {},
      newHeaderName: '',
      newHeaderValue: ''
    };
    autoBind(this);
  }

  componentDidMount() {
    if (this.state.esid) {
      dataInterface.getExternalService(this.state.assetUid, this.state.esid)
        .done((data) => {
          console.log('loaded external service', data);

          const stateUpdate = {
            isLoadingExternalService: false,
            name: data.name,
            url: data.endpoint,
            isActive: data.active,
            type: data.export_type,
            securityLevel: SECURITY_OPTIONS[data.security_level],
            settings: {
              customHeaders: data.settings.custom_headers
            }
          };

          if (data.settings.username) {
            stateUpdate.securityUsername = data.settings.username;
          }
          if (data.settings.username) {
            stateUpdate.securityPassword = data.settings.username;
          }

          this.setState(stateUpdate);
        })
        .fail((data) => {
          console.log('failed loading external service', data);
        });
    } else {
      this.setState({isLoadingExternalService: false});
    }
  }

  formSecurityTypeChange(evt) {
    this.setState({securityLevel: evt});
  }

  formItemChange(evt) {
    this.setState({[evt.target.name]: evt.target.value})
  }

  getDataForEndpoint() {
    let securityLevel = SECURITY_OPTIONS.no_auth.value;
    if (this.state.securityLevel !== null) {
      securityLevel = this.state.securityLevel.value;
    }

    const data = {
      name: this.state.name,
      endpoint: this.state.url,
      active: this.state.isActive,
      export_type: this.state.type,
      security_level: securityLevel,
      settings: {
        custom_headers: this.state.customHeaders
      }
    };

    if (this.state.securityUsername) {
      data.settings.username = this.state.securityUsername;
    }
    if (this.state.securityPassword) {
      data.settings.password = this.state.securityPassword;
    }

    return data;
  }

  onSubmit(evt) {
    evt.preventDefault();

    const data = this.getDataForEndpoint();

    if (!data.name.trim() || !data.endpoint.trim()) {
      alertify.error(t('Please enter both name and url of your service.'));
      return;
    }

    const callbacks = {
      onComplete: () => {
        stores.pageState.hideModal();
        actions.resources.loadAsset({id: this.state.assetUid});
      },
      onFail: () => {
        this.setState({isSubmitPending: false});
        alertify.error(t('Failed registering REST service'));
      },
    };

    this.setState({isSubmitPending: true});
    if (this.state.esid) {
      actions.externalServices.update(
        this.state.assetUid,
        this.state.esid,
        data,
        callbacks
      );
    } else {
      actions.externalServices.add(
        this.state.assetUid,
        data,
        callbacks
      );
    }
    return false;
  }

  addHttpHeader(evt) {
    evt.preventDefault();
    const newCustomHeaders = this.state.customHeaders;
    newCustomHeaders[this.state.newHeaderName] = this.state.newHeaderValue;
    this.setState({
      customHeaders: newCustomHeaders,
      newHeaderName: '',
      newHeaderValue: ''
    });
  }

  removeHttpHeader(httpHeaderName, evt) {
    evt.preventDefault();
    const newCustomHeaders = this.state.customHeaders;
    delete newCustomHeaders[httpHeaderName];
    this.setState({customHeaders: newCustomHeaders});
  }

  renderCustomHttpHeaders() {
    const isAddButtonEnabled = this.state.newHeaderName !== '';

    const customHeadersArray = [];
    for (let header in this.state.customHeaders) {
      if (this.state.customHeaders.hasOwnProperty(header)) {
        customHeadersArray.push({
          name: header,
          value: this.state.customHeaders[header]
        });
      }
    }

    return (
      <bem.FormModal__item>
        <label
          htmlFor="http-header-name"
          className='long'
        >
          {t('Custom HTTP Headers')}
        </label>

        {customHeadersArray.length > 0 &&
          <bem.FormModal__item>
            {customHeadersArray.map((item, n) => {
              return (
                <bem.FormModal__item m='http-header' key={n}>
                  <code>{item.name}</code>

                  {item.value ? <code>{item.value}</code> : null}

                  <i className='k-icon-trash' onClick={this.removeHttpHeader.bind(this, item.name)}/>
                </bem.FormModal__item>
              );
            })}
          </bem.FormModal__item>
        }

        <bem.FormModal__item m='http-header-inputs'>
          <input
            type='text'
            placeholder={t('Name')}
            id='http-header-name'
            name='newHeaderName'
            value={this.state.newHeaderName}
            onChange={this.formItemChange.bind(this)}
          />

          <input
            type='text'
            placeholder={t('Value')}
            name='newHeaderValue'
            value={this.state.newHeaderValue}
            onChange={this.formItemChange.bind(this)}
          />

          <button
            onClick={this.addHttpHeader.bind(this)}
            disabled={!isAddButtonEnabled}
            className='mdl-button mdl-button--raised mdl-button--colored'
          >
            <i className='k-icon-plus' />
          </button>
        </bem.FormModal__item>
      </bem.FormModal__item>
    )
  }

  render() {
    const isEditingExistingService = Boolean(this.state.esid);

    if (this.state.isLoadingExternalService) {
      return (
        <bem.Loading>
          <bem.Loading__inner>
            <i />
            {t('loading...')}
          </bem.Loading__inner>
        </bem.Loading>
      );
    } else {
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
                    value={EXPORT_TYPES.JSON}
                    name='type'
                    onChange={this.formItemChange.bind(this)}
                    checked={this.state.type === EXPORT_TYPES.JSON}
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
                    value={EXPORT_TYPES.XML}
                    name='type'
                    onChange={this.formItemChange.bind(this)}
                    checked={this.state.type === EXPORT_TYPES.XML}
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
                name='securityLevel'
                value={this.state.securityLevel}
                onChange={this.formSecurityTypeChange.bind(this)}
                options={this.state.securityOptions}
              />
            </bem.FormModal__item>

            {this.state.securityLevel && this.state.securityLevel.value === SECURITY_OPTIONS.basic_auth.value &&
              <bem.FormModal__item>
                <label htmlFor='rest-service-form--username'>
                  {t('Username')}
                </label>

                <input
                  type='text'
                  id='rest-service-form--username'
                  name='securityUsername'
                  value={this.state.securityUsername}
                  onChange={this.formItemChange.bind(this)}
                />

                <label htmlFor='rest-service-form--password'>
                  {t('Password')}
                </label>

                <input
                  type='text'
                  id='rest-service-form--password'
                  name='securityPassword'
                  value={this.state.securityPassword}
                  onChange={this.formItemChange.bind(this)}
                />
              </bem.FormModal__item>
            }

            {this.renderCustomHttpHeaders()}

            <bem.FormModal__item m='actions'>
              <button
                onClick={this.onSubmit}
                disabled={this.state.isSubmitPending}
                className='mdl-button mdl-js-button mdl-button--raised mdl-button--colored'
              >
                { isEditingExistingService ? t('Save') : t('Create') }
              </button>
            </bem.FormModal__item>
          </bem.FormModal__item>
        </bem.FormModal__form>
      );
    }
  }
};
