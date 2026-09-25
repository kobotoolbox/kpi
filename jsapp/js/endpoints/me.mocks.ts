import { http, HttpResponse, delay } from 'msw'
import type { AccountFieldsErrors } from '#/account/account.constants'
import type { MeListResponse } from '#/api/models/meListResponse'
import { getMeRetrieveMockHandler } from '#/api/react-query/user-team-organization-usage/msw'

/**
 * Mock response data for /me/ endpoint.
 * Note: AccountResponse (legacy) is compatible with MeListResponse (Orval).
 */
export const meMockResponse: MeListResponse = {
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

/**
 * Mock API for session endpoint using Orval-generated handler.
 * Use it in Storybook tests in `parameters.msw.handlers[]`.
 */
const meMock = getMeRetrieveMockHandler(meMockResponse)
export default meMock

/**
 * Hand written handlers for `PATCH /me/`, because the interesting outcomes are the rejections and the
 * generated handler only knows how to answer 200 with faker data.
 *
 * The trailing `{/}?` matches the endpoint with or without its trailing slash, the same way the generated
 * handlers do.
 */
const ME_URL = '*/me{/}?'

/**
 * Profile details saved. The body is not read - the screen reloads the page on success. `delayMs` holds the
 * answer back, so a story can click something else while the save is still in flight.
 */
export const meUpdateSuccessMock = ({ delayMs }: { delayMs?: number } = {}) =>
  http.patch(ME_URL, async () => {
    if (delayMs) {
      await delay(delayMs)
    }
    return HttpResponse.json(meMockResponse)
  })

/**
 * A rejected save, in either of the two shapes the endpoint answers in.
 *
 * `fieldErrors` go under `extra_details` because that is where the fields were sent, and
 * `CurrentUserSerializer.validate_extra_details` reports them there. `detail` is what the endpoint uses for
 * anything about the request as a whole, which has no field to sit under.
 */
export const meUpdateErrorsMock = ({
  fieldErrors,
  detail,
  status = 400,
}: {
  fieldErrors?: AccountFieldsErrors
  detail?: string
  status?: number
}) =>
  http.patch(ME_URL, () =>
    HttpResponse.json({ ...(fieldErrors && { extra_details: fieldErrors }), ...(detail && { detail }) }, { status }),
  )
