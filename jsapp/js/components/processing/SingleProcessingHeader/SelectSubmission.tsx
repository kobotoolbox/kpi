import React, { useCallback } from 'react'
import {
  type assetsDataListResponse,
  getAssetsDataListQueryKey,
  useAssetsDataList,
} from '#/api/react-query/survey-data'
import Button from '#/components/common/button'
import { goToProcessing } from '#/components/processing/routes.utils'
import styles from './index.module.scss'

// TODO: improve schema to enum `action` prop.
const ADVANCED_FEATURES_ACTION = [
  'manual_transcription',
  'manual_translation',
  'automatic_google_transcription',
  'automatic_google_translation',
]
// TODO: improve schema, AdvancedFeatureResponse.asset doesn't exist for the above.
// TODO: improve ...

interface Props {
  submissionEditId: string
  assetUid: string
  xpath: string
}

/**
 * Component with the current question label and the UI for switching between
 * submissions and questions. It also has means of leaving Single Processing
 * via "DONE" button.
 */
export default function SelectSubmission({ assetUid, submissionEditId, xpath }: Props) {
  const query = JSON.stringify({ [xpath]: { $exists: true } })

  const params = {
    limit: 200,
    start: 0,
    sort: JSON.stringify({ _id: -1 }),
    query,
  } as any
  const querySubmission = useAssetsDataList(assetUid!, params, {
    query: {
      queryKey: getAssetsDataListQueryKey(assetUid!, params),
      enabled: !!assetUid,
      select: useCallback(
        (data: assetsDataListResponse) => {
          return data?.status === 200 ? data.data.results : []
        },
        [xpath],
      ),
    },
  })
  console.log(querySubmission.data)

  const count = querySubmission.data?.length ?? 0

  // Note: in case a submission has answer for Q1 but not Q2, when question is switched then the index will be 0.
  // TODO: auto-select 1st instead? Auto-select next one instead?
  const currentSubmissionIndex = querySubmission.data?.findIndex((submission) => submission['meta/rootUuid'].slice(5) === submissionEditId) ?? -1

  const goPrev = () => {
    if(!querySubmission.data) return
    if(currentSubmissionIndex === 0) return
    goToProcessing(assetUid, xpath, querySubmission.data[currentSubmissionIndex - 1]['meta/rootUuid'].slice(5), true)
  }

  const goNext = () => {
    if(!querySubmission.data) return
    if(currentSubmissionIndex + 1 === count) return
    goToProcessing(assetUid, xpath, querySubmission.data[currentSubmissionIndex + 1]['meta/rootUuid'].slice(5), true)
  }

  return (
    <section className={styles.column}>
      <nav className={styles.submissions}>
        <div className={styles.count}>
          <strong>
            {t('Item')}
            &nbsp;
            {currentSubmissionIndex + 1}
          </strong>
          &nbsp;
          {t('of ##total_count##').replace('##total_count##', String(count))}
        </div>

        <Button
          type='text'
          size='s'
          startIcon='arrow-up'
          onClick={goPrev}
          isDisabled={currentSubmissionIndex <= 0}
        />

        <Button
          type='text'
          size='s'
          endIcon='arrow-down'
          onClick={goNext}
          isDisabled={currentSubmissionIndex + 1 === count}
        />
      </nav>
    </section>
  )
}
