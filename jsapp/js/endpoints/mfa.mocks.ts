import { http, HttpResponse } from 'msw'
import type { TOTPAuthenticator } from '#/api/models/tOTPAuthenticator'
import { sessionAuthenticatedMock } from './allauth.mocks'

/**
 * Mocks for allauth's MFA endpoints. The writes edit the {@link MfaMockState} they are handed, so a story can watch
 * 2FA go on and off.
 */

const AUTHENTICATORS_URL = '*/api/v2/allauth/browser/v1/account/authenticators'
const TOTP_ENDPOINT_URL = '*/api/v2/allauth/browser/v1/account/authenticators/totp'
const RECOVERY_CODES_URL = '*/api/v2/allauth/browser/v1/account/authenticators/recovery-codes'
const REAUTHENTICATE_URL = '*/api/v2/allauth/browser/v1/auth/reauthenticate'
const MFA_REAUTHENTICATE_URL = '*/api/v2/allauth/browser/v1/auth/2fa/reauthenticate'

/** What `GET totp` hands out: the URI behind both the QR code and the manual secret. */
export const TOTP_URL = 'otpauth://totp/kobo-zefir?secret=MFADEMOSECRET234&issuer=kobo'

export const BACKUP_CODES = ['11aa22bb33cc', '44dd55ee66ff', '77gg88hh99ii', 'jj00kk11ll22', 'mm33nn44oo55']

/** The only code these mocks accept, so a story can also type a wrong one. */
export const VALID_CODE = '123456'

/** The only password these mocks accept */
export const VALID_PASSWORD = 'correct horse battery staple'

/** allauth's message for a wrong code */
export const INCORRECT_CODE_MESSAGE = 'Incorrect code.'

/** When {@link MFA_ACTIVE} was set up */
export const MFA_ACTIVE_CREATED_AT = '2026-02-03T04:05:06.000Z'

export const MFA_ACTIVE: TOTPAuthenticator = {
  type: 'totp',
  // allauth sends seconds
  created_at: Date.parse(MFA_ACTIVE_CREATED_AT) / 1000,
  last_used_at: Date.parse(MFA_ACTIVE_CREATED_AT) / 1000,
}

/** The user's authenticator table, reduced to the one row the section reads */
export interface MfaMockState {
  totp: TOTPAuthenticator | null
}

/** Rejects anything but `valid` under `field`, the way allauth does */
function withCredentialCheck(field: 'code' | 'password', valid: string, accepted: () => Response) {
  return async ({ request }: { request: Request }) => {
    const body = (await request.json()) as Record<string, string>

    if (body[field] !== valid) {
      const message = field === 'code' ? INCORRECT_CODE_MESSAGE : 'Incorrect password.'
      return HttpResponse.json({ status: 400, errors: [{ code: 'incorrect', param: field, message }] }, { status: 400 })
    }
    return accepted()
  }
}

/** A reauthentication allauth accepted */
const reauthenticated = () =>
  HttpResponse.json({
    status: 200,
    data: { user: { id: 1, display: 'sallyride', username: 'sallyride', has_usable_password: true }, methods: [] },
    meta: { is_authenticated: true },
  })

const recoveryCodes = () =>
  HttpResponse.json({
    status: 200,
    data: {
      type: 'recovery_codes',
      created_at: MFA_ACTIVE.created_at,
      last_used_at: null,
      total_code_count: BACKUP_CODES.length,
      unused_code_count: BACKUP_CODES.length,
      unused_codes: BACKUP_CODES,
    },
  })

export const mfaAuthenticatorsMock = (state: MfaMockState) =>
  http.get(AUTHENTICATORS_URL, () => HttpResponse.json({ status: 200, data: state.totp ? [state.totp] : [] }))

/** No authenticator yet, so allauth answers 404 with a fresh secret */
export const mfaTotpStatusMock = (state: MfaMockState) =>
  http.get(TOTP_ENDPOINT_URL, () =>
    state.totp
      ? HttpResponse.json({ status: 200, data: state.totp })
      : HttpResponse.json({ status: 404, meta: { secret: 'MFADEMOSECRET234', totp_url: TOTP_URL } }, { status: 404 }),
  )

export const mfaActivateMock = (state: MfaMockState) =>
  http.post(
    TOTP_ENDPOINT_URL,
    withCredentialCheck('code', VALID_CODE, () => {
      state.totp = MFA_ACTIVE
      return HttpResponse.json({ status: 200, data: MFA_ACTIVE })
    }),
  )

export const mfaDeactivateMock = (state: MfaMockState) =>
  http.delete(TOTP_ENDPOINT_URL, () => {
    state.totp = null
    return HttpResponse.json({ status: 200 })
  })

/** KPI's refusal for superusers under `SUPERUSER_AUTH_ENFORCEMENT` */
export const mfaDeactivateRefusedMock = () =>
  http.delete(TOTP_ENDPOINT_URL, () =>
    HttpResponse.json(
      {
        status: 403,
        errors: [{ code: 'cannot_delete_authenticator', message: 'You cannot deactivate two-factor authentication.' }],
      },
      { status: 403 },
    ),
  )

export const mfaRecoveryCodesMocks = () => [
  http.get(RECOVERY_CODES_URL, recoveryCodes),
  http.post(RECOVERY_CODES_URL, recoveryCodes),
]

/** Reading the codes breaking. `once` leaves the handler behind it to answer the retry. */
export const mfaRecoveryCodesServerErrorMock = ({ once }: { once?: boolean } = {}) =>
  http.get(RECOVERY_CODES_URL, () => HttpResponse.json({ detail: 'Internal server error.' }, { status: 500 }), { once })

/** Counts activations without answering, so the regular mock still does */
export const mfaActivateCounterMock = (onActivate: () => void) =>
  http.post(TOTP_ENDPOINT_URL, () => {
    onActivate()
  })

export const reauthenticateMocks = () => [
  http.post(REAUTHENTICATE_URL, withCredentialCheck('password', VALID_PASSWORD, reauthenticated)),
  http.post(MFA_REAUTHENTICATE_URL, withCredentialCheck('code', VALID_CODE, reauthenticated)),
]

/** Every handler over one state - what most stories need. Put overrides first, msw takes the first match. */
export const mfaMocks = (state: MfaMockState, { hasUsablePassword = true } = {}) => [
  sessionAuthenticatedMock({ hasUsablePassword }),
  mfaAuthenticatorsMock(state),
  mfaTotpStatusMock(state),
  mfaActivateMock(state),
  mfaDeactivateMock(state),
  ...mfaRecoveryCodesMocks(),
  ...reauthenticateMocks(),
]
