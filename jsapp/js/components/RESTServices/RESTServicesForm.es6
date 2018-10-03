import $ from 'jquery';
import React from 'react';
import autoBind from 'react-autobind';
import TagsInput from 'react-tagsinput';
import alertify from 'alertifyjs';
import bem from '../../bem';
import {dataInterface} from '../../dataInterface';
import actions from '../../actions';
import stores from '../../stores';
import Select from 'react-select';
import Checkbox from '../checkbox';
import Radio from '../radio';
import TextBox from '../textBox';
import {t} from '../../utils';

const EXPORT_TYPES = {
  JSON: 'json',
  XML: 'xml'
};
const AUTH_OPTIONS = {
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
      nameError: null,
      endpoint: '',
      endpointError: null,
      type: EXPORT_TYPES.JSON,
      isActive: true,
      emailNotification: true,
      authLevel: null,
      authOptions: [
        AUTH_OPTIONS.no_auth,
        AUTH_OPTIONS.basic_auth
      ],
      authUsername: '',
      authPassword: '',
      selectedFields: [],
      customHeaders: [
        this.getEmptyHeaderRow()
      ]
    };
    autoBind(this);
  }

  componentDidMount() {
    if (this.state.hookUid) {
      dataInterface.getHook(this.state.assetUid, this.state.hookUid)
        .done((data) => {
          const stateUpdate = {
            isLoadingHook: false,
            name: data.name,
            endpoint: data.endpoint,
            isActive: data.active,
            emailNotification: data.email_notification || true,
            type: data.export_type,
            authLevel: AUTH_OPTIONS[data.auth_level] || null,
            customHeaders: this.headersObjToArr(data.settings.custom_headers)
          };

          if (stateUpdate.customHeaders.length === 0) {
            stateUpdate.customHeaders.push(this.getEmptyHeaderRow());
          }
          if (data.settings.username) {
            stateUpdate.authUsername = data.settings.username;
          }
          if (data.settings.password) {
            stateUpdate.authPassword = data.settings.password;
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

  handleNameChange(newName) {
    this.setState({
      name: newName,
      nameError: null
    });
  }

  handleEndpointChange(newEndpoint) {
    this.setState({
      endpoint: newEndpoint,
      endpointError: null
    });
  }

  handleAuthTypeChange(evt) {this.setState({authLevel: evt});}

  handleAuthUsernameChange(newUsername) {this.setState({authUsername: newUsername});}

  handleAuthPasswordChange(newPassword) {this.setState({authPassword: newPassword});}

  handleActiveChange(isChecked) {this.setState({isActive: isChecked});}
    
  handleEmailNotificationChange(isChecked) {
    this.setState({emailNotification: isChecked});
  }

  handleTypeRadioChange(name, value) {this.setState({[name]: value});}
  
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

  getDataForBackend() {
    let authLevel = AUTH_OPTIONS.no_auth.value;
    if (this.state.authLevel !== null) {
      authLevel = this.state.authLevel.value;
    }

    const data = {
      name: this.state.name,
      endpoint: this.state.endpoint,
      active: this.state.isActive,
      email_notification: this.state.emailNotification,
      export_type: this.state.type,
      auth_level: authLevel,
      settings: {
        custom_headers: this.headersArrToObj(this.state.customHeaders)
      }
    };

    if (this.state.authUsername) {
      data.settings.username = this.state.authUsername;
    }
    if (this.state.authPassword) {
      data.settings.password = this.state.authPassword;
    }

    return data;
  }

  validateForm() {
    let isValid = true;
    if (this.state.name.trim() === '') {
      this.setState({nameError: t('Name required')});
      isValid = false;
    }
    if (this.state.endpoint.trim() === '') {
      this.setState({endpointError: t('URL required')});
      isValid = false;
    }
    return isValid;
  }

  onSubmit(evt) {
    evt.preventDefault();

    if (!this.validateForm()) {
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
        this.getDataForBackend(),
        callbacks
      );
    } else {
      actions.hooks.add(
        this.state.assetUid,
        this.getDataForBackend(),
        callbacks
      );
    }
    return false;
  }

  /*
   * handle custom headers
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
                <i className='k-icon k-icon-trash'/>
              </button>
            </bem.FormModal__item>
          );
        })}

        <button
          className='http-header-add'
          onClick={this.addNewCustomHeaderRow}
        >
          <i className='k-icon k-icon-plus' />
          {t('Add header')}
        </button>
      </bem.FormModal__item>
    )
  }

  /*
   * handle fields
   */

  onSelectedFieldsChange(evt) {
    this.setState({selectedFields: evt});
  }

  renderFieldsSelector() {
    const inputProps = {
      placeholder: t('Add field(s)'),
      id: 'selected-fields-input'
    };

    return (
      <bem.FormModal__item>
        <label htmlFor='selected-fields-input'>
          {t('Select fields')}
        </label>

        <TagsInput
          value={this.state.selectedFields}
          onChange={this.onSelectedFieldsChange.bind(this)}
          inputProps={inputProps}
        />
      </bem.FormModal__item>
    )
  }

  /*
   * rendering
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
              <TextBox
                label={t('Name')}
                type='text'
                placeholder={t('Service Name')}
                value={this.state.name}
                errors={this.state.nameError}
                onChange={this.handleNameChange.bind(this)}
              />
            </bem.FormModal__item>

            <bem.FormModal__item>
              <TextBox
                label={t('Endpoint URL')}
                type='text'
                placeholder={t('https://')}
                value={this.state.endpoint}
                errors={this.state.endpointError}
                onChange={this.handleEndpointChange.bind(this)}
              />
            </bem.FormModal__item>

            <bem.FormModal__item>
              <Checkbox
                name='isActive'
                id='active-checkbox'
                onChange={this.handleActiveChange.bind(this)}
                checked={this.state.isActive}
                label={t('Enabled')}
              />
            </bem.FormModal__item>

            <bem.FormModal__item>
              <Checkbox
                name='emailNotification'
                id='email-checkbox'
                onChange={this.handleEmailNotificationChange.bind(this)}
                checked={this.state.emailNotification}
                label={t('Receive emails notifications')}
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
                value={this.state.authLevel}
                options={this.state.authOptions}
                onChange={this.handleAuthTypeChange.bind(this)}
                className='kobo-select'
                classNamePrefix='kobo-select'
                id='rest-service-form--security'
                name='authLevel'
                menuPlacement='auto'
              />
            </bem.FormModal__item>

            {this.renderFieldsSelector()}

            {this.state.authLevel && this.state.authLevel.value === AUTH_OPTIONS.basic_auth.value &&
              <bem.FormModal__item>
                <TextBox
                  label={t('Username')}
                  type='text'
                  value={this.state.authUsername}
                  onChange={this.handleAuthUsernameChange.bind(this)}
                />

                <TextBox
                  label={t('Password')}
                  type='text'
                  value={this.state.authPassword}
                  onChange={this.handleAuthPasswordChange.bind(this)}
                />
              </bem.FormModal__item>
            }

            {this.renderCustomHeaders()}
          </bem.FormModal__item>

          <bem.Modal__footer>
            <bem.Modal__footerButton
              m='primary'
              onClick={this.onSubmit}
              disabled={this.state.isSubmitPending}
            >
              { isEditingExistingHook ? t('Save') : t('Create') }
            </bem.Modal__footerButton>
          </bem.Modal__footer>
        </bem.FormModal__form>
      );
    }
  }
};
