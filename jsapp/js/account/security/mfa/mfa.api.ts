import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  type CredentialField,
  CredentialRejection,
  assertOk,
  reauthenticate,
} from '#/account/security/reauthentication/reauthentication.api'
import { type OrvalFetchError, onErrorDefaultHandler } from '#/api/onErrorDefaultHandler'
import {
  allauthBrowserV1AccountAuthenticatorsRecoveryCodesGet,
  type allauthBrowserV1AccountAuthenticatorsRecoveryCodesGetResponse200,
  allauthBrowserV1AccountAuthenticatorsRecoveryCodesPost,
  allauthBrowserV1AccountAuthenticatorsTotpDelete,
  allauthBrowserV1AccountAuthenticatorsTotpGet,
  allauthBrowserV1AccountAuthenticatorsTotpPost,
  getAllauthBrowserV1AccountAuthenticatorsGetQueryKey,
  useAllauthBrowserV1AccountAuthenticatorsGet,
  useAllauthBrowserV1AuthSessionGet,
} from '#/api/react-query/authentication-allauth-headless'
import { splitAllauthErrors } from '#/auth/allauthErrors'
import { getAuthStatusQueryKey } from '#/auth/authChangeWatcher'
import { getAuthStatus } from '#/auth/authStatus'
import { notify } from '#/utils'

// allauth wants a recent authentication before any 2FA change, and answers a 401 otherwise. KPI asks for it in the
// modal rather than on a screen of its own, and wants the password and the code together, so each write
// reauthenticates first with what the modal collected.

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

/** Whether the account has a password. Undefined until the session has loaded. */
export function useHasUsablePassword() {
  const { data } = useAllauthBrowserV1AuthSessionGet<boolean | undefined>({
    query: {
      queryKey: getAuthStatusQueryKey(),
      select: (response) => getAuthStatus(response).user?.has_usable_password,
      throwOnError: false,
    },
  })
  return data
}

/** Every write changes the status, so they all reread {@link useMfaStatus} */
function useMfaMutation<TData, TVariables = void>(key: string, mutationFn: (variables: TVariables) => Promise<TData>) {
  const queryClient = useQueryClient()

  return useMutation<TData, OrvalFetchError | CredentialRejection, TVariables>({
    mutationKey: ['mfa', key],
    mutationFn,
    onError: (error, variables, context) => {
      if (!(error instanceof CredentialRejection)) {
        onErrorDefaultHandler(error, variables, context)
      } else if (!error.field) {
        notify(error.message, 'error')
      }
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: getAllauthBrowserV1AccountAuthenticatorsGetQueryKey() }),
  })
}

/** Replaces the recovery codes, invalidating the previous set */
async function generateRecoveryCodes(field: CredentialField | null) {
  const response = await allauthBrowserV1AccountAuthenticatorsRecoveryCodesPost()
  assertOk(response, field)
  // allauth's spec leaves out this 200, which carries the same body as the GET
  return (response as allauthBrowserV1AccountAuthenticatorsRecoveryCodesGetResponse200).data.data.unused_codes
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
    throw new CredentialRejection(null, splitAllauthErrors(response, []).formErrors[0])
  })

interface MfaConfirmVariables extends MfaCode {
  /** Leave out for accounts without a password, see {@link useHasUsablePassword} */
  password?: string
}

/** Turns 2FA on. Read the codes allauth made along with it through {@link useMfaRecoveryCodes}. */
export const useMfaConfirmCode = () =>
  useMfaMutation<void, MfaConfirmVariables>('confirm', async ({ code, password }) => {
    await reauthenticate({ password })
    assertOk(await allauthBrowserV1AccountAuthenticatorsTotpPost({ code }), 'code')
  })

/**
 * Separate from {@link useMfaConfirmCode}, so a failed read can be retried without turning 2FA on twice. Needs no
 * reauthentication right after activation: the backend counts the activation as a fresh 2FA authentication. A retry
 * may come after that has expired, so it passes a new code to reauthenticate with first.
 */
export const useMfaRecoveryCodes = () =>
  useMfaMutation<string[], Partial<MfaCode>>('recoveryCodes', async ({ code }) => {
    if (code) {
      await reauthenticate({ code })
    }
    const response = await allauthBrowserV1AccountAuthenticatorsRecoveryCodesGet()
    assertOk(response, null)
    // KPI hides codes kept from the old 2FA system, as it only has their hashes. A new setup gets new ones instead
    const codes = response.data.data.unused_codes
    return codes?.length ? codes : generateRecoveryCodes(null)
  })

interface MfaDeactivateVariables extends MfaCode {
  /** Leave out for accounts without a password, see {@link useHasUsablePassword} */
  password?: string
}

/** KPI wants every credential the account has before 2FA goes off, so the password as well as the code */
export const useMfaDeactivate = () =>
  useMfaMutation<void, MfaDeactivateVariables>('deactivate', async ({ code, password }) => {
    await reauthenticate({ password, code })
    // KPI refuses with a 403 for superusers under `SUPERUSER_AUTH_ENFORCEMENT`
    assertOk(await allauthBrowserV1AccountAuthenticatorsTotpDelete(), 'code')
  })

/** Reauthenticates first, with the code alone: allauth's rule, which KPI keeps here */
export const useMfaRegenerateCodes = () =>
  useMfaMutation<string[], MfaCode>('regenerate', async ({ code }) => {
    await reauthenticate({ code })
    return generateRecoveryCodes('code')
  })
