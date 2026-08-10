import { Box, Flex, Group, ScrollArea, Stack, Text } from '@mantine/core'
import { type MouseEvent, useCallback, useEffect, useState } from 'react'
import type { ServerError } from '#/api/ServerError'
import { useAssetsRetrieve } from '#/api/react-query/manage-projects-and-library-content'
import { useAssetsPairedDataCreate, useAssetsPairedDataPartialUpdate } from '#/api/react-query/survey-data'
import ButtonNew from '#/components/common/ButtonNew'
import LoadingSpinner from '#/components/common/loadingSpinner'
import MultiCheckbox from '#/components/common/multiCheckbox'
import dataAttachmentsUtils, { type ColumnFilter } from '#/components/dataAttachments/dataAttachmentsUtils'
import type { AssetResponse } from '#/dataInterface'
import { getAssetUIDFromUrl, notify } from '#/utils'

export interface DataAttachmentColumnsFormProps {
  onRequestClose: () => void
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
 * @prop {function} onRequestClose - causes the modal to close
 * @prop {object} asset - current asset
 * @prop {sourceAttributes} source
 * @prop {string} filename
 * @prop {string[]} fields - selected fields to retrieve from source
 * @prop {string} attachmentUrl - if exists, we are patching an existing attachment
                                  otherwise, this is a new import
 */
export function DataAttachmentColumnsForm({
  onRequestClose,
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

  const { mutate: createPairedDataMutate, isPending: isCreatingAttachment } = useAssetsPairedDataCreate<ServerError>({
    mutation: {
      // Hide default error to avoid duplicate toasts
      onError: () => null,
    },
  })
  const { mutate: patchPairedDataMutate, isPending: isPatchingAttachment } =
    useAssetsPairedDataPartialUpdate<ServerError>({
      mutation: {
        // Hide default error to avoid duplicate toasts
        onError: () => null,
      },
    })

  const isLoading = isCreatingAttachment || isPatchingAttachment

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

      const onSuccess = () => {
        onAttachmentChanged?.()
        onRequestClose()
      }

      const onFailure = (error: ServerError) => {
        const invalidFieldsErrorMessage = dataAttachmentsUtils.buildInvalidFieldsErrorMessage(
          selectedFields,
          error.parsedResponse,
          t('Failed to attach to source'),
          t('Some fields are invalid:'),
        )

        if (invalidFieldsErrorMessage) {
          notify.error(invalidFieldsErrorMessage)
          return
        }

        const errorResponse = error.parsedResponse as {
          detail?: string
          data_sharing?: { fields?: string }
          fields?: string[]
          filename?: string[]
        }

        notify.error(
          errorResponse?.detail ||
            errorResponse?.data_sharing?.fields ||
            errorResponse?.fields?.[0] ||
            errorResponse?.filename?.[0] ||
            t('Failed to attach to source'),
        )
      }

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
            onSuccess,
            onError: onFailure,
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
          onSuccess,
          onError: onFailure,
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
      onRequestClose,
      patchPairedDataMutate,
      source.url,
    ],
  )

  return (
    <Stack gap={0}>
      <Text size='md'>
        {t(
          'You are about to import ##SOURCE_NAME##. Select or deselect in the list below to narrow down the number of questions to import.',
        ).replace('##SOURCE_NAME##', source.name)}
      </Text>

      <Flex mt={14} gap={10} align='center' justify='space-between' wrap='wrap'>
        <Text fw='bold'>{t('Select below the questions you want to import')}</Text>

        <Group gap={0} wrap='nowrap'>
          <ButtonNew variant='light' size='sm' onClick={onBulkSelect}>
            {t('Select all')}
          </ButtonNew>

          <Text mx={12}>{t('|')}</Text>

          <ButtonNew variant='light' size='sm' onClick={onBulkDeselect}>
            {t('Deselect all')}
          </ButtonNew>
        </Group>
      </Flex>

      {!isInitialised && (
        <Box mt={12}>
          <LoadingSpinner message={t('Loading imported questions')} />
        </Box>
      )}

      {/* The 200px tall bordered frame the `multi-checkbox--type-frame` styles used to provide */}
      <ScrollArea h={200} mt={12} p={12} bd='1px solid var(--mantine-color-gray-6)' bdrs='xs'>
        <MultiCheckbox
          type='bare'
          items={columnsToDisplay}
          onChange={onColumnSelected}
          disabled={isLoading || isFetchingSourceAsset}
        />
      </ScrollArea>

      {isLoading && (
        <Box mt={12}>
          <LoadingSpinner message={t('Updating imported questions')} />
        </Box>
      )}

      <Flex mt='md' justify='center'>
        <ButtonNew size='lg' px={60} onClick={onSubmit} disabled={isLoading || !isInitialised}>
          {t('Accept')}
        </ButtonNew>
      </Flex>
    </Stack>
  )
}

export default DataAttachmentColumnsForm
