import $ from 'jquery';
import React from 'react';
import autoBind from 'react-autobind';
import alertify from 'alertifyjs';
import bem from '../../bem';
import {dataInterface} from '../../dataInterface';
import actions from '../../actions';
import stores from '../../stores';
import Select from 'react-select';
import Checkbox from '../checkbox';
import Radio from '../radio';
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
      isLoadingHook: true,
      isSubmitPending: false,
      assetUid: props.assetUid,
      // will be empty if creating new service
      hookUid: props.hookUid,
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
      customHeaders: [
        this.getEmptyHeaderRow()
      ]
    };
    autoBind(this);
  }

  /*
   * initialization
   */

  componentDidMount() {
    if (this.state.hookUid) {
      dataInterface.getHook(this.state.assetUid, this.state.hookUid)
        .done((data) => {
          const stateUpdate = {
            isLoadingHook: false,
            name: data.name,
            url: data.endpoint,
            isActive: data.active,
            type: data.export_type,
            securityLevel: SECURITY_OPTIONS[data.security_level],
            customHeaders: this.headersObjToArr(data.settings.custom_headers)
          };

          if (stateUpdate.customHeaders.length === 0) {
            stateUpdate.customHeaders.push(this.getEmptyHeaderRow());
          }
          if (data.settings.username) {
            stateUpdate.securityUsername = data.settings.username;
          }
          if (data.settings.password) {
            stateUpdate.securityPassword = data.settings.password;
          }

          this.setState(stateUpdate);
        })
        .fail((data) => {
          this.setState({isSubmitPending: false});
          alertify.error(t('Could not load REST Service'));
        });
    } else {
      this.setState({isLoadingHook: false});
    }
  }

  /*
   * helpers
   */

  getEmptyHeaderRow() {
    return {name: '', value: ''};
  }

  headersObjToArr(headersObj) {
    const headersArr = [];
    for (let header in headersObj) {
      if (headersObj.hasOwnProperty(header)) {
        headersArr.push({
          name: header,
          value: headersObj[header]
        });
      }
    }
    return headersArr;
  }

  headersArrToObj(headersArr) {
    const headersObj = {}
    for (const header of headersArr) {
      if (header.name) {
        headersObj[header.name] = header.value;
      }
    }
    return headersObj;
  }

  /*
   * user input handling
   */

  handleSecurityTypeChange(evt) {
    this.setState({securityLevel: evt});
  }

  handleFormItemChange(evt) {
    this.setState({[evt.target.name]: evt.target.value});
  }

  handleActiveChange(isChecked) {
    this.setState({isActive: isChecked});
  }

  handleTypeRadioChange(name, value) {
    this.setState({[name]: value});
  }

  handleCustomHeaderChange(evt) {
    const propName = evt.target.name;
    const propValue = evt.target.value;
    const index = evt.target.dataset.index;
    const newCustomHeaders = this.state.customHeaders;
    if (propName === 'headerName') {
      newCustomHeaders[index].name = propValue;
    }
    if (propName === 'headerValue') {
      newCustomHeaders[index].value = propValue;
    }
    this.setState({customHeaders: newCustomHeaders});
  }

  /*
   * submitting form
   */

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
        custom_headers: this.headersArrToObj(this.state.customHeaders)
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
      },
    };

    this.setState({isSubmitPending: true});
    if (this.state.hookUid) {
      actions.hooks.update(
        this.state.assetUid,
        this.state.hookUid,
        data,
        callbacks
      );
    } else {
      actions.hooks.add(
        this.state.assetUid,
        data,
        callbacks
      );
    }
    return false;
  }

  /*
   * rendering custom headers
   */

 onCustomHeaderInputKeyPress(evt) {
   if (evt.key === 'Enter' && evt.currentTarget.name === 'headerName') {
     evt.preventDefault();
     $(evt.currentTarget).parent().find('input[name="headerValue"]').focus();
   }
   if (evt.key === 'Enter' && evt.currentTarget.name === 'headerValue') {
     evt.preventDefault();
     this.addNewCustomHeaderRow();
   }
 }

  addNewCustomHeaderRow(evt) {
    if (evt) {
      evt.preventDefault();
    }
    const newCustomHeaders = this.state.customHeaders;
    newCustomHeaders.push(this.getEmptyHeaderRow());
    this.setState({customHeaders: newCustomHeaders});
    setTimeout(() => {
      $('input[name="headerName"]').last().focus();
    }, 0);
  }

  removeCustomHeaderRow(evt) {
    evt.preventDefault();
    const newCustomHeaders = this.state.customHeaders;
    const rowIndex = evt.currentTarget.dataset.index;
    newCustomHeaders.splice(rowIndex, 1);
    if (newCustomHeaders.length === 0) {
      newCustomHeaders.push(this.getEmptyHeaderRow());
    }
    this.setState({customHeaders: newCustomHeaders});
  }

  renderCustomHeaders() {
    return (
      <bem.FormModal__item m='http-headers'>
        <label>
          {t('Custom HTTP Headers')}
        </label>

        {this.state.customHeaders.map((item, n) => {
          return (
            <bem.FormModal__item m='http-header-row' key={n}>
              <input
                type='text'
                placeholder={t('Name')}
                id={`headerName-${n}`}
                name='headerName'
                value={this.state.customHeaders[n].name}
                data-index={n}
                onChange={this.handleCustomHeaderChange}
                onKeyPress={this.onCustomHeaderInputKeyPress}
              />

              <input
                type='text'
                placeholder={t('Value')}
                id={`headerValue-${n}`}
                name='headerValue'
                value={this.state.customHeaders[n].value}
                data-index={n}
                onChange={this.handleCustomHeaderChange}
                onKeyPress={this.onCustomHeaderInputKeyPress}
              />

              <button
                className='http-header-row-remove'
                data-index={n}
                onClick={this.removeCustomHeaderRow}
              >
                <i className='k-icon-trash'/>
              </button>
            </bem.FormModal__item>
          );
        })}

        <button
          className='http-header-add'
          onClick={this.addNewCustomHeaderRow}
        >
          <i className='k-icon-plus' />
        </button>
      </bem.FormModal__item>
    )
  }

  /*
   * initialization
   */

  render() {
    const isEditingExistingHook = Boolean(this.state.hookUid);

    if (this.state.isLoadingHook) {
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
                onChange={this.handleFormItemChange.bind(this)}
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
                onChange={this.handleFormItemChange.bind(this)}
              />
            </bem.FormModal__item>

            <bem.FormModal__item>
              <Checkbox
                name='isActive'
                id='active-checkbox'
                onChange={this.handleActiveChange.bind(this)}
                checked={this.state.isActive}
                label={t('Enabled')}
                errors={['test', 'secn']}
              />
            </bem.FormModal__item>

            <bem.FormModal__item>
              <label>{t('Type')}</label>

              <bem.FormModal__item m='inline'>
                <Radio
                  value={EXPORT_TYPES.JSON}
                  name='type'
                  onChange={this.handleTypeRadioChange.bind(this)}
                  checked={this.state.type === EXPORT_TYPES.JSON}
                  label={t('JSON')}
                />
              </bem.FormModal__item>

              <bem.FormModal__item m='inline'>
                <Radio
                  value={EXPORT_TYPES.XML}
                  name='type'
                  onChange={this.handleTypeRadioChange.bind(this)}
                  checked={this.state.type === EXPORT_TYPES.XML}
                  label={t('XML')}
                />
              </bem.FormModal__item>
            </bem.FormModal__item>

            <bem.FormModal__item>
              <label htmlFor='rest-service-form--security'>
                {t('Security')}
              </label>

              <Select
                value={this.state.securityLevel}
                options={this.state.securityOptions}
                onChange={this.handleSecurityTypeChange.bind(this)}
                className='kobo-select'
                classNamePrefix='kobo-select'
                id='rest-service-form--security'
                name='securityLevel'
                menuPlacement='auto'
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
                  onChange={this.handleFormItemChange.bind(this)}
                />

                <label htmlFor='rest-service-form--password'>
                  {t('Password')}
                </label>

                <input
                  type='text'
                  id='rest-service-form--password'
                  name='securityPassword'
                  value={this.state.securityPassword}
                  onChange={this.handleFormItemChange.bind(this)}
                />
              </bem.FormModal__item>
            }

            {this.renderCustomHeaders()}

            <bem.FormModal__item m='actions'>
              <button
                onClick={this.onSubmit}
                disabled={this.state.isSubmitPending}
                className='mdl-button mdl-js-button mdl-button--raised mdl-button--colored'
              >
                { isEditingExistingHook ? t('Save') : t('Create') }
              </button>
            </bem.FormModal__item>
          </bem.FormModal__item>
        </bem.FormModal__form>
      );
    }
  }
};
