import React, { useEffect, useRef, useState } from 'react'

import { when } from 'mobx'
import { useNavigate } from 'react-router-dom'
import { actions } from '#/actions'
import { cleanupTags, removeInvalidChars } from '#/assetUtils'
import bem from '#/bem'
import TagsInput from '#/components/common/TagsInput'
import Button from '#/components/common/button'
import LoadingSpinner from '#/components/common/loadingSpinner'
import TextBox from '#/components/common/textBox'
import WrappedSelect from '#/components/common/wrappedSelect'
import managedCollectionsStore from '#/components/library/managedCollectionsStore'
import ExtraProjectMetadataFields from '#/components/modalForms/ExtraProjectMetadataFields'
import { ASSET_TYPES, type AssetTypeName } from '#/constants'
import type { AssetResponse, AssetSettings, LabelValuePair } from '#/dataInterface'
import envStore from '#/envStore'
import pageState from '#/pageState.store'
import { getRouteAssetUid, isAnyLibraryRoute } from '#/router/routerUtils'
import sessionStore from '#/stores/session'
import { notify } from '#/utils'
import styles from './LibraryAssetForm.module.scss'
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

  const setField = <K extends keyof FormFields>(fieldName: K, newValue: FormFields[K]) => {
    setFields((prev) => {
      return { ...prev, [fieldName]: newValue }
    })
  }

  /**
   * `WrappedSelect` types its `onChange` argument as `unknown` (it wraps
   * react-select and stays generic). This helper localizes that one cast so
   * call sites stay typed against `FormFields`.
   */
  const setFieldFromSelect =
    <K extends keyof FormFields>(fieldName: K) =>
    (val: unknown) =>
      setField(fieldName, val as FormFields[K])

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

  const sectors: LabelValuePair[] = envStore.data.sector_choices
  const countries: LabelValuePair[] = envStore.data.country_choices
  const operationalPurposes: LabelValuePair[] = envStore.data.operational_purpose_choices

  return (
    <bem.FormModal__form className={`project-settings ${styles.form}`}>
      <bem.FormModal__item m='wrapper' disabled={isPending}>
        <bem.FormModal__item>
          <TextBox
            value={fields.name}
            onChange={(val) => setField('name', removeInvalidChars(val))}
            label={t('Name')}
            placeholder={t('Enter title of ##type## here').replace('##type##', formAssetType ?? '')}
          />
        </bem.FormModal__item>

        {metadataFields.description && (
          <bem.FormModal__item>
            <TextBox
              type='text-multiline'
              value={fields.description}
              onChange={(val) => setField('description', removeInvalidChars(val))}
              label={metadataFields.description.label || t('Description')}
              placeholder={t('Enter short description here')}
            />
          </bem.FormModal__item>
        )}

        <bem.FormModal__item>
          <TextBox
            value={fields.organization}
            onChange={(val) => setField('organization', val)}
            label={t('Organization')}
          />
        </bem.FormModal__item>

        {metadataFields.sector && (
          <bem.FormModal__item>
            <WrappedSelect
              label={metadataFields.sector.label || t('Primary Sector')}
              value={fields.sector}
              onChange={setFieldFromSelect('sector')}
              options={sectors}
              isLimitedHeight
              isClearable
            />
          </bem.FormModal__item>
        )}

        {metadataFields.country && (
          <bem.FormModal__item>
            <WrappedSelect
              label={metadataFields.country.label || t('Country')}
              isMulti
              value={fields.country}
              onChange={setFieldFromSelect('country')}
              options={countries}
              isLimitedHeight
              isClearable
            />
          </bem.FormModal__item>
        )}

        {metadataFields.operational_purpose && (
          <bem.FormModal__item>
            <WrappedSelect
              label={metadataFields.operational_purpose.label || t('Operational purpose of data')}
              value={fields.operational_purpose}
              onChange={setFieldFromSelect('operational_purpose')}
              options={operationalPurposes}
              isLimitedHeight
              isClearable
            />
          </bem.FormModal__item>
        )}

        {metadataFields.collects_pii && (
          <bem.FormModal__item>
            <WrappedSelect
              label={
                metadataFields.collects_pii.label || t('Does this project collect personally identifiable information?')
              }
              value={fields.collects_pii}
              onChange={setFieldFromSelect('collects_pii')}
              options={[
                { value: 'Yes', label: t('Yes') },
                { value: 'No', label: t('No') },
              ]}
              isClearable
            />
          </bem.FormModal__item>
        )}

        <ExtraProjectMetadataFields values={extraMetadataFields} onChange={onExtraFieldChange} />

        <bem.FormModal__item>
          <TagsInput
            value={fields.tags}
            onChange={(val) => setField('tags', Array.from(new Set(cleanupTags(val))))}
            label={t('Tags')}
          />
        </bem.FormModal__item>
      </bem.FormModal__item>

      <bem.Modal__footer>
        <ModalBackButton isDisabled={isPending} />

        <Button type='primary' size='l' onClick={onSubmit} isDisabled={isPending} label={getSubmitButtonLabel()} />
      </bem.Modal__footer>
    </bem.FormModal__form>
  )
}
