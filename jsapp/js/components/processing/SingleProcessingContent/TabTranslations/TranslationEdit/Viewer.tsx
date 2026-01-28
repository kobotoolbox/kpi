import React from 'react'
import type { _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem } from '#/api/models/_dataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem'
import type { _DataSupplementResponseOneOfManualTranscriptionVersionsItem } from '#/api/models/_dataSupplementResponseOneOfManualTranscriptionVersionsItem'
import { ActionEnum } from '#/api/models/actionEnum'
import type { DataResponse } from '#/api/models/dataResponse'
import { useAssetsDataSupplementPartialUpdate } from '#/api/react-query/survey-data'
import Button from '#/components/common/button'
import type { LanguageCode } from '#/components/languages/languagesStore'
import { userCan } from '#/components/permissions/utils'
import { isSupplementVersionAutomatic } from '#/components/processing/common/utils'
import type { AssetResponse } from '#/dataInterface'
import { removeDefaultUuidPrefix } from '#/utils'
import { SUBSEQUENCES_SCHEMA_VERSION } from '../../../common/constants'
import bodyStyles from '../../../common/processingBody.module.scss'
import HeaderLanguageAndDate from './HeaderLanguageAndDate'
import styles from './Viewer.module.scss'

// TODO OpenAPI: PatchedDataSupplementPayloadOneOfOneOfManualTranscription.value is nullable

interface Props {
  translationVersion:
    | _DataSupplementResponseOneOfManualTranscriptionVersionsItem
    | _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem
  translationVersions: Array<
    | _DataSupplementResponseOneOfManualTranscriptionVersionsItem
    | _DataSupplementResponseOneOfAutomaticGoogleTranscriptionVersionsItem
  >
  asset: AssetResponse
  questionXpath: string
  submission: DataResponse
  onEdit: () => void
  onAdd: () => void
  onChangeLanguageCode: (languageCode: LanguageCode) => void
}

export default function Viewer({
  asset,
  questionXpath,
  submission,
  translationVersion,
  translationVersions,
  onEdit,
  onAdd,
  onChangeLanguageCode,
}: Props) {
  const mutateTrash = useAssetsDataSupplementPartialUpdate()

  const handleTrash = () => {
    mutateTrash.mutateAsync({
      uidAsset: asset.uid,
      rootUuid: removeDefaultUuidPrefix(submission['meta/rootUuid']),
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
  }

  return (
    <>
      <header className={bodyStyles.transxHeader}>
        <HeaderLanguageAndDate
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
        {
          'value' in translationVersion._data
            ? translationVersion._data.value
            : '' /** typeguard, should always exist */
        }
      </article>
    </>
  )
}
