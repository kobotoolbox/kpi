import React, { useMemo } from 'react'

import { getAssetsDataListQueryKey, useAssetsDataList } from '#/api/react-query/survey-data'
import { getRowNameByXpath } from '#/assetUtils'
import SubmissionDataList from '#/components/submissions/submissionDataList'
import { ADDITIONAL_SUBMISSION_PROPS, META_QUESTION_TYPES } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import { addDefaultUuidPrefix, recordKeys } from '#/utils'
import styles from './sidebarSubmissionData.module.scss'

interface SidebarSubmissionDataProps {
  xpath: string
  submissionId: string
  asset: AssetResponse
}

export default function SidebarSubmissionData({ asset, submissionId, xpath }: SidebarSubmissionDataProps) {
  const params = {
    query: JSON.stringify({
      $or: [{ 'meta/rootUuid': addDefaultUuidPrefix(submissionId!) }, { _uuid: submissionId }],
    }),
  } as any
  const querySubmission = useAssetsDataList(asset!.uid, params, {
    query: {
      queryKey: getAssetsDataListQueryKey(asset!.uid, params),
      enabled: !!asset!.uid,
    },
  })

  const submissionData = querySubmission.data?.status === 200 ? querySubmission.data.data.results[0] : undefined

  if (!asset.content) {
    return null
  }

  // If submission data is not ready yet, just don't render the list.
  if (!submissionData) {
    return null
  }

  /** We want only the processing related data (the actual form questions) */
  const questionsToHide = useMemo(() => {
    const metaQuestions = [
      getRowNameByXpath(asset.content!, xpath) || '',
      ...recordKeys(ADDITIONAL_SUBMISSION_PROPS),
      ...recordKeys(META_QUESTION_TYPES),
    ]

    // TODO: use a simpler store instead.
    return metaQuestions // .concat(store.getHiddenSidebarQuestions())
  }, [asset, xpath])

  return (
    <section className={styles.dataList} key='data-list'>
      <div className={styles.dataListBody}>
        <SubmissionDataList asset={asset} submissionData={submissionData} hideQuestions={questionsToHide} hideGroups />
      </div>
    </section>
  )
}
