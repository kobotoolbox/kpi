import type { AuthenticationResponse } from '#/api/models/authenticationResponse'
import type { ErrorResponse } from '#/api/models/errorResponse'
import type { ErrorResponseErrorsItem } from '#/api/models/errorResponseErrorsItem'
import { FlowId } from '#/api/models/flowId'

/**
 * allauth's headless endpoints answer with their own errors, which `#/api/onErrorDefaultHandler`
 * cannot read - `getApiErrorMessage()` only looks at Django's `detail` and `error` keys.
 *
 * These all take a response rather than a thrown error: allauth uses status codes as protocol signals -
 * some of its 4xx answers are successes - so `fetchAllauth` hands every 4xx back as data and leaves the
 * reading of it to us.
 *
 * See https://docs.allauth.org/en/latest/headless/openapi-specification/
 */

/** What every allauth response has in common once `fetchAllauth` is done with it. */
export interface AllauthResponse {
  status: number
  data: unknown
}

export interface AllauthErrorSplit {
  /** Keyed by form field name, ready to hand to Mantine's `form.setErrors()`. */
  fieldErrors: Record<string, string>
  /** Messages that belong under no input, for the banner above the form. Never empty on failure. */
  formErrors: string[]
}

/** For a failure allauth did not describe: a 5xx, a dead connection, or a body we cannot read. */
export const getGenericAllauthErrorMessage = () => t('Something went wrong. Please try again later.')

function getErrorItems(response: AllauthResponse): ErrorResponseErrorsItem[] {
  const body = response.data as ErrorResponse | undefined
  if (!Array.isArray(body?.errors)) {
    return []
  }
  return body.errors.filter((item) => typeof item?.message === 'string')
}

/** Statuses allauth answers with an empty body, so the copy has to come from us. */
function getMessagelessStatusMessage(status: number): string {
  if (status === 403) {
    return t('Account registration is not available on this server.')
  }
  if (status === 409) {
    return t('You are already logged in. Please log out before creating another account.')
  }
  return getGenericAllauthErrorMessage()
}

/**
 * Splits a rejected allauth call into inline field errors and banner messages.
 *
 * Anything allauth names in `param` that is not in `formFields` goes to the banner:
 * `form.setErrors()` will happily store an error under a path no input reads, hiding the message.
 */
export function splitAllauthErrors(response: AllauthResponse, formFields: readonly string[]): AllauthErrorSplit {
  const fieldErrors: Record<string, string> = {}
  const formErrors: string[] = []

  for (const item of getErrorItems(response)) {
    const field = item.param && formFields.includes(item.param) ? item.param : null
    if (field && !(field in fieldErrors)) {
      fieldErrors[field] = item.message
    } else {
      // No `param`, a field we don't render, or a second message for a field that already has one -
      // only one error renders under an input.
      formErrors.push(item.message)
    }
  }

  if (!formErrors.length && !Object.keys(fieldErrors).length) {
    formErrors.push(getMessagelessStatusMessage(response.status))
  }

  return { fieldErrors, formErrors }
}

/**
 * Whether a signup answer is in fact the happy path.
 *
 * Under `ACCOUNT_EMAIL_VERIFICATION = 'mandatory'` (the KPI default) a successful signup answers 401 with a pending
 * `verify_email` flow, since the new account is not logged in until the address is confirmed.
 */
export function isPendingEmailVerification(response: AllauthResponse): boolean {
  if (response.status !== 401) {
    return false
  }
  const flows = (response.data as AuthenticationResponse | undefined)?.data?.flows
  return Array.isArray(flows) && flows.some((flow) => flow.id === FlowId.verify_email && flow.is_pending === true)
}
