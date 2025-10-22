import { HttpResponse, http } from 'msw'
import { endpoints } from '#/api.endpoints'
import type { AccountResponse } from '#/dataInterface'

/**
 * Mock API for session endpoint. Use it in Storybook tests in `parameters.msw.handlers[]`.
 */
const meMock = http.get<never, never, AccountResponse>(endpoints.ME, () => HttpResponse.json(meMockResponse))
export default meMock

export const meMockResponse: AccountResponse = {
  username: 'zefir',
  first_name: '',
  last_name: '',
  email: '',
  server_time: '2025-09-11T21:55:49Z',
  date_joined: '2025-08-07T10:37:47Z',
  projects_url: 'http://kc.kobo.local/zefir',
  gravatar: 'https://www.gravatar.com/avatar/d41d8cd98f00b204e9800998ecf8427e?s=40',
  last_login: null,
  extra_details: {
    name: '',
    organization: '',
    last_ui_language: 'en',
    project_views_settings: {
      kobo_my_projects: { order: {}, filters: [] },
      pvTJ223uUkFcZdC43DUZ9wM: { order: {}, filters: [] },
    },
    require_auth: true,
  },
  git_rev: false,
  social_accounts: [],
  validated_password: true,
  accepted_tos: false,
  organization: {
    url: 'http://kf.kobo.local/api/v2/organizations/orgWiPMsyx4oNEHXfqGhrbzt/',
    name: 'Zefir Inc',
    uid: 'orgWiPMsyx4oNEHXfqGhrbzt',
  },
  extra_details__uid: 'uTcCX9wL5royoPb4mHWcBz',
}
