import { ServerError } from '#/api/ServerError'
import type { EmailReauthenticationRequiredResponse } from '#/api/models/emailReauthenticationRequiredResponse'
import type { Flow } from '#/api/models/flow'
import { FlowId } from '#/api/models/flowId'
import type { OrvalFetchError } from '#/api/onErrorDefaultHandler'

/** `code` of the 403 KPI's own sensitive endpoints answer, see `kobo/apps/accounts/reauthentication.py` */
const REAUTHENTICATION_REQUIRED_CODE = 'reauthentication_required'

/**
 * Which credentials to ask for. KPI wants all of them, while allauth takes any one.
 *
 * Note: no case for an ask that can't be answered here. The backend never refuses an account with nothing to prove,
 * and its 2FA types are TOTP and recovery codes only (no `webauthn`), both typed into the same code input.
 */
export interface ReauthenticationAsk {
  isPasswordNeeded: boolean
  isCodeNeeded: boolean
}

/** Reads the reauthentication ask out of a KPI 403, or `null` when the error is something else */
export function getReauthenticationAsk(error: OrvalFetchError): ReauthenticationAsk | null {
  if (!(error instanceof ServerError) || error.response.status !== 403) {
    return null
  }
  const body = error.parsedResponse as Partial<EmailReauthenticationRequiredResponse> | undefined
  if (body?.code !== REAUTHENTICATION_REQUIRED_CODE) {
    return null
  }

  // The generated type leaves the items untyped, but they are allauth's flows
  const flows = (Array.isArray(body.flows) ? body.flows : []) as Partial<Flow>[]
  return {
    isPasswordNeeded: flows.some((flow) => flow.id === FlowId.reauthenticate),
    isCodeNeeded: flows.some((flow) => flow.id === FlowId.mfa_reauthenticate),
  }
}
