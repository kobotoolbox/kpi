import { ServerError } from '#/api/ServerError'
import type { ErrorResponseErrorsItem } from '#/api/models/errorResponseErrorsItem'
import { FlowId } from '#/api/models/flowId'

/**
 * allauth's headless endpoints answer with their own errors, which `#/api/onErrorDefaultHandler`
 * cannot read - `getApiErrorMessage()` only looks at Django's `detail` and `error` keys.
 *
 * See https://docs.allauth.org/en/latest/headless/openapi-specification/
 */

/** `{status: 400, errors: [{code, param?, message}]}` - `param` is absent for non-field errors. */
interface AllauthErrorBody {
  status?: number
  errors?: ErrorResponseErrorsItem[]
}

/** `{status: 401, data: {flows: [{id, is_pending?}]}, meta: {is_authenticated: false}}` */
interface AllauthAuthenticationBody {
  data?: { flows?: Array<{ id?: string; is_pending?: boolean }> }
}

export interface AllauthErrorSplit {
  /** Keyed by form field name, ready to hand to Mantine's `form.setErrors()`. */
  fieldErrors: Record<string, string>
  /** Messages that belong under no input, for the banner above the form. Never empty on failure. */
  formErrors: string[]
}

function getErrorItems(error: unknown): ErrorResponseErrorsItem[] {
  if (!(error instanceof ServerError)) {
    return []
  }
  const body = error.parsedResponse as AllauthErrorBody | undefined
  if (!Array.isArray(body?.errors)) {
    return []
  }
  return body.errors.filter((item) => typeof item?.message === 'string')
}

/** Statuses allauth answers with an empty body, so the copy has to come from us. */
function getMessagelessStatusMessage(error: unknown): string {
  const status = error instanceof ServerError ? error.response.status : undefined
  if (status === 403) {
    return t('Account registration is not available on this server.')
  }
  if (status === 409) {
    return t('You are already logged in. Please log out before creating another account.')
  }
  return t('Something went wrong. Please try again later.')
}

/**
 * Splits a rejected allauth call into inline field errors and banner messages.
 *
 * Anything allauth names in `param` that is not in `formFields` goes to the banner:
 * `form.setErrors()` will happily store an error under a path no input reads, hiding the message.
 */
export function splitAllauthErrors(error: unknown, formFields: readonly string[]): AllauthErrorSplit {
  const fieldErrors: Record<string, string> = {}
  const formErrors: string[] = []

  for (const item of getErrorItems(error)) {
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
    formErrors.push(getMessagelessStatusMessage(error))
  }

  return { fieldErrors, formErrors }
}

/**
 * Whether a rejected signup is in fact the happy path.
 *
 * Under `ACCOUNT_EMAIL_VERIFICATION = 'mandatory'` (the KPI default) a successful signup answers 401 with a pending
 * `verify_email` flow, since the new account is not logged in yet. The fetch mutator throws on every non-2xx, so that
 * particular success would land in react-query's `onError`.
 */
export function isPendingEmailVerification(error: unknown): boolean {
  if (!(error instanceof ServerError) || error.response.status !== 401) {
    return false
  }
  const flows = (error.parsedResponse as AllauthAuthenticationBody | undefined)?.data?.flows
  return Array.isArray(flows) && flows.some((flow) => flow.id === FlowId.verify_email && flow.is_pending === true)
}

/**
 * Whether a rejected email verification is in fact the happy path.
 *
 * Endpoint docs say "a status code of 401 does not imply failure. It indicates that the email verification was
 * successful, yet, the user is still not signed in". That happens when `ACCOUNT_LOGIN_ON_EMAIL_CONFIRMATION` is off.
 * KPI sets it to `True` by default, so this is needed for servers that override it.
 */
export function isVerifiedWithoutSession(error: unknown): boolean {
  return error instanceof ServerError && error.response.status === 401
}
