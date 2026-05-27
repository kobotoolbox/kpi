import { http, HttpResponse } from 'msw'
import type { UserReportsServiceUsageResponse } from '#/api/models/userReportsServiceUsageResponse'
import { getOrganizationsServiceUsageRetrieveUrl } from '#/api/react-query/user-team-organization-usage'
import { meMockResponse } from './me.mocks'

/**
 * Mock API handler for the /service_usage/ endpoint of an organization.
 * Use in Storybook tests in `parameters.msw.handlers.organizationServiceUsage`.
 *
 * Property `id` is used to generate the URL and populate other response fields that depend on it.
 * Default value is coming from `meMockResponse`.
 */
const organizationServiceUsageMock = (overrideId?: string) => {
  const id = overrideId ?? meMockResponse.organization!.uid
  return http.get<never, never, UserReportsServiceUsageResponse>(getOrganizationsServiceUsageRetrieveUrl(id), () =>
    HttpResponse.json(mockServiceUsageResponse()),
  )
}
export default organizationServiceUsageMock

const mockServiceUsageResponse = (): UserReportsServiceUsageResponse => {
  return {
    total_nlp_usage: {
      asr_seconds_current_period: 0,
      llm_requests_current_period: 0,
      mt_characters_current_period: 0,
      asr_seconds_all_time: 0,
      llm_requests_all_time: 0,
      mt_characters_all_time: 0,
    },
    total_storage_bytes: 123456789,
    total_submission_count: {
      retention_days: 30,
      cumulative: 1000,
      current_period: 100,
    },
    balances: {
      submission: { effective_limit: 10000, balance_value: 9000, balance_percent: 90, exceeded: false },
      storage_bytes: { effective_limit: 1000000000, balance_value: 876543211, balance_percent: 87, exceeded: false },
      asr_seconds: null,
      mt_characters: null,
      llm_requests: null,
    },
    current_period_start: '2025-08-01T00:00:00Z',
    current_period_end: '2025-08-31T23:59:59Z',
  }
}
