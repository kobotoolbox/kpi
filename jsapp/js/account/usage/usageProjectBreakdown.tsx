import { useState } from 'react'

import { keepPreviousData } from '@tanstack/react-query'
import prettyBytes from 'pretty-bytes'
import { Link } from 'react-router-dom'
import UniversalTable, { DEFAULT_PAGE_SIZE, type UniversalTableColumn } from '#/UniversalTable'
import type { CustomAssetUsage } from '#/api/models/customAssetUsage'
import type { ErrorObject } from '#/api/models/errorObject'
import type { OrganizationsAssetUsageListParams } from '#/api/models/organizationsAssetUsageListParams'
import {
  getOrganizationsAssetUsageListQueryKey,
  useOrganizationsAssetUsageList,
} from '#/api/react-query/user-team-organization-usage'
import { useOrganizationAssumed } from '#/api/useOrganizationAssumed'
import AssetStatusBadge from '#/components/common/assetStatusBadge'
import Button from '#/components/common/button'
import Icon from '#/components/common/icon'
import { FeatureFlag, useFeatureFlag } from '#/featureFlags'
import type { ProjectFieldDefinition } from '#/projects/projectViews/constants'
import type { ProjectsTableOrder } from '#/projects/projectsTable/projectsTable'
import SortableProjectColumnHeader from '#/projects/projectsTable/sortableProjectColumnHeader'
import { ROUTES } from '#/router/routerConstants'
import { convertSecondsToMinutes, notify } from '#/utils'
import styles from './usageProjectBreakdown.module.scss'
import { useBillingPeriod } from './useBillingPeriod'

const ProjectBreakdown = () => {
  const [showIntervalBanner, setShowIntervalBanner] = useState(true)
  const [organization] = useOrganizationAssumed()
  const { billingPeriod } = useBillingPeriod()
  const [order, setOrder] = useState<ProjectsTableOrder>({})
  const [pagination, setPagination] = useState({
    limit: DEFAULT_PAGE_SIZE,
    offset: 0,
  })

  function getQueryParams() {
    // TODO: align props with backend pagination params to simplify away this helper
    const queryParams: OrganizationsAssetUsageListParams = { ...pagination }
    if (order.direction && order.fieldName) {
      const orderPrefix = order.direction === 'descending' ? '-' : ''
      const fieldName = order.fieldName === 'status' ? '_deployment_status' : order.fieldName
      queryParams.ordering = orderPrefix + fieldName
    }
    return queryParams
  }

  const queryResult = useOrganizationsAssetUsageList(organization.id, getQueryParams(), {
    query: {
      queryKey: getOrganizationsAssetUsageListQueryKey(organization.id, getQueryParams()),
      placeholderData: keepPreviousData,
      throwOnError: () => {
        notify(t('There was an error getting the list.'), 'error') // TODO: update message in backend (DEV-1218).
        return false
      },
    },
  })

  const usageName: ProjectFieldDefinition = {
    name: 'name',
    label:
      queryResult.data && queryResult.data.status === 200
        ? t('##count## Projects').replace('##count##', queryResult.data.data.count.toString())
        : t('Projects'),
    apiFilteringName: 'name',
    apiOrderingName: 'name',
    availableConditions: [],
  }
  const usageStatus: ProjectFieldDefinition = {
    name: 'status',
    label: 'Status',
    apiFilteringName: '_deployment_status',
    apiOrderingName: '_deployment_status',
    availableConditions: [],
  }

  const updateOrder = (newOrder: ProjectsTableOrder) => {
    setOrder(newOrder)
  }

  function dismissIntervalBanner() {
    setShowIntervalBanner(false)
  }

  const columns: Array<UniversalTableColumn<CustomAssetUsage>> = [
    {
      key: 'asset_name',
      label: (
        <SortableProjectColumnHeader
          styling={false}
          field={usageName}
          orderableFields={['name', 'status']}
          order={order}
          onChangeOrderRequested={updateOrder}
          fixedWidth
        />
      ),
      size: 100,
      cellFormatter: (data: CustomAssetUsage) => {
        const assetParts = data.asset.split('/')
        const uid = assetParts[assetParts.length - 2]

        return (
          <Link className={styles.link} to={ROUTES.FORM_SUMMARY.replace(':uid', uid)}>
            {data.asset__name}
          </Link>
        )
      },
    },
    {
      key: 'submissions_current',
      label: t('Submissions'),
      size: 100,
      cellFormatter: (data: CustomAssetUsage) => data.submission_count_current_period,
    },
    {
      key: 'storage',
      label: t('File storage'),
      size: 100,
      cellFormatter: (data: CustomAssetUsage) => prettyBytes(data.storage_bytes),
    },
    {
      key: 'transcript_minutes',
      label: t('Transcript minutes'),
      size: 100,
      cellFormatter: (data: CustomAssetUsage) =>
        convertSecondsToMinutes(data.nlp_usage_current_period.total_nlp_asr_seconds).toLocaleString(),
    },
    {
      key: 'translation_characters',
      label: t('Translation characters'),
      size: 100,
      cellFormatter: (data: CustomAssetUsage) => data.nlp_usage_current_period.total_nlp_mt_characters.toLocaleString(),
    },
    ...(useFeatureFlag(FeatureFlag.autoQAEnabled)
      ? [
          {
            key: 'llm_requests',
            label: t('Automatic analysis requests'),
            size: 100,
            cellFormatter: (data: CustomAssetUsage) =>
              data.nlp_usage_current_period.total_nlp_llm_requests.toLocaleString(),
          },
        ]
      : []),
    {
      key: 'staus',
      label: (
        <SortableProjectColumnHeader
          styling={false}
          field={usageStatus}
          orderableFields={['name', 'status']}
          order={order}
          onChangeOrderRequested={updateOrder}
          fixedWidth
        />
      ),
      size: 100,
      cellFormatter: (data: CustomAssetUsage) => <AssetStatusBadge deploymentStatus={data.deployment_status} />,
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
      <UniversalTable<CustomAssetUsage, ErrorObject>
        pagination={pagination}
        setPagination={setPagination}
        queryResult={queryResult}
        columns={columns}
      />
    </div>
  )
}

export default ProjectBreakdown
