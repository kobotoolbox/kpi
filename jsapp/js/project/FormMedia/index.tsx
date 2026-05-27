import './FormMedia.scss'
import { Anchor, Group, Stack, Text } from '@mantine/core'
import React, { useCallback, useEffect, useState } from 'react'
import Dropzone from 'react-dropzone'
import { actions } from '#/actions'
import ActionIcon from '#/components/common/ActionIcon'
import Button from '#/components/common/ButtonNew'
import Alert from '#/components/common/alert'
import LoadingSpinner from '#/components/common/loadingSpinner'
import TextBox from '#/components/common/textBox'
import { ASSET_FILE_TYPES, MAX_DISPLAYED_STRING_LENGTH } from '#/constants'
import type { AssetFileResponse, PaginatedResponse } from '#/dataInterface'
import envStore from '#/envStore'
import { notify, truncateString, truncateUrl } from '#/utils'

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
  const [isUploadFilePending, setIsUploadFilePending] = useState(false)
  const [isUploadURLPending, setIsUploadURLPending] = useState(false)

  const loadMedia = useCallback(() => {
    actions.media.loadMedia(props.asset.uid)
  }, [props.asset.uid])

  useEffect(() => {
    const onGetMediaCompleted = (response: PaginatedResponse<FormMediaItem>) => {
      setUploadedAssets(response.results)
      setIsUploadFilePending(false)
      setIsUploadURLPending(false)
      setIsInitialised(true)
    }

    const onUploadFailed = (response: { responseJSON?: FieldErrors }) => {
      setFieldsErrors(response?.responseJSON ?? {})
      setIsUploadFilePending(false)
      setIsUploadURLPending(false)
    }

    // Initial fetch for media list when this screen mounts.
    loadMedia()

    // Keep listening to legacy Reflux actions until this feature is moved
    // to React Query. We clean up listeners in the effect return.
    const stopLoadMediaCompleted = actions.media.loadMedia.completed.listen(onGetMediaCompleted)
    const stopUploadFailed = actions.media.uploadMedia.failed.listen(onUploadFailed)

    return () => {
      if (typeof stopLoadMediaCompleted === 'function') {
        stopLoadMediaCompleted()
      }

      if (typeof stopUploadFailed === 'function') {
        stopUploadFailed()
      }
    }
  }, [loadMedia])

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
    (formMediaJSON: {
      description: string
      file_type: string
      metadata: string
      base64Encoded?: string | ArrayBuffer | null
    }) => {
      // Clear stale errors so users only see feedback for the latest attempt.
      setFieldsErrors({})
      actions.media.uploadMedia(props.asset.uid, formMediaJSON)
    },
    [props.asset.uid],
  )

  const onFileDrop = useCallback(
    (files: File[]) => {
      if (files.length < 1) {
        return
      }

      setIsUploadFilePending(true)

      // We intentionally upload each file independently.
      // Reflux will refresh the list when each upload completes.
      files.forEach(async (file) => {
        const base64File = await toBase64(file)

        uploadMedia({
          description: DEFAULT_MEDIA_DESCRIPTION,
          file_type: ASSET_FILE_TYPES.form_media.id,
          metadata: JSON.stringify({ filename: file.name }),
          base64Encoded: base64File,
        })
      })
    },
    [toBase64, uploadMedia],
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
    uploadMedia({
      description: DEFAULT_MEDIA_DESCRIPTION,
      file_type: ASSET_FILE_TYPES.form_media.id,
      metadata: JSON.stringify({ redirect_url: url }),
    })
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
                  // Added manually by frontend, not backend. See uploadMedia().
                  download={item.metadata.filename}
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
