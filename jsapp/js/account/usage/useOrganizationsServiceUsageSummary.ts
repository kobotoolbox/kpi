import type { UseQueryOptions } from '@tanstack/react-query'
import type { ErrorDetail } from '#/api/models/errorDetail'
import type { ServiceUsageBalances } from '#/api/models/serviceUsageBalances'
import {
  type organizationsServiceUsageRetrieveResponse,
  useOrganizationsServiceUsageRetrieve,
} from '#/api/react-query/organizations'
import { USAGE_WARNING_RATIO } from '#/constants'
import { useSession } from '#/stores/useSession'
import { convertSecondsToMinutes, formatRelativeTime, recordEntries } from '#/utils'
import { UsageLimitTypes } from '../stripe.types'


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
export type OrganizationsServiceUsageSummaryResponse200 = {
  data: OrganizationsServiceUsageSummary
  status: 200
}
export type OrganizationsServiceUsageSummaryResponse404 = {
  data: ErrorDetail
  status: 404
}
export type OrganizationsServiceUsageSummaryResponseComposite =
  | OrganizationsServiceUsageSummaryResponse200
  | OrganizationsServiceUsageSummaryResponse404
export type OrganizationsServiceUsageSummaryResponse = OrganizationsServiceUsageSummaryResponseComposite & {
  headers: Headers
}

const usageBalanceKeyMapping = {
  storage_bytes: UsageLimitTypes.STORAGE,
  submission: UsageLimitTypes.SUBMISSION,
  asr_seconds: UsageLimitTypes.TRANSCRIPTION,
  mt_characters: UsageLimitTypes.TRANSLATION,
}

const transformOrganizationsService = (
  response: organizationsServiceUsageRetrieveResponse,
): OrganizationsServiceUsageSummaryResponse => {
  if (response.status !== 200) return response

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
    status: response.status,
    headers: response.headers,
    data: {
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
    },
  }
}

export const useOrganizationsServiceUsageSummary = (
  options?: Omit<
    UseQueryOptions<organizationsServiceUsageRetrieveResponse, ErrorDetail, OrganizationsServiceUsageSummary>,
    'queryKey' | 'select'
  >,
) => {
  // Note: not using `useOrganizationAssumed` due being used within routes that accessible by anonymous user as well.
  const session = useSession()
  const organizationId = session.isPending ? undefined : session.currentLoggedAccount?.organization?.uid

  // Note: for "!" see https://github.com/orval-labs/orval/issues/2397
  const query = useOrganizationsServiceUsageRetrieve(organizationId!, {
    query: {
      staleTime: 1000 * 60, // 1 minute stale time
      ...options,
      queryKey: undefined as any, // Note: for `any` see https://github.com/orval-labs/orval/issues/2396
      select: transformOrganizationsService,
    },
    request: {
      includeHeaders: true,
      errorMessageDisplay: t('There was an error fetching usage data.'),
    },
  })

  return query
}
