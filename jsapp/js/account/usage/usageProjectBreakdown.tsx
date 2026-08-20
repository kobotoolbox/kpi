import { useState } from 'react'

import { Text } from '@mantine/core'
import { keepPreviousData } from '@tanstack/react-query'
import prettyBytes from 'pretty-bytes'
import { Link } from 'react-router-dom'
import UniversalTable, { DEFAULT_PAGE_SIZE, type UniversalTableColumn } from '#/UniversalTable'
import type { CustomAssetUsage } from '#/api/models/customAssetUsage'
import type { ErrorDetail } from '#/api/models/errorDetail'
import type { OrganizationsAssetUsageListParams } from '#/api/models/organizationsAssetUsageListParams'
import {
  getOrganizationsAssetUsageListQueryKey,
  useOrganizationsAssetUsageList,
} from '#/api/react-query/user-team-organization-usage'
import { useOrganizationAssumed } from '#/api/useOrganizationAssumed'
import AssetStatusBadge from '#/components/common/assetStatusBadge'
import type { ProjectFieldDefinition } from '#/projects/projectViews/constants'
import type { ProjectsTableOrder } from '#/projects/projectsTable/projectsTable'
import SortableProjectColumnHeader from '#/projects/projectsTable/sortableProjectColumnHeader'
import { ROUTES } from '#/router/routerConstants'
import { convertSecondsToMinutes } from '#/utils'
import styles from './usageProjectBreakdown.module.scss'
import { useBillingPeriod } from './useBillingPeriod'

const ProjectBreakdown = () => {
  const [organization] = useOrganizationAssumed()
  const { billingPeriod, hasActivePlan } = useBillingPeriod()
  const [order, setOrder] = useState<ProjectsTableOrder>({})
  const [pagination, setPagination] = useState({
    limit: DEFAULT_PAGE_SIZE,
    start: 0,
  })

  console.log('testing billing period: ', billingPeriod)

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
    {
      key: 'llm_requests',
      label: t('Automatic analysis requests'),
      size: 100,
      cellFormatter: (data: CustomAssetUsage) => data.nlp_usage_current_period.total_nlp_llm_requests.toLocaleString(),
    },
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
      {/* Margin bottom to match the padding top of parent */}
      <Text mb={15}>
        {t('Track usage for the current ##INTERVAL## across your projects').replace(
          '##INTERVAL##',
          billingPeriod === 'year' ? t('year') : hasActivePlan ? t('billing period') : t('month'),
        )}
      </Text>
      <UniversalTable<CustomAssetUsage, ErrorDetail>
        pagination={pagination}
        setPagination={setPagination}
        queryResult={queryResult}
        columns={columns}
      />
    </div>
  )
}

export default ProjectBreakdown
