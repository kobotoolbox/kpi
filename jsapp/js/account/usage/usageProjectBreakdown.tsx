import { useState } from 'react'

import { keepPreviousData } from '@tanstack/react-query'
import prettyBytes from 'pretty-bytes'
import { Link } from 'react-router-dom'
import UniversalTable, { DEFAULT_PAGE_SIZE, type UniversalTableColumn } from '#/UniversalTable'
import type { CustomAssetUsage } from '#/api/models/customAssetUsage'
import type { ErrorObject } from '#/api/models/errorObject'
import {
  getOrganizationsAssetUsageListQueryKey,
  useOrganizationsAssetUsageList,
} from '#/api/react-query/user-team-organization-usage'
import { useOrganizationAssumed } from '#/api/useOrganizationAssumed'
import AssetStatusBadge from '#/components/common/assetStatusBadge'
import Button from '#/components/common/button'
import Icon from '#/components/common/icon'
import type { ProjectFieldDefinition } from '#/projects/projectViews/constants'
import type { ProjectsTableOrder } from '#/projects/projectsTable/projectsTable'
import SortableProjectColumnHeader from '#/projects/projectsTable/sortableProjectColumnHeader'
import { ROUTES } from '#/router/routerConstants'
import { notify, convertSecondsToMinutes } from '#/utils'
import styles from './usageProjectBreakdown.module.scss'
import { useBillingPeriod } from './useBillingPeriod'

const ProjectBreakdown = () => {
  const [showIntervalBanner, setShowIntervalBanner] = useState(true)
  const [organization] = useOrganizationAssumed()
  const { billingPeriod } = useBillingPeriod()
  const [order, setOrder] = useState<ProjectsTableOrder>({})
  const [fieldName, setFieldName] = useState('')
  const [pagination, setPagination] = useState({
    limit: DEFAULT_PAGE_SIZE,
    offset: 0,
    ordering: fieldName,
  })

  const queryResult = useOrganizationsAssetUsageList(organization.id, pagination, {
    query: {
      queryKey: getOrganizationsAssetUsageListQueryKey(organization.id, pagination),
      placeholderData: keepPreviousData,
      // We might want to improve this in future, for now let's not retry
      retry: false,
      // The `refetchOnWindowFocus` option is `true` by default, I'm setting it
      // here so we don't forget about it.
      refetchOnWindowFocus: true,
      throwOnError: () => {
        notify(t('There was an error getting the list.'), 'error') // TODO: update message in backend (DEV-1218).
        return false
      },
    },
  })

  const usageName: ProjectFieldDefinition = {
    name: 'name',
    label: getUsageNameLabel(),
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
    if (order.fieldName) {
      setFieldName(order.fieldName)
    }
  }

  function dismissIntervalBanner() {
    setShowIntervalBanner(false)
  }

  function getUsageNameLabel() {
    if (queryResult.data) {
      return t('##count## Projects').replace('##count##', '') // FIXME: `count` doens't exist, seems related to the error type mismatch stuff queryResult.data.data.count.toString())
    } else {
      return t('Projects')
    }
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
      key: 'submissions_all',
      label: t('Submissions (Total)'),
      size: 100,
      cellFormatter: (data: CustomAssetUsage) => data.submission_count_all_time,
    },
    {
      key: 'submissions_current',
      label: t('Submissions'),
      size: 100,
      cellFormatter: (data: CustomAssetUsage) => data.submission_count_current_period,
    },
    {
      key: 'storage',
      label: t('Storage'),
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
      cellFormatter: (data: CustomAssetUsage) =>
        convertSecondsToMinutes(data.nlp_usage_current_period.total_nlp_mt_characters).toLocaleString(),
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
