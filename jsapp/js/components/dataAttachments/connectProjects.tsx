import './connect-projects.scss'

import { type MouseEvent, useCallback, useEffect, useMemo, useState } from 'react'

import alertify from 'alertifyjs'
import { useAssetsList, useAssetsPartialUpdate } from '#/api/react-query/manage-projects-and-library-content'
import { useAssetsPairedDataDestroy, useAssetsPairedDataList } from '#/api/react-query/survey-data'
import bem from '#/bem'
import type { MultiCheckboxItem } from '#/components/common/multiCheckbox'
import dataAttachmentsUtils, { type ColumnFilter } from '#/components/dataAttachments/dataAttachmentsUtils'
import { MAX_DISPLAYED_STRING_LENGTH, MODAL_TYPES } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import envStore from '#/envStore'
import pageState from '#/pageState.store'
import { escapeHtml, generateAutoname, getAssetUIDFromUrl, truncateFile, truncateString } from '#/utils'
import type { AttachedSourceItem, ConnectableAsset } from './common'
import ConnectProjectsExports from './connectProjectsExports'
import ConnectProjectsImports from './connectProjectsImports'
import ConnectProjectsSelect from './connectProjectsSelect'

const DYNAMIC_DATA_ATTACHMENTS_SUPPORT_URL = 'dynamic_data_attachment.html'

const SHARING_ENABLED_PROJECTS_QUERY = 'data_sharing__enabled:true'

function ConnectProjects({ asset }: { asset: AssetResponse }) {
  const [isShared, setIsShared] = useState(asset.data_sharing?.enabled || false)
  const [isSharingAnyQuestions, setIsSharingAnyQuestions] = useState(
    Boolean(asset.data_sharing?.fields?.length) || false,
  )
  const [newSource, setNewSource] = useState<ConnectableAsset | null>(null)
  const [newFilename, setNewFilename] = useState('')
  const [columnsToDisplay, setColumnsToDisplay] = useState<ColumnFilter[]>(() => {
    if (asset.data_sharing?.enabled) {
      return dataAttachmentsUtils.generateColumnFilters(asset.data_sharing.fields || [], asset.content?.survey || [])
    }
    return []
  })
  const [fieldsErrors, setFieldsErrors] = useState<Record<string, string>>({})

  // Make sure the local state is refreshed after asset is changed
  useEffect(() => {
    const nextIsShared = asset.data_sharing?.enabled || false
    const nextSharedFields = asset.data_sharing?.fields || []

    setIsShared(nextIsShared)
    setIsSharingAnyQuestions(Boolean(nextSharedFields.length))
    setColumnsToDisplay(
      nextIsShared ? dataAttachmentsUtils.generateColumnFilters(nextSharedFields, asset.content?.survey || []) : [],
    )
    setNewSource(null)
    setNewFilename('')
    setFieldsErrors({})
  }, [asset.uid, asset.data_sharing?.enabled, asset.data_sharing?.fields, asset.content?.survey])

  const {
    data: attachedSourcesResponse,
    isFetched: isInitialised,
    isFetching: isFetchingAttachedSources,
    refetch: refetchAttachedSources,
  } = useAssetsPairedDataList(asset.uid)
  const { mutate: detachSourceMutate, isPending: isDetachingSource } = useAssetsPairedDataDestroy()
  const { data: sharingEnabledAssetsResponse } = useAssetsList({ q: SHARING_ENABLED_PROJECTS_QUERY })
  const { mutate: patchDataSharingMutate, isPending: isPatchingDataSharing } = useAssetsPartialUpdate()

  const isLoading = isFetchingAttachedSources || isDetachingSource || isPatchingDataSharing

  const sharingEnabledAssetsLoaded = Boolean(sharingEnabledAssetsResponse?.data)

  const sharingEnabledAssets = useMemo<ConnectableAsset[]>(() => {
    return (
      sharingEnabledAssetsResponse?.data.results.map((item) => ({
        uid: item.uid,
        url: item.url,
        name: item.name || '',
      })) || []
    )
  }, [sharingEnabledAssetsResponse])

  const attachedSources = useMemo<AttachedSourceItem[]>(() => {
    const payload = attachedSourcesResponse?.data
    const sources = payload && 'results' in payload ? payload.results : []

    return sources.map((source) => ({
      sourceName: truncateString(source.source__name, MAX_DISPLAYED_STRING_LENGTH.connect_projects),
      sourceUrl: source.source,
      sourceUid: getAssetUIDFromUrl(source.source) || '',
      linkedFields: source.fields,
      filename: truncateFile(source.filename, MAX_DISPLAYED_STRING_LENGTH.connect_projects),
      attachmentUrl: source.url,
    }))
  }, [attachedSourcesResponse])

  // Note: we wrap most of the functions in `useCallback`, because they are being referenced in
  // useEffect dependency array. Without it we end up in endless loop of calls

  const refreshAttachmentList = useCallback(() => {
    setNewSource(null)
    setNewFilename('')
    setFieldsErrors({})
    void refetchAttachedSources()
  }, [refetchAttachedSources])

  const onFilenameChange = useCallback((newVal: string) => {
    setNewFilename(newVal)
    setFieldsErrors({})
  }, [])

  const onSourceChange = useCallback((newVal: ConnectableAsset | null) => {
    if (newVal) {
      setNewSource(newVal)
      setNewFilename(generateAutoname(newVal.name, 0, MAX_DISPLAYED_STRING_LENGTH.connect_projects))
      setFieldsErrors({})
    } else {
      setNewSource(null)
    }
  }, [])

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
        onAttachmentChanged: refreshAttachmentList,
      })
    },
    [asset, refreshAttachmentList],
  )

  const onConfirmAttachment = useCallback(
    (evt: MouseEvent<HTMLButtonElement>) => {
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

  const onRemoveAttachment = useCallback(
    (attachmentUrl: string) => {
      const attachmentUid = getAssetUIDFromUrl(attachmentUrl)
      if (!attachmentUid) {
        return
      }

      detachSourceMutate(
        {
          uidAsset: asset.uid,
          uidPairedData: attachmentUid,
        },
        {
          onSuccess: refreshAttachmentList,
        },
      )
    },
    [asset.uid, detachSourceMutate, refreshAttachmentList],
  )

  const patchDataSharing = useCallback(
    (data: { enabled: boolean; fields: string[] }, onSuccess?: () => void) => {
      patchDataSharingMutate(
        {
          uidAsset: asset.uid,
          // TODO: Backend stores shared questions under `data_sharing`, but Orval doesn't model this, see:
          // https://linear.app/kobotoolbox/issue/DEV-2003
          data: { data_sharing: { enabled: data.enabled, fields: data.fields } } as any,
        },
        {
          onSuccess: (response) => {
            // Derive state from the canonical server value rather than the optimistic `data` object
            const serverSharing =
              response.status === 200
                ? ((response.data as any).data_sharing as { enabled?: boolean; fields?: string[] } | undefined)
                : undefined
            const nextEnabled = serverSharing?.enabled ?? data.enabled
            const nextFields = serverSharing?.fields ?? data.fields
            setIsShared(nextEnabled)
            setIsSharingAnyQuestions(Boolean(nextFields.length))
            setColumnsToDisplay(
              nextEnabled ? dataAttachmentsUtils.generateColumnFilters(nextFields, asset.content?.survey ?? []) : [],
            )
            onSuccess?.()
          },
        },
      )
    },
    [asset.uid, asset.content?.survey, patchDataSharingMutate],
  )

  const onToggleSharingData = useCallback(() => {
    const data = {
      enabled: !isShared,
      fields: [],
    }

    if (isShared) {
      patchDataSharing(data)
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
        patchDataSharing(data)
        dialog.destroy()
      },
      oncancel: dialog.destroy,
    }

    dialog.set(opts).show()
  }, [asset.name, isShared, patchDataSharing])

  const onColumnSelected = useCallback(
    (columnList: MultiCheckboxItem[]) => {
      const fields: string[] = []

      columnList.forEach((item) => {
        if (item.checked) {
          fields.push(item.label)
        }
      })

      const data = {
        enabled: isShared,
        fields,
      }

      patchDataSharing(data)
    },
    [isShared, patchDataSharing],
  )

  const onSharingCheckboxChange = useCallback(
    (checked: boolean) => {
      if (!checked) {
        patchDataSharing({
          enabled: isShared,
          fields: [],
        })
      }
      setColumnsToDisplay(dataAttachmentsUtils.generateColumnFilters([], asset.content?.survey || []))
      setIsSharingAnyQuestions(checked)
    },
    [asset.content?.survey, isShared, patchDataSharing],
  )

  const filteredAssets = useMemo(() => {
    const attachedSourceUids = attachedSources.map((item) => item.sourceUid)
    return sharingEnabledAssets.filter((item) => !attachedSourceUids.includes(item.uid))
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
                sharingEnabledAssetsLoaded={sharingEnabledAssetsLoaded}
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
