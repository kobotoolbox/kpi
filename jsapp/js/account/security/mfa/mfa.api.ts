import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type OrvalFetchError, onErrorDefaultHandler } from '#/api/onErrorDefaultHandler'
import {
  allauthBrowserV1AccountAuthenticatorsRecoveryCodesGet,
  type allauthBrowserV1AccountAuthenticatorsRecoveryCodesGetResponse200,
  allauthBrowserV1AccountAuthenticatorsRecoveryCodesPost,
  allauthBrowserV1AccountAuthenticatorsTotpDelete,
  allauthBrowserV1AccountAuthenticatorsTotpGet,
  allauthBrowserV1AccountAuthenticatorsTotpPost,
  allauthBrowserV1Auth2faReauthenticatePost,
  allauthBrowserV1AuthReauthenticatePost,
  getAllauthBrowserV1AccountAuthenticatorsGetQueryKey,
  useAllauthBrowserV1AccountAuthenticatorsGet,
  useAllauthBrowserV1AuthSessionGet,
} from '#/api/react-query/authentication-allauth-headless'
import { type AllauthResponse, splitAllauthErrors } from '#/auth/allauthErrors'
import { getAuthStatusQueryKey } from '#/auth/authChangeWatcher'
import { getAuthStatus } from '#/auth/authStatus'
import { notify } from '#/utils'

// allauth wants a recent authentication before any 2FA change, and answers a 401 otherwise. That 401 makes
// `AuthChangeRedirector` leave the page and lose the modal, so each write reauthenticates first.

/** The modal input a refusal belongs to */
type MfaField = 'code' | 'password'

/** allauth refused a request. The modal shows it by `field`; with no field it becomes a toast. */
export class MfaRejection extends Error {
  constructor(
    readonly field: MfaField | null,
    message: string,
  ) {
    super(message)
    this.name = 'MfaRejection'
  }
}

/** Throws a {@link MfaRejection} unless allauth answered 200 */
function assertOk<T extends AllauthResponse>(
  response: T,
  field: MfaField | null,
): asserts response is Extract<T, { status: 200 }> {
  if (response.status === 200) {
    return
  }
  const { fieldErrors, formErrors } = splitAllauthErrors(response, field ? [field] : [])
  throw new MfaRejection(field, (field && fieldErrors[field]) || formErrors[0])
}

/** A TOTP token or a recovery code - allauth takes either */
interface MfaCode {
  code: string
}

export interface MfaStatus {
  isActive: boolean
  /** When the authenticator app was set up */
  dateCreated: string | null
}

export interface MfaSetup {
  qrCodeUrl: string
}

export function useMfaStatus() {
  return useAllauthBrowserV1AccountAuthenticatorsGet<MfaStatus>({
    query: {
      queryKey: getAllauthBrowserV1AccountAuthenticatorsGetQueryKey(),
      select: (response) => {
        const totp = response.status === 200 ? response.data.data.find(({ type }) => type === 'totp') : undefined
        return {
          isActive: Boolean(totp),
          // allauth sends seconds
          dateCreated: totp ? new Date(totp.created_at * 1000).toISOString() : null,
        }
      },
    },
  })
}

/** SSO-only accounts have no password, and allauth doesn't ask them for one */
export function useIsPasswordNeeded() {
  const { data } = useAllauthBrowserV1AuthSessionGet<boolean>({
    query: {
      queryKey: getAuthStatusQueryKey(),
      select: (response) => getAuthStatus(response).user?.has_usable_password ?? true,
      throwOnError: false,
    },
  })
  // Ask until we know otherwise
  return data ?? true
}

/** Every write changes the status, so they all reread {@link useMfaStatus} */
function useMfaMutation<TData, TVariables = void>(key: string, mutationFn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient()

  return useMutation<TData, OrvalFetchError | MfaRejection, TVariables>({
    mutationKey: ['mfa', key],
    mutationFn,
    onError: (error, variables, context) => {
      if (!(error instanceof MfaRejection)) {
        onErrorDefaultHandler(error, variables, context)
      } else if (!error.field) {
        notify(error.message, 'error')
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: getAllauthBrowserV1AccountAuthenticatorsGetQueryKey() }),
  })
}

async function reauthenticateWithCode(code: string) {
  assertOk(await allauthBrowserV1Auth2faReauthenticatePost({ code }), 'code')
}

/**
 * Reserves a TOTP secret and returns its QR code. 2FA stays off until {@link useMfaConfirmCode} accepts a token.
 * A mutation, not a query: every read replaces the secret.
 */
export const useMfaActivate = () =>
  useMfaMutation<MfaSetup>('activate', async () => {
    const response = await allauthBrowserV1AccountAuthenticatorsTotpGet()
    // allauth hands out the secret with a 404, as in "no authenticator yet"
    if (response.status === 404) {
      return { qrCodeUrl: response.data.meta.totp_url }
    }
    // A 200 (2FA already on) or a 409 (allauth won't add one). The status reread fixes the switch
    throw new MfaRejection(null, splitAllauthErrors(response, []).formErrors[0])
  })

interface MfaConfirmVariables extends MfaCode {
  /** Leave out for accounts {@link useIsPasswordNeeded} lets through */
  password?: string
}

/** Turns 2FA on. Read the codes allauth made along with it through {@link useMfaRecoveryCodes}. */
export const useMfaConfirmCode = () =>
  useMfaMutation<void, MfaConfirmVariables>('confirm', async ({ code, password }) => {
    if (password !== undefined) {
      assertOk(await allauthBrowserV1AuthReauthenticatePost({ password }), 'password')
    }
    assertOk(await allauthBrowserV1AccountAuthenticatorsTotpPost({ code }), 'code')
  })

/** Separate from {@link useMfaConfirmCode}, so a failed read can be retried without turning 2FA on twice */
export const useMfaRecoveryCodes = () =>
  useMfaMutation<string[]>('recoveryCodes', async () => {
    const response = await allauthBrowserV1AccountAuthenticatorsRecoveryCodesGet()
    assertOk(response, null)
    return response.data.data.unused_codes
  })

/** TODO: DEV-1971 drop the code once the reauthentication screens exist */
export const useMfaDeactivate = () =>
  useMfaMutation<void, MfaCode>('deactivate', async ({ code }) => {
    await reauthenticateWithCode(code)
    // KPI refuses with a 403 for superusers under `SUPERUSER_AUTH_ENFORCEMENT`
    assertOk(await allauthBrowserV1AccountAuthenticatorsTotpDelete(), 'code')
  })

/**
 * Replaces the recovery codes, invalidating the previous set
 *
 * TODO: DEV-1971 drop the code, same as {@link useMfaDeactivate}
 */
export const useMfaRegenerateCodes = () =>
  useMfaMutation<string[], MfaCode>('regenerate', async ({ code }) => {
    await reauthenticateWithCode(code)

    const response = await allauthBrowserV1AccountAuthenticatorsRecoveryCodesPost()
    assertOk(response, 'code')
    // allauth's spec leaves out this 200, which carries the same body as the GET
    return (response as allauthBrowserV1AccountAuthenticatorsRecoveryCodesGetResponse200).data.data.unused_codes
  })
