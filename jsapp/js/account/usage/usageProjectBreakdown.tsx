import React, { useEffect, useState } from 'react'

import prettyBytes from 'pretty-bytes'
import { Link } from 'react-router-dom'
import { useOrganizationQuery } from '#/account/organization/organizationQuery'
import type { AssetUsage, AssetWithUsage } from '#/account/usage/assetUsage.api'
import { getOrgAssetUsage, getOrgAssetUsage2 } from '#/account/usage/assetUsage.api'
import AssetStatusBadge from '#/components/common/assetStatusBadge'
import Button from '#/components/common/button'
import Icon from '#/components/common/icon'
import LoadingSpinner from '#/components/common/loadingSpinner'
import { USAGE_ASSETS_PER_PAGE } from '#/constants'
import type { ProjectFieldDefinition } from '#/projects/projectViews/constants'
import type { ProjectsTableOrder } from '#/projects/projectsTable/projectsTable'
import SortableProjectColumnHeader from '#/projects/projectsTable/sortableProjectColumnHeader'
import { ROUTES } from '#/router/routerConstants'
import { convertSecondsToMinutes } from '#/utils'
import styles from './usageProjectBreakdown.module.scss'
import { useBillingPeriod } from './useBillingPeriod'
import UniversalTable, { DEFAULT_PAGE_SIZE, UniversalTableColumn } from '#/UniversalTable'
import {keepPreviousData, useQuery} from '@tanstack/react-query'
import {QueryKeys} from '#/query/queryKeys'
import {A} from 'msw/lib/core/HttpResponse-CKZrrwKE'

type ButtonType = 'back' | 'forward'

const ProjectBreakdown = () => {
  const [currentPage, setCurrentPage] = useState(1)
  const [projectData, setProjectData] = useState<AssetUsage>({
    count: '0',
    next: null,
    previous: null,
    results: [],
  })
  const [order, setOrder] = useState({})
  const [showIntervalBanner, setShowIntervalBanner] = useState(true)
  const [loading, setLoading] = useState(true)
  const orgQuery = useOrganizationQuery()
  const { billingPeriod } = useBillingPeriod()
  const [pagination, setPagination] = useState({
    limit: DEFAULT_PAGE_SIZE,
    offset: 0,
  })

  const queryResult = useQuery({
    queryKey: [QueryKeys.assetUsage, pagination.limit, pagination.offset, orgQuery.data, orgQuery.data?.id],
    queryFn: () => getOrgAssetUsage2(pagination.limit, pagination.offset, orgQuery.data ? orgQuery.data.id : ''),
    placeholderData: keepPreviousData,
  })

  useEffect(() => {
    async function fetchData(orgId: string) {
      const data = await getOrgAssetUsage(currentPage, orgId, order)
      const updatedResults = data.results.map((projectResult) => {
        const assetParts = projectResult.asset.split('/')
        const uid = assetParts[assetParts.length - 2]
        return {
          ...projectResult,
          uid: uid,
        }
      })

      setProjectData({
        ...data,
        results: updatedResults,
      })
      setLoading(false)
    }

    if (orgQuery.data) {
      fetchData(orgQuery.data.id)
    }
  }, [currentPage, order, orgQuery.data])

  if (loading) {
    return <LoadingSpinner />
  }

  function dismissIntervalBanner() {
    setShowIntervalBanner(false)
  }

  const calculateRange = (): string => {
    const totalProjects = Number.parseInt(projectData.count)
    let startRange = (currentPage - 1) * USAGE_ASSETS_PER_PAGE + 1
    if (Number.parseInt(projectData.count) === 0) {
      startRange = 0
    }
    const endRange = Math.min(currentPage * USAGE_ASSETS_PER_PAGE, totalProjects)
    return `${startRange}-${endRange} of ${totalProjects}`
  }

  const handleClick = async (event: React.MouseEvent<HTMLButtonElement>, buttonType: ButtonType): Promise<void> => {
    event.preventDefault()

    try {
      if (buttonType === 'back' && projectData.previous) {
        setCurrentPage((prevPage) => Math.max(prevPage - 1, 1))
      } else if (buttonType === 'forward' && projectData.next) {
        setCurrentPage((prevPage) =>
          Math.min(prevPage + 1, Math.ceil(Number.parseInt(projectData.count) / USAGE_ASSETS_PER_PAGE)),
        )
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }

  const isActiveBack = currentPage > 1
  const isActiveForward = currentPage < Math.ceil(Number.parseInt(projectData.count) / USAGE_ASSETS_PER_PAGE)

  const usageName: ProjectFieldDefinition = {
    name: 'name',
    label: t('##count## Projects').replace('##count##', projectData.count),
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

  const renderProjectRow = (project: AssetWithUsage) => {
    const periodSubmissions = project.submission_count_current_period.toLocaleString()

    const periodASRSeconds = convertSecondsToMinutes(
      project.nlp_usage_current_period.total_nlp_asr_seconds,
    ).toLocaleString()

    const periodMTCharacters = project.nlp_usage_current_period.total_nlp_mt_characters.toLocaleString()

    return (
      <tr key={project.asset}>
        <td dir='auto'>
          <Link className={styles.link} to={ROUTES.FORM_SUMMARY.replace(':uid', project.uid)}>
            {project.asset__name}
          </Link>
        </td>
        <td>{project.submission_count_all_time.toLocaleString()}</td>
        <td className={styles.currentMonth}>{periodSubmissions}</td>
        <td>{prettyBytes(project.storage_bytes)}</td>
        <td>{periodASRSeconds}</td>
        <td>{periodMTCharacters}</td>
        <td className={styles.badge}>
          <AssetStatusBadge deploymentStatus={project.deployment_status} />
        </td>
      </tr>
    )
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
    <UniversalTable<AssetWithUsage>
      pagination={pagination}
      setPagination={setPagination}
      queryResult={queryResult}
      columns={columns}
    />
  )
}

export default ProjectBreakdown
