import { Stack } from '@mantine/core'
import { when } from 'mobx'
import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { actions } from '#/actions'
import { cleanupAndUniqueTags, removeInvalidChars } from '#/assetUtils'
import bem from '#/bem'
import MultiSelect from '#/components/common/MultiSelect'
import Select from '#/components/common/Select'
import TagsInput from '#/components/common/TagsInput'
import TextInput from '#/components/common/TextInput'
import Textarea from '#/components/common/Textarea'
import Button from '#/components/common/button'
import LoadingSpinner from '#/components/common/loadingSpinner'
import managedCollectionsStore from '#/components/library/managedCollectionsStore'
import ExtraProjectMetadataFields from '#/components/modalForms/ExtraProjectMetadataFields'
import { ASSET_TYPES, type AssetTypeName } from '#/constants'
import type { AssetResponse, AssetSettings, LabelValuePair } from '#/dataInterface'
import envStore from '#/envStore'
import pageState from '#/pageState.store'
import { getRouteAssetUid, isAnyLibraryRoute } from '#/router/routerUtils'
import sessionStore from '#/stores/session'
import { notify } from '#/utils'
import ModalBackButton from './ModalBackButton'

interface LibraryAssetFormProps {
  asset?: AssetResponse
  assetType?: AssetTypeName
  onSetModalTitle?: (title: string) => void
}

type ExtraMetadataValues = Record<string, string | string[] | null>

interface FormFields {
  name: string
  organization: string
  tags: string[]
  description: string
  sector: AssetSettings['sector']
  country: AssetSettings['country']
  operational_purpose: AssetSettings['operational_purpose']
  collects_pii: AssetSettings['collects_pii']
}

/**
 * Modal for creating or updating library asset (collection or template).
 *
 * The displayed metadata fields (description, sector, country, operational
 * purpose, collects PII, plus any extra superuser-configured metadata) are
 * driven entirely by what the environment exposes, mirroring how
 * `ProjectSettings` handles them.
 *
 * NOTE: We have multiple components with similar forms:
 * - ProjectSettings
 * - AccountSettingsRoute
 * - LibraryAssetForm
 */
export const LibraryAssetForm = ({ asset, assetType, onSetModalTitle: _onSetModalTitle }: LibraryAssetFormProps) => {
  const navigate = useNavigate()

  const formAssetType: AssetTypeName | undefined = asset ? asset.asset_type : assetType

  const [isSessionLoaded, setIsSessionLoaded] = useState(!!sessionStore.isLoggedIn)
  const [isPending, setIsPending] = useState(false)

  const [fields, setFields] = useState<FormFields>(() => {
    return {
      name: asset?.name ?? '',
      organization: asset?.settings?.organization ?? '',
      tags: asset?.tag_string ? asset.tag_string.split(',') : [],
      description: asset?.settings?.description ?? '',
      sector: asset?.settings?.sector ?? null,
      country: asset?.settings?.country ?? null,
      operational_purpose: asset?.settings?.operational_purpose ?? null,
      collects_pii: asset?.settings?.collects_pii ?? null,
    }
  })

  const [extraMetadataFields, setExtraMetadataFields] = useState<ExtraMetadataValues>(() => {
    const initial: ExtraMetadataValues = {}
    for (const field of envStore.data.extra_project_metadata_fields) {
      initial[field.name] = asset?.settings?.extra_metadata?.[field.name] ?? null
    }
    return initial
  })

  // Latest values for use inside long-lived reflux callbacks below.
  const formAssetTypeRef = useRef(formAssetType)
  formAssetTypeRef.current = formAssetType

  useEffect(() => {
    const disposeSessionWhen = when(
      () => sessionStore.isInitialLoadComplete,
      () => setIsSessionLoaded(true),
    )

    const onCreateCompleted = (response: AssetResponse) => {
      setIsPending(false)
      notify(
        t('##type## ##name## created')
          .replace('##type##', formAssetTypeRef.current ?? 'asset')
          .replace('##name##', response.name),
      )
      pageState.hideModal()
      if (formAssetTypeRef.current === ASSET_TYPES.collection.id) {
        navigate(`/library/asset/${response.uid}`)
      } else if (formAssetTypeRef.current === ASSET_TYPES.template.id) {
        navigate(`/library/asset/${response.uid}/edit`)
      }
    }

    const onCreateFailed = () => {
      setIsPending(false)
      notify(t('Failed to create ##type##').replace('##type##', formAssetTypeRef.current ?? 'asset'), 'error')
    }

    const onUpdateCompleted = () => {
      setIsPending(false)
      pageState.hideModal()
    }

    const onUpdateFailed = () => {
      setIsPending(false)
      notify(t('Failed to update ##type##').replace('##type##', formAssetTypeRef.current ?? 'asset'), 'error')
    }

    const unlisteners = [
      actions.resources.createResource.completed.listen(onCreateCompleted),
      actions.resources.createResource.failed.listen(onCreateFailed),
      actions.resources.updateAsset.completed.listen(onUpdateCompleted),
      actions.resources.updateAsset.failed.listen(onUpdateFailed),
    ]

    return () => {
      // Cancel the pending MobX reaction in case we unmount before the
      // session finishes loading — otherwise it would try to setState on
      // an unmounted component.
      disposeSessionWhen()
      unlisteners.forEach((clb) => clb())
    }
  }, [navigate])

  // Configured metadata field definitions (`undefined` when disabled).
  const metadataFields = envStore.data.getProjectMetadataFieldsAsSimpleDict()
  const sectors: LabelValuePair[] = envStore.data.sector_choices
  const countries: LabelValuePair[] = envStore.data.country_choices
  const operationalPurposes: LabelValuePair[] = envStore.data.operational_purpose_choices

  const setField = <K extends keyof FormFields>(fieldName: K, newValue: FormFields[K]) => {
    setFields((prev) => {
      return { ...prev, [fieldName]: newValue }
    })
  }

  const toSingleSelectValue = (
    value: AssetSettings['sector'] | AssetSettings['operational_purpose'] | AssetSettings['collects_pii'],
  ): string | null =>
    value && typeof value === 'object' && 'value' in value && typeof value.value === 'string' ? value.value : null

  const toMultiSelectValue = (value: AssetSettings['country']): string[] => {
    if (!value) {
      return []
    }

    // Backend always returns country as an array
    return value.map((item) => item.value)
  }

  const fromSingleSelectValue = (newValue: string | null, option?: LabelValuePair): LabelValuePair | null => {
    if (!newValue) {
      return null
    }

    return {
      value: newValue,
      label: option?.label || newValue,
    }
  }

  const onCountryChange = (values: string[]) => {
    const nextCountries = values
      .map((value) => countries.find((country) => country.value === value))
      .filter((country): country is LabelValuePair => Boolean(country))

    setField('country', nextCountries.length ? nextCountries : null)
  }

  const onExtraFieldChange = (fieldName: string, newValue: string | string[] | null) => {
    setExtraMetadataFields((prev) => {
      return { ...prev, [fieldName]: newValue }
    })
  }

  const onSubmit = (evt: React.FormEvent | React.MouseEvent) => {
    evt.preventDefault()
    setIsPending(true)

    const settings = JSON.stringify({
      organization: fields.organization,
      description: fields.description,
      sector: fields.sector,
      country: fields.country,
      operational_purpose: fields.operational_purpose,
      collects_pii: fields.collects_pii,
      extra_metadata: extraMetadataFields,
    })

    if (asset) {
      actions.resources.updateAsset(asset.uid, {
        name: fields.name,
        settings,
        tag_string: fields.tags.join(','),
      })
      return
    }

    const params: {
      name: string
      asset_type: AssetTypeName | undefined
      settings: string
      tag_string: string
      parent?: string
    } = {
      name: fields.name,
      asset_type: formAssetType,
      settings,
      tag_string: fields.tags.join(','),
    }

    const currentAssetUid = getRouteAssetUid()
    if (currentAssetUid && isAnyLibraryRoute() && params.asset_type !== ASSET_TYPES.collection.id) {
      const found = managedCollectionsStore.find(currentAssetUid)
      if (found && found.asset_type === ASSET_TYPES.collection.id) {
        // When creating from within a collection page, make the new asset
        // a child of this collection.
        params.parent = found.url
      }
    }

    actions.resources.createResource(params)
  }

  const getSubmitButtonLabel = () => {
    if (asset) {
      return isPending ? t('Saving…') : t('Save')
    }
    return isPending ? t('Creating…') : t('Create')
  }

  if (!isSessionLoaded || !envStore.isReady) {
    return <LoadingSpinner />
  }

  return (
    <bem.FormModal__form className='project-settings'>
      <bem.FormModal__item m='wrapper' disabled={isPending}>
        <Stack gap={15}>
          <TextInput
            value={fields.name}
            onChange={(evt) => setField('name', removeInvalidChars(evt.currentTarget.value))}
            label={t('Name')}
            placeholder={t('Enter title of ##type## here').replace('##type##', formAssetType ?? '')}
          />

          {metadataFields.description && (
            <Textarea
              autosize
              minRows={1}
              value={fields.description}
              onChange={(evt) => setField('description', removeInvalidChars(evt.currentTarget.value))}
              label={metadataFields.description.label || t('Description')}
              placeholder={t('Enter short description here')}
            />
          )}

          <TextInput
            value={fields.organization}
            onChange={(evt) => setField('organization', evt.currentTarget.value)}
            label={t('Organization')}
          />

          {metadataFields.sector && (
            <Select
              label={metadataFields.sector.label || t('Primary Sector')}
              value={toSingleSelectValue(fields.sector)}
              onChange={(newValue, option) => setField('sector', fromSingleSelectValue(newValue, option))}
              data={sectors}
              clearable
              maxDropdownHeight={220}
            />
          )}

          {metadataFields.country && (
            <MultiSelect
              label={metadataFields.country.label || t('Country')}
              value={toMultiSelectValue(fields.country)}
              onChange={onCountryChange}
              data={countries}
              clearable
              maxDropdownHeight={220}
            />
          )}

          {metadataFields.operational_purpose && (
            <Select
              label={metadataFields.operational_purpose.label || t('Operational purpose of data')}
              value={toSingleSelectValue(fields.operational_purpose)}
              onChange={(newValue, option) => setField('operational_purpose', fromSingleSelectValue(newValue, option))}
              data={operationalPurposes}
              clearable
              maxDropdownHeight={220}
            />
          )}

          {metadataFields.collects_pii && (
            <Select
              label={
                metadataFields.collects_pii.label || t('Does this project collect personally identifiable information?')
              }
              value={toSingleSelectValue(fields.collects_pii)}
              onChange={(newValue, option) => setField('collects_pii', fromSingleSelectValue(newValue, option))}
              data={[
                { value: 'Yes', label: t('Yes') },
                { value: 'No', label: t('No') },
              ]}
              clearable
            />
          )}

          <ExtraProjectMetadataFields values={extraMetadataFields} onChange={onExtraFieldChange} />

          <TagsInput
            value={fields.tags}
            onChange={(val) => setField('tags', cleanupAndUniqueTags(val))}
            label={t('Tags')}
          />
        </Stack>
      </bem.FormModal__item>

      <bem.Modal__footer>
        <ModalBackButton isDisabled={isPending} />

        <Button type='primary' size='l' onClick={onSubmit} isDisabled={isPending} label={getSubmitButtonLabel()} />
      </bem.Modal__footer>
    </bem.FormModal__form>
  )
}
