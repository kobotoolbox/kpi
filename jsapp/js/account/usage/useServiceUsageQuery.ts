import { useEffect } from 'react'
import { fetchGet } from '#/api'
import { endpoints } from '#/api.endpoints'
import {
  getOrganizationsServiceUsageRetrieveQueryKey,
  organizationsServiceUsageRetrieve,
} from '#/api/react-query/organizations'
import { useServiceUsageList } from '#/api/react-query/service-usage'
import { USAGE_WARNING_RATIO } from '#/constants'
import { queryClient } from '#/query/queryClient'
import { QueryKeys } from '#/query/queryKeys'
import { convertSecondsToMinutes, formatRelativeTime } from '#/utils'
import { useOrganizationQuery } from '../organization/organizationQuery'
import { UsageLimitTypes } from '../stripe.types'

/**
 * Type `Record<string, unknown>` raises problems down the road when using with interfaces without index signature.
 * Type `object` handles both kinds of objects, with and without index signature. Useful for interface-d objects.
 */
type KeyValue<T extends object, K extends keyof T = keyof T> = [K, T[K]]
export const recordEntries = <T extends object>(o: T) => Object.entries(o) as KeyValue<T>[]
export const recordKeys = <T extends object>(o: T) => Object.keys(o) as (keyof T)[]
export const recordValues = <T extends object>(o: T) => Object.values(o) as T[keyof T][]



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
  limitWarningList: UsageLimitTypes[]
  limitExceedList: UsageLimitTypes[]
}

export async function getOrgServiceUsage(organization_id: string) {
  return fetchGet<UsageResponse>(endpoints.ORG_SERVICE_USAGE_URL.replace(':organization_id', organization_id))
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

  const usage = await organizationsServiceUsageRetrieve(organizationId, {
    includeHeaders: true,
    errorMessageDisplay: t('There was an error fetching usage data.'),
  } as any)

  if (!usage || usage.status !== 200) {
    throw Error(t("Couldn't get usage data"))
  }
  let lastUpdated: UsageState['lastUpdated'] = null
  if ('headers' in usage && usage.headers instanceof Headers) {
    const lastUpdateDate = usage.headers.get('date')
    if (lastUpdateDate) {
      lastUpdated = formatRelativeTime(lastUpdateDate)
    }
  }

  const limitWarningList: UsageLimitTypes[] = []
  const limitExceedList: UsageLimitTypes[] = []

  for (const [key, balance] of recordEntries(usage.data.balances)) {
    if (balance?.exceeded) {
      limitExceedList.push(usageBalanceKeyMapping[key])
    } else if (balance?.balance_percent && balance.balance_percent / 100 >= USAGE_WARNING_RATIO) {
      limitWarningList.push(usageBalanceKeyMapping[key])
    }
  }

  return {
    storage: usage.data.total_storage_bytes,
    submissions: usage.data.total_submission_count.current_period,
    transcriptionMinutes: convertSecondsToMinutes(usage.data.total_nlp_usage.asr_seconds_current_period),
    translationChars: usage.data.total_nlp_usage.mt_characters_current_period,
    currentPeriodStart: usage.data.current_period_start,
    currentPeriodEnd: usage.data.current_period_end,
    lastUpdated,
    // @ts-expect-error schema: DEV-954
    balances: usage.data.balances,
    limitWarningList,
    limitExceedList,
  }
}

interface ServiceUsageQueryParams {
  shouldForceInvalidation?: boolean
}

export const useServiceUsageQuery = (params?: ServiceUsageQueryParams) => {
  const { data: organizationData } = useOrganizationQuery()

  useEffect(() => {
    if (params?.shouldForceInvalidation) {
      queryClient.invalidateQueries({
        queryKey: [QueryKeys.serviceUsage, organizationData?.id],
        refetchType: 'none',
      })
    }
  }, [params?.shouldForceInvalidation])

  return useServiceUsageList({
    query: {
      enabled: !!organizationData,
      queryKey: getOrganizationsServiceUsageRetrieveQueryKey(organizationData?.id!),
      // A low stale time is needed to avoid calling the API twice on some situations
      // (e.g. usage component that contains limits banner which also uses this query).
      staleTime: 1000 * 60, // 1 minute stale time
    },
  })
}
