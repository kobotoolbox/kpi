import { http, HttpResponse, delay } from 'msw'
import type { ErrorResponseErrorsItem } from '#/api/models/errorResponseErrorsItem'

/**
 * Hand written msw handlers for allauth's headless endpoints. The generated ones answer 200 with faker data, and every
 * interesting allauth outcome is a non-2xx - a successful signup included.
 */

const SIGNUP_URL = '*/api/v2/allauth/browser/v1/auth/signup'

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

/**
 * The server itself broke. This is the one signup outcome `fetchAllauth` still throws on, so it is the only
 * way into the form's `onError`.
 */
export const signupServerErrorMock = () =>
  http.post(SIGNUP_URL, () => HttpResponse.json({ detail: 'Internal server error.' }, { status: 500 }))
