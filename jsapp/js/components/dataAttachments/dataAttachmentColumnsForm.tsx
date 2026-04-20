import { type MouseEvent, useCallback, useEffect, useState } from 'react'
import { useAssetsRetrieve } from '#/api/react-query/manage-projects-and-library-content'
import { useAssetsPairedDataCreate, useAssetsPairedDataPartialUpdate } from '#/api/react-query/survey-data'
import bem from '#/bem'
import Button from '#/components/common/button'
import LoadingSpinner from '#/components/common/loadingSpinner'
import MultiCheckbox from '#/components/common/multiCheckbox'
import dataAttachmentsUtils, { type ColumnFilter } from '#/components/dataAttachments/dataAttachmentsUtils'
import type { AssetResponse } from '#/dataInterface'
import { getAssetUIDFromUrl, notify } from '#/utils'

interface DataAttachmentColumnsFormProps {
  onSetModalTitle: (newTitle: string) => void
  onModalClose: () => void
  onAttachmentChanged?: () => void
  asset: AssetResponse
  source: Pick<AssetResponse, 'uid' | 'name' | 'url'>
  filename: string
  fields: string[]
  attachmentUrl?: string
}

/**
 * The content of the DATA_ATTACHMENT_COLUMNS modal
 *
 * @prop {function} onSetModalTitle - for changing the modal title by this component
 * @prop {function} onModalClose - causes the modal to close
 * @prop {object} asset - current asset
 * @prop {sourceAttributes} source
 * @prop {string} filename
 * @prop {string[]} fields - selected fields to retrieve from source
 * @prop {string} attachmentUrl - if exists, we are patching an existing attachment
                                  otherwise, this is a new import
 */
function DataAttachmentColumnsForm({
  onSetModalTitle,
  onModalClose,
  onAttachmentChanged,
  asset,
  source,
  filename,
  fields,
  attachmentUrl,
}: DataAttachmentColumnsFormProps) {
  const [columnsToDisplay, setColumnsToDisplay] = useState<ColumnFilter[]>([])

  const {
    data: sourceAssetResponse,
    isFetched: isInitialised,
    isFetching: isFetchingSourceAsset,
  } = useAssetsRetrieve(source.uid)
  const { mutate: createPairedDataMutate, isPending: isCreatingAttachment } = useAssetsPairedDataCreate()
  const { mutate: patchPairedDataMutate, isPending: isPatchingAttachment } = useAssetsPairedDataPartialUpdate()

  const isLoading = isCreatingAttachment || isPatchingAttachment

  useEffect(() => {
    onSetModalTitle(t('Import data from ##SOURCE_NAME##').replace('##SOURCE_NAME##', source.name))
  }, [onSetModalTitle, source.name])

  useEffect(() => {
    const payload = sourceAssetResponse?.data
    if (!payload || !('uid' in payload)) {
      return
    }

    if (Array.isArray(payload.data_sharing?.fields) && payload.data_sharing.fields.length > 0) {
      setColumnsToDisplay(dataAttachmentsUtils.generateColumnFilters(fields, payload.data_sharing.fields))
      return
    }

    // Empty `fields` implies all source questions are exposed.
    setColumnsToDisplay(dataAttachmentsUtils.generateColumnFilters(fields, payload.content?.survey ?? []))
  }, [fields, sourceAssetResponse])

  const onBulkSelect = useCallback((evt: MouseEvent<HTMLButtonElement>) => {
    evt.preventDefault()
    setColumnsToDisplay((current) => current.map((item) => ({ label: item.label, checked: true })))
  }, [])

  const onBulkDeselect = useCallback((evt: MouseEvent<HTMLButtonElement>) => {
    evt.preventDefault()
    setColumnsToDisplay((current) => current.map((item) => ({ label: item.label, checked: false })))
  }, [])

  const onColumnSelected = useCallback((newList: ColumnFilter[]) => {
    setColumnsToDisplay(newList)
  }, [])

  const onSubmit = useCallback(
    (evt: MouseEvent<HTMLButtonElement>) => {
      evt.preventDefault()

      const selectedFields = columnsToDisplay.filter((item) => item.checked).map((item) => item.label)

      if (attachmentUrl) {
        const pairedDataUid = getAssetUIDFromUrl(attachmentUrl)
        if (!pairedDataUid) {
          console.error('Failed to parse paired data UID from attachment URL:', attachmentUrl)
          notify(t('Could not update import. Please refresh and try again.'), 'error')
          return
        }

        patchPairedDataMutate(
          {
            uidAsset: asset.uid,
            uidPairedData: pairedDataUid,
            data: {
              fields: selectedFields,
              filename,
            },
          },
          {
            onSuccess: () => {
              onAttachmentChanged?.()
              onModalClose()
            },
          },
        )
        return
      }

      createPairedDataMutate(
        {
          uidAsset: asset.uid,
          data: {
            source: source.url,
            fields: selectedFields,
            filename,
          },
        },
        {
          onSuccess: () => {
            onAttachmentChanged?.()
            onModalClose()
          },
        },
      )
    },
    [
      asset.uid,
      attachmentUrl,
      columnsToDisplay,
      createPairedDataMutate,
      filename,
      onAttachmentChanged,
      onModalClose,
      patchPairedDataMutate,
      source.url,
      source.url,
    ],
  )

  return (
    // TODO: Don't use BEM elements
    // See: https://github.com/kobotoolbox/kpi/issues/3912
    <bem.FormModal__form m='data-attachment-columns'>
      <div className='header'>
        <span className='modal-description'>
          {t(
            'You are about to import ##SOURCE_NAME##. Select or deselect in the list below to narrow down the number of questions to import.',
          ).replace('##SOURCE_NAME##', source.name)}
        </span>

        <div className='bulk-options'>
          <span className='bulk-options__description'>{t('Select below the questions you want to import')}</span>

          <div className='bulk-options__buttons'>
            <Button type='secondary' size='s' onClick={onBulkSelect} label={t('Select all')} />

            <span>{t('|')}</span>

            <Button type='secondary' size='s' onClick={onBulkDeselect} label={t('Deselect all')} />
          </div>
        </div>
      </div>

      {!isInitialised && <LoadingSpinner message={t('Loading imported questions')} />}

      <MultiCheckbox
        type='frame'
        items={columnsToDisplay}
        onChange={onColumnSelected}
        disabled={isLoading || isFetchingSourceAsset}
        className='data-attachment-columns-multicheckbox'
      />

      {isLoading && <LoadingSpinner message={t('Updating imported questions')} />}

      <footer className='modal__footer'>
        <Button
          type='primary'
          size='l'
          isSubmit
          onClick={onSubmit}
          isDisabled={isLoading || !isInitialised}
          label={t('Accept')}
          className='data-attachment-modal-footer-button'
        />
      </footer>
    </bem.FormModal__form>
  )
}

export default DataAttachmentColumnsForm
