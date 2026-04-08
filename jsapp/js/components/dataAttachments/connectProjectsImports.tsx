import Button from '#/components/common/button'
import LoadingSpinner from '#/components/common/loadingSpinner'
import TextBox from '#/components/common/textBox'
import type { AssetResponse } from '#/dataInterface'
import type { AttachedSourceItem } from './connectProjects.types'

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
  return (
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

        <Button type='primary' size='m' onClick={onConfirmAttachment} label={t('Import')} />
      </div>

      <ul className='connect-projects__import-list'>
        <label>{t('Imported')}</label>

        {(!isInitialised || isLoading) && (
          <div className='connect-projects__import-list-item'>
            <LoadingSpinner message={t('Loading imported projects')} />
          </div>
        )}

        {!isLoading && attachedSources.length === 0 && (
          <li className='connect-projects__import-list-item--no-imports'>{t('No data imported')}</li>
        )}

        {!isLoading &&
          attachedSources.length > 0 &&
          attachedSources.map((item) => (
            <li key={item.attachmentUrl} className='connect-projects__import-list-item'>
              <i className='k-icon k-icon-check' />

              <div className='connect-projects__import-labels'>
                <span className='connect-projects__import-labels-filename'>{item.filename}</span>

                <span className='connect-projects__import-labels-source'>{item.sourceName}</span>
              </div>

              <div className='connect-projects__import-options'>
                <Button
                  type='secondary'
                  size='m'
                  startIcon='settings'
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

                <Button
                  type='secondary-danger'
                  size='m'
                  startIcon='trash'
                  onClick={() => onRemoveAttachment(item.attachmentUrl)}
                />
              </div>
            </li>
          ))}
      </ul>
    </div>
  )
}
