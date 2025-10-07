import { http, HttpResponse } from 'msw'
import type { OrganizationResponse } from '#/api/models/organizationResponse'
import { getOrganizationsRetrieveUrl } from '#/api/react-query/user-team-organization-usage'

/**
 * Mock API for organization endpoint. Use it in Storybook tests in `parameters.msw.handlers[]`.
 *
 * This will mock a response to given `organizationId`. Will assume user is the owner, and `is_mmo` is "configurable"
 * with `storybookTestId` HACK solution.
 */
const organizationMock = (organizationId: string) =>
  http.get<never, never, OrganizationResponse>(getOrganizationsRetrieveUrl(organizationId), () => {
    // In case of `DeleteAccountBanner` component, we want to test the UI with user that owns an MMO organization.
    const storybookTestId = sessionStorage.getItem('storybookTestId')
    if (storybookTestId === 'UserOwnsMMO') {
      return HttpResponse.json(organizationReponse(organizationId, true))
    }

    return HttpResponse.json(organizationReponse(organizationId, false))
  })
export default organizationMock

const organizationReponse = (organizationId: string, isMMO: boolean): OrganizationResponse => ({
  id: organizationId,
  url: `http://kf.kobo.local/api/v2/organizations/${organizationId}/`,
  name: 'mocked organization',
  website: '',
  organization_type: 'none',
  created: '2025-06-10T10:11:40.822688Z',
  modified: '2025-08-04T12:10:49.395459Z',
  is_owner: true,
  is_mmo: isMMO,
  request_user_role: 'owner',
  members: `http://kf.kobo.local/api/v2/organizations/${organizationId}/members/`,
  assets: `http://kf.kobo.local/api/v2/organizations/${organizationId}/assets/`,
  service_usage: `http://kf.kobo.local/api/v2/organizations/${organizationId}/service_usage/`,
  asset_usage: `http://kf.kobo.local/api/v2/organizations/${organizationId}/asset_usage/`,
})
