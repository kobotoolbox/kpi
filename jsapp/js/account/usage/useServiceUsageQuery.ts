import { type UseQueryResult, useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { fetchGet } from '#/api'
import { endpoints } from '#/api.endpoints'
import { USAGE_WARNING_RATIO } from '#/constants'
import { queryClient } from '#/query/queryClient'
import { QueryKeys } from '#/query/queryKeys'
import { convertSecondsToMinutes, formatRelativeTime } from '#/utils'
import { useOrganizationQuery } from '../organization/organizationQuery'
import { UsageLimitTypes } from '../stripe.types'

interface UsageBalance {
  effective_limit: number
  balance_value: number
  balance_percent: number
  exceeded: boolean
}
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
  balances: {
    storage_bytes: UsageBalance | null
    submission: UsageBalance | null
    asr_seconds: UsageBalance | null
    mt_characters: UsageBalance | null
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
  balances: {
    storage_bytes: UsageBalance | null
    submission: UsageBalance | null
    asr_seconds: UsageBalance | null
    mt_characters: UsageBalance | null
  }
  limitWarningList: string[]
  limitExceedList: string[]
}

export async function getOrgServiceUsage(organization_id: string) {
  return fetchGet<UsageResponse>(endpoints.ORG_SERVICE_USAGE_URL.replace(':organization_id', organization_id), {
    includeHeaders: true,
    errorMessageDisplay: t('There was an error fetching usage data.'),
  })
}

const usageBalanceKeyMapping = {
  storage_bytes: UsageLimitTypes.STORAGE,
  submission: UsageLimitTypes.SUBMISSION,
  asr_seconds: UsageLimitTypes.TRANSCRIPTION,
  mt_characters: UsageLimitTypes.TRANSLATION,
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

  const limitWarningList: string[] = []
  const limitExceedList: string[] = []

  Object.keys(usage.balances).forEach((key) => {
    const balance = usage.balances[key as keyof UsageResponse['balances']]

    // Mapping the balance to our Stripe's UsageLimitTypes enum
    const limitType = usageBalanceKeyMapping[key as keyof typeof usageBalanceKeyMapping]

    if (balance?.exceeded) {
      limitExceedList.push(limitType)
    } else if (balance && balance.balance_percent / 100 >= USAGE_WARNING_RATIO) {
      limitWarningList.push(limitType)
    }
  })

  return {
    storage: usage.total_storage_bytes,
    submissions: usage.total_submission_count.current_period,
    transcriptionMinutes: convertSecondsToMinutes(usage.total_nlp_usage.asr_seconds_current_period),
    translationChars: usage.total_nlp_usage.mt_characters_current_period,
    currentPeriodStart: usage.current_period_start,
    currentPeriodEnd: usage.current_period_end,
    lastUpdated,
    balances: usage.balances,
    limitWarningList,
    limitExceedList,
  }
}

interface ServiceUsageQueryParams {
  shouldForceInvalidation?: boolean
}

export const useServiceUsageQuery = (params?: ServiceUsageQueryParams): UseQueryResult<UsageState> => {
  const { data: organizationData } = useOrganizationQuery()

  useEffect(() => {
    if (params?.shouldForceInvalidation) {
      queryClient.invalidateQueries({
        queryKey: [QueryKeys.serviceUsage, organizationData?.id],
        refetchType: 'none',
      })
    }
  }, [params?.shouldForceInvalidation])

  return useQuery({
    queryKey: [QueryKeys.serviceUsage, organizationData?.id],
    queryFn: () => loadUsage(organizationData?.id || null),
    // A low stale time is needed to avoid calling the API twice on some situations
    // (e.g. usage component that contains limits banner which also uses this query).
    staleTime: 1000 * 60, // 1 minute stale time
    enabled: !!organizationData,
  })
}
