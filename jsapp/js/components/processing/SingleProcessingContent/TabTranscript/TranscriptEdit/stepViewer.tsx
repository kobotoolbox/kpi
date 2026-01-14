import React, { useState } from 'react'

import { useParams } from 'react-router-dom'
import type { _DataSupplementResponseOneOfOneOfManualTranscriptionVersionsItem } from '#/api/models/_dataSupplementResponseOneOfOneOfManualTranscriptionVersionsItem'
import { useAssetsDataSupplementPartialUpdate } from '#/api/react-query/survey-data'
import assetStore from '#/assetStore'
import Button from '#/components/common/button'
import { userCan } from '#/components/permissions/utils'
import bodyStyles from '../../common/processingBody.module.scss'
import HeaderLanguageAndDate from './headerLanguageAndDate'
import StepEditor from './stepEditor'

// TODO OpenAPI: PatchedDataSupplementPayloadOneOfOneOfManualTranscription.value is nullable

interface RouteParams extends Record<string, string | undefined> {
  uid: string
  xpath: string
  submissionEditId: string
}

export default function StepViewer({
  transcript,
}: { transcript: _DataSupplementResponseOneOfOneOfManualTranscriptionVersionsItem }) {
  const { uid, xpath, submissionEditId } = useParams<RouteParams>()
  const [edit, setEdit] = useState(false)

  const mutateTrash = useAssetsDataSupplementPartialUpdate({ mutation: {} })

  const handleTrash = () => {
    mutateTrash.mutateAsync({
      uidAsset: uid!,
      rootUuid: submissionEditId!,
      data: {
        _version: '',
        [xpath!]: { manual_transcription: { language: transcript!._data.language, value: null as any } },
      },
    })
  }

  if (edit) return <StepEditor assetUid={uid!} draft={transcript} />

  return (
    <div className={bodyStyles.root}>
      <header className={bodyStyles.transxHeader}>
        <HeaderLanguageAndDate />

        <nav className={bodyStyles.transxHeaderButtons}>
          <Button
            type='text'
            size='s'
            startIcon='edit'
            onClick={() => setEdit(true)}
            tooltip={t('Edit')}
            isDisabled={edit}
          />

          <Button
            type='text'
            size='s'
            startIcon='trash'
            onClick={handleTrash}
            tooltip={t('Delete')}
            isPending={mutateTrash.isPending}
            isDisabled={!userCan('change_submissions', assetStore.getAsset(uid!))}
          />
        </nav>
      </header>

      <article className={bodyStyles.text} dir='auto'>
        {transcript?._data.value}
      </article>
    </div>
  )
}
