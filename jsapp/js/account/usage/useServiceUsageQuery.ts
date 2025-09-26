import { useEffect } from 'react'
import type { ServiceUsageBalances } from '#/api/models/serviceUsageBalances'
import {
  type organizationsServiceUsageRetrieveResponse,
  useOrganizationsServiceUsageRetrieve,
} from '#/api/react-query/organizations'
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

export interface OrganizationsServiceUsageSummary {
  storage: number
  submissions: number
  transcriptionMinutes: number
  translationChars: number
  currentPeriodStart: string
  currentPeriodEnd: string
  lastUpdated?: String | null
  balances: ServiceUsageBalances
  limitWarningList: UsageLimitTypes[]
  limitExceedList: UsageLimitTypes[]
}

const usageBalanceKeyMapping = {
  storage_bytes: UsageLimitTypes.STORAGE,
  submission: UsageLimitTypes.SUBMISSION,
  asr_seconds: UsageLimitTypes.TRANSCRIPTION,
  mt_characters: UsageLimitTypes.TRANSLATION,
}

const transformUsage = (response: organizationsServiceUsageRetrieveResponse): OrganizationsServiceUsageSummary => {
  if (!response || response.status !== 200) {
    throw Error(t("Couldn't get usage data"))
  }

  let lastUpdated: OrganizationsServiceUsageSummary['lastUpdated'] = null
  if ('headers' in response && response.headers instanceof Headers) {
    const lastUpdateDate = response.headers.get('date')
    if (lastUpdateDate) {
      lastUpdated = formatRelativeTime(lastUpdateDate)
    }
  }

  const data = response.data

  const limitWarningList: UsageLimitTypes[] = []
  const limitExceedList: UsageLimitTypes[] = []
  for (const [key, balance] of recordEntries(data.balances)) {
    if (balance?.exceeded) {
      limitExceedList.push(usageBalanceKeyMapping[key])
    } else if (balance?.balance_percent && balance.balance_percent / 100 >= USAGE_WARNING_RATIO) {
      limitWarningList.push(usageBalanceKeyMapping[key])
    }
  }

  return {
    storage: data.total_storage_bytes,
    submissions: data.total_submission_count.current_period,
    transcriptionMinutes: convertSecondsToMinutes(data.total_nlp_usage.asr_seconds_current_period),
    translationChars: data.total_nlp_usage.mt_characters_current_period,
    currentPeriodStart: data.current_period_start,
    currentPeriodEnd: data.current_period_end,
    lastUpdated,
    balances: data.balances,
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

  // Note: for "!" see https://github.com/orval-labs/orval/issues/2397
  return useOrganizationsServiceUsageRetrieve(organizationData?.id!, {
    query: {
      queryKey: undefined as any, // Note: for `any` see https://github.com/orval-labs/orval/issues/2396
      // A low stale time is needed to avoid calling the API twice on some situations
      // (e.g. usage component that contains limits banner which also uses this query).
      staleTime: 1000 * 60, // 1 minute stale time
      select: transformUsage,
    },
    request: {
      includeHeaders: true,
      errorMessageDisplay: t('There was an error fetching usage data.'),
    },
  })
}
