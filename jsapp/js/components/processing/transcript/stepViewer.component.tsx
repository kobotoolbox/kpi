import React, { useState } from 'react'

import { useParams } from 'react-router-dom'
import type { _DataSupplementResponseOneOfOneOfManualTranscriptionVersionsItem } from '#/api/models/_dataSupplementResponseOneOfOneOfManualTranscriptionVersionsItem'
import { useAssetsDataSupplementPartialUpdate } from '#/api/react-query/survey-data'
import Button from '#/components/common/button'
import bodyStyles from '#/components/processing/processingBody.module.scss'
import { hasChangeSubPermissionToCurrentAsset } from '../analysis/utils'
import HeaderLanguageAndDate from './headerLanguageAndDate.component'
import StepEditor from './stepEditor.component'

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

  if (edit) return <StepEditor draft={transcript} />

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
            isDisabled={!hasChangeSubPermissionToCurrentAsset()}
          />
        </nav>
      </header>

      <article className={bodyStyles.text} dir='auto'>
        {transcript?._data.value}
      </article>
    </div>
  )
}
