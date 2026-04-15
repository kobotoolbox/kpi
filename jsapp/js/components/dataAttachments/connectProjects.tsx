import './connect-projects.scss'

import React, { useCallback, useEffect, useMemo, useState } from 'react'

import alertify from 'alertifyjs'
import { actions } from '#/actions'
import bem from '#/bem'
import type { MultiCheckboxItem } from '#/components/common/multiCheckbox'
import dataAttachmentsUtils, { type ColumnFilter } from '#/components/dataAttachments/dataAttachmentsUtils'
import { MAX_DISPLAYED_STRING_LENGTH, MODAL_TYPES } from '#/constants'
import type { AssetResponse, AssetsResponse, FailResponse } from '#/dataInterface'
import envStore from '#/envStore'
import pageState from '#/pageState.store'
import { escapeHtml, generateAutoname, recordEntries } from '#/utils'
import type { AttachedSourceItem } from './connectProjects.types'
import ConnectProjectsExports from './connectProjectsExports'
import ConnectProjectsImports from './connectProjectsImports'
import ConnectProjectsSelect from './connectProjectsSelect'

const DYNAMIC_DATA_ATTACHMENTS_SUPPORT_URL = 'dynamic_data_attachment.html'

function ConnectProjects({ asset }: { asset: AssetResponse }) {
  const [isInitialised, setIsInitialised] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isShared, setIsShared] = useState(asset.data_sharing?.enabled || false)
  const [isSharingAnyQuestions, setIsSharingAnyQuestions] = useState(
    Boolean(asset.data_sharing?.fields?.length) || false,
  )
  const [attachedSources, setAttachedSources] = useState<AttachedSourceItem[]>([])
  const [sharingEnabledAssets, setSharingEnabledAssets] = useState<AssetsResponse | null>(null)
  const [newSource, setNewSource] = useState<AssetResponse | null>(null)
  const [newFilename, setNewFilename] = useState('')
  const [columnsToDisplay, setColumnsToDisplay] = useState<ColumnFilter[]>(() => {
    if (asset.data_sharing?.enabled) {
      return dataAttachmentsUtils.generateColumnFilters(asset.data_sharing.fields || [], asset.content?.survey || [])
    }
    return []
  })
  const [fieldsErrors, setFieldsErrors] = useState<Record<string, string>>({})

  const onAttachToSourceFailed = (response: FailResponse) => {
    const newFieldsErrors: Record<string, string> = {}

    if (!response?.responseJSON || Object.keys(response?.responseJSON).length === 0) {
      newFieldsErrors.filename = t('Please check file name')
    } else {
      for (const [key, value] of recordEntries(response?.responseJSON)) {
        if (typeof key === 'string' && value !== undefined) {
          newFieldsErrors[key] = String(value)
        }
      }
    }

    setIsLoading(false)
    setFieldsErrors(newFieldsErrors)
  }

  const onGetAttachedSourcesCompleted = (response: AttachedSourceItem[]) => {
    setIsInitialised(true)
    setIsLoading(false)
    setAttachedSources(response)
  }

  const onGetSharingEnabledAssetsCompleted = (response: AssetsResponse) => {
    setSharingEnabledAssets(response)
  }

  const onToggleDataSharingCompleted = useCallback(
    (response: AssetResponse) => {
      setIsShared(response.data_sharing.enabled || false)
      setIsSharingAnyQuestions(false)
      setColumnsToDisplay(dataAttachmentsUtils.generateColumnFilters([], asset.content?.survey))
    },
    [asset.content?.survey],
  )

  const onUpdateColumnFiltersCompleted = useCallback(
    (response: AssetResponse) => {
      setIsLoading(false)
      setColumnsToDisplay(
        dataAttachmentsUtils.generateColumnFilters(response.data_sharing.fields || [], asset.content?.survey),
      )
    },
    [asset.content?.survey],
  )

  const onPatchSourceCompleted = useCallback(() => {
    actions.dataShare.getAttachedSources(asset.uid)
  }, [asset.uid])

  const refreshAttachmentList = useCallback(() => {
    setNewSource(null)
    setNewFilename('')
    setFieldsErrors({})
    actions.dataShare.getAttachedSources(asset.uid)
  }, [asset.uid])

  useEffect(() => {
    const unlisteners = [
      actions.dataShare.attachToSource.started.listen(() => setIsLoading(true)),
      actions.dataShare.attachToSource.completed.listen(refreshAttachmentList),
      actions.dataShare.attachToSource.failed.listen(onAttachToSourceFailed),
      actions.dataShare.detachSource.completed.listen(refreshAttachmentList),
      actions.dataShare.patchSource.started.listen(() => setIsLoading(true)),
      actions.dataShare.patchSource.completed.listen(onPatchSourceCompleted),
      actions.dataShare.getSharingEnabledAssets.completed.listen(onGetSharingEnabledAssetsCompleted),
      actions.dataShare.getAttachedSources.completed.listen(onGetAttachedSourcesCompleted),
      actions.dataShare.toggleDataSharing.completed.listen(onToggleDataSharingCompleted),
      actions.dataShare.updateColumnFilters.completed.listen(onUpdateColumnFiltersCompleted),
      actions.dataShare.updateColumnFilters.failed.listen(() => setIsLoading(false)),
      actions.dataShare.detachSource.failed.listen(() => setIsLoading(false)),
      actions.dataShare.patchSource.completed.listen(() => setIsLoading(false)),
      actions.dataShare.patchSource.failed.listen(() => setIsLoading(false)),
    ]

    refreshAttachmentList()
    actions.dataShare.getSharingEnabledAssets()

    return () => {
      unlisteners.forEach((clb) => clb())
    }
  }, [
    refreshAttachmentList,
    onAttachToSourceFailed,
    onPatchSourceCompleted,
    onGetSharingEnabledAssetsCompleted,
    onGetAttachedSourcesCompleted,
    onToggleDataSharingCompleted,
    onUpdateColumnFiltersCompleted,
  ])

  const onFilenameChange = (newVal: string) => {
    setNewFilename(newVal)
    setFieldsErrors({})
  }

  const onSourceChange = (newVal: AssetResponse | null) => {
    if (newVal) {
      setNewSource(newVal)
      setNewFilename(generateAutoname(newVal.name, 0, MAX_DISPLAYED_STRING_LENGTH.connect_projects))
      setFieldsErrors({})
    } else {
      setNewSource(null)
    }
  }

  const showColumnFilterModal = useCallback(
    (
      source: Pick<AssetResponse, 'uid' | 'name' | 'url'>,
      filename: string,
      fields: string[],
      attachmentUrl?: string,
    ) => {
      pageState.showModal({
        type: MODAL_TYPES.DATA_ATTACHMENT_COLUMNS,
        asset,
        source,
        filename,
        fields,
        attachmentUrl,
      })
    },
    [asset],
  )

  const onConfirmAttachment = useCallback(
    (evt: React.MouseEvent<HTMLButtonElement>) => {
      evt.preventDefault()

      if (newFilename !== '' && newSource?.url) {
        setFieldsErrors({})
        showColumnFilterModal(newSource, newFilename, [])
        return
      }

      setFieldsErrors((state) => {
        const nextState = { ...state }
        if (!newSource?.url) {
          nextState.source = t('No project selected')
        }
        if (newFilename === '') {
          nextState.filename = t('Field is empty')
        }
        return nextState
      })
    },
    [newFilename, newSource, showColumnFilterModal],
  )

  const onRemoveAttachment = (attachmentUrl: string) => {
    setIsLoading(true)
    actions.dataShare.detachSource(attachmentUrl)
  }

  const onToggleSharingData = useCallback(() => {
    const data = {
      data_sharing: {
        enabled: !isShared,
        fields: [],
      },
    }

    if (isShared) {
      actions.dataShare.toggleDataSharing(asset.uid, data)
      return
    }

    const dialog = alertify.dialog('confirm')
    const opts = {
      title: `${t('Privacy Notice')}`,
      message: t(
        'This will attach the full dataset from "##ASSET_NAME##" as a background XML file to this form. While not easily visible, it is technically possible for anyone entering data to your form to retrieve and view this dataset. Do not use this feature if "##ASSET_NAME##" includes sensitive data.',
      ).replaceAll('##ASSET_NAME##', escapeHtml(asset.name)),
      labels: { ok: t('Acknowledge and continue'), cancel: t('Cancel') },
      onok: () => {
        actions.dataShare.toggleDataSharing(asset.uid, data)
        dialog.destroy()
      },
      oncancel: dialog.destroy,
    }

    dialog.set(opts).show()
  }, [asset.name, asset.uid, isShared])

  const onColumnSelected = useCallback(
    (columnList: MultiCheckboxItem[]) => {
      setIsLoading(true)
      const fields: string[] = []

      columnList.forEach((item) => {
        if (item.checked) {
          fields.push(item.label)
        }
      })

      const data = {
        data_sharing: {
          enabled: isShared,
          fields,
        },
      }

      actions.dataShare.updateColumnFilters(asset.uid, data)
    },
    [asset.uid, isShared],
  )

  const onSharingCheckboxChange = useCallback(
    (checked: boolean) => {
      if (!checked) {
        setColumnsToDisplay([])
        const data = {
          data_sharing: {
            enabled: isShared,
            fields: [],
          },
        }
        actions.dataShare.updateColumnFilters(asset.uid, data)
      }

      setIsSharingAnyQuestions(checked)
    },
    [asset.uid, isShared],
  )

  const filteredAssets = useMemo(() => {
    const attachedSourceUids = attachedSources.map((item) => item.sourceUid)
    return sharingEnabledAssets?.results.filter((item) => !attachedSourceUids.includes(item.uid)) || []
  }, [attachedSources, sharingEnabledAssets])

  return (
    <bem.FormView__row>
      <bem.FormView__cell m={['page-title']}>
        <i className='k-icon k-icon-folder-out' />
        <h2>{t('Share data with other project forms')}</h2>
      </bem.FormView__cell>

      <bem.FormView__cell m={['box', 'padding']}>
        <bem.FormView__form>
          <span>
            {t(
              'Enable data sharing to allow other forms to import and use dynamic data from this project. Learn more about dynamic data attachments',
            )}
            &nbsp;
            <a
              href={envStore.data.support_url + DYNAMIC_DATA_ATTACHMENTS_SUPPORT_URL}
              target='_blank'
              rel='noopener noreferrer'
            >
              {t('here')}
            </a>
          </span>

          <ConnectProjectsExports
            isShared={isShared}
            isSharingAnyQuestions={isSharingAnyQuestions}
            isLoading={isLoading}
            columnsToDisplay={columnsToDisplay}
            onToggleSharingData={onToggleSharingData}
            onSharingCheckboxChange={onSharingCheckboxChange}
            onColumnSelected={onColumnSelected}
          />
        </bem.FormView__form>
      </bem.FormView__cell>

      <bem.FormView__cell m={['page-title']}>
        <i className='k-icon k-icon-folder-in' />
        <h2>{t('Import other project data')}</h2>
      </bem.FormView__cell>

      <bem.FormView__cell m={['box', 'padding']}>
        <bem.FormView__form>
          <span>
            {t(
              'Connect with other project(s) to import dynamic data from them into this project. Learn more about dynamic data attachments',
            )}
            &nbsp;
            <a href={envStore.data.support_url + DYNAMIC_DATA_ATTACHMENTS_SUPPORT_URL} target='_blank'>
              {t('here')}
            </a>
          </span>
          <ConnectProjectsImports
            selectComponent={
              <ConnectProjectsSelect
                sharingEnabledAssets={sharingEnabledAssets}
                filteredAssets={filteredAssets}
                value={newSource}
                isLoading={isLoading}
                isInitialised={isInitialised}
                sourceError={fieldsErrors.source}
                onSourceChange={onSourceChange}
              />
            }
            newFilename={newFilename}
            fieldsErrors={fieldsErrors}
            onFilenameChange={onFilenameChange}
            onConfirmAttachment={onConfirmAttachment}
            isInitialised={isInitialised}
            isLoading={isLoading}
            attachedSources={attachedSources}
            showColumnFilterModal={showColumnFilterModal}
            onRemoveAttachment={onRemoveAttachment}
          />
        </bem.FormView__form>
      </bem.FormView__cell>
    </bem.FormView__row>
  )
}

export default ConnectProjects
