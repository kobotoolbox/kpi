import { Box, Stack } from '@mantine/core'
import React from 'react'
import DocumentTitle from 'react-document-title'
import { useParams } from 'react-router-dom'
import { getAssetsRetrieveQueryKey, useAssetsRetrieve } from '#/api/react-query/manage-projects-and-library-content'
import LoadingSpinner from '#/components/common/loadingSpinner'
import LimitNotifications from '#/components/usageLimits/limitNotifications.component'
import type { AssetResponse } from '#/dataInterface'
import SubmissionsCountGraph from '#/project/submissionsCountGraph.component'
import { useAssetRefluxInvalidation } from '#/project/useAssetRefluxInvalidation'
import styles from './FormSummary.module.scss'
import FormSummaryProjectInfo from './FormSummaryProjectInfo'
import ProjectDataNav from './ProjectDataNav'
import ProjectLinksNav from './ProjectLinksNav'
import ProjectTeam from './ProjectTeam'
import SummarySection from './SummarySection'

/** The project summary page. */
export default function FormSummary() {
  const assetUid = useParams().uid ?? ''

  // Same key as `FormViewSideTabs`, so they share the cache
  const assetQuery = useAssetsRetrieve(assetUid, undefined, {
    query: { queryKey: getAssetsRetrieveQueryKey(assetUid), enabled: assetUid !== '' },
  })
  // With `updateAsset`, so a rename in the header updates the page title
  useAssetRefluxInvalidation(assetUid, { withUpdateAsset: true })

  // TODO: stop casting this as AssetResponse after backend openAPI task DEV-1727 is done
  const asset = assetQuery.data?.status === 200 ? (assetQuery.data.data as unknown as AssetResponse) : undefined

  return (
    <DocumentTitle title={`${asset?.name || t('Untitled')} | ${t('Summary')} | KoboToolbox`}>
      <Box className={styles.root}>
        <LimitNotifications />

        {assetQuery.isPending && <LoadingSpinner />}

        {asset && (
          <Box className={styles.columns}>
            <Stack gap={40} className={styles.mainColumn}>
              <FormSummaryProjectInfo asset={asset} />

              <SummarySection title={t('Submissions')}>
                <SubmissionsCountGraph assetUid={asset.uid} />
              </SummarySection>
            </Stack>

            <Stack gap={40} className={styles.sideColumn}>
              <ProjectLinksNav asset={asset} />
              <ProjectDataNav asset={asset} />
              <ProjectTeam asset={asset} />
            </Stack>
          </Box>
        )}
      </Box>
    </DocumentTitle>
  )
}
