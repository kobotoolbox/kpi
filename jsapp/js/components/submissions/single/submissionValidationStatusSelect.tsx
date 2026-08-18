import { Loader } from '@mantine/core'
import React from 'react'
import Select from '#/components/common/Select'
import { userCan, userHasPermForSubmission } from '#/components/permissions/utils'
import {
  VALIDATION_STATUS_OPTIONS,
  ValidationStatusAdditionalName,
} from '#/components/submissions/validationStatus.constants'
import type { ValidationStatusOptionName } from '#/components/submissions/validationStatus.constants'
import type { AssetResponse, SubmissionResponse } from '#/dataInterface'

interface SubmissionValidationStatusSelectProps {
  asset: AssetResponse
  submission: SubmissionResponse
  /** While a change is on its way to the API. */
  isPending: boolean
  onChange: (newValidationStatus: ValidationStatusOptionName) => void
}

/**
 * Sets the record's validation status. Renders nothing for an archived form,
 * which offers no actions on its data.
 */
export default function SubmissionValidationStatusSelect({
  asset,
  submission,
  isPending,
  onChange,
}: SubmissionValidationStatusSelectProps) {
  if (!asset.deployment__active) {
    return null
  }

  const selectedOption = 'uid' in submission._validation_status ? submission._validation_status.uid : null

  const canValidate =
    userCan('validate_submissions', asset) || userHasPermForSubmission('validate_submissions', asset, submission)

  return (
    <Select<ValidationStatusOptionName>
      className='submission-modal-validation-status'
      label={t('Validation status:')}
      size='xs'
      clearable={false}
      data={VALIDATION_STATUS_OPTIONS}
      value={selectedOption}
      onChange={(newSelectedOption) => {
        onChange(newSelectedOption ?? ValidationStatusAdditionalName.no_status)
      }}
      rightSection={isPending ? <Loader size='xs' /> : undefined}
      disabled={isPending || !canValidate}
    />
  )
}
