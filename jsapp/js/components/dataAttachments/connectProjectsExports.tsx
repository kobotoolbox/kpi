import Checkbox from '#/components/common/checkbox'
import LoadingSpinner from '#/components/common/loadingSpinner'
import MultiCheckbox, { type MultiCheckboxItem } from '#/components/common/multiCheckbox'
import ToggleSwitch from '#/components/common/toggleSwitch'
import type { ColumnFilter } from '#/components/dataAttachments/dataAttachmentsUtils'

interface ConnectProjectsExportsProps {
  isShared: boolean
  isSharingAnyQuestions: boolean
  isLoading: boolean
  columnsToDisplay: ColumnFilter[]
  onToggleSharingData: () => void
  onSharingCheckboxChange: (checked: boolean) => void
  onColumnSelected: (items: MultiCheckboxItem[]) => void
}

export default function ConnectProjectsExports({
  isShared,
  isSharingAnyQuestions,
  isLoading,
  columnsToDisplay,
  onToggleSharingData,
  onSharingCheckboxChange,
  onColumnSelected,
}: ConnectProjectsExportsProps) {
  if (isShared) {
    return (
      <div className='connect-projects__export'>
        <div className='connect-projects__export-options'>
          <ToggleSwitch onChange={onToggleSharingData} label={t('Data sharing enabled')} checked={isShared} />

          <Checkbox
            name='sharing'
            checked={isSharingAnyQuestions}
            onChange={onSharingCheckboxChange}
            label={t('Select specific questions to share')}
          />
        </div>

        {isSharingAnyQuestions && (
          <div className='connect-projects__export-multicheckbox'>
            <span className='connect-projects__export-hint'>
              {t('Select any questions you want to share in the right side table')}
              {isLoading && <LoadingSpinner message={t('Updating shared questions')} />}
            </span>

            <MultiCheckbox type='frame' items={columnsToDisplay} disabled={isLoading} onChange={onColumnSelected} />
          </div>
        )}
      </div>
    )
  }

  return (
    <div className='connect-projects__export'>
      <div className='connect-projects__export-switch'>
        <ToggleSwitch onChange={onToggleSharingData} label={t('Data sharing disabled')} checked={isShared} />
      </div>
    </div>
  )
}
