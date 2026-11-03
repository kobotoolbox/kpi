import { useMutation, useQueryClient } from '@tanstack/react-query'
import { CredentialRejection, assertOk, reauthenticate } from '#/account/security/reauthentication/reauthentication.api'
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
import { notify } from '#/utils'

// allauth wants a recent authentication before any 2FA change, and answers a 401 otherwise. KPI wants the password
// and the code together, so each write reauthenticates first with whatever the modal collected.

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

/**
 * Copy of the `ACCOUNT_REAUTHENTICATION_TIMEOUT` default from `kobo/settings/base.py` - change both together.
 *
 * TODO: DEV-3184 read it from the backend once DEV-3183 exposes it
 */
const REAUTHENTICATION_TIMEOUT_SECONDS = 300
/** Asks a bit early, so the window doesn't close while the user scans and types */
const REAUTHENTICATION_MARGIN_SECONDS = 60

interface PasswordCheckReading {
  hasUsablePassword: boolean
  /** Last reauthentication, in server seconds */
  reauthenticatedAt: number | null
  /** Server clock when this reading came in, so a wrong browser clock doesn't matter */
  serverNow: number | null
}

/** Only the part of the session body this reads */
interface SessionBody {
  data?: { user?: { has_usable_password?: boolean }; methods?: Array<{ at?: number; reauthenticated?: boolean }> }
}

/** SSO-only accounts have no password to confirm with. Assumed to have one until the session says otherwise. */
export function useHasUsablePassword() {
  const { data } = useAllauthBrowserV1AuthSessionGet<boolean>({
    query: {
      queryKey: getAuthStatusQueryKey(),
      select: (response) => (response.data as SessionBody | undefined)?.data?.user?.has_usable_password ?? true,
      throwOnError: false,
    },
  })
  return data ?? true
}

/** Whether allauth will want the password before 2FA goes on. A function, so submit can ask again. */
export function usePasswordCheck() {
  const { data, dataUpdatedAt } = useAllauthBrowserV1AuthSessionGet<PasswordCheckReading>({
    query: {
      queryKey: getAuthStatusQueryKey(),
      select: (response) => {
        const body = response.data as SessionBody | undefined
        const serverDate = Date.parse(response.headers?.get('date') ?? '')
        return {
          // SSO-only accounts have no password, and allauth doesn't ask them for one
          hasUsablePassword: body?.data?.user?.has_usable_password ?? true,
          // Since allauth 65.20 a login doesn't count, only an explicit reauthentication
          reauthenticatedAt: body?.data?.methods?.filter((method) => method.reauthenticated).at(-1)?.at ?? null,
          serverNow: Number.isNaN(serverDate) ? null : serverDate / 1000,
        }
      },
      throwOnError: false,
    },
  })

  return () => {
    // Ask until we know otherwise
    if (!data || data.reauthenticatedAt === null) {
      return data?.hasUsablePassword ?? true
    }
    if (!data.hasUsablePassword) {
      return false
    }
    // Server time of the reading, plus what the browser has counted since
    const readingNow = data.serverNow ?? dataUpdatedAt / 1000
    const elapsed = readingNow - data.reauthenticatedAt + (Date.now() - dataUpdatedAt) / 1000
    return elapsed > REAUTHENTICATION_TIMEOUT_SECONDS - REAUTHENTICATION_MARGIN_SECONDS
  }
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
  /** Leave out for accounts {@link usePasswordCheck} lets through */
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
 * reauthentication right after activation: the backend counts the activation as a fresh 2FA authentication.
 */
export const useMfaRecoveryCodes = () =>
  useMfaMutation<string[]>('recoveryCodes', async () => {
    const response = await allauthBrowserV1AccountAuthenticatorsRecoveryCodesGet()
    assertOk(response, null)
    return response.data.data.unused_codes
  })

interface MfaDeactivateVariables extends MfaCode {
  /** Leave out for SSO-only accounts, see {@link useHasUsablePassword} */
  password?: string
}

/** KPI wants every credential the account has before 2FA goes off, so the password as well as the code */
export const useMfaDeactivate = () =>
  useMfaMutation<void, MfaDeactivateVariables>('deactivate', async ({ code, password }) => {
    await reauthenticate({ password, code })
    // KPI refuses with a 403 for superusers under `SUPERUSER_AUTH_ENFORCEMENT`
    assertOk(await allauthBrowserV1AccountAuthenticatorsTotpDelete(), 'code')
  })

/** Replaces the recovery codes, invalidating the previous set. allauth takes the code alone here. */
export const useMfaRegenerateCodes = () =>
  useMfaMutation<string[], MfaCode>('regenerate', async ({ code }) => {
    await reauthenticate({ code })

    const response = await allauthBrowserV1AccountAuthenticatorsRecoveryCodesPost()
    assertOk(response, 'code')
    // allauth's spec leaves out this 200, which carries the same body as the GET
    return (response as allauthBrowserV1AccountAuthenticatorsRecoveryCodesGetResponse200).data.data.unused_codes
  })
