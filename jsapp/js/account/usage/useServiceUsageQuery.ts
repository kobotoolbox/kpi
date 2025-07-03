import { type UseQueryResult, useQuery } from '@tanstack/react-query'
import { fetchGet } from '#/api'
import { endpoints } from '#/api.endpoints'
import { QueryKeys } from '#/query/queryKeys'
import { convertSecondsToMinutes, formatRelativeTime } from '#/utils'
import { useOrganizationQuery } from '../organization/organizationQuery'

export interface UsageResponse {
  current_period_start: string
  current_period_end: string
  total_submission_count: {
    current_period: number
    all_time: number
  }
  total_storage_bytes: number
  total_nlp_usage: {
    asr_seconds_current_period: number
    mt_characters_current_period: number
    asr_seconds_all_time: number
    mt_characters_all_time: number
  }
}

export interface UsageState {
  storage: number
  submissions: number
  transcriptionMinutes: number
  translationChars: number
  currentPeriodStart: string
  currentPeriodEnd: string
  lastUpdated?: String | null
}

export async function getOrgServiceUsage(organization_id: string) {
  return fetchGet<UsageResponse>(endpoints.ORG_SERVICE_USAGE_URL.replace(':organization_id', organization_id), {
    includeHeaders: true,
    errorMessageDisplay: t('There was an error fetching usage data.'),
  })
}

const loadUsage = async (organizationId: string | null): Promise<UsageState | undefined> => {
  if (!organizationId) {
    throw Error(t('No organization found'))
  }

  const usage = await getOrgServiceUsage(organizationId)
  if (!usage) {
    throw Error(t("Couldn't get usage data"))
  }
  let lastUpdated: UsageState['lastUpdated'] = null
  if ('headers' in usage && usage.headers instanceof Headers) {
    const lastUpdateDate = usage.headers.get('date')
    if (lastUpdateDate) {
      lastUpdated = formatRelativeTime(lastUpdateDate)
    }
  }
  return {
    storage: usage.total_storage_bytes,
    submissions: usage.total_submission_count.current_period,
    transcriptionMinutes: convertSecondsToMinutes(usage.total_nlp_usage.asr_seconds_current_period),
    translationChars: usage.total_nlp_usage.mt_characters_current_period,
    currentPeriodStart: usage.current_period_start,
    currentPeriodEnd: usage.current_period_end,
    lastUpdated,
  }
}

export const useServiceUsageQuery = (): UseQueryResult<UsageState> => {
  const { data: organizationData } = useOrganizationQuery()

  return useQuery({
    queryKey: [QueryKeys.serviceUsage, organizationData?.id],
    queryFn: () => loadUsage(organizationData?.id || null),
    // A low stale time is needed to avoid calling the API twice on some situations
    // (e.g. usage component that contains limits banner which also uses this query).
    staleTime: 1000,
    enabled: !!organizationData,
  })
}
