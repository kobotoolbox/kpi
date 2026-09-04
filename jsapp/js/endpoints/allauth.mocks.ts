import { http, HttpResponse, delay } from 'msw'
import type { ErrorResponseErrorsItem } from '#/api/models/errorResponseErrorsItem'

/**
 * Hand written msw handlers for allauth's headless endpoints. The generated ones answer 200 with faker data, and every
 * interesting allauth outcome is a non-2xx - a successful signup included.
 */

const SIGNUP_URL = '*/api/v2/allauth/browser/v1/auth/signup'
const EMAIL_VERIFY_URL = '*/api/v2/allauth/browser/v1/auth/email/verify'

/**
 * A successful signup under `ACCOUNT_EMAIL_VERIFICATION = 'mandatory'`, the KPI default: 401, since the  new account
 * is not logged in until the address is confirmed.
 */
export const signupPendingVerificationMock = () =>
  http.post(SIGNUP_URL, () =>
    HttpResponse.json(
      {
        status: 401,
        data: {
          flows: [{ id: 'login' }, { id: 'signup' }, { id: 'verify_email', is_pending: true }],
        },
        meta: { is_authenticated: false },
      },
      { status: 401 },
    ),
  )

/** A successful signup where verification is `none` or `optional`: the account is created and logged in. */
export const signupAuthenticatedMock = () =>
  http.post(SIGNUP_URL, () =>
    HttpResponse.json(
      {
        status: 200,
        data: {
          user: {
            id: 1,
            display: 'someone',
            username: 'someone',
            email: 'someone@example.com',
            has_usable_password: true,
          },
          methods: [],
        },
        meta: { is_authenticated: true },
      },
      { status: 200 },
    ),
  )

/** A rejected signup. `param` is the allauth field name; omit it for an error with no field. */
export const signupErrorsMock = (errors: ErrorResponseErrorsItem[]) =>
  http.post(SIGNUP_URL, () => HttpResponse.json({ status: 400, errors }, { status: 400 }))

/** A signup request that never answers, so the submit button stays in its loading state. */
export const signupNeverAnswersMock = () =>
  http.post(SIGNUP_URL, async () => {
    await delay('infinite')
  })

/** Registration is closed. allauth answers with no message at all, hence the bare body. */
export const signupClosedMock = () => http.post(SIGNUP_URL, () => HttpResponse.json({ status: 403 }, { status: 403 }))

/** Looking up an activation key that is still good. */
export const emailVerificationInfoMock = (email: string, display: string) =>
  http.get(EMAIL_VERIFY_URL, () =>
    HttpResponse.json({
      status: 200,
      data: {
        email,
        user: { id: 1, display, username: display, email, has_usable_password: true },
      },
      meta: { is_authenticating: true },
    }),
  )

/** Looking up an activation key that has expired or was already used. */
export const emailVerificationInvalidKeyMock = () =>
  http.get(EMAIL_VERIFY_URL, () =>
    HttpResponse.json(
      { status: 400, errors: [{ code: 'invalid', param: 'key', message: 'Invalid or expired key.' }] },
      { status: 400 },
    ),
  )

/** Confirming an activation key: allauth logs the account in and answers with the user. */
export const emailVerifyConfirmMock = () =>
  http.post(EMAIL_VERIFY_URL, () =>
    HttpResponse.json({
      status: 200,
      data: { user: { id: 1, display: 'someone', username: 'someone', has_usable_password: true }, methods: [] },
      meta: { is_authenticated: true },
    }),
  )

/** With `ACCOUNT_LOGIN_ON_EMAIL_CONFIRMATION` off: verified, nobody signed in, reported as a 401. */
export const emailVerifyConfirmWithoutSessionMock = () =>
  http.post(EMAIL_VERIFY_URL, () =>
    HttpResponse.json(
      { status: 401, data: { flows: [{ id: 'login' }] }, meta: { is_authenticated: false } },
      { status: 401 },
    ),
  )
