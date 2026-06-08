import { modals } from '@mantine/modals'
import React from 'react'
import { MODAL_TYPES } from '#/constants'
import LibraryUploadModal from './LibraryUploadModal'
import type { LibraryUploadModalParams } from './LibraryUploadModal'

export function openLibraryUploadModal(
  params: Partial<Omit<LibraryUploadModalParams, 'type'>> & { type?: LibraryUploadModalParams['type'] } = {},
) {
  const initialType = params.type ?? MODAL_TYPES.LIBRARY_UPLOAD
  const initialTitle = initialType === MODAL_TYPES.UPLOADING_XLS ? t('Uploading XLS file') : t('Upload file')
  let modalId = ''

  modalId = modals.open({
    title: initialTitle,
    size: 'lg',
    children: (
      <LibraryUploadModal
        params={{
          type: initialType,
          file: params.file,
          filename: params.filename,
          onBack: params.onBack,
        }}
        onTitleChange={(title) => {
          modals.updateModal({
            modalId,
            title,
          })
        }}
        onRequestClose={() => {
          modals.close(modalId)
        }}
      />
    ),
  })

  return {
    modalId,
    close: () => modals.close(modalId),
  }
}
