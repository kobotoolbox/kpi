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
import type { TranslationVersionItem } from '#/components/processing/common/types'
import { isSupplementVersionAutomatic } from '#/components/processing/common/utils'
import type { AssetResponse } from '#/dataInterface'
import { notify, removeDefaultUuidPrefix } from '#/utils'
import { SUBSEQUENCES_SCHEMA_VERSION } from '../../../common/constants'
import bodyStyles from '../../../common/processingBody.module.scss'
import HeaderLanguageAndDate from './HeaderLanguageAndDate'

interface Props {
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse
  supplement: DataSupplementResponse
  activeBulkActions: BulkActionResponse[]
  translationVersion: TranslationVersionItem
  onBack: () => void
  onSave: () => void
  onUnsavedWorkChange: (hasUnsavedWork: boolean) => void
  advancedFeatures: AdvancedFeatureResponse[]
}

export default function Editor({
  asset,
  questionXpath,
  submission,
  supplement,
  activeBulkActions,
  translationVersion,
  onBack,
  onSave,
  onUnsavedWorkChange,
  advancedFeatures,
}: Props) {
  const initialValue = 'value' in translationVersion._data ? translationVersion._data.value : null
  const isUnacceptedAutomaticTranslation =
    isSupplementVersionAutomatic(translationVersion) && !translationVersion._dateAccepted
  const [value, setValue] = useState(initialValue)
  const hasUnsavedChanges = value !== initialValue || isUnacceptedAutomaticTranslation

  const hasConflictingOngoingJob = isConflictingOngoingJobForSubmission({
    activeBulkActions,
    actionType: 'translation',
    fieldXpath: questionXpath,
    submissionUuid: getSubmissionRootUuid(submission),
    selectedLanguage: translationVersion._data.language,
  })

  // Track unsaved work when value changes from initial
  useEffect(() => {
    onUnsavedWorkChange(value !== initialValue)
  }, [value, initialValue, onUnsavedWorkChange])

  const advancedFeature = advancedFeatures.find(
    (af) => af.action === ActionEnum.manual_translation && af.question_xpath === questionXpath,
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
          action: ActionEnum.manual_translation,
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
          action: ActionEnum.manual_translation,
          question_xpath: questionXpath,
          params: advancedFeature.params.concat({
            language: languageCode,
          }),
        } as any,
      })
    }
  }

  const handleSave = async () => {
    if (hasConflictingOngoingJob) return
    if (!value) return // Just a typeguard, button is disabled.
    if (value === initialValue && isSupplementVersionAutomatic(translationVersion)) {
      await patch.mutateAsync({
        uidAsset: asset.uid,
        rootUuid: removeDefaultUuidPrefix(submission['meta/rootUuid']),
        data: {
          _version: SUBSEQUENCES_SCHEMA_VERSION,
          [questionXpath]: {
            [ActionEnum.automatic_google_translation]: {
              language: translationVersion._data.language,
              accepted: true,
            },
          },
        },
      })
    } else {
      await assertManualAdvancedFeature(translationVersion._data.language)
      await patch.mutateAsync({
        uidAsset: asset.uid,
        rootUuid: removeDefaultUuidPrefix(submission['meta/rootUuid']),
        data: {
          _version: SUBSEQUENCES_SCHEMA_VERSION,
          [questionXpath]: {
            [ActionEnum.manual_translation]: {
              language: translationVersion._data.language,
              value: value,
            },
          },
        },
      })
    }

    // Clear unsaved work status after successful save
    onUnsavedWorkChange(false)
    notify(t('successfully updated'), 'success')
    onSave()
  }

  const handleDiscard = async () => {
    // While a conflicting job is active, avoid all write operations from edit mode.
    if (hasConflictingOngoingJob) {
      onBack()
      return
    }

    if (isUnacceptedAutomaticTranslation) {
      // Return to view mode and let optimistic update handle removal from UI
      onBack()
      await assertManualAdvancedFeature(translationVersion._data.language)
      await patch.mutateAsync({
        uidAsset: asset.uid,
        rootUuid: removeDefaultUuidPrefix(submission['meta/rootUuid']),
        data: {
          _version: SUBSEQUENCES_SCHEMA_VERSION,
          [questionXpath]: {
            [ActionEnum.automatic_google_translation]: {
              language: translationVersion._data.language,
              value: null,
            },
          },
        },
      })
    } else {
      // Reset value to initial to clear unsaved work status
      setValue(initialValue)
      onBack()
    }
  }

  return (
    <>
      <header className={bodyStyles.transxHeader}>
        <HeaderLanguageAndDate translationVersion={translationVersion} supplement={supplement} xpath={questionXpath} />

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
              (value === initialValue && !isUnacceptedAutomaticTranslation) ||
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
        disabled={patch.isPending || hasConflictingOngoingJob}
        dir='auto'
      />
    </>
  )
}
