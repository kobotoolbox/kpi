import { Checkbox, Group, Stack, Text } from '@mantine/core'
import { IconFileTypeXls } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import orvalFetchWithAuth from '#/api/orval.mutator'
import { importsRetrieve } from '#/api/react-query/manage-projects-and-library-content'
import ButtonNew from '#/components/common/ButtonNew'
import DropzoneNew from '#/components/common/DropzoneNew'
import KoboIcon from '#/components/common/KoboIcon'
import LoadingSpinner from '#/components/common/loadingSpinner'
import myLibraryStore from '#/components/library/myLibraryStore'
import { ASSET_TYPES, MODAL_TYPES } from '#/constants'
import type { CreateImportRequest, ImportResponse } from '#/dataInterface'
import envStore from '#/envStore'
import { escapeHtml, join, notify, validFileTypes } from '#/utils'

export interface LibraryUploadModalParams {
  type: string
  file?: File
  filename?: string
  onBack?: () => void
}

interface LibraryUploadModalProps {
  params: LibraryUploadModalParams
  onRequestClose: () => void
  onTitleChange?: (title: string) => void
}

type UploadFlowState = 'form' | 'uploadingFile' | 'processingImport'

interface LegacyImportFetchResponse {
  data: ImportResponse
  status: number
  headers: Headers
}

function getModalTitle(flowState: UploadFlowState): string {
  return flowState === 'processingImport' ? t('Uploading XLS file') : t('Upload file')
}

function appendToFormData(formData: FormData, key: string, value: unknown) {
  if (value === undefined || value === null) {
    return
  }

  if (value instanceof Blob) {
    formData.append(key, value)
    return
  }

  formData.append(key, String(value))
}

async function createImport(importParams: CreateImportRequest): Promise<ImportResponse> {
  const formData = new FormData()

  Object.entries(importParams).forEach(([key, value]) => {
    appendToFormData(formData, key, value)
  })

  // We intentionally call the shared Orval mutator directly instead of
  // `importsCreate(...)` because the generated endpoint model currently expects
  // a different payload shape than this legacy upload flow (`base64Encoded`,
  // `library`, `desired_type`). Using the mutator preserves shared auth,
  // CSRF/multipart handling, error normalization, and Reflux bridge callbacks.
  const response = await orvalFetchWithAuth<LegacyImportFetchResponse>('/api/v2/imports/', {
    method: 'POST',
    body: formData,
  })

  return response.data
}

function readFileAsDataURL(file: File): Promise<string | ArrayBuffer | null> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      resolve(reader.result)
    }

    reader.onerror = () => {
      reject(new Error('file_read_error'))
    }

    reader.readAsDataURL(file)
  })
}

export default function LibraryUploadModal(props: LibraryUploadModalProps) {
  const onBack = props.params.onBack

  const { onRequestClose } = props
  const [currentFile, setCurrentFile] = useState<File | null>(props.params.file || null)
  const [isUploadAsTemplateChecked, setIsUploadAsTemplateChecked] = useState(false)
  const [uploadFlowState, setUploadFlowState] = useState<UploadFlowState>(
    props.params.type === MODAL_TYPES.UPLOADING_XLS ? 'processingImport' : 'form',
  )
  const [uploadFilename, setUploadFilename] = useState(props.params.filename || props.params.file?.name || '')
  const [currentImportUid, setCurrentImportUid] = useState<string | null>(null)
  const terminalImportStatusRef = useRef<string | null>(null)
  const previousTypeRef = useRef(props.params.type)
  const paramsType = props.params.type
  const paramsFilename = props.params.filename
  const paramsFile = props.params.file

  const createImportMutation = useMutation({
    mutationFn: createImport,
    retry: false,
  })

  const importDetailsQuery = useQuery({
    queryKey: ['library-upload-import', currentImportUid],
    queryFn: () => importsRetrieve(currentImportUid as string),
    enabled: Boolean(currentImportUid),
    retry: false,
    refetchInterval: (query) => {
      const status = (query.state.data?.data as ImportResponse | undefined)?.status
      if (status === 'complete' || status === 'error') {
        return false
      }

      return 1000
    },
  })

  useEffect(() => {
    const incomingType = paramsType
    const previousType = previousTypeRef.current

    if (incomingType === MODAL_TYPES.UPLOADING_XLS) {
      if (previousType !== incomingType || paramsFilename !== uploadFilename) {
        setUploadFlowState('processingImport')
        setUploadFilename(paramsFilename || '')
      }
    }

    if (incomingType === MODAL_TYPES.LIBRARY_UPLOAD && previousType !== incomingType) {
      setUploadFlowState('form')
      setCurrentFile(paramsFile || null)
      setUploadFilename(paramsFile?.name || '')
      setCurrentImportUid(null)
      terminalImportStatusRef.current = null
    }

    previousTypeRef.current = incomingType
  }, [paramsType, paramsFilename, paramsFile, uploadFilename])

  useEffect(() => {
    if (!currentImportUid) {
      terminalImportStatusRef.current = null
      return
    }

    const importData = importDetailsQuery.data?.data as ImportResponse | undefined
    if (!importData) {
      return
    }

    const terminalStatus = `${currentImportUid}:${importData.status}`
    if (terminalImportStatusRef.current === terminalStatus) {
      return
    }

    if (importData.status === 'complete') {
      terminalImportStatusRef.current = terminalStatus
      myLibraryStore.fetchData(true)
      notify(t('XLS Import completed'))
      onRequestClose()
      return
    }

    if (importData.status === 'error') {
      terminalImportStatusRef.current = terminalStatus
      const errLines: React.ReactNode[] = [t('Import Failed!')]
      if (uploadFilename) {
        errLines.push(<code key='filename'>Name: {uploadFilename}</code>)
      }
      if (importData.messages?.error) {
        errLines.push(
          <code key='error'>
            {importData.messages.error_type}: {escapeHtml(importData.messages.error)}
          </code>,
        )
      }
      notify.error(<div>{join(errLines, <br />)}</div>)
      onRequestClose()
    }
  }, [currentImportUid, importDetailsQuery.data, onRequestClose, uploadFilename])

  useEffect(() => {
    if (!importDetailsQuery.error || !currentImportUid) {
      return
    }

    if (terminalImportStatusRef.current === `${currentImportUid}:request_error`) {
      return
    }

    terminalImportStatusRef.current = `${currentImportUid}:request_error`
    notify.error(t('Import failed'))
    onRequestClose()
  }, [currentImportUid, importDetailsQuery.error, onRequestClose])

  const isSubmitEnabled = useMemo(
    () => uploadFlowState === 'form' && Boolean(currentFile),
    [currentFile, uploadFlowState],
  )

  const title = getModalTitle(uploadFlowState)
  const processingMessage = uploadFilename ? t('Uploading: ') + uploadFilename : t('Uploading file…')

  useEffect(() => {
    props.onTitleChange?.(title)
  }, [props.onTitleChange, title])

  async function onSubmit(evt: React.MouseEvent<HTMLButtonElement>) {
    evt.preventDefault()

    if (!currentFile) {
      return
    }

    setUploadFlowState('uploadingFile')

    let base64Encoded: string | ArrayBuffer | null
    try {
      base64Encoded = await readFileAsDataURL(currentFile)
    } catch {
      notify.error(t('Failed to read file.'))
      setUploadFlowState('form')
      return
    }

    try {
      const payload: CreateImportRequest = {
        name: currentFile.name,
        base64Encoded,
        library: true,
      }

      if (isUploadAsTemplateChecked) {
        payload.desired_type = ASSET_TYPES.template.id
      }

      const createImportResponse = await createImportMutation.mutateAsync(payload)
      setUploadFilename(currentFile.name)
      setCurrentImportUid(createImportResponse.uid)
      setUploadFlowState('processingImport')
    } catch {
      notify.error(t('Failed to create import.'))
      setUploadFlowState('form')
    }
  }

  const isBusy =
    uploadFlowState === 'uploadingFile' ||
    (uploadFlowState === 'processingImport' && Boolean(currentImportUid) && importDetailsQuery.isFetching)
  const backButtonLabel = onBack ? t('Back') : t('Close')

  function onBackClick() {
    onRequestClose()
    onBack?.()
  }

  return (
    <Stack gap='md'>
      {uploadFlowState === 'form' && (
        <>
          <Text>{t('Import an XLSForm from your computer.')}</Text>

          <DropzoneNew
            onDrop={(files) => {
              if (files[0]) {
                setCurrentFile(files[0])
              }
            }}
            multiple={false}
            maxFiles={1}
            accept={validFileTypes()}
          >
            <Stack gap='xs' align='center' style={{ pointerEvents: 'none' }}>
              <KoboIcon icon={IconFileTypeXls} size={52} />
              <Text ta='center' fw={500}>
                {currentFile?.name || t('Drag and drop the XLSForm file here or click to browse')}
              </Text>
              <DropzoneNew.Accept>
                <Text size='sm' c='blue.5'>
                  {t('Drop file to select it')}
                </Text>
              </DropzoneNew.Accept>
              <DropzoneNew.Reject>
                <Text size='sm' c='red.6'>
                  {t('Only .xls and .xlsx files are supported')}
                </Text>
              </DropzoneNew.Reject>
              <DropzoneNew.Idle>
                <Text size='sm'>{t('Only .xls and .xlsx files are supported')}</Text>
              </DropzoneNew.Idle>
            </Stack>
          </DropzoneNew>

          <Stack gap='xxs'>
            <Checkbox
              checked={isUploadAsTemplateChecked}
              onChange={(evt) => {
                setIsUploadAsTemplateChecked(evt.currentTarget.checked)
              }}
              label={t('Upload as template')}
            />

            <Text size='sm'>
              {t('Note that this will be ignored when uploading a collection file.')}{' '}
              <a href={envStore.data.support_url + 'import_collection.html'} target='_blank' rel='noreferrer'>
                {t('Learn more')}
              </a>
            </Text>
          </Stack>
        </>
      )}

      {uploadFlowState === 'uploadingFile' && <LoadingSpinner message={t('Uploading file…')} />}

      {uploadFlowState === 'processingImport' && <LoadingSpinner message={processingMessage} />}

      {uploadFlowState === 'form' && (
        <Group justify='space-between'>
          <ButtonNew size='lg' variant='light' onClick={onBackClick}>
            {backButtonLabel}
          </ButtonNew>

          <ButtonNew
            size='lg'
            onClick={onSubmit}
            disabled={!isSubmitEnabled || createImportMutation.isPending || isBusy}
          >
            {t('Upload')}
          </ButtonNew>
        </Group>
      )}
    </Stack>
  )
}
