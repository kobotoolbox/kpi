import { Box, Checkbox, Group, PasswordInput, Radio, Stack } from '@mantine/core'
import { type FormEvent, useEffect, useState } from 'react'
import { actions } from '#/actions'
import { cleanupAndUniqueTags } from '#/assetUtils'
import ButtonNew from '#/components/common/ButtonNew'
import Select from '#/components/common/Select'
import TagsInput from '#/components/common/TagsInput'
import TextInput from '#/components/common/TextInput'
import Textarea from '#/components/common/Textarea'
import LoadingSpinner from '#/components/common/loadingSpinner'
import { type ExternalServiceHookResponse, type FailResponse, dataInterface } from '#/dataInterface'
import envStore from '#/envStore'
import { notify } from '#/utils'
import RESTServicesCustomHeaders, { type CustomHeader, getEmptyHeaderRow } from './RESTServicesCustomHeaders'

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

const TYPE_OPTIONS = [EXPORT_TYPES.json, EXPORT_TYPES.xml]

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

const AUTH_OPTIONS_LIST = [AUTH_OPTIONS.no_auth, AUTH_OPTIONS.basic_auth]

interface RESTServicesFormProps {
  assetUid: string
  hookUid?: string
  onRequestClose: () => void
}

function headersObjToArr(headersObj: { [key: string]: string }): CustomHeader[] {
  const headersArr: CustomHeader[] = []
  for (const header in headersObj) {
    if (Object.prototype.hasOwnProperty.call(headersObj, header)) {
      headersArr.push({ name: header, value: headersObj[header] })
    }
  }
  return headersArr
}

function headersArrToObj(headersArr: CustomHeader[]) {
  const headersObj: { [key: string]: string } = {}
  for (const header of headersArr) {
    if (header.name) {
      headersObj[header.name] = header.value
    }
  }
  return headersObj
}

export default function RESTServicesForm({ assetUid, hookUid, onRequestClose }: RESTServicesFormProps) {
  const isEditingExistingHook = Boolean(hookUid)

  const [isLoadingHook, setIsLoadingHook] = useState(isEditingExistingHook)
  const [isSubmitPending, setIsSubmitPending] = useState(false)
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState<string | undefined>(undefined)
  const [endpoint, setEndpoint] = useState('')
  const [endpointError, setEndpointError] = useState<string | undefined>(undefined)
  const [type, setType] = useState<HookExportTypeName>(EXPORT_TYPES.json.value)
  const [isActive, setIsActive] = useState(true)
  const [emailNotification, setEmailNotification] = useState(true)
  const [authLevel, setAuthLevel] = useState<HookAuthLevelName | null>(null)
  const [authUsername, setAuthUsername] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [subsetFields, setSubsetFields] = useState<string[]>([])
  const [customHeaders, setCustomHeaders] = useState<CustomHeader[]>([getEmptyHeaderRow()])
  const [payloadTemplate, setPayloadTemplate] = useState('')
  const [payloadTemplateErrors, setPayloadTemplateErrors] = useState<string | string[]>([])

  useEffect(() => {
    if (!hookUid) {
      return
    }

    dataInterface
      .getHook(assetUid, hookUid)
      .done((data: ExternalServiceHookResponse) => {
        const loadedHeaders = headersObjToArr(data.settings.custom_headers)
        setName(data.name)
        setEndpoint(data.endpoint)
        setIsActive(data.active)
        setEmailNotification(data.email_notification)
        setSubsetFields(data.subset_fields || [])
        setType(data.export_type)
        setAuthLevel(AUTH_OPTIONS[data.auth_level] ? data.auth_level : null)
        setCustomHeaders(loadedHeaders.length === 0 ? [getEmptyHeaderRow()] : loadedHeaders)
        setPayloadTemplate(data.payload_template)
        if (data.settings.username) {
          setAuthUsername(data.settings.username)
        }
        if (data.settings.password) {
          setAuthPassword(data.settings.password)
        }
        setIsLoadingHook(false)
      })
      .fail(() => {
        setIsSubmitPending(false)
        notify.error(t('Could not load REST Service'))
      })
  }, [assetUid, hookUid])

  const getDataForBackend = () => {
    const data: Partial<ExternalServiceHookResponse> = {
      name: name,
      endpoint: endpoint,
      active: isActive,
      subset_fields: subsetFields,
      email_notification: emailNotification,
      export_type: type,
      auth_level: authLevel || AUTH_OPTIONS.no_auth.value,
      settings: {
        custom_headers: headersArrToObj(customHeaders),
      },
      payload_template: payloadTemplate,
    }

    if (authUsername && data.settings !== undefined) {
      data.settings.username = authUsername
    }
    if (authPassword && data.settings !== undefined) {
      data.settings.password = authPassword
    }
    return data
  }

  const validateForm = () => {
    let isValid = true
    if (name.trim() === '') {
      setNameError(t('Name required'))
      isValid = false
    }
    if (endpoint.trim() === '') {
      setEndpointError(t('URL required'))
      isValid = false
    }
    return isValid
  }

  const onSubmit = (evt: FormEvent) => {
    evt.preventDefault()

    if (!validateForm()) {
      notify.error(t('Please enter both name and url of your service.'))
      return
    }

    const callbacks = {
      onComplete: () => {
        onRequestClose()
        actions.resources.loadAsset({ id: assetUid })
      },
      onFail: (data: FailResponse) => {
        let newPayloadTemplateErrors: string | string[] = []
        if (data.responseJSON?.payload_template?.length !== 0) {
          newPayloadTemplateErrors = data.responseJSON?.payload_template || []
        }
        setPayloadTemplateErrors(newPayloadTemplateErrors)
        setIsSubmitPending(false)
      },
    }

    setIsSubmitPending(true)
    if (hookUid) {
      actions.hooks.update(assetUid, hookUid, getDataForBackend(), callbacks)
    } else {
      actions.hooks.add(assetUid, getDataForBackend(), callbacks)
    }
  }

  if (isLoadingHook) {
    return <LoadingSpinner />
  }

  let submissionPlaceholder = '%SUBMISSION%'
  if (envStore.isReady && envStore.data.submission_placeholder) {
    submissionPlaceholder = envStore.data.submission_placeholder
  }

  const payloadTemplateError = Array.isArray(payloadTemplateErrors)
    ? payloadTemplateErrors.join(' ')
    : payloadTemplateErrors

  return (
    <Box component='form' onSubmit={onSubmit}>
      <Stack gap='md'>
        <TextInput
          label={t('Name')}
          placeholder={t('Service Name')}
          value={name}
          error={nameError}
          onChange={(evt) => {
            setName(evt.currentTarget.value)
            setNameError(undefined)
          }}
        />

        <TextInput
          label={t('Endpoint URL')}
          placeholder={t('https://')}
          value={endpoint}
          error={endpointError}
          onChange={(evt) => {
            setEndpoint(evt.currentTarget.value)
            setEndpointError(undefined)
          }}
        />

        <Checkbox checked={isActive} onChange={(evt) => setIsActive(evt.currentTarget.checked)} label={t('Enabled')} />

        <Checkbox
          checked={emailNotification}
          onChange={(evt) => setEmailNotification(evt.currentTarget.checked)}
          label={t('Receive emails notifications')}
        />

        <Radio.Group label={t('Type')} value={type} onChange={(newType) => setType(newType as HookExportTypeName)}>
          <Group gap='lg' mt='xxs'>
            {TYPE_OPTIONS.map((option) => (
              <Radio key={option.value} value={option.value} label={option.label} />
            ))}
          </Group>
        </Radio.Group>

        <Select
          label={t('Security')}
          data={AUTH_OPTIONS_LIST}
          value={authLevel}
          onChange={(newVal) => setAuthLevel((newVal as HookAuthLevelName) || null)}
          searchable={false}
        />

        {authLevel === HookAuthLevelName.basic_auth && (
          <Group grow align='flex-start'>
            <TextInput
              label={t('Username')}
              value={authUsername}
              onChange={(evt) => setAuthUsername(evt.currentTarget.value)}
            />

            <PasswordInput
              label={t('Password')}
              value={authPassword}
              onChange={(evt) => setAuthPassword(evt.currentTarget.value)}
            />
          </Group>
        )}

        <TagsInput
          value={subsetFields}
          onChange={(newValue) => setSubsetFields(cleanupAndUniqueTags(newValue))}
          placeholder={t('Add field(s)')}
          label={t('Select fields subset')}
        />

        <RESTServicesCustomHeaders headers={customHeaders} onChange={setCustomHeaders} />

        {type === EXPORT_TYPES.json.value && (
          <Textarea
            autosize
            minRows={2}
            label={t('Add custom wrapper around JSON submission (%SUBMISSION% will be replaced by JSON)').replace(
              '%SUBMISSION%',
              submissionPlaceholder,
            )}
            placeholder={t('Add Custom Wrapper')}
            value={payloadTemplate}
            error={payloadTemplateError || undefined}
            onChange={(evt) => {
              setPayloadTemplate(evt.currentTarget.value)
              setPayloadTemplateErrors([])
            }}
          />
        )}
      </Stack>

      <Group justify='flex-end' mt='lg'>
        <ButtonNew type='submit' size='lg' loading={isSubmitPending}>
          {isEditingExistingHook ? t('Save') : t('Create')}
        </ButtonNew>
      </Group>
    </Box>
  )
}
