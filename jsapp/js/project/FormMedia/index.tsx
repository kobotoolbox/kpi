import './FormMedia.scss'
import { Anchor, Group, Stack, Text } from '@mantine/core'
import { useIsMutating } from '@tanstack/react-query'
import React, { useCallback, useState } from 'react'
import Dropzone from 'react-dropzone'
import type { ServerError } from '#/api/ServerError'
import type { FilesResponse } from '#/api/models/filesResponse'
import type { FilesResponseMetadata } from '#/api/models/filesResponseMetadata'
import { useAssetsFilesCreate, useAssetsFilesDestroy, useAssetsFilesList } from '#/api/react-query/survey-data'
import ActionIcon from '#/components/common/ActionIcon'
import Button from '#/components/common/ButtonNew'
import Alert from '#/components/common/alert'
import LoadingSpinner from '#/components/common/loadingSpinner'
import TextBox from '#/components/common/textBox'
import { ASSET_FILE_TYPES, MAX_DISPLAYED_STRING_LENGTH } from '#/constants'
import envStore from '#/envStore'
import { notify, truncateString, truncateUrl } from '#/utils'

// Distinct mutation key so useIsMutating can count only file uploads, not URL uploads.
// This approach is necessary because file uploads can be concurrent (multi-file drag-drop)
// while URL uploads are sequential, and we need separate spinner logic for each flow.
// useIsMutating tracks active mutations across all hook instances, making it more reliable
// than per-component state for concurrent operations.
const FILE_UPLOAD_MUTATION_KEY = ['assetsFilesCreate', 'form-media-file'] as const

const DEFAULT_MEDIA_DESCRIPTION = 'default'
const MEDIA_SUPPORT_URL = 'upload_media.html'

interface FormMediaAsset {
  uid: string
  deployment__active?: boolean
}

interface FormMediaProps {
  asset: FormMediaAsset
}

// Field-level validation errors returned by the backend.
interface FieldErrors {
  // API uses this key for file-upload validation errors.
  base64Encoded?: string
  // API uses this key for URL-based upload validation errors.
  metadata?: string | string[]
  [key: string]: unknown
}

type FormMediaItemMetadata = FilesResponseMetadata & {
  // URL-based media entries carry redirect_url instead of a local filename.
  redirect_url?: string
}

interface FormMediaItem extends Omit<FilesResponse, 'metadata'> {
  metadata: FormMediaItemMetadata
}

function getReadableFileName(item: FormMediaItem): string {
  // URL-based media does not have a real filename, so we display a truncated URL.
  if (item.metadata.redirect_url) {
    return truncateUrl(item.metadata.redirect_url, MAX_DISPLAYED_STRING_LENGTH.form_media)
  }

  return truncateString(item.metadata.filename ?? '', MAX_DISPLAYED_STRING_LENGTH.form_media)
}

/**
 * Form media management screen for a project.
 *
 * Lets users list existing media, upload new files (drag/drop), add media by
 * URL, and delete items.
 *
 * @param props.asset Project identifier and deployment state.
 */
export default function FormMedia(props: FormMediaProps) {
  const [fieldsErrors, setFieldsErrors] = useState<FieldErrors>({})
  const [inputURL, setInputURL] = useState('')

  // useIsMutating counts active mutations in the cache across all hook instances,
  // so it correctly tracks concurrent file uploads unlike per-call onSettled.
  const isUploadFilePending = useIsMutating({ mutationKey: FILE_UPLOAD_MUTATION_KEY }) > 0

  const mediaQuery = useAssetsFilesList(props.asset.uid, {
    file_type: ASSET_FILE_TYPES.form_media.id,
  })

  const mediaItems = (mediaQuery.data?.status === 200 ? mediaQuery.data.data.results : []) as FormMediaItem[]

  // Separate mutation instances for file vs URL uploads to keep their
  // isPending states independent. Default toast suppressed for both since
  // validation errors are displayed inline.
  const fileUploadMutation = useAssetsFilesCreate({
    mutation: {
      mutationKey: FILE_UPLOAD_MUTATION_KEY,
      onError: () => {
        // Inline errors shown in the dropzone; suppress the default toast.
      },
    },
  })

  const urlUploadMutation = useAssetsFilesCreate({
    mutation: {
      onError: () => {
        // Inline errors shown on the URL input; suppress the default toast.
      },
    },
  })

  const destroyMutation = useAssetsFilesDestroy({
    mutation: {
      onError: () => notify.error(t('Failed to delete media!')),
    },
  })

  const toBase64 = useCallback(
    // Backend accepts base64 payloads for uploaded files.
    (file: File) =>
      new Promise<string | ArrayBuffer | null>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(file)
      }),
    [],
  )

  const onFileDrop = useCallback(
    (files: File[]) => {
      if (files.length < 1) {
        return
      }

      // Clear stale errors so users only see feedback for the latest attempt.
      setFieldsErrors({})

      // Upload each file independently; the cache is invalidated per-upload.
      files.forEach(async (file) => {
        try {
          // Await per-file conversion before dispatching the upload request.
          const base64File = await toBase64(file)

          fileUploadMutation.mutate(
            {
              uidAsset: props.asset.uid,
              data: {
                description: DEFAULT_MEDIA_DESCRIPTION,
                file_type: ASSET_FILE_TYPES.form_media.id,
                base64Encoded: base64File as string,
                metadata: { filename: file.name },
              },
            },
            {
              onError: (error) => {
                setFieldsErrors((prev) => {
                  return { ...prev, ...((error as ServerError)?.parsedResponse ?? {}) }
                })
              },
            },
          )
        } catch {
          // File reading failed before the request was dispatched — nothing to clean up.
          notify.error(t('Could not process one of the selected files.'))
        }
      })
    },
    [fileUploadMutation.mutate, props.asset.uid, toBase64],
  )

  const onSubmitURL = useCallback(() => {
    const url = inputURL

    if (url === '') {
      notify.warning(t('URL is empty!'))
      return
    }

    // Clear stale errors so users only see feedback for the latest attempt.
    setFieldsErrors({})
    setInputURL('')

    // For URL uploads backend expects redirect_url inside metadata.
    urlUploadMutation.mutate(
      {
        uidAsset: props.asset.uid,
        data: {
          description: DEFAULT_MEDIA_DESCRIPTION,
          file_type: ASSET_FILE_TYPES.form_media.id,
          metadata: { redirect_url: url },
        },
      },
      {
        onError: (error) => {
          setFieldsErrors((error as ServerError)?.parsedResponse ?? {})
        },
      },
    )
  }, [inputURL, props.asset.uid, urlUploadMutation.mutate])

  const onDeleteMedia = useCallback(
    (fileUid: string) => {
      destroyMutation.mutate(
        { uidAsset: props.asset.uid, uidFile: fileUid },
        {
          onSuccess: () => notify(t('Successfully deleted media')),
        },
      )
    },
    [destroyMutation.mutate, props.asset.uid],
  )

  return (
    <div className='form-view form-view--form-media'>
      <div className='form-media'>
        {props.asset.deployment__active && (
          <Alert iconName='alert' type='warning' mb='md'>
            {t('You must redeploy this form to see media changes.')}
          </Alert>
        )}

        <Group className='form-media__title' wrap='nowrap' gap='xs'>
          <Text className='form-media__label'>{t('Attach files')}</Text>

          {envStore.isReady && envStore.data.support_url && (
            <Anchor
              className='title-help'
              target='_blank'
              href={envStore.data.support_url + MEDIA_SUPPORT_URL}
              rel='noreferrer'
              data-tip={t('Learn more about form media')}
            >
              <i className='k-icon k-icon-help' />
            </Anchor>
          )}
        </Group>

        <div className='form-media__upload'>
          {!isUploadFilePending && (
            <Dropzone onDrop={onFileDrop}>
              {({ getRootProps, getInputProps }) => (
                <div {...getRootProps({ className: 'kobo-dropzone kobo-dropzone--form-media' })}>
                  <input {...getInputProps()} />

                  {fieldsErrors?.base64Encoded && (
                    <Alert type='error' mb='sm'>
                      {fieldsErrors.base64Encoded}
                    </Alert>
                  )}

                  <i className='k-icon k-icon-upload' />
                  {t('Drag and drop files here')}
                  <div className='dropzone-description'>
                    {t('or')} <Anchor component='span'>{t('click here to browse')}</Anchor>
                  </div>
                </div>
              )}
            </Dropzone>
          )}

          {isUploadFilePending && (
            <div className='kobo-dropzone kobo-dropzone--form-media'>
              <LoadingSpinner message={t('Uploading file…')} />
            </div>
          )}

          <Stack className='form-media-upload-url' gap='sm'>
            <Text className='form-media-upload-url__label'>{t('You can also add files using a URL')}</Text>

            <Group className='form-media-upload-url__form' wrap='nowrap' align='flex-start'>
              <TextBox
                type='url'
                placeholder={t('Paste URL here')}
                errors={fieldsErrors?.metadata}
                value={inputURL}
                onChange={setInputURL}
              />

              <Button
                variant='light'
                size='md'
                onClick={onSubmitURL}
                disabled={!inputURL}
                loading={urlUploadMutation.isPending}
              >
                {t('Add')}
              </Button>
            </Group>
          </Stack>
        </div>

        <div className='form-media__list'>
          <Text className='form-media__label'>{t('Attached files')}</Text>

          <ul>
            {/* Keep the spinner visible during first load and active uploads. */}
            {(mediaQuery.isPending || isUploadFilePending || urlUploadMutation.isPending) && (
              <li className='form-media__list-item'>
                <LoadingSpinner message={t('loading media')} />
              </li>
            )}

            {!mediaQuery.isPending && !mediaItems.length && (
              <li className='form-media__list-item'>{t('No files uploaded yet')}</li>
            )}

            {mediaItems.map((item) => (
              <li className='form-media__list-item' key={item.uid}>
                <i
                  className={`form-media__file-type k-icon ${
                    item.metadata.redirect_url ? 'k-icon-link' : 'k-icon-media-files'
                  }`}
                />

                <a
                  href={item.content}
                  target='_blank'
                  rel='noreferrer'
                  // Keep native browser navigation for URL-based entries.
                  // `download` is only useful for uploaded files.
                  download={item.metadata.redirect_url ? undefined : item.metadata.filename}
                >
                  {getReadableFileName(item)}
                </a>

                <ActionIcon
                  size='md'
                  variant='subtle'
                  color='red'
                  aria-label={t('Delete file')}
                  onClick={() => onDeleteMedia(item.uid)}
                >
                  <i className='k-icon k-icon-trash' />
                </ActionIcon>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
