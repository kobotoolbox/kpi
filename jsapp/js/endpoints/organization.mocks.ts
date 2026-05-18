import { http, HttpResponse } from 'msw'
import type { OrganizationResponse } from '#/api/models/organizationResponse'
import type { UserReportsServiceUsageResponse } from '#/api/models/userReportsServiceUsageResponse'
import {
  getOrganizationsRetrieveUrl,
  getOrganizationsServiceUsageRetrieveUrl,
} from '#/api/react-query/user-team-organization-usage'
import { meMockResponse } from './me.mocks'

/**
 * Mock API handlers for organization endpoints, including /service_usage/.
 * Use in Storybook tests in `parameters.msw.handlers.organization`.
 *
 * Property `id` is used to generate the URL and populate other response fields that depend on it.
 * Default value is `meMockResponse.organization!.uid`.
 */
const organizationMock = (override?: Partial<OrganizationResponse>) => {
  const id = override?.id ?? meMockResponse.organization!.uid
  // Main organization endpoint
  const orgHandler = http.get<never, never, OrganizationResponse>(getOrganizationsRetrieveUrl(id), () =>
    HttpResponse.json({ ...organizationReponse(id), ...override }),
  )
  // /service_usage/ endpoint
  const serviceUsageHandler = http.get<never, never, UserReportsServiceUsageResponse>(
    getOrganizationsServiceUsageRetrieveUrl(id),
    () => HttpResponse.json(mockServiceUsageResponse()),
  )
  return [orgHandler, serviceUsageHandler]
}
export default organizationMock

const organizationReponse = (organizationId: string): OrganizationResponse => {
  return {
    id: organizationId,
    url: `http://kf.kobo.local/api/v2/organizations/${organizationId}/`,
    name: 'mocked organization',
    website: '',
    organization_type: 'none',
    created: '2025-06-10T10:11:40.822688Z',
    modified: '2025-08-04T12:10:49.395459Z',
    is_owner: true,
    is_mmo: false,
    request_user_role: 'owner',
    members: `http://kf.kobo.local/api/v2/organizations/${organizationId}/members/`,
    assets: `http://kf.kobo.local/api/v2/organizations/${organizationId}/assets/`,
    service_usage: `http://kf.kobo.local/api/v2/organizations/${organizationId}/service_usage/`,
    asset_usage: `http://kf.kobo.local/api/v2/organizations/${organizationId}/asset_usage/`,
  }
}

// Plausible mock for UserReportsServiceUsageResponse
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
