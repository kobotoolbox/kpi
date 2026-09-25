import { http, HttpResponse, delay } from 'msw'
import type { AccountConfigurationLoginMethodsItem } from '#/api/models/accountConfigurationLoginMethodsItem'
import type { ErrorResponseErrorsItem } from '#/api/models/errorResponseErrorsItem'

/**
 * Hand written msw handlers for allauth's headless endpoints. The generated ones answer 200 with faker data, and every
 * interesting allauth outcome is a non-2xx - a successful signup included.
 */

const SIGNUP_URL = '*/api/v2/allauth/browser/v1/auth/signup'
const EMAIL_VERIFY_URL = '*/api/v2/allauth/browser/v1/auth/email/verify'
const SESSION_URL = '*/api/v2/allauth/browser/v1/auth/session'
const CONFIG_URL = '*/api/v2/allauth/browser/v1/config'
/** Exported so a story can put its own handler here and inspect the credentials the form posted. */
export const LOGIN_URL = '*/api/v2/allauth/browser/v1/auth/login'

/** allauth's own settings. The default `loginMethods` matches an instance that left `ACCOUNT_LOGIN_METHODS` alone. */
export const allauthConfigurationMock = (loginMethods: AccountConfigurationLoginMethodsItem[] = ['username']) =>
  http.get(CONFIG_URL, () =>
    HttpResponse.json({
      status: 200,
      data: {
        account: {
          login_methods: loginMethods,
          is_open_for_signup: true,
          email_verification_by_code_enabled: false,
          login_by_code_enabled: false,
          password_reset_by_code_enabled: false,
        },
      },
    }),
  )

/** The settings never arriving, so the form has no credential it can safely ask for. */
export const allauthConfigurationServerErrorMock = () =>
  http.get(CONFIG_URL, () => HttpResponse.json({ detail: 'Internal server error.' }, { status: 500 }))

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
            display: 'sallyride',
            username: 'sallyride',
            email: 'sallyride@nasa.com',
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

/** A sign-in allauth was happy with: the session exists, and the form may leave `/auth`. */
export const loginAuthenticatedMock = () =>
  http.post(LOGIN_URL, () =>
    HttpResponse.json({
      status: 200,
      data: {
        user: {
          id: 1,
          display: 'sallyride',
          username: 'sallyride',
          email: 'sallyride@nasa.com',
          has_usable_password: true,
        },
        methods: [{ method: 'password', at: 1700000000, username: 'sallyride' }],
      },
      meta: { is_authenticated: true },
    }),
  )

/** A rejected sign-in */
export const loginErrorsMock = (errors: ErrorResponseErrorsItem[]) =>
  http.post(LOGIN_URL, () => HttpResponse.json({ status: 400, errors }, { status: 400 }))

/** A sign-in request that never answers, so the submit button stays in its loading state. */
export const loginNeverAnswersMock = () =>
  http.post(LOGIN_URL, async () => {
    await delay('infinite')
  })

/** Credentials allauth accepted from an account whose address is still unconfirmed */
export const loginEmailVerificationRequiredMock = () =>
  http.post(LOGIN_URL, () =>
    HttpResponse.json(
      {
        status: 401,
        data: { flows: [{ id: 'login' }, { id: 'verify_email', is_pending: true }] },
        meta: { is_authenticated: false },
      },
      { status: 401 },
    ),
  )

/** The same halfway-there 401, this time waiting on a one-time code from `allauth.mfa` */
export const loginMfaRequiredMock = () =>
  http.post(LOGIN_URL, () =>
    HttpResponse.json(
      {
        status: 401,
        data: { flows: [{ id: 'login' }, { id: 'mfa_authenticate', is_pending: true }] },
        meta: { is_authenticated: false },
      },
      { status: 401 },
    ),
  )

/** Somebody is already signed in - allauth says 409 and nothing else */
export const loginAlreadyAuthenticatedMock = () =>
  http.post(LOGIN_URL, () => HttpResponse.json({ status: 409 }, { status: 409 }))

/** The server itself broke */
export const loginServerErrorMock = () =>
  http.post(LOGIN_URL, () => HttpResponse.json({ detail: 'Internal server error.' }, { status: 500 }))

/** A logout that never answers, so the button it was clicked on stays in its loading state. */
export const logoutNeverAnswersMock = () =>
  http.delete(SESSION_URL, async () => {
    await delay('infinite')
  })

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

/**
 * The activation key lookup itself breaking, which is a 5xx: the one lookup outcome `fetchAllauth` throws
 * on. `once` leaves the handler behind it to answer the retry.
 */
export const emailVerificationServerErrorMock = ({ once }: { once?: boolean } = {}) =>
  http.get(EMAIL_VERIFY_URL, () => HttpResponse.json({ detail: 'Internal server error.' }, { status: 500 }), { once })

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
      data: { user: { id: 1, display: 'sallyride', username: 'sallyride', has_usable_password: true }, methods: [] },
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
