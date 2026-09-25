import React from 'react'
import Button from '#/components/common/button'

interface SubmissionRefreshWarningProps {
  onRefresh: () => void
}

/**
 * Offers to load the record again, for when we know it has most likely changed
 * on the back end - e.g. the user has been editing it in Enketo.
 */
export default function SubmissionRefreshWarning({ onRefresh }: SubmissionRefreshWarningProps) {
  return (
    <div className='submission-modal-message-box'>
      <p>{t('Click on the button below to load the most recent data for this submission. ')}</p>

      <Button onClick={onRefresh} type='primary' size='l' label={t('Refresh submission')} />
    </div>
  )
}
