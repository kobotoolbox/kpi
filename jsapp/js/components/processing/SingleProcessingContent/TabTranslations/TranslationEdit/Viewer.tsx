import React from 'react'
import { destroyConfirm } from '#/alertify'
import { ActionEnum } from '#/api/models/actionEnum'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import { useAssetsDataSupplementPartialUpdate } from '#/api/react-query/survey-data'
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
import { SUBSEQUENCES_SCHEMA_VERSION } from '../../../common/constants'
import bodyStyles from '../../../common/processingBody.module.scss'
import HeaderLanguageAndDate from './HeaderLanguageAndDate'
import styles from './Viewer.module.scss'

interface Props {
  translationVersion: TranslationVersionItem
  translationVersions: Array<TranslationVersionItem>
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse
  supplement: DataSupplementResponse
  activeBulkActions: BulkActionResponse[]
  onEdit: () => void
  onAdd: () => void
  onChangeLanguageCode: (languageCode: LanguageCode) => void
}

export default function Viewer({
  asset,
  questionXpath,
  submission,
  supplement,
  activeBulkActions,
  translationVersion,
  translationVersions,
  onEdit,
  onAdd,
  onChangeLanguageCode,
}: Props) {
  const mutateTrash = useAssetsDataSupplementPartialUpdate()

  const hasConflictingOngoingJob = isConflictingOngoingJobForSubmission({
    activeBulkActions,
    actionType: 'translation',
    fieldXpath: questionXpath,
    submissionUuid: getSubmissionRootUuid(submission),
    selectedLanguage: translationVersion._data.language,
  })

  const handleTrash = () => {
    destroyConfirm(() => {
      mutateTrash.mutateAsync({
        uidAsset: asset.uid,
        rootUuid: getSubmissionRootUuid(submission),
        data: {
          _version: SUBSEQUENCES_SCHEMA_VERSION,
          [questionXpath]: {
            [isSupplementVersionAutomatic(translationVersion)
              ? ActionEnum.automatic_google_translation
              : ActionEnum.manual_translation]: {
              language: translationVersion._data.language,
              value: null,
            },
          },
        },
      })
    }, t('Delete translation?'))
  }

  return (
    <>
      <header className={bodyStyles.transxHeader}>
        <HeaderLanguageAndDate
          supplement={supplement}
          xpath={questionXpath}
          translationVersion={translationVersion}
          translationVersions={translationVersions}
          onChangeLanguageCode={onChangeLanguageCode}
        />

        <nav className={bodyStyles.transxHeaderButtons}>
          <Button
            type='secondary'
            size='s'
            startIcon='plus'
            label={
              <>
                <span className={styles.newButtonLabel}>{t('new translation')}</span>
                <span className={styles.newButtonLabelShort}>{t('new')}</span>
              </>
            }
            onClick={onAdd}
            isDisabled={!userCan('change_submissions', asset)}
          />

          <Button
            type='secondary'
            size='s'
            startIcon='edit'
            onClick={onEdit}
            tooltip={t('Edit')}
            isDisabled={!userCan('change_submissions', asset) || hasConflictingOngoingJob}
          />

          <Button
            type='secondary-danger'
            size='s'
            startIcon='trash'
            onClick={handleTrash}
            tooltip={t('Delete')}
            isPending={mutateTrash.isPending}
            isDisabled={!userCan('change_submissions', asset) || hasConflictingOngoingJob}
          />
        </nav>
      </header>

      {hasConflictingOngoingJob && <ConflictingOngoingJobAlert mb='md' />}

      <article className={bodyStyles.text} dir='auto'>
        {
          'value' in translationVersion._data
            ? translationVersion._data.value
            : '' /** typeguard, should always exist */
        }
      </article>
    </>
  )
}
