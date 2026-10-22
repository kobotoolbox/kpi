import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { OrvalFetchError } from '#/api/onErrorDefaultHandler'
import { fetchWithAuth } from '#/api/orval.mutator'
import { ROOT_URL } from '#/constants'

// On KPI's MFA endpoints, not the generated `useAllauthBrowserV1AccountAuthenticators*` hooks: KPI keeps an
// `MfaMethodsWrapper` row that `is_mfa_enabled` gates on, so setting up through allauth alone would store a secret no
// login ever asks for.
//
// TODO: DEV-3120 switch these to the generated hooks once DEV-3109 drops that row. Allauth has no
// `date_modified`, so `dateModified` becomes the setup date.

/** The only method KPI offers, and part of every write URL */
const MFA_METHOD = 'app'

/** One row of `GET /auth/mfa/user-methods/` */
export interface MfaUserMethod {
  name: typeof MFA_METHOD
  is_active: boolean
  date_created: string
  date_modified: string
  date_disabled: string | null
}

/** A TOTP token or a recovery code - either works wherever the backend asks */
interface MfaCode {
  code: string
}

export interface MfaStatus {
  isActive: boolean
  /** When 2FA was last switched on or off, if ever */
  dateModified: string | null
}

export interface MfaSetup {
  qrCodeUrl: string
}

export const getMfaStatusQueryKey = () => ['mfaStatus'] as const

export function useMfaStatus() {
  return useQuery<MfaUserMethod[], OrvalFetchError, MfaStatus>({
    queryKey: getMfaStatusQueryKey(),
    queryFn: async () => {
      const { data } = await fetchWithAuth<{ data: MfaUserMethod[] }>(`${ROOT_URL}/api/v2/auth/mfa/user-methods/`, {
        method: 'GET',
      })
      return data
    },
    // Empty until 2FA has been set up once; the row then stays, even when switched off
    select: (methods) => {
      return {
        isActive: methods[0]?.is_active ?? false,
        dateModified: methods[0]?.date_modified ?? null,
      }
    },
  })
}

/**
 * Every write is a POST under the method name and changes the status, so they all reread {@link useMfaStatus}.
 * `normalize` keeps wire shapes out of the components.
 */
function useMfaMutation<TWire, TData, TVariables extends MfaCode | void = void>(
  endpoint: string,
  normalize: (wire: TWire) => TData,
) {
  const queryClient = useQueryClient()

  return useMutation<TData, OrvalFetchError, TVariables>({
    mutationKey: [`mfa/${endpoint}`],
    mutationFn: async (variables) => {
      const { data } = await fetchWithAuth<{ data: TWire }>(
        `${ROOT_URL}/api/v2/auth/${MFA_METHOD}/${endpoint}`,
        // `activate` is the one write with nothing to send
        { method: 'POST', body: variables ? JSON.stringify(variables) : undefined },
      )
      return normalize(data)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: getMfaStatusQueryKey() }),
  })
}

/**
 * Reserves a TOTP secret and returns its QR code. 2FA stays off until {@link useMfaConfirmCode} accepts a token.
 *
 * TODO: DEV-3120 remove this - allauth hands out the secret in its TOTP status 404
 */
export const useMfaActivate = () =>
  useMfaMutation<{ details: string }, MfaSetup>('activate/', ({ details }) => {
    return { qrCodeUrl: details }
  })

/**
 * Turns 2FA on, and returns the recovery codes - the only time they are shown
 *
 * TODO: DEV-3120 - allauth's activation omits the codes, so they will need a second read
 */
export const useMfaConfirmCode = () =>
  useMfaMutation<{ backup_codes: string[] }, string[], MfaCode>('activate/confirm/', ({ backup_codes }) => backup_codes)

/**
 * Switching 2FA off needs a token of its own: this endpoint never answers `reauthentication_required`, so there is
 * nothing for `AuthChangeRedirector` to catch
 *
 * TODO: DEV-1971 drop the code field - allauth's delete takes no body
 */
export const useMfaDeactivate = () => useMfaMutation<void, void, MfaCode>('deactivate/', () => undefined)

/**
 * Replaces the recovery codes, invalidating the previous set
 *
 * TODO: DEV-1971 drop the code field, same as {@link useMfaDeactivate}
 */
export const useMfaRegenerateCodes = () =>
  useMfaMutation<{ backup_codes: string[] }, string[], MfaCode>('codes/regenerate/', ({ backup_codes }) => backup_codes)
