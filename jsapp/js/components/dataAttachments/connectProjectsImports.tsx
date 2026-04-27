import { Group, Modal, Text } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import React, { useState } from 'react'
import ButtonNew from '#/components/common/ButtonNew'
import LoadingSpinner from '#/components/common/loadingSpinner'
import TextBox from '#/components/common/textBox'
import type { AssetResponse } from '#/dataInterface'
import ActionIcon from '../common/ActionIcon'
import Icon from '../common/icon'
import type { AttachedSourceItem } from './common'

interface ConnectProjectsImportsProps {
  selectComponent: React.ReactNode
  newFilename: string
  fieldsErrors: Record<string, string>
  onFilenameChange: (newVal: string) => void
  onConfirmAttachment: (evt: React.MouseEvent<HTMLButtonElement>) => void
  isInitialised: boolean
  isLoading: boolean
  attachedSources: AttachedSourceItem[]
  showColumnFilterModal: (
    source: Pick<AssetResponse, 'uid' | 'name' | 'url'>,
    filename: string,
    fields: string[],
    attachmentUrl?: string,
  ) => void
  onRemoveAttachment: (attachmentUrl: string) => void
}

export default function ConnectProjectsImports({
  selectComponent,
  newFilename,
  fieldsErrors,
  onFilenameChange,
  onConfirmAttachment,
  isInitialised,
  isLoading,
  attachedSources,
  showColumnFilterModal,
  onRemoveAttachment,
}: ConnectProjectsImportsProps) {
  const [attachmentToRemove, setAttachmentToRemove] = useState<string | null>(null)
  const [isRemovalModalOpened, { open: openRemovalModal, close: closeRemovalModal }] = useDisclosure(false)

  const openRemovalConfirmation = (attachmentUrl: string) => {
    setAttachmentToRemove(attachmentUrl)
    openRemovalModal()
  }

  const closeRemovalConfirmation = () => {
    setAttachmentToRemove(null)
    closeRemovalModal()
  }

  const confirmRemoval = () => {
    if (!attachmentToRemove) {
      closeRemovalConfirmation()
      return
    }

    onRemoveAttachment(attachmentToRemove)
    closeRemovalConfirmation()
  }

  return (
    <>
      <Modal opened={isRemovalModalOpened} onClose={closeRemovalConfirmation} title={t('Remove project?')}>
        <Text>{t('Are you sure you want to remove imported project?')}</Text>
        <Group justify='flex-end' mt='md'>
          <ButtonNew size='md' onClick={closeRemovalConfirmation}>
            {t('Cancel')}
          </ButtonNew>
          <ButtonNew size='md' variant='danger' onClick={confirmRemoval} disabled={isLoading}>
            {t('Remove project')}
          </ButtonNew>
        </Group>
      </Modal>

      <div className='connect-projects__import'>
        <div className='connect-projects__import-form'>
          {selectComponent}

          <TextBox
            className='connect-projects-textbox'
            placeholder={t('Give a unique name to the import')}
            value={newFilename}
            size='m'
            onChange={onFilenameChange}
            errors={fieldsErrors.filename}
          />

          <ButtonNew variant='filled' size='md' onClick={onConfirmAttachment}>
            {t('Import')}
          </ButtonNew>
        </div>

        <h3 className='connect-projects__list-header'>{t('Imported')}</h3>

        <ul className='connect-projects__import-list'>
          {(!isInitialised || isLoading) && (
            <li className='connect-projects__import-list-item'>
              <LoadingSpinner message={t('Loading imported projects')} />
            </li>
          )}

          {isInitialised && !isLoading && attachedSources.length === 0 && (
            <li className='connect-projects__import-list-item--no-imports'>{t('No data imported')}</li>
          )}

          {!isLoading &&
            attachedSources.length > 0 &&
            attachedSources.map((item) => (
              <li key={item.attachmentUrl} className='connect-projects__import-list-item'>
                <Icon
                  size='xl'
                  name={item.isSourceDeleted ? 'close' : 'check'}
                  color={item.isSourceDeleted ? 'mid-red' : 'blue'}
                />

                <div className='connect-projects__import-labels'>
                  <span className='connect-projects__import-labels-filename'>{item.filename}</span>

                  <span className='connect-projects__import-labels-source'>{item.sourceName}</span>
                </div>

                <div className='connect-projects__import-options'>
                  <ActionIcon
                    variant='light'
                    size='md'
                    iconName='settings'
                    tooltip={item.isSourceDeleted ? t('Cannot configure deleted project') : t('Configure')}
                    disabled={item.isSourceDeleted || !item.sourceUid || !item.sourceUrl}
                    onClick={() =>
                      showColumnFilterModal(
                        {
                          uid: item.sourceUid,
                          name: item.sourceName,
                          url: item.sourceUrl,
                        },
                        item.filename,
                        item.linkedFields,
                        item.attachmentUrl,
                      )
                    }
                  />

                  <ActionIcon
                    variant='danger-secondary'
                    size='md'
                    iconName='trash'
                    tooltip={t('Remove')}
                    onClick={() => openRemovalConfirmation(item.attachmentUrl)}
                  />
                </div>
              </li>
            ))}
        </ul>
      </div>
    </>
  )
}
