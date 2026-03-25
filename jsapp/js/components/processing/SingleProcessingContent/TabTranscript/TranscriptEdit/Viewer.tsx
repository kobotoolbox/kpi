import React from 'react'
import { destroyConfirm } from '#/alertify'
import { ActionEnum } from '#/api/models/actionEnum'
import type { DataResponse } from '#/api/models/dataResponse'
import type { DataSupplementResponse } from '#/api/models/dataSupplementResponse'
import { useAssetsDataSupplementPartialUpdate } from '#/api/react-query/survey-data'
import Button from '#/components/common/button'
import { userCan } from '#/components/permissions/utils'
import type { TranscriptVersionItem } from '#/components/processing/common/types'
import { isSupplementVersionAutomatic } from '#/components/processing/common/utils'
import type { AssetResponse } from '#/dataInterface'
import { removeDefaultUuidPrefix } from '#/utils'
import { SUBSEQUENCES_SCHEMA_VERSION } from '../../../common/constants'
import bodyStyles from '../../../common/processingBody.module.scss'
import HeaderLanguageAndDate from './headerLanguageAndDate'

interface Props {
  transcriptVersion: TranscriptVersionItem
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse
  supplement: DataSupplementResponse
  onEdit: () => void
}

export default function Viewer({ asset, questionXpath, submission, supplement, transcriptVersion, onEdit }: Props) {
  const mutateTrash = useAssetsDataSupplementPartialUpdate()

  const handleTrash = () => {
    destroyConfirm(() => {
      mutateTrash.mutateAsync({
        uidAsset: asset.uid,
        rootUuid: removeDefaultUuidPrefix(submission['meta/rootUuid']),
        data: {
          _version: SUBSEQUENCES_SCHEMA_VERSION,
          [questionXpath]: {
            [isSupplementVersionAutomatic(transcriptVersion)
              ? ActionEnum.automatic_google_transcription
              : ActionEnum.manual_transcription]: {
              language: transcriptVersion._data.language,
              value: null,
            },
          },
        },
      })
    }, t('Delete transcription?'))
  }

  return (
    <>
      <header className={bodyStyles.transxHeader}>
        <HeaderLanguageAndDate transcriptVersion={transcriptVersion} supplement={supplement} xpath={questionXpath} />

        <nav className={bodyStyles.transxHeaderButtons}>
          <Button
            type='secondary'
            size='s'
            startIcon='edit'
            onClick={onEdit}
            tooltip={t('Edit')}
            isDisabled={!userCan('change_submissions', asset)}
          />

          <Button
            type='secondary-danger'
            size='s'
            startIcon='trash'
            onClick={handleTrash}
            tooltip={t('Delete')}
            isPending={mutateTrash.isPending}
            isDisabled={!userCan('change_submissions', asset)}
          />
        </nav>
      </header>

      <article className={bodyStyles.text} dir='auto'>
        {'value' in transcriptVersion._data ? transcriptVersion._data.value : '' /** typeguard, should always exist */}
      </article>
    </>
  )
}
