import { http, HttpResponse, delay } from 'msw'
import type { ErrorResponseErrorsItem } from '#/api/models/errorResponseErrorsItem'

/**
 * Hand written msw handlers for allauth's headless endpoints. The generated ones answer 200 with faker data, and every
 * interesting allauth outcome is a non-2xx - a successful signup included.
 */

const SIGNUP_URL = '*/api/v2/allauth/browser/v1/auth/signup'
const EMAIL_VERIFY_URL = '*/api/v2/allauth/browser/v1/auth/email/verify'
const SESSION_URL = '*/api/v2/allauth/browser/v1/auth/session'
/** Exported so a story can put its own handler here and inspect the credentials the form posted */
export const LOGIN_URL = '*/api/v2/allauth/browser/v1/auth/login'
/** Asking for a reset link */
export const PASSWORD_REQUEST_URL = '*/api/v2/allauth/browser/v1/auth/password/request'
/** `GET` checks the key from the link, `POST` sets the new password */
export const PASSWORD_RESET_URL = '*/api/v2/allauth/browser/v1/auth/password/reset'

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

/** A rejected reset request. `param: 'email'` puts the message under the input; omit it for the banner. */
export const passwordRequestErrorsMock = (errors: ErrorResponseErrorsItem[]) =>
  http.post(PASSWORD_REQUEST_URL, () => HttpResponse.json({ status: 400, errors }, { status: 400 }))

/** A reset request that never answers, so the submit button stays in its loading state. */
export const passwordRequestNeverAnswersMock = () =>
  http.post(PASSWORD_REQUEST_URL, async () => {
    await delay('infinite')
  })

/** The server itself broke, which is the only way into the request form's `onError`. */
export const passwordRequestServerErrorMock = () =>
  http.post(PASSWORD_REQUEST_URL, () => HttpResponse.json({ detail: 'Internal server error.' }, { status: 500 }))

/** Looking up a reset key that is still good, so the new password form may be shown. */
export const passwordResetKeyValidMock = () =>
  http.get(PASSWORD_RESET_URL, () =>
    HttpResponse.json({
      status: 200,
      data: { user: { id: 1, display: 'sallyride', username: 'sallyride', has_usable_password: true } },
    }),
  )

/** A reset key that has expired or was already used. */
export const passwordResetKeyInvalidMock = () =>
  http.get(PASSWORD_RESET_URL, () =>
    HttpResponse.json(
      { status: 400, errors: [{ code: 'invalid', param: 'key', message: 'Invalid or expired key.' }] },
      { status: 400 },
    ),
  )

/** A good key looked up while signed in: allauth will not reset a password from a link behind a session. */
export const passwordResetKeyConflictMock = () =>
  http.get(PASSWORD_RESET_URL, () => HttpResponse.json({ status: 409 }, { status: 409 }))

/**
 * A reset that changed the password and signed the account in: `ACCOUNT_LOGIN_ON_PASSWORD_RESET` on. With it
 * off - the KPI default - allauth answers 401, and the story covering that builds its own response.
 */
export const passwordResetDoneAndSignedInMock = () =>
  http.post(PASSWORD_RESET_URL, () =>
    HttpResponse.json({
      status: 200,
      data: {
        user: { id: 1, display: 'sallyride', username: 'sallyride', has_usable_password: true },
        methods: [{ method: 'password', at: 1700000000, username: 'sallyride' }],
      },
      meta: { is_authenticated: true },
    }),
  )

/** A rejected reset. `param: 'password'` lands under the input; `param: 'key'` ends the whole attempt. */
export const passwordResetErrorsMock = (errors: ErrorResponseErrorsItem[]) =>
  http.post(PASSWORD_RESET_URL, () => HttpResponse.json({ status: 400, errors }, { status: 400 }))
