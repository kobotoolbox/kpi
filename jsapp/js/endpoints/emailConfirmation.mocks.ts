import { http, HttpResponse } from 'msw'
import { getApiV2EmailConfirmationsCreateMockHandler } from '#/api/react-query/user-team-organization-usage/msw'

/**
 * Mocks for `/api/v2/email-confirmations/`, the "send me another confirmation email" endpoint.
 *
 * Only the 200 has a generated handler - the rest of what this endpoint answers with is a non-2xx.
 */

const EMAIL_CONFIRMATION_URL = '*/api/v2/email-confirmations{/}?'

/**
 * The one answer for a request that got through, whether the address is unverified, already verified, or
 * held by nobody. The `detail` is quoted from the backend's `EMAIL_CONFIRMATION_REQUESTED_DETAIL`.
 */
export const emailConfirmationRequestedMock = () =>
  getApiV2EmailConfirmationsCreateMockHandler({
    detail: 'If that email address needs confirming, a new confirmation email has been sent to it.',
  })

/**
 * The per-address hourly limit, reached. The message is DRF's own, since the throttle sets no copy of its
 * own, so this is verbatim what a person would be shown.
 */
export const emailConfirmationThrottledMock = () =>
  http.post(EMAIL_CONFIRMATION_URL, () =>
    HttpResponse.json({ detail: 'Request was throttled. Expected available in 3521 seconds.' }, { status: 429 }),
  )

/** An address our own pattern lets through but Django's `EmailField` refuses, such as an over-long one. */
export const emailConfirmationInvalidEmailMock = () =>
  http.post(EMAIL_CONFIRMATION_URL, () =>
    HttpResponse.json({ email: ['Enter a valid email address.'] }, { status: 400 }),
  )
