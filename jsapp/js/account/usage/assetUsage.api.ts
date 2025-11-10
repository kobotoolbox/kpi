import { fetchGet } from '#/api'
import type { PaginatedResponse } from '#/dataInterface'
import { PROJECT_FIELDS } from '#/projects/projectViews/constants'
import type { ProjectFieldName } from '#/projects/projectViews/constants'
import type { ProjectsTableOrder } from '#/projects/projectsTable/projectsTable'

export interface AssetWithUsage {
  asset: string
  asset__name: string
  nlp_usage_current_period: {
    total_nlp_asr_seconds: number
    total_nlp_mt_characters: number
  }
  nlp_usage_all_time: {
    total_nlp_asr_seconds: number
    total_nlp_mt_characters: number
  }
  storage_bytes: number
  submission_count_current_period: number
  submission_count_all_time: number
  deployment_status: string
}

const ORG_ASSET_USAGE_URL = '/api/v2/organizations/:organization_id/asset_usage/'

export async function getOrgAssetUsage(
  limit: number,
  offset: number,
  organizationId: string,
  order?: ProjectsTableOrder,
) {
  const apiUrl = ORG_ASSET_USAGE_URL.replace(':organization_id', organizationId)

  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  })

  if (order?.fieldName && order.direction && (order.direction === 'ascending' || order.direction === 'descending')) {
    const orderingPrefix = order.direction === 'ascending' ? '' : '-'
    const fieldDefinition = PROJECT_FIELDS[order.fieldName as ProjectFieldName]
    params.set('ordering', orderingPrefix + fieldDefinition.apiOrderingName)
  }

  return {
    status: 200 as const,
    data: await fetchGet<PaginatedResponse<AssetWithUsage>>(`${apiUrl}?${params}`, {
      includeHeaders: true,
      errorMessageDisplay: t('There was an error fetching asset usage data.'),
    }),
  }
}
