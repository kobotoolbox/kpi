import { useMutation } from '@tanstack/react-query'
import type { OrvalFetchError } from '#/api/onErrorDefaultHandler'
import {
  allauthBrowserV1Auth2faReauthenticatePost,
  allauthBrowserV1AuthReauthenticatePost,
} from '#/api/react-query/authentication-allauth-headless'
import { type AllauthResponse, splitAllauthErrors } from '#/auth/allauthErrors'

/** The input a refusal belongs to */
export type CredentialField = 'code' | 'password'

/** allauth refused a request. Shown by `field`; with no field it belongs to the whole form. */
export class CredentialRejection extends Error {
  constructor(
    readonly field: CredentialField | null,
    message: string,
  ) {
    super(message)
    this.name = 'CredentialRejection'
  }
}

/** Throws a {@link CredentialRejection} unless allauth answered 200 */
export function assertOk<T extends AllauthResponse>(
  response: T,
  field: CredentialField | null,
): asserts response is Extract<T, { status: 200 }> {
  if (response.status === 200) {
    return
  }
  const { fieldErrors, formErrors } = splitAllauthErrors(response, field ? [field] : [])
  throw new CredentialRejection(field, (field && fieldErrors[field]) || formErrors[0])
}

/** Leave out what allauth didn't ask for */
export interface ReauthenticateVariables {
  password?: string
  /** A TOTP token or a recovery code - allauth takes either */
  code?: string
}

/** Sends every credential asked for in one go: an email change wants the password and the 2FA code, not just one */
export async function reauthenticate({ password, code }: ReauthenticateVariables) {
  // Password first, so a wrong one doesn't use up a recovery code
  if (password !== undefined) {
    assertOk(await allauthBrowserV1AuthReauthenticatePost({ password }), 'password')
  }
  if (code !== undefined) {
    assertOk(await allauthBrowserV1Auth2faReauthenticatePost({ code }), 'code')
  }
}

export const useReauthenticate = () =>
  useMutation<void, OrvalFetchError | CredentialRejection, ReauthenticateVariables>({
    mutationKey: ['reauthenticate'],
    mutationFn: reauthenticate,
    // The form shows every failure itself
    onError: () => null,
  })
