import React, { useEffect, useState } from 'react'
import { ActionEnum } from '#/api/models/actionEnum'
import type { AdvancedFeatureResponse } from '#/api/models/advancedFeatureResponse'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import {
  useAssetsAdvancedFeaturesCreate,
  useAssetsAdvancedFeaturesPartialUpdate,
  useAssetsDataSupplementPartialUpdate,
} from '#/api/react-query/survey-data'
import Button from '#/components/common/button'
import type { LanguageCode } from '#/components/languages/languagesStore'
import { userCan } from '#/components/permissions/utils'
import ConflictingOngoingJobAlert from '#/components/processing/common/ConflictingOngoingJobAlert'
import {
  getSubmissionRootUuid,
  isConflictingOngoingJobForSubmission,
} from '#/components/processing/common/conflictingOngoingJob'
import type { TranscriptVersionItem } from '#/components/processing/common/types'
import { isSupplementVersionAutomatic } from '#/components/processing/common/utils'
import type { AssetResponse } from '#/dataInterface'
import { notify } from '#/utils'
import { SUBSEQUENCES_SCHEMA_VERSION } from '../../../common/constants'
import bodyStyles from '../../../common/processingBody.module.scss'
import HeaderLanguageAndDate from './headerLanguageAndDate'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse
  supplement: DataSupplementResponse
  activeBulkActions: BulkActionResponse[]
  transcriptVersion: TranscriptVersionItem
  onBack: () => void
  onSave?: () => void
  onUnsavedWorkChange: (hasUnsavedWork: boolean) => void
  advancedFeatures: AdvancedFeatureResponse[]
}

export default function Editor({
  asset,
  questionXpath,
  submission,
  supplement,
  activeBulkActions,
  transcriptVersion,
  onBack,
  onSave,
  onUnsavedWorkChange,
  advancedFeatures,
}: Props) {
  const initialValue = 'value' in transcriptVersion._data ? transcriptVersion._data.value : null
  const unacceptedAutomaticTranscript =
    isSupplementVersionAutomatic(transcriptVersion) && !transcriptVersion._dateAccepted
  const [value, setValue] = useState(initialValue)
  const hasUnsavedChanges = value !== initialValue || unacceptedAutomaticTranscript

  const hasConflictingOngoingJob = isConflictingOngoingJobForSubmission({
    activeBulkActions,
    actionType: 'transcript',
    fieldXpath: questionXpath,
    submissionUuid: getSubmissionRootUuid(submission),
    selectedLanguage: transcriptVersion._data.language,
  })

  // Track unsaved work when value changes from initial
  useEffect(() => {
    onUnsavedWorkChange(value !== initialValue)
  }, [value, initialValue, onUnsavedWorkChange])

  const advancedFeature = advancedFeatures.find(
    (af) => af.action === ActionEnum.manual_transcription && af.question_xpath === questionXpath,
  )

  const patch = useAssetsDataSupplementPartialUpdate()

  const mutationCreateAF = useAssetsAdvancedFeaturesCreate()
  const mutationPatchAF = useAssetsAdvancedFeaturesPartialUpdate()
  const assertManualAdvancedFeature = async (languageCode: LanguageCode) => {
    // Silently under the hook enable advanced features if needed.
    if (!advancedFeature) {
      await mutationCreateAF.mutateAsync({
        uidAsset: asset.uid,
        data: {
          question_xpath: questionXpath,
          action: ActionEnum.manual_transcription,
          params: [
            {
              language: languageCode,
            },
          ],
        },
      })
    } else if (!advancedFeature?.params.find((param) => 'language' in param && param.language === languageCode)) {
      await mutationPatchAF.mutateAsync({
        uidAsset: asset.uid,
        uidAdvancedFeature: advancedFeature.uid,
        data: {
          action: ActionEnum.manual_transcription,
          question_xpath: questionXpath,
          params: advancedFeature.params.concat({
            language: languageCode,
          }),
        } as any,
      })
    }
  }

  const handleSave = async () => {
    // Button state can lag behind fresh data for a moment, so keep this check
    // here too and bail out if a conflicting job has just appeared.
    if (hasConflictingOngoingJob) return
    if (!value) return // Just a typeguard, button is disabled.
    if (value === initialValue && isSupplementVersionAutomatic(transcriptVersion)) {
      await patch.mutateAsync({
        uidAsset: asset.uid,
        rootUuid: getSubmissionRootUuid(submission),
        data: {
          _version: SUBSEQUENCES_SCHEMA_VERSION,
          [questionXpath]: {
            [ActionEnum.automatic_google_transcription]: {
              language: transcriptVersion._data.language,
              accepted: true,
            },
          },
        },
      })
    } else {
      await assertManualAdvancedFeature(transcriptVersion._data.language)
      await patch.mutateAsync({
        uidAsset: asset.uid,
        rootUuid: getSubmissionRootUuid(submission),
        data: {
          _version: SUBSEQUENCES_SCHEMA_VERSION,
          [questionXpath]: {
            [ActionEnum.manual_transcription]: {
              language: transcriptVersion._data.language,
              value: value,
            },
          },
        },
      })
    }

    // Clear unsaved work status after successful save
    onUnsavedWorkChange(false)
    notify(t('successfully updated'), 'success')
    if (onSave) {
      onSave()
    }
  }

  const handleDiscard = async () => {
    // While a conflicting job is active, avoid all write operations from edit mode.
    if (hasConflictingOngoingJob) {
      onBack()
      return
    }

    if (unacceptedAutomaticTranscript) {
      await assertManualAdvancedFeature(transcriptVersion._data.language)
      await patch.mutateAsync({
        uidAsset: asset.uid,
        rootUuid: getSubmissionRootUuid(submission),
        data: {
          _version: SUBSEQUENCES_SCHEMA_VERSION,
          [questionXpath]: {
            [ActionEnum.automatic_google_transcription]: {
              language: transcriptVersion._data.language,
              value: null,
            },
          },
        },
      })
      // TODO: add some spinner while this loads.
    }

    // Reset value to initial to clear unsaved work status
    setValue(initialValue)
    onBack()
  }

  return (
    <>
      <header className={bodyStyles.transxHeader}>
        <HeaderLanguageAndDate transcriptVersion={transcriptVersion} supplement={supplement} xpath={questionXpath} />

        <nav className={bodyStyles.transxHeaderButtons}>
          <Button
            type='secondary'
            size='s'
            label={hasConflictingOngoingJob ? t('Back') : hasUnsavedChanges ? t('Discard') : t('Back')}
            onClick={handleDiscard}
            isDisabled={patch.isPending || (!hasConflictingOngoingJob && !userCan('change_submissions', asset))}
          />

          <Button
            type='primary'
            size='s'
            label={t('Save')}
            onClick={handleSave}
            isPending={patch.isPending}
            isDisabled={
              hasConflictingOngoingJob ||
              !value ||
              (value === initialValue && !unacceptedAutomaticTranscript) ||
              !userCan('change_submissions', asset)
            }
          />
        </nav>
      </header>

      {hasConflictingOngoingJob && <ConflictingOngoingJobAlert mb='md' />}

      <textarea
        className={bodyStyles.textarea}
        value={value || ''}
        onChange={(evt: React.ChangeEvent<HTMLTextAreaElement>) => setValue(evt.target.value)}
        disabled={hasConflictingOngoingJob}
        dir='auto'
      />
    </>
  )
}
