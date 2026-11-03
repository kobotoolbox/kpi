import type { OrganizationResponse } from '#/api/models/organizationResponse'
import { getApiV2OrganizationsRetrieveMockHandler } from '#/api/react-query/user-team-organization-usage/msw'
import { meMockResponse } from './me.mocks'

/**
 * Mock API handler for organization endpoint using Orval-generated handler.
 * Property `id` is used to generate the URL and populate other response fields that depend on it.
 * Default value is `meMockResponse.organization!.uid`.
 */
const organizationMock = (override?: Partial<OrganizationResponse>) => {
  const id = override?.id ?? meMockResponse.organization?.uid ?? 'default-org-id'

  return getApiV2OrganizationsRetrieveMockHandler({
    id,
    url: `http://kf.kobo.local/api/v2/organizations/${id}/`,
    name: 'mocked organization',
    website: '',
    organization_type: 'none',
    created: '2025-06-10T10:11:40.822688Z',
    modified: '2025-08-04T12:10:49.395459Z',
    is_owner: true,
    is_mmo: false,
    request_user_role: 'owner',
    members: `http://kf.kobo.local/api/v2/organizations/${id}/members/`,
    assets: `http://kf.kobo.local/api/v2/organizations/${id}/assets/`,
    service_usage: `http://kf.kobo.local/api/v2/organizations/${id}/service_usage/`,
    asset_usage: `http://kf.kobo.local/api/v2/organizations/${id}/asset_usage/`,
    ...override,
  })
}

export default organizationMock
