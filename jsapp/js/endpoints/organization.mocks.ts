import { http, HttpResponse } from 'msw'
import type { OrganizationResponse } from '#/api/models/organizationResponse'
import { getOrganizationsRetrieveUrl } from '#/api/react-query/user-team-organization-usage'

/**
 * Mock API for organization endpoint. Use it in Storybook tests in `parameters.msw.handlers[]`.
 *
 * Property `id` required, because it's used to generate the URL and populate other response fields that depend on it.
 */
const organizationMock = (override: Partial<OrganizationResponse> & Pick<OrganizationResponse, 'id'>) =>
  http.get<never, never, OrganizationResponse>(getOrganizationsRetrieveUrl(override.id), () => {
    return HttpResponse.json({...organizationReponse(override.id), ...override})
  })
export default organizationMock

const organizationReponse = (organizationId: string): OrganizationResponse => ({
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
})
