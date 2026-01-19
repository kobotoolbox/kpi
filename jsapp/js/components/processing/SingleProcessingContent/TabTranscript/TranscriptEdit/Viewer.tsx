import React from 'react'
import type { _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem } from '#/api/models/_dataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem'
import type { _DataSupplementResponseOneOfManualTranscriptionVersionsItem } from '#/api/models/_dataSupplementResponseOneOfManualTranscriptionVersionsItem'
import type { DataResponse } from '#/api/models/dataResponse'
import { queryClient } from '#/api/queryClient'
import { getAssetsDataSupplementRetrieveQueryKey, useAssetsDataSupplementPartialUpdate } from '#/api/react-query/survey-data'
import Button from '#/components/common/button'
import { userCan } from '#/components/permissions/utils'
import { SUBSEQUENCES_SCHEMA_VERSION } from '#/components/processing/common/constants'
import type { AssetResponse } from '#/dataInterface'
import { removeDefaultUuidPrefix } from '#/utils'
import bodyStyles from '../../../common/processingBody.module.scss'
import { ADVANCED_FEATURES_ACTION, isTranscriptVersionAutomatic } from '../common/utils'
import HeaderLanguageAndDate from './headerLanguageAndDate'

// TODO OpenAPI: PatchedDataSupplementPayloadOneOfOneOfManualTranscription.value is nullable

interface Props {
  transcriptVersion:
    | _DataSupplementResponseOneOfManualTranscriptionVersionsItem
    | _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse
  onEdit: () => void
}

export default function Viewer({ asset, questionXpath, submission, transcriptVersion, onEdit }: Props) {
  const mutateTrash = useAssetsDataSupplementPartialUpdate({
    mutation: {
      onSettled: () => {
        queryClient.invalidateQueries({
          queryKey: getAssetsDataSupplementRetrieveQueryKey(
            asset.uid,
            removeDefaultUuidPrefix(submission['meta/rootUuid']),
          ),
        })
      },
    },
  })

  const handleTrash = () => {
    mutateTrash.mutateAsync({
      uidAsset: asset.uid,
      rootUuid: removeDefaultUuidPrefix(submission['meta/rootUuid']),
      data: {
        _version: SUBSEQUENCES_SCHEMA_VERSION,
        [questionXpath]: {
          [isTranscriptVersionAutomatic(transcriptVersion) ? ADVANCED_FEATURES_ACTION.automatic_google_transcription : ADVANCED_FEATURES_ACTION.manual_transcription]: {
            language: transcriptVersion._data.language,
            value: null,
          },
        },
      },
    })
  }

  return (
    <>
      <header className={bodyStyles.transxHeader}>
        <HeaderLanguageAndDate transcriptVersion={transcriptVersion} />

        <nav className={bodyStyles.transxHeaderButtons}>
          <Button type='text' size='s' startIcon='edit' onClick={onEdit} tooltip={t('Edit')} />

          <Button
            type='text'
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
