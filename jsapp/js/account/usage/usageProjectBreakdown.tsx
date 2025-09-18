import { useState } from 'react'

import prettyBytes from 'pretty-bytes'
import { useOrganizationQuery } from '#/account/organization/organizationQuery'
import type { AssetWithUsage } from '#/account/usage/assetUsage.api'
import { getOrgAssetUsage } from '#/account/usage/assetUsage.api'
import AssetStatusBadge from '#/components/common/assetStatusBadge'
import Button from '#/components/common/button'
import Icon from '#/components/common/icon'
import { convertSecondsToMinutes } from '#/utils'
import styles from './usageProjectBreakdown.module.scss'
import { useBillingPeriod } from './useBillingPeriod'
import UniversalTable, { DEFAULT_PAGE_SIZE, UniversalTableColumn } from '#/UniversalTable'
import {keepPreviousData, useQuery} from '@tanstack/react-query'
import {QueryKeys} from '#/query/queryKeys'

const ProjectBreakdown = () => {
  const [showIntervalBanner, setShowIntervalBanner] = useState(true)
  const orgQuery = useOrganizationQuery()
  const { billingPeriod } = useBillingPeriod()
  const [pagination, setPagination] = useState({
    limit: DEFAULT_PAGE_SIZE,
    offset: 0,
  })

  const queryResult = useQuery({
    queryKey: [QueryKeys.assetUsage, pagination.limit, pagination.offset, orgQuery.data, orgQuery.data?.id],
    queryFn: () => getOrgAssetUsage(pagination.limit, pagination.offset, orgQuery.data ? orgQuery.data.id : ''),
    placeholderData: keepPreviousData,
  })

  function dismissIntervalBanner() {
    setShowIntervalBanner(false)
  }

  const columns: Array<UniversalTableColumn<AssetWithUsage>> = [
    {
      key: 'asset_name',
      label: t('Project name'),
      size: 100,
      cellFormatter: (data: AssetWithUsage) => (
        data.asset__name
      )
    },
    {
      key: 'submissions_all',
      label: t('Submissions (Total)'),
      size: 100,
      cellFormatter: (data: AssetWithUsage) => (
        data.submission_count_all_time
      )
    },
    {
      key: 'submissions_current',
      label: t('Submissions'),
      size: 100,
      cellFormatter: (data: AssetWithUsage) => (
        data.submission_count_current_period
      )
    },
    {
      key: 'storage',
      label: t('Storage'),
      size: 100,
      cellFormatter: (data: AssetWithUsage) => (
        prettyBytes(data.storage_bytes)
      )
    },
    {
      key: 'transcript_minutes',
      label: t('Transcript minutes'),
      size: 100,
      cellFormatter: (data: AssetWithUsage) => (
        convertSecondsToMinutes(
          data.nlp_usage_current_period.total_nlp_asr_seconds,
        ).toLocaleString()
      )
    },
    {
      key: 'transcript_minutes',
      label: t('Transcript minutes'),
      size: 100,
      cellFormatter: (data: AssetWithUsage) => (
        convertSecondsToMinutes(
          data.nlp_usage_current_period.total_nlp_mt_characters,
        ).toLocaleString()
      )
    },
    {
      key: 'transcript_minutes',
      label: t('Transcript minutes'),
      size: 100,
      cellFormatter: (data: AssetWithUsage) => (
        <AssetStatusBadge deploymentStatus={data.deployment_status} />
      )
    },
  ]

  return (
    <div className={styles.root}>
      {showIntervalBanner && (
        <div className={styles.intervalBanner}>
          <div className={styles.intervalBannerContent}>
            <Icon name={'information'} size='m' color='blue' />
            <div className={styles.intervalBannerText}>
              {t(
                'Submissions, transcription minutes, and translation characters reflect usage for the current ##INTERVAL## based on your plan settings.',
              ).replace('##INTERVAL##', billingPeriod === 'year' ? t('year') : t('month'))}
            </div>
          </div>
          <Button size='s' type='text' startIcon='close' onClick={dismissIntervalBanner} />
        </div>
      )}
      <UniversalTable<AssetWithUsage>
        pagination={pagination}
        setPagination={setPagination}
        queryResult={queryResult}
        columns={columns}
      />
      </div>
  )
}

export default ProjectBreakdown
