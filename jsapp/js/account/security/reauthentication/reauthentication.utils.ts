import { ServerError } from '#/api/ServerError'
import type { EmailReauthenticationRequiredResponse } from '#/api/models/emailReauthenticationRequiredResponse'
import type { Flow } from '#/api/models/flow'
import { FlowId } from '#/api/models/flowId'
import type { OrvalFetchError } from '#/api/onErrorDefaultHandler'

/** `code` of the 403 KPI's own sensitive endpoints answer, see `kobo/apps/accounts/reauthentication.py` */
const REAUTHENTICATION_REQUIRED_CODE = 'reauthentication_required'

/** The 2FA types a code input can answer. A security key can't be typed in. */
const CODE_TYPES: readonly string[] = ['totp', 'recovery_codes']

/** Which credentials to ask for. KPI wants all of them, while allauth takes any one. */
export interface ReauthenticationAsk {
  isPasswordNeeded: boolean
  isCodeNeeded: boolean
  /** False when a step can't be done here, or none was named. Signing in again is the only way then. */
  isAnswerable: boolean
}

const isPasswordFlow = (flow: Partial<Flow>) => flow.id === FlowId.reauthenticate

const isCodeFlow = (flow: Partial<Flow>) =>
  flow.id === FlowId.mfa_reauthenticate && (flow.types ?? []).some((type) => CODE_TYPES.includes(type))

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
    isPasswordNeeded: flows.some(isPasswordFlow),
    isCodeNeeded: flows.some(isCodeFlow),
    isAnswerable: flows.length > 0 && flows.every((flow) => isPasswordFlow(flow) || isCodeFlow(flow)),
  }
}
