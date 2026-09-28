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
/** Where the one-time code goes once a password has been accepted */
export const MFA_AUTHENTICATE_URL = '*/api/v2/allauth/browser/v1/auth/2fa/authenticate'
/** Asking for a reset link */
export const PASSWORD_REQUEST_URL = '*/api/v2/allauth/browser/v1/auth/password/request'
/** `GET` checks the key from the link, `POST` sets the new password */
export const PASSWORD_RESET_URL = '*/api/v2/allauth/browser/v1/auth/password/reset'
/** `GET` asks what the provider gave us, `POST` fills in the rest */
export const PROVIDER_SIGNUP_URL = '*/api/v2/allauth/browser/v1/auth/provider/signup'

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

/** A sign-in allauth was happy with: the session exists, and the form may leave `/accounts`. */
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

/** The one-time code checked out: allauth finishes the sign-in it had paused and hands out the session. */
export const mfaAuthenticatedMock = () =>
  http.post(MFA_AUTHENTICATE_URL, () =>
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
        methods: [
          { method: 'password', at: 1700000000, username: 'sallyride' },
          { method: 'mfa', at: 1700000001, type: 'totp' },
        ],
      },
      meta: { is_authenticated: true },
    }),
  )

/** A code allauth refused. `param: 'code'` puts the message under the input; omit it for the banner. */
export const mfaErrorsMock = (errors: ErrorResponseErrorsItem[]) =>
  http.post(MFA_AUTHENTICATE_URL, () => HttpResponse.json({ status: 400, errors }, { status: 400 }))

/** A code check that never answers, so the submit button stays in its loading state. */
export const mfaNeverAnswersMock = () =>
  http.post(MFA_AUTHENTICATE_URL, async () => {
    await delay('infinite')
  })

/**
 * allauth is not waiting on a code any more: `mfa_authenticate` has dropped off the pending flows, so the
 * half-finished sign-in this code was for is gone.
 */
export const mfaFlowExpiredMock = () =>
  http.post(MFA_AUTHENTICATE_URL, () =>
    HttpResponse.json(
      { status: 401, data: { flows: [{ id: 'login' }] }, meta: { is_authenticated: false } },
      { status: 401 },
    ),
  )

/** The server itself broke, which is the only way into the code form's `onError`. */
export const mfaServerErrorMock = () =>
  http.post(MFA_AUTHENTICATE_URL, () => HttpResponse.json({ detail: 'Internal server error.' }, { status: 500 }))

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

/**
 * A taken reset request on a server running `ACCOUNT_PASSWORD_RESET_BY_CODE_ENABLED`: the mail carries a code, and
 * the 401 says the flow is waiting for it.
 */
export const passwordRequestCodeSentMock = () =>
  http.post(PASSWORD_REQUEST_URL, () =>
    HttpResponse.json(
      {
        status: 401,
        data: { flows: [{ id: 'login' }, { id: 'password_reset_by_code', is_pending: true }] },
        meta: { is_authenticated: false },
      },
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

interface PendingProviderSignupOptions {
  /** allauth's `display`: "a name derived from the third-party provider account data". */
  display?: string
  email?: string
  username?: string
  providerName?: string
}

/**
 * A provider signup allauth is holding, because the handshake came back with too little to make an account
 * from. Whatever the provider did give us is here, and is what the form starts filled in with.
 *
 * Pass a blank string for anything the provider said nothing about - GitLab hands over a username and an
 * address, plenty of OIDC deployments hand over less.
 */
export const providerSignupPendingMock = ({
  display = 'Sally Ride',
  email = 'sallyride@nasa.com',
  username = 'sallyride',
  providerName = 'Example Organization',
}: PendingProviderSignupOptions = {}) =>
  http.get(PROVIDER_SIGNUP_URL, () =>
    HttpResponse.json({
      status: 200,
      data: {
        email: [{ email, primary: true, verified: false }],
        account: {
          uid: 'provider-account-uid',
          display,
          provider: { id: 'example-org', name: providerName, flows: ['provider_redirect'] },
        },
        user: { display, username, has_usable_password: false },
      },
    }),
  )

/**
 * No provider signup is pending. Covers the handshake having failed, the signup already being finished, and
 * the session that held it having expired - allauth answers 409 to all three.
 */
export const providerSignupNothingPendingMock = () =>
  http.get(PROVIDER_SIGNUP_URL, () => HttpResponse.json({ status: 409 }, { status: 409 }))

/** A lookup that never answers, so the screen stays on its loading panel. */
export const providerSignupLookupNeverAnswersMock = () =>
  http.get(PROVIDER_SIGNUP_URL, async () => {
    await delay('infinite')
  })

/**
 * The lookup itself breaking, which says nothing about the pending signup. `once` leaves the handler behind
 * it to answer the retry.
 */
export const providerSignupLookupServerErrorMock = ({ once }: { once?: boolean } = {}) =>
  http.get(PROVIDER_SIGNUP_URL, () => HttpResponse.json({ detail: 'Internal server error.' }, { status: 500 }), {
    once,
  })

/** A finished provider signup where verification is `none` or `optional`: the account is created and logged in. */
export const providerSignupAuthenticatedMock = () =>
  http.post(PROVIDER_SIGNUP_URL, () =>
    HttpResponse.json({
      status: 200,
      data: {
        user: {
          id: 1,
          display: 'sallyride',
          username: 'sallyride',
          email: 'sallyride@nasa.com',
          // No password: the provider is the credential.
          has_usable_password: false,
        },
        methods: [],
      },
      meta: { is_authenticated: true },
    }),
  )

/**
 * The happy path under `ACCOUNT_EMAIL_VERIFICATION = 'mandatory'`, the KPI default: 401, since an address
 * that came from a provider is still not a confirmed address.
 */
export const providerSignupPendingVerificationMock = () =>
  http.post(PROVIDER_SIGNUP_URL, () =>
    HttpResponse.json(
      {
        status: 401,
        data: { flows: [{ id: 'login' }, { id: 'verify_email', is_pending: true }] },
        meta: { is_authenticated: false },
      },
      { status: 401 },
    ),
  )

/** A rejected provider signup. `param` is the allauth field name; omit it for an error with no field. */
export const providerSignupErrorsMock = (errors: ErrorResponseErrorsItem[]) =>
  http.post(PROVIDER_SIGNUP_URL, () => HttpResponse.json({ status: 400, errors }, { status: 400 }))

/** A submit that never answers, so the button stays in its loading state. */
export const providerSignupNeverAnswersMock = () =>
  http.post(PROVIDER_SIGNUP_URL, async () => {
    await delay('infinite')
  })

/** The flow went away between loading the form and submitting it. */
export const providerSignupFlowExpiredMock = () =>
  http.post(PROVIDER_SIGNUP_URL, () => HttpResponse.json({ status: 409 }, { status: 409 }))

/** The server itself broke, which is the only way into the form's `onError`. */
export const providerSignupServerErrorMock = () =>
  http.post(PROVIDER_SIGNUP_URL, () => HttpResponse.json({ detail: 'Internal server error.' }, { status: 500 }))
