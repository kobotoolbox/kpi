import React from 'react'

import clonedeep from 'lodash.clonedeep'
import { actions } from '#/actions'
import bem from '#/bem'
import Button from '#/components/common/button'
import Checkbox from '#/components/common/checkbox'
import KoboTagsInput from '#/components/common/koboTagsInput'
import LoadingSpinner from '#/components/common/loadingSpinner'
import Radio from '#/components/common/radio'
import TextBox from '#/components/common/textBox'
import WrappedSelect from '#/components/common/wrappedSelect'
import { KEY_CODES } from '#/constants'
import { type ExternalServiceHookResponse, type FailResponse, dataInterface } from '#/dataInterface'
import envStore from '#/envStore'
import pageState from '#/pageState.store'
import { notify } from '#/utils'

export enum HookExportTypeName {
  json = 'json',
  xml = 'xml',
}

const EXPORT_TYPES = {
  json: {
    value: HookExportTypeName.json,
    label: t('JSON'),
  },
  xml: {
    value: HookExportTypeName.xml,
    label: t('XML'),
  },
}

export enum HookAuthLevelName {
  no_auth = 'no_auth',
  basic_auth = 'basic_auth',
}

const AUTH_OPTIONS = {
  no_auth: {
    value: HookAuthLevelName.no_auth,
    label: t('No Authorization'),
  },
  basic_auth: {
    value: HookAuthLevelName.basic_auth,
    label: t('Basic Authorization'),
  },
}

interface RESTServicesFormProps {
  assetUid: string
  hookUid?: string
}

interface RESTServicesFormState {
  isLoadingHook: boolean
  isSubmitPending: boolean
  assetUid: string
  hookUid?: string
  name: string
  nameError?: string
  endpoint: string
  endpointError?: string
  type: HookExportTypeName
  typeOptions: Array<{ value: HookExportTypeName; label: string }>
  isActive: boolean
  emailNotification: boolean
  authLevel: { value: HookAuthLevelName; label: string } | null
  authOptions: Array<{ value: HookAuthLevelName; label: string }>
  authUsername: string
  authPassword: string
  subsetFields: string[]
  customHeaders: Array<{ name: string; value: string }>
  payloadTemplate: string
  payloadTemplateErrors: string | string[]
}

export default class RESTServicesForm extends React.Component<RESTServicesFormProps, RESTServicesFormState> {
  constructor(props: RESTServicesFormProps) {
    super(props)
    this.state = {
      isLoadingHook: true,
      isSubmitPending: false,
      assetUid: props.assetUid,
      hookUid: props.hookUid,
      name: '',
      nameError: undefined,
      endpoint: '',
      endpointError: undefined,
      type: EXPORT_TYPES.json.value,
      typeOptions: [EXPORT_TYPES.json, EXPORT_TYPES.xml],
      isActive: true,
      emailNotification: true,
      authLevel: null,
      authOptions: [AUTH_OPTIONS.no_auth, AUTH_OPTIONS.basic_auth],
      authUsername: '',
      authPassword: '',
      subsetFields: [],
      customHeaders: [this.getEmptyHeaderRow()],
      payloadTemplate: '',
      payloadTemplateErrors: [],
    }
  }

  componentDidMount() {
    if (this.state.hookUid) {
      dataInterface
        .getHook(this.state.assetUid, this.state.hookUid)
        .done((data: ExternalServiceHookResponse) => {
          const stateUpdate: Partial<RESTServicesFormState> = {
            isLoadingHook: false,
            name: data.name,
            endpoint: data.endpoint,
            isActive: data.active,
            emailNotification: data.email_notification,
            subsetFields: data.subset_fields || [],
            type: data.export_type,
            authLevel: AUTH_OPTIONS[data.auth_level] || null,
            customHeaders: this.headersObjToArr(data.settings.custom_headers),
            payloadTemplate: data.payload_template,
          }

          if (stateUpdate.customHeaders?.length === 0) {
            stateUpdate.customHeaders.push(this.getEmptyHeaderRow())
          }
          if (data.settings.username) {
            stateUpdate.authUsername = data.settings.username
          }
          if (data.settings.password) {
            stateUpdate.authPassword = data.settings.password
          }

          this.setState(stateUpdate as RESTServicesFormState)
        })
        .fail(() => {
          this.setState({ isSubmitPending: false })
          notify.error(t('Could not load REST Service'))
        })
    } else {
      this.setState({ isLoadingHook: false })
    }
  }

  /*
   * helpers
   */

  getEmptyHeaderRow() {
    return { name: '', value: '' }
  }

  headersObjToArr(headersObj: { [key: string]: string }) {
    const headersArr: Array<{ name: string; value: string }> = []
    for (const header in headersObj) {
      if (Object.prototype.hasOwnProperty.call(headersObj, header)) {
        headersArr.push({
          name: header,
          value: headersObj[header],
        })
      }
    }
    return headersArr
  }

  headersArrToObj(headersArr: Array<{ name: string; value: string }>) {
    const headersObj: { [key: string]: string } = {}
    for (const header of headersArr) {
      if (header.name) {
        headersObj[header.name] = header.value
      }
    }
    return headersObj
  }

  /*
   * user input handling
   */

  handleNameChange(newName: string) {
    this.setState({
      name: newName,
      nameError: undefined,
    })
  }

  handleEndpointChange(newEndpoint: string) {
    this.setState({
      endpoint: newEndpoint,
      endpointError: undefined,
    })
  }

  handleAuthTypeChange(evt: unknown) {
    const newVal = evt as { value: HookAuthLevelName; label: string }
    this.setState({ authLevel: newVal })
  }

  handleAuthUsernameChange(newUsername: string) {
    this.setState({ authUsername: newUsername })
  }

  handleAuthPasswordChange(newPassword: string) {
    this.setState({ authPassword: newPassword })
  }

  handleActiveChange(isChecked: boolean) {
    this.setState({ isActive: isChecked })
  }

  handleEmailNotificationChange(isChecked: boolean) {
    this.setState({ emailNotification: isChecked })
  }

  handleTypeRadioChange(value: string, name: string) {
    this.setState({ [name]: value } as unknown as Pick<RESTServicesFormState, keyof RESTServicesFormState>)
  }

  handleCustomHeaderNameChange(headerIndex: number, newName: string) {
    const newCustomHeaders = clonedeep(this.state.customHeaders)
    newCustomHeaders[headerIndex].name = newName
    this.setState({ customHeaders: newCustomHeaders })
  }

  handleCustomHeaderValueChange(headerIndex: number, newValue: string) {
    const newCustomHeaders = clonedeep(this.state.customHeaders)
    newCustomHeaders[headerIndex].value = newValue
    this.setState({ customHeaders: newCustomHeaders })
  }

  handleCustomWrapperChange(newVal: string) {
    this.setState({
      payloadTemplate: newVal,
      payloadTemplateErrors: [],
    })
  }

  /*
   * submitting form
   */

  getDataForBackend() {
    let authLevel = AUTH_OPTIONS.no_auth.value
    if (this.state.authLevel !== null) {
      authLevel = this.state.authLevel.value
    }

    const data: Partial<ExternalServiceHookResponse> = {
      name: this.state.name,
      endpoint: this.state.endpoint,
      active: this.state.isActive,
      subset_fields: this.state.subsetFields,
      email_notification: this.state.emailNotification,
      export_type: this.state.type,
      auth_level: authLevel,
      settings: {
        custom_headers: this.headersArrToObj(this.state.customHeaders),
      },
      payload_template: this.state.payloadTemplate,
    }

    if (this.state.authUsername && data.settings !== undefined) {
      data.settings.username = this.state.authUsername
    }
    if (this.state.authPassword && data.settings !== undefined) {
      data.settings.password = this.state.authPassword
    }
    return data
  }

  validateForm() {
    let isValid = true
    if (this.state.name.trim() === '') {
      this.setState({ nameError: t('Name required') })
      isValid = false
    }
    if (this.state.endpoint.trim() === '') {
      this.setState({ endpointError: t('URL required') })
      isValid = false
    }
    return isValid
  }

  onSubmit(evt: React.FormEvent) {
    evt.preventDefault()

    if (!this.validateForm()) {
      notify.error(t('Please enter both name and url of your service.'))
      return
    }

    const callbacks = {
      onComplete: () => {
        pageState.hideModal()
        actions.resources.loadAsset({ id: this.state.assetUid })
      },
      onFail: (data: FailResponse) => {
        let payloadTemplateErrors: string | string[] = []
        if (data.responseJSON?.payload_template?.length !== 0) {
          payloadTemplateErrors = data.responseJSON?.payload_template || []
        }
        this.setState({
          payloadTemplateErrors: payloadTemplateErrors,
          isSubmitPending: false,
        })
      },
    }

    this.setState({ isSubmitPending: true })
    if (this.state.hookUid) {
      actions.hooks.update(this.state.assetUid, this.state.hookUid, this.getDataForBackend(), callbacks)
    } else {
      actions.hooks.add(this.state.assetUid, this.getDataForBackend(), callbacks)
    }
    return false
  }

  /*
   * handle custom headers
   */

  onCustomHeaderInputKeyPress(evt: React.KeyboardEvent<HTMLInputElement>) {
    // Pressing ENTER key while editing the name, moves focus to the input for the value
    if (evt.keyCode === KEY_CODES.ENTER && evt.currentTarget.name === 'headerName') {
      evt.preventDefault()
      ;(evt.currentTarget.parentElement?.querySelector('input[name="headerValue"]') as HTMLInputElement).focus()
    }
    // Pressing ENTER key while editing the value, adds a new row and moves focus to its name input
    if (evt.keyCode === KEY_CODES.ENTER && evt.currentTarget.name === 'headerValue') {
      evt.preventDefault()
      this.addNewCustomHeaderRow()
    }
  }

  addNewCustomHeaderRow(evt?: React.MouseEvent<HTMLButtonElement>) {
    if (evt) {
      evt.preventDefault()
    }
    const newCustomHeaders = this.state.customHeaders
    newCustomHeaders.push(this.getEmptyHeaderRow())
    this.setState({ customHeaders: newCustomHeaders })
    setTimeout(() => {
      const inputs = document.querySelectorAll('input[name="headerName"]')
      const lastEl = inputs[inputs.length - 1]
      if (lastEl !== null) {
        ;(lastEl as HTMLInputElement).focus()
      }
    }, 0)
  }

  removeCustomHeaderRow(headerIndex: number) {
    const newCustomHeaders = clonedeep(this.state.customHeaders)
    newCustomHeaders.splice(Number(headerIndex), 1)
    if (newCustomHeaders.length === 0) {
      newCustomHeaders.push(this.getEmptyHeaderRow())
    }
    this.setState({ customHeaders: newCustomHeaders })
  }

  renderCustomHeaders() {
    return (
      <bem.FormModal__item m='http-headers'>
        <label>{t('Custom HTTP Headers')}</label>

        {this.state.customHeaders.map((_item, n) => (
          <bem.FormModal__item m='http-header-row' key={n}>
            <input
              type='text'
              placeholder={t('Name')}
              id={`headerName-${n}`}
              name='headerName'
              value={this.state.customHeaders[n].name}
              onChange={(evt: React.ChangeEvent<HTMLInputElement>) => {
                this.handleCustomHeaderNameChange(n, evt.target.value)
              }}
              onKeyDown={this.onCustomHeaderInputKeyPress.bind(this)}
            />

            <input
              type='text'
              placeholder={t('Value')}
              id={`headerValue-${n}`}
              name='headerValue'
              value={this.state.customHeaders[n].value}
              onChange={(evt: React.ChangeEvent<HTMLInputElement>) => {
                this.handleCustomHeaderValueChange(n, evt.target.value)
              }}
              onKeyDown={this.onCustomHeaderInputKeyPress.bind(this)}
            />

            <Button
              type='secondary-danger'
              size='m'
              className='http-header-row-remove'
              startIcon='trash'
              onClick={(evt: React.ChangeEvent<HTMLButtonElement>) => {
                evt.preventDefault()
                this.removeCustomHeaderRow(n)
              }}
            />
          </bem.FormModal__item>
        ))}

        <Button
          type='secondary'
          size='s'
          startIcon='plus'
          onClick={this.addNewCustomHeaderRow.bind(this)}
          label={t('Add header')}
        />
      </bem.FormModal__item>
    )
  }

  /*
   * handle fields
   */

  onSubsetFieldsChange(newValue: string) {
    this.setState({ subsetFields: newValue.split(',') })
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
    )
  }

  /*
   * rendering
   */

  render() {
    const isEditingExistingHook = Boolean(this.state.hookUid)

    if (this.state.isLoadingHook) {
      return <LoadingSpinner />
    } else {
      let submissionPlaceholder = '%SUBMISSION%'
      if (envStore.isReady && envStore.data.submission_placeholder) {
        submissionPlaceholder = envStore.data.submission_placeholder
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
                onChange={this.handleActiveChange.bind(this)}
                checked={this.state.isActive}
                label={t('Enabled')}
              />
            </bem.FormModal__item>

            <bem.FormModal__item>
              <Checkbox
                name='emailNotification'
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
              <WrappedSelect
                label={t('Security')}
                value={this.state.authLevel}
                options={this.state.authOptions}
                onChange={this.handleAuthTypeChange.bind(this)}
                id='rest-service-form--security'
                name='authLevel'
                isSearchable={false}
                isLimitedHeight
              />
            </bem.FormModal__item>

            {this.state.authLevel && this.state.authLevel.value === AUTH_OPTIONS.basic_auth.value && (
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
            )}

            {this.renderFieldsSelector()}

            {this.renderCustomHeaders()}

            {this.state.type === EXPORT_TYPES.json.value && (
              <bem.FormModal__item m='rest-custom-wrapper'>
                <TextBox
                  label={t('Add custom wrapper around JSON submission (%SUBMISSION% will be replaced by JSON)').replace(
                    '%SUBMISSION%',
                    submissionPlaceholder,
                  )}
                  type='text-multiline'
                  placeholder={t('Add Custom Wrapper')}
                  value={this.state.payloadTemplate}
                  errors={this.state.payloadTemplateErrors}
                  onChange={this.handleCustomWrapperChange.bind(this)}
                />
              </bem.FormModal__item>
            )}
          </bem.FormModal__item>

          <bem.Modal__footer>
            <Button
              type='primary'
              size='l'
              onClick={this.onSubmit.bind(this)}
              isDisabled={this.state.isSubmitPending}
              label={isEditingExistingHook ? t('Save') : t('Create')}
            />
          </bem.Modal__footer>
        </bem.FormModal__form>
      )
    }
  }
}
