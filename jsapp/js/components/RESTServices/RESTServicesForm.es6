import React from 'react';
import autoBind from 'react-autobind';
import KoboTagsInput from 'js/components/common/koboTagsInput';
import alertify from 'alertifyjs';
import bem from 'js/bem';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {dataInterface} from '../../dataInterface';
import {actions} from '../../actions';
import {stores} from '../../stores';
import Select from 'react-select';
import Checkbox from 'js/components/common/checkbox';
import Radio from 'js/components/common/radio';
import TextBox from 'js/components/common/textBox';
import {KEY_CODES} from 'js/constants';
import envStore from 'js/envStore';

const EXPORT_TYPES = {
  json: {
    value: 'json',
    label: t('JSON')
  },
  xml: {
    value: 'xml',
    label: t('XML')
  }
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
      type: EXPORT_TYPES.json.value,
      typeOptions: [
        EXPORT_TYPES.json,
        EXPORT_TYPES.xml
      ],
      isActive: true,
      emailNotification: true,
      authLevel: null,
      authOptions: [
        AUTH_OPTIONS.no_auth,
        AUTH_OPTIONS.basic_auth
      ],
      authUsername: '',
      authPassword: '',
      subsetFields: [],
      customHeaders: [
        this.getEmptyHeaderRow()
      ],
      payloadTemplate: '',
      payloadTemplateErrors: []
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
            emailNotification: data.email_notification,
            subsetFields: data.subset_fields || [],
            type: data.export_type,
            authLevel: AUTH_OPTIONS[data.auth_level] || null,
            customHeaders: this.headersObjToArr(data.settings.custom_headers),
            payloadTemplate: data.payload_template
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
        .fail(() => {
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
    const headersObj = {};
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

  handleCustomWrapperChange(newVal) {
    this.setState({
      payloadTemplate: newVal,
      payloadTemplateErrors: []
    });
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
      subset_fields: this.state.subsetFields,
      email_notification: this.state.emailNotification,
      export_type: this.state.type,
      auth_level: authLevel,
      settings: {
        custom_headers: this.headersArrToObj(this.state.customHeaders)
      },
      payload_template: this.state.payloadTemplate
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
      onFail: (data) => {
        let payloadTemplateErrors = [];
        if (
          data.responseJSON &&
          data.responseJSON.payload_template &&
          data.responseJSON.payload_template.length !== 0
        ) {
          payloadTemplateErrors = data.responseJSON.payload_template;
        }
        this.setState({
          payloadTemplateErrors: payloadTemplateErrors,
          isSubmitPending: false
        });
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
   if (evt.keyCode === KEY_CODES.ENTER && evt.currentTarget.name === 'headerName') {
     evt.preventDefault();
     $(evt.currentTarget).parent().find('input[name="headerValue"]').focus();
   }
   if (evt.keyCode === KEY_CODES.ENTER && evt.currentTarget.name === 'headerValue') {
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

              <bem.Button
                m='icon'
                className='http-header-row-remove'
                data-index={n}
                onClick={this.removeCustomHeaderRow}
              >
                <i className='k-icon k-icon-trash'/>
              </bem.Button>
            </bem.FormModal__item>
          );
        })}

        <bem.KoboButton
          m='small'
          onClick={this.addNewCustomHeaderRow}
        >
          <i className='k-icon k-icon-plus' />
          {t('Add header')}
        </bem.KoboButton>
      </bem.FormModal__item>
    );
  }

  /*
   * handle fields
   */

  onSubsetFieldsChange(newValue) {
    this.setState({subsetFields: newValue.split(',')});
  }

  renderFieldsSelector() {
    return (
      <bem.FormModal__item>
        <KoboTagsInput
          tags={this.state.subsetFields.join(',')}
          onChange={this.onSubsetFieldsChange}
          placeholder={t('Add field(s)')}
          label={t('Select fields subset')}
        />
      </bem.FormModal__item>
    );
  }

  /*
   * rendering
   */

  render() {
    const isEditingExistingHook = Boolean(this.state.hookUid);

    if (this.state.isLoadingHook) {
      return (<LoadingSpinner/>);
    } else {
      let submissionPlaceholder = '%SUBMISSION%';
      if (envStore.isReady && envStore.data.submission_placeholder) {
        submissionPlaceholder = envStore.data.submission_placeholder;
      }

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
              <Radio
                name='type'
                options={this.state.typeOptions}
                onChange={this.handleTypeRadioChange.bind(this)}
                selected={this.state.type}
                title={t('Type')}
              />
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
                isSearchable={false}
              />
            </bem.FormModal__item>

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

            {this.renderFieldsSelector()}

            {this.renderCustomHeaders()}

            {this.state.type === EXPORT_TYPES.json.value &&
              <bem.FormModal__item m='rest-custom-wrapper'>
                <TextBox
                  label={t('Add custom wrapper around JSON submission (%SUBMISSION% will be replaced by JSON)').replace('%SUBMISSION%', submissionPlaceholder)}
                  type='text-multiline'
                  placeholder={t('Add Custom Wrapper')}
                  value={this.state.payloadTemplate}
                  errors={this.state.payloadTemplateErrors}
                  onChange={this.handleCustomWrapperChange.bind(this)}
                />
              </bem.FormModal__item>
            }
          </bem.FormModal__item>

          <bem.Modal__footer>
            <bem.KoboButton
              m='blue'
              onClick={this.onSubmit}
              disabled={this.state.isSubmitPending}
            >
              { isEditingExistingHook ? t('Save') : t('Create') }
            </bem.KoboButton>
          </bem.Modal__footer>
        </bem.FormModal__form>
      );
    }
  }
}
