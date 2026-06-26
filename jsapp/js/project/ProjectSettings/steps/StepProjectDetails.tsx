import cx from 'classnames'
import React from 'react'
import { queryClient } from '#/api/queryClient'
import { getOrganizationsRetrieveQueryKey } from '#/api/react-query/user-team-organization-usage'
import Button from '#/components/common/button'
import TextBox from '#/components/common/textBox'
import WrappedSelect from '#/components/common/wrappedSelect'
import ExtraProjectMetadataFields from '#/components/modalForms/ExtraProjectMetadataFields'
import { userCan } from '#/components/permissions/utils'
import { PROJECT_SETTINGS_CONTEXTS } from '#/constants'
import type { AssetResponse, LabelValuePair } from '#/dataInterface'
import envStore from '#/envStore'
import sessionStore from '#/stores/session'
import { addRequiredToLabel } from '#/textUtils'
import styles from '../ProjectSettings.module.scss'
import BackButton from '../components/BackButton'
import type { StepName } from '../constants'
import type { ProjectSettingsContext, ProjectSettingsFields } from '../types'
import { getFieldMetadata, getNameInputLabel } from '../utils'

interface StepProjectDetailsProps {
  context: ProjectSettingsContext
  fields: ProjectSettingsFields
  formAsset?: AssetResponse
  isSubmitPending: boolean
  hasFieldError: (fieldName: string) => boolean
  onNameChange: (newValue: string) => void
  onDescriptionChange: (newValue: string) => void
  onAnyFieldChange: (
    fieldName: string,
    newFieldValue: string | string[] | LabelValuePair | LabelValuePair[] | null,
  ) => void
  onSubmit: (evt: React.FormEvent<HTMLFormElement> | React.MouseEvent<HTMLButtonElement>) => void
  onArchiveProject: (evt: React.MouseEvent<HTMLButtonElement>) => void
  onUnarchiveProject: (evt: React.MouseEvent<HTMLButtonElement>) => void
  onDeleteProject: (evt: React.MouseEvent<HTMLButtonElement>) => void
  isArchivable: () => boolean
  isArchived: () => boolean
  previousStep: StepName | null
  onBack: () => void
  modalStyle: string | null
}

export default function StepProjectDetails({
  context,
  fields,
  formAsset,
  isSubmitPending,
  hasFieldError,
  onNameChange,
  onDescriptionChange,
  onAnyFieldChange,
  onSubmit,
  onArchiveProject,
  onUnarchiveProject,
  onDeleteProject,
  isArchivable,
  isArchived,
  previousStep,
  onBack,
  modalStyle,
}: StepProjectDetailsProps) {
  const sectorField = getFieldMetadata('sector')
  const sectors = envStore.data.sector_choices
  const countryField = getFieldMetadata('country')
  const countries = envStore.data.country_choices
  const bothCountryAndSector = sectorField && countryField
  const operationalPurposeField = getFieldMetadata('operational_purpose')
  const operationalPurposes = envStore.data.operational_purpose_choices
  const collectsPiiField = getFieldMetadata('collects_pii')
  const descriptionField = getFieldMetadata('description')

  // Check if user is in a Multi-Member Organization (MMO)
  // MMO members should always see the delete button, even without delete_asset permission,
  // so they can click it and see the error explaining why they can't delete
  const isMMO = () => {
    const account = sessionStore.currentAccount
    const orgUid = 'organization' in account ? account.organization?.uid : undefined
    if (orgUid) {
      const orgResponse = queryClient.getQueryData(getOrganizationsRetrieveQueryKey(orgUid)) as any
      if (orgResponse?.status === 200 && orgResponse.data?.is_mmo) {
        return true
      }
    }
    return false
  }

  const userCanViewDeleteButton = isMMO() || userCan('delete_asset', formAsset)

  return (
    <form onSubmit={onSubmit} className={cx(styles.projectDetails, modalStyle ?? styles.projectDetailsView)}>
      {context === PROJECT_SETTINGS_CONTEXTS.EXISTING && (
        <div className={styles.saveChanges}>
          <Button type='primary' size='l' isSubmit onClick={onSubmit} label={t('Save Changes')} />
        </div>
      )}
      <div className={styles.inputWrapper}>
        {/* Project Name */}
        <div className={styles.input}>
          <TextBox
            value={fields.name}
            onChange={onNameChange}
            errors={hasFieldError('name') ? t('Please enter a title for your project!') : false}
            label={addRequiredToLabel(getNameInputLabel(fields.name))}
            placeholder={t('Enter title of project here')}
          />
        </div>

        {/* Description */}
        {descriptionField && (
          <div className={styles.input}>
            <TextBox
              type='text-multiline'
              value={fields.description}
              onChange={onDescriptionChange}
              errors={hasFieldError('description') ? t('Please enter a description for your project') : false}
              label={addRequiredToLabel(descriptionField.label, descriptionField.required)}
              placeholder={t('Enter short description here')}
            />
          </div>
        )}

        {/* Sector */}
        {sectorField && (
          <div className={cx(styles.input, bothCountryAndSector ? styles.sector : null)}>
            <WrappedSelect
              label={addRequiredToLabel(sectorField.label, sectorField.required)}
              value={fields.sector}
              onChange={(newValue) => onAnyFieldChange('sector', newValue as LabelValuePair | null)}
              options={sectors}
              isLimitedHeight
              menuPlacement='top'
              isClearable
              error={hasFieldError('sector') ? t('Please choose a sector') : undefined}
            />
          </div>
        )}

        {/* Country */}
        {countryField && (
          <div className={cx(styles.input, bothCountryAndSector ? styles.country : null)}>
            <WrappedSelect
              label={addRequiredToLabel(countryField.label, countryField.required)}
              isMulti
              value={fields.country}
              onChange={(newValue) => onAnyFieldChange('country', newValue as LabelValuePair[] | null)}
              options={countries}
              isLimitedHeight
              menuPlacement='top'
              isClearable
              error={hasFieldError('country') ? t('Please select at least one country') : undefined}
            />
          </div>
        )}

        {/* Operational Purpose of Data */}
        {operationalPurposeField && (
          <div className={styles.input}>
            <WrappedSelect
              label={addRequiredToLabel(operationalPurposeField.label, operationalPurposeField.required)}
              value={fields.operational_purpose}
              onChange={(newValue) => onAnyFieldChange('operational_purpose', newValue as LabelValuePair | null)}
              options={operationalPurposes}
              isLimitedHeight
              isClearable
              error={
                hasFieldError('operational_purpose')
                  ? t('Please specify the operational purpose of your project')
                  : undefined
              }
            />
          </div>
        )}

        {/* Does this project collect personally identifiable information? */}
        {collectsPiiField && (
          <div className={styles.input}>
            <WrappedSelect
              label={addRequiredToLabel(collectsPiiField.label, collectsPiiField.required)}
              value={fields.collects_pii}
              onChange={(newValue) => onAnyFieldChange('collects_pii', newValue as LabelValuePair | null)}
              options={[
                { value: 'Yes', label: t('Yes') },
                { value: 'No', label: t('No') },
              ]}
              isClearable
              error={
                hasFieldError('collects_pii')
                  ? t('Please indicate whether or not your project collects personally identifiable information')
                  : undefined
              }
            />
          </div>
        )}

        {/* Extra Project Metadata */}
        <ExtraProjectMetadataFields
          values={fields.extra_metadata_fields}
          onChange={onAnyFieldChange}
          hasFieldError={hasFieldError}
          fieldClassName={styles.input}
        />

        {(context === PROJECT_SETTINGS_CONTEXTS.NEW || context === PROJECT_SETTINGS_CONTEXTS.REPLACE) && (
          <div className={styles.modalFooter}>
            {/* Don't allow going back if asset already exist */}
            {!formAsset && <BackButton previousStep={previousStep} isDisabled={false} onClick={onBack} />}

            <Button
              type='primary'
              size='l'
              isSubmit
              onClick={onSubmit}
              isDisabled={isSubmitPending}
              label={
                <>
                  {isSubmitPending && t('Please wait…')}
                  {!isSubmitPending && context === PROJECT_SETTINGS_CONTEXTS.NEW && t('Create project')}
                  {!isSubmitPending && context === PROJECT_SETTINGS_CONTEXTS.REPLACE && t('Save')}
                </>
              }
            />
          </div>
        )}

        {userCan('manage_asset', formAsset) && context === PROJECT_SETTINGS_CONTEXTS.EXISTING && (
          <div className={styles.input}>
            <div className={cx(styles.input, styles.inputInline)}>
              {isArchived() && (
                <Button type='secondary' size='l' label={t('Unarchive Project')} onClick={onUnarchiveProject} />
              )}

              {isArchivable() && (
                <Button type='secondary' size='l' label={t('Archive Project')} onClick={onArchiveProject} />
              )}
            </div>

            {isArchivable() && (
              <div className={cx(styles.input, styles.inputInline)}>
                {t('Archive project to stop accepting submissions.')}
              </div>
            )}
            {isArchived() && (
              <div className={cx(styles.input, styles.inputInline)}>
                {t('Unarchive project to resume accepting submissions.')}
              </div>
            )}
          </div>
        )}

        {userCanViewDeleteButton && context === PROJECT_SETTINGS_CONTEXTS.EXISTING && (
          <div className={styles.input}>
            <Button
              type='danger'
              size='l'
              label={formAsset!.deployment__submission_count > 0 ? t('Delete Project and Data') : t('Delete Project')}
              onClick={onDeleteProject}
            />
          </div>
        )}
      </div>
    </form>
  )
}
