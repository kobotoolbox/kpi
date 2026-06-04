import './FormMedia.scss'
import { Anchor, Group, Stack, Text } from '@mantine/core'
import React, { useCallback, useEffect, useState } from 'react'
import Dropzone from 'react-dropzone'
import { actions } from '#/actions'
import type { MediaUploadPayload, MediaUploadSource } from '#/actions/mediaActions'
import ActionIcon from '#/components/common/ActionIcon'
import Button from '#/components/common/ButtonNew'
import Alert from '#/components/common/alert'
import LoadingSpinner from '#/components/common/loadingSpinner'
import TextBox from '#/components/common/textBox'
import { ASSET_FILE_TYPES, MAX_DISPLAYED_STRING_LENGTH } from '#/constants'
import type { AssetFileResponse, PaginatedResponse } from '#/dataInterface'
import envStore from '#/envStore'
import { notify, truncateString, truncateUrl } from '#/utils'
import usePendingUploads from './usePendingUploads'

const DEFAULT_MEDIA_DESCRIPTION = 'default'
const MEDIA_SUPPORT_URL = 'upload_media.html'

interface FormMediaAsset {
  uid: string
  deployment__active?: boolean
}

interface FormMediaProps {
  asset: FormMediaAsset
}

type FormMediaMetadata = AssetFileResponse['metadata'] & {
  // Present only for entries created from a URL instead of an uploaded file.
  redirect_url?: string
}

interface FormMediaItem extends Omit<AssetFileResponse, 'metadata'> {
  metadata: FormMediaMetadata
}

interface FieldErrors {
  // API uses this key for file-upload validation errors.
  base64Encoded?: string
  // API uses this key for URL-based upload validation errors.
  metadata?: string | string[]
  [key: string]: unknown
}

function getReadableFileName(item: FormMediaItem): string {
  // URL-based media does not have a real filename, so we display a truncated URL.
  if (item.metadata.redirect_url) {
    return truncateUrl(item.metadata.redirect_url, MAX_DISPLAYED_STRING_LENGTH.form_media)
  }

  return truncateString(item.metadata.filename, MAX_DISPLAYED_STRING_LENGTH.form_media)
}

/**
 * Form media management screen for a project.
 *
 * Lets users list existing media, upload new files (drag/drop), add media by
 * URL, and delete items. Data currently flows through legacy Reflux media
 * actions (`actions.media.*`).
 *
 * @param props.asset Project identifier and deployment state.
 */
export default function FormMedia(props: FormMediaProps) {
  const [uploadedAssets, setUploadedAssets] = useState<FormMediaItem[]>([])
  const [fieldsErrors, setFieldsErrors] = useState<FieldErrors>({})
  const [inputURL, setInputURL] = useState('')
  // Show a loading state before first media list fetch resolves.
  const [isInitialised, setIsInitialised] = useState(false)
  const [isUploadURLPending, setIsUploadURLPending] = useState(false)
  const {
    isPending: isUploadFilePending,
    beginBatch: beginPendingFileUploads,
    resolveOne: resolveOnePendingFileUpload,
    reset: resetPendingFileUploads,
  } = usePendingUploads()

  const loadMedia = useCallback(() => {
    actions.media.loadMedia(props.asset.uid)
  }, [props.asset.uid])

  useEffect(() => {
    const onGetMediaCompleted = (response: PaginatedResponse<FormMediaItem>) => {
      setUploadedAssets(response.results)
      setIsInitialised(true)
    }

    const onUploadCompleted = (_uid: string, uploadSource: MediaUploadSource) => {
      if (uploadSource === 'file') {
        resolveOnePendingFileUpload()
        return
      }

      setIsUploadURLPending(false)
    }

    const onUploadFailed = (response: unknown, uploadSource: MediaUploadSource) => {
      const typedResponse = response as { responseJSON?: FieldErrors } | undefined
      setFieldsErrors(typedResponse?.responseJSON ?? {})

      if (uploadSource === 'file') {
        resolveOnePendingFileUpload()
      } else {
        setIsUploadURLPending(false)
      }
    }

    // Initial fetch for media list when this screen mounts.
    loadMedia()

    // Keep listening to legacy Reflux actions until this feature is moved
    // to React Query. We clean up listeners in the effect return.
    const stopLoadMediaCompleted = actions.media.loadMedia.completed.listen(onGetMediaCompleted)
    const stopUploadCompleted = actions.media.uploadMedia.completed.listen(onUploadCompleted)
    const stopUploadFailed = actions.media.uploadMedia.failed.listen(onUploadFailed)

    return () => {
      // Avoid stale pending state if the user leaves this route mid-upload.
      resetPendingFileUploads()

      if (typeof stopLoadMediaCompleted === 'function') {
        stopLoadMediaCompleted()
      }

      if (typeof stopUploadCompleted === 'function') {
        stopUploadCompleted()
      }

      if (typeof stopUploadFailed === 'function') {
        stopUploadFailed()
      }
    }
  }, [loadMedia, resetPendingFileUploads, resolveOnePendingFileUpload])

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

  const uploadMedia = useCallback(
    (formMediaJSON: MediaUploadPayload, uploadSource: MediaUploadSource) => {
      // Clear stale errors so users only see feedback for the latest attempt.
      setFieldsErrors({})
      actions.media.uploadMedia(props.asset.uid, formMediaJSON, uploadSource)
    },
    [props.asset.uid],
  )

  const onFileDrop = useCallback(
    (files: File[]) => {
      if (files.length < 1) {
        return
      }

      beginPendingFileUploads(files.length)

      // We intentionally upload each file independently.
      // Reflux will refresh the list when each upload completes.
      files.forEach(async (file) => {
        try {
          // We await per-file conversion before sending the upload request.
          const base64File = await toBase64(file)

          uploadMedia(
            {
              description: DEFAULT_MEDIA_DESCRIPTION,
              file_type: ASSET_FILE_TYPES.form_media.id,
              metadata: JSON.stringify({ filename: file.name }),
              base64Encoded: base64File,
            },
            'file',
          )
        } catch {
          // If file reading fails before request dispatch, no action callback
          // will fire, so we must resolve this pending slot manually.
          resolveOnePendingFileUpload()
          notify.error(t('Could not process one of the selected files.'))
        }
      })
    },
    [beginPendingFileUploads, resolveOnePendingFileUpload, toBase64, uploadMedia],
  )

  const onSubmitURL = useCallback(() => {
    const url = inputURL

    if (url === '') {
      notify.warning(t('URL is empty!'))
      return
    }

    setIsUploadURLPending(true)
    setInputURL('')

    // For URL uploads backend expects redirect_url inside metadata JSON.
    uploadMedia(
      {
        description: DEFAULT_MEDIA_DESCRIPTION,
        file_type: ASSET_FILE_TYPES.form_media.id,
        metadata: JSON.stringify({ redirect_url: url }),
      },
      'url',
    )
  }, [inputURL, uploadMedia])

  const onDeleteMedia = useCallback(
    (url: string) => {
      actions.media.deleteMedia(props.asset.uid, url)
    },
    [props.asset.uid],
  )

  return (
    <div className='form-view form-view--form-media'>
      <div className='form-media'>
        {props.asset.deployment__active && (
          <Alert iconName='alert' type='warning'>
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

              <Button variant='light' size='md' onClick={onSubmitURL} disabled={!inputURL} loading={isUploadURLPending}>
                {t('Add')}
              </Button>
            </Group>
          </Stack>
        </div>

        <div className='form-media__list'>
          <Text className='form-media__label'>{t('Attached files')}</Text>

          <ul>
            {/* Keep the spinner visible during first load and active uploads. */}
            {(!isInitialised || isUploadFilePending || isUploadURLPending) && (
              <li className='form-media__list-item'>
                <LoadingSpinner message={t('loading media')} />
              </li>
            )}

            {isInitialised && !uploadedAssets.length && (
              <li className='form-media__list-item'>{t('No files uploaded yet')}</li>
            )}

            {uploadedAssets.map((item) => (
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
                  onClick={() => onDeleteMedia(item.url)}
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
