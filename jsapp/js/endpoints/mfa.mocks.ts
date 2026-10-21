import { http, HttpResponse } from 'msw'
import type { MfaUserMethod } from '#/account/security/mfa/mfa.api'

/**
 * Mocks for KPI's own MFA endpoints, which have no generated handlers - they are absent from the OpenAPI schema.
 * The writes edit the array they are handed, so a story can watch 2FA go on and off.
 */

const USER_METHODS_URL = '*/api/v2/auth/mfa/user-methods{/}?'
const ACTIVATE_URL = '*/api/v2/auth/app/activate{/}?'
const CONFIRM_URL = '*/api/v2/auth/app/activate/confirm{/}?'
const DEACTIVATE_URL = '*/api/v2/auth/app/deactivate{/}?'
const REGENERATE_URL = '*/api/v2/auth/app/codes/regenerate{/}?'

/** What `activate` answers with: the URI behind both the QR code and the manual secret. */
export const TOTP_URL = 'otpauth://totp/kobo-zefir?secret=MFADEMOSECRET234&issuer=kobo'

export const BACKUP_CODES = ['11aa22bb33cc', '44dd55ee66ff', '77gg88hh99ii', 'jj00kk11ll22', 'mm33nn44oo55']

/** The only code these mocks accept, so a story can also type a wrong one. */
export const VALID_CODE = '123456'

export const MFA_ACTIVE: MfaUserMethod = {
  name: 'app',
  is_active: true,
  date_created: '2026-01-02T03:04:05Z',
  date_modified: '2026-02-03T04:05:06Z',
  date_disabled: null,
}

/** 2FA that was set up and later switched off, which is how the backend leaves the row behind. */
export const MFA_DISABLED: MfaUserMethod = {
  ...MFA_ACTIVE,
  is_active: false,
  date_disabled: '2026-03-04T05:06:07Z',
}

export const mfaUserMethodsMock = (methods: MfaUserMethod[]) =>
  http.get(USER_METHODS_URL, () => HttpResponse.json(methods))

/** Reserves a secret. 2FA is still off at this point - only `confirm` turns it on. */
export const mfaActivateMock = () => http.post(ACTIVATE_URL, () => HttpResponse.json({ details: TOTP_URL }))

/** Rejects anything but {@link VALID_CODE}, the way `MfaCodeSerializer` does */
function withCodeCheck(accepted: () => Response) {
  return async ({ request }: { request: Request }) => {
    const { code } = (await request.json()) as { code: string }

    if (code !== VALID_CODE) {
      return HttpResponse.json({ code: ['Invalid code'] }, { status: 400 })
    }
    return accepted()
  }
}

export const mfaConfirmCodeMock = (methods: MfaUserMethod[]) =>
  http.post(
    CONFIRM_URL,
    withCodeCheck(() => {
      methods.splice(0, methods.length, MFA_ACTIVE)

      return HttpResponse.json({ backup_codes: BACKUP_CODES })
    }),
  )

export const mfaDeactivateMock = (methods: MfaUserMethod[]) =>
  http.post(
    DEACTIVATE_URL,
    withCodeCheck(() => {
      methods.splice(0, methods.length, MFA_DISABLED)

      return HttpResponse.json({})
    }),
  )

export const mfaRegenerateCodesMock = () =>
  http.post(
    REGENERATE_URL,
    withCodeCheck(() => HttpResponse.json({ backup_codes: BACKUP_CODES })),
  )

/** Every handler over one array of methods - what most stories need */
export const mfaMocks = (methods: MfaUserMethod[]) => [
  mfaUserMethodsMock(methods),
  mfaActivateMock(),
  mfaConfirmCodeMock(methods),
  mfaDeactivateMock(methods),
  mfaRegenerateCodesMock(),
]
