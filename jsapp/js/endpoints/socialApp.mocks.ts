import { http, HttpResponse, delay } from 'msw'
import type { SocialAppDetail } from '#/api/models/socialAppDetail'
import { getApiV2SocialAppsRetrieveMockHandler } from '#/api/react-query/configuration/msw'

/**
 * Handlers for `/api/v2/social-apps/{provider_id}/`, the provider detail endpoint.
 *
 * The 200 goes through the generated handler; the interesting outcomes - a provider that is not configured
 * above all - are hand written, since the generated one only ever answers 200 with faker data.
 */

/** The URL pattern is the generated handler's, so these replace it rather than racing it. */
const SOCIAL_APP_URL = '*/api/v2/social-apps/:providerId{/}?'

/** A configured provider, public or hidden - the endpoint resolves both. */
export const makeSocialAppMock = (override?: Partial<SocialAppDetail>) =>
  getApiV2SocialAppsRetrieveMockHandler({ provider_id: 'example-org', name: 'Example Organization', ...override })

/** No provider answers to this `provider_id`: a typo in a hand-passed link, or a provider since removed. */
export const socialAppNotFoundMock = () =>
  http.get(SOCIAL_APP_URL, () => HttpResponse.json({ detail: 'Not found.' }, { status: 404 }))

/** A lookup that never answers, so the screen stays on its loading panel. */
export const socialAppNeverAnswersMock = () =>
  http.get(SOCIAL_APP_URL, async () => {
    await delay('infinite')
  })
