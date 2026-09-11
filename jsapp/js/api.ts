/**
 * Thin kobo api wrapper around fetch
 */

import * as Sentry from '@sentry/react'
import { containsHtmlMarkup } from '#/api/getDisplayableErrorText'
import { getFailResponseMessage } from '#/api/getFailResponseMessage'
import type { FailResponse } from '#/dataInterface'
import { getCsrfToken, notify } from '#/utils'
import type { Json } from './components/common/common.interfaces'
import { ROOT_URL } from './constants'

/**
 * jQuery calls `.fail()` handlers with `(jqXHR, textStatus, errorThrown)`, so `.fail(handleApiFail)` passes one of these
 * as the toast message. None of them is copy for a user.
 */
const JQUERY_TEXT_STATUSES = ['error', 'timeout', 'abort', 'parsererror', 'nocontent', 'notmodified']

/**
 * Whether a fail response is the result of us aborting the request on purpose (rather than an actual API error). Useful
 * for callers that keep their own error state and shouldn't flag a request they cancelled themselves.
 */
export function isAbortResponse(response: FailResponse) {
  return response.status === 0 && response.statusText === 'abort'
}

/**
 * Useful for handling the fail responses from API. Its main goal is to display a helpful error toast notification and
 * to pass the error message to Sentry.
 *
 * It detects response bodies that aren't messages (an HTML error page, a traceback) and uses a generic message instead
 * of spitting them out - the raw body still goes to the console and to Sentry. The error message displayed to the user
 * can be customized using the optional `toastMessage` argument.
 *
 * @deprecated - instead, use react-query + Orval.
 */
export function handleApiFail(response: FailResponse, toastMessage?: string) {
  // Don't do anything if we purposefully aborted the request
  if (isAbortResponse(response)) {
    return
  }

  const customMessage = toastMessage && !JQUERY_TEXT_STATUSES.includes(toastMessage) ? toastMessage : undefined

  const responseMessage = response.responseText
  let htmlMessage = ''

  if (typeof responseMessage === 'string' && containsHtmlMarkup(responseMessage)) {
    // Try plucking the useful error message from the HTML string - this works
    // for Werkzeug Debugger only. It is being used on development environment,
    // on production this would most probably result in an empty message (and
    // thus falling back to the generic message below).
    const htmlDoc = new DOMParser().parseFromString(responseMessage, 'text/html')
    htmlMessage = htmlDoc.getElementsByClassName('errormsg')[0]?.textContent?.trim() ?? ''
  }

  /*
  the message shown to the user, which uses (in descending order of priority)
  1. the toast message (if provided)
  2. the Werkzeug-plucked error (development only)
  3. the response body, when it holds a message - see `getFailResponseMessage`
  4. a generic error
  */
  const backendMessage = htmlMessage || getFailResponseMessage(response)

  let displayMessage = backendMessage

  if (customMessage || !displayMessage) {
    // display the caller's message or, if we don't have *any* message available, use a generic error
    displayMessage = customMessage || t('An error occurred')

    if (!window.navigator.onLine) {
      // another general case — the original fetch response.message might have
      // something more useful to say.
      displayMessage += '\n\n' + t('Your connection is offline')
    }
  }

  const statusMessage = response.status || response.statusText ? `${response.status} ${response.statusText}` : ''

  // The body no longer reaches the toast, so log it here instead - a suppressed
  // traceback is still the fastest way to find out what actually broke.
  const consoleMessage = [statusMessage, responseMessage].filter(Boolean).join(' | ') || displayMessage

  // show the error message to the user
  notify.error(displayMessage, undefined, consoleMessage)

  // Sentry groups issues by message, so send the status rather than a body that
  // differs on every request. The body itself rides along as extra context.
  Sentry.captureMessage(
    backendMessage || statusMessage || displayMessage,
    responseMessage ? { extra: { responseText: responseMessage } } : undefined,
  )
}

const JSON_HEADER = 'application/json'

// TODO: Figure out how to improve UX if there are many errors happening
// simultaneously (other than deciding not to show them.)
//
// const notifyServerErrorThrottled = throttle(
//   (errorMessage: string) => {
//     notify(errorMessage, 'error');
//   },
//   500 // half second
// );

type FetchHttpMethod = 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE'

export interface FetchDataOptions {
  /**
   * By default we display an error toast notification when response is not good
   * and the error code is clearly error. If you need to handle the notification
   * in some other manner make it `false`. This is useful for example if the 404
   * response is a meaningful "good" response.
   *
   * `true` by default
   */
  notifyAboutError?: boolean
  /**
   * Override the default error toast message text. Sentry will still receive the
   * default error message, for debugging purposes.
   *
   * Only applies when `notifyAboutError` is `true`.
   */
  errorMessageDisplay?: string
  /**
   * Useful if you already have a full URL to be called and there is no point
   * adding `ROOT_URL` to it.
   *
   * `true` by default
   */
  prependRootUrl?: boolean
  /**
   * Include the headers along with the response body, under the `headers` key.
   * Useful if, for example, you need to determine the age of a cached response.
   * **/
  includeHeaders?: boolean
}

/**
 * @deprecated - instead, use react-query + Orval.
 */
export const fetchDataRaw = async <T>(
  /**
   * If you have full url to be called, remember to use `prependRootUrl` option.
   */
  path: string,
  method: FetchHttpMethod,
  data?: string,
  options?: FetchDataOptions,
) => {
  // Prepare options
  const defaults = { notifyAboutError: true, prependRootUrl: true }
  const { notifyAboutError, prependRootUrl } = Object.assign({}, defaults, options)

  const headers: { [key: string]: string } = {
    Accept: JSON_HEADER,
  }

  // For when it's needed we pass authentication data
  if (method !== 'GET') {
    const csrfToken = getCsrfToken()
    if (csrfToken) {
      headers['X-CSRFToken'] = csrfToken
    }

    headers['Content-Type'] = JSON_HEADER
  }

  // This function is expected to be used mostly with paths pointing at API
  // endpoints that start on "/", but sometimes we already have full URL and
  // there is no point adding anything to it.
  const url = prependRootUrl ? ROOT_URL + path : path

  const fetchOptions: RequestInit = {
    method: method,
    headers,
  }

  if (data) {
    fetchOptions['body'] = data
  }

  const response = await fetch(url, fetchOptions)

  const contentType = response.headers.get('content-type')

  // Error handling
  if (!response.ok) {
    // This will be returned with the promise rejection. It can include that
    // response JSON, but not all endpoints/situations will produce one.
    const failResponse: FailResponse = {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    }

    if (contentType && contentType.indexOf('application/json') !== -1) {
      failResponse.responseText = await response.text()
      try {
        failResponse.responseJSON = JSON.parse(failResponse.responseText)
      } catch {
        // If the response text is not a proper JSON, we simply don't add it to
        // the rejection object.
      }
    }

    // For these codes we might display a toast with HTTP status (through
    // `handleApiFail` helper)
    if (
      notifyAboutError &&
      (response.status === 401 || response.status === 403 || response.status === 404 || response.status >= 500)
    ) {
      handleApiFail(failResponse, options?.errorMessageDisplay)
    }

    return Promise.reject(failResponse)
  }

  let responseJson = {}
  // There is no response for 204
  if (response.status !== 204 && contentType && contentType.indexOf('application/json') !== -1) {
    responseJson = await response.json()
  }

  if (options?.includeHeaders) {
    responseJson = {
      headers: response.headers,
      ...responseJson,
    } as { headers: Headers } & T
  }

  return { data: responseJson, status: response.status, headers: response.headers } as T
}

/**
 * @deprecated - instead, use react-query + Orval.
 */
const fetchData = async <T>(
  /**
   * If you have full url to be called, remember to use `prependRootUrl` option.
   */
  path: string,
  method: FetchHttpMethod,
  data?: Json,
  options?: FetchDataOptions,
) => {
  const body = data ? JSON.stringify(data) : undefined
  const response = await fetchDataRaw<{ data: T; status: number; headers: unknown }>(path, method, body, options)
  return response.data
}
/**
 * GET Kobo API at path
 * @deprecated - instead, use react-query + Orval.
 */
export const fetchGet = async <T>(path: string, options?: FetchDataOptions) =>
  fetchData<T>(path, 'GET', undefined, options)

/**
 * GET data from Kobo API at url
 * @deprecated - instead, use react-query + Orval.
 */
export const fetchGetUrl = async <T>(url: string, options?: FetchDataOptions) => {
  options = Object.assign({}, options, { prependRootUrl: false })
  return fetchData<T>(url, 'GET', undefined, options)
}

/**
 * POST data to Kobo API at path
 * @deprecated - instead, use react-query + Orval.
 */
export const fetchPost = async <T>(path: string, data: Json, options?: FetchDataOptions) =>
  fetchData<T>(path, 'POST', data, options)

/**
 * POST data to Kobo API at url
 * @deprecated - instead, use react-query + Orval.
 */
export const fetchPostUrl = async <T>(url: string, data: Json, options?: FetchDataOptions) => {
  options = Object.assign({}, options, { prependRootUrl: false })
  return fetchData<T>(url, 'POST', data, options)
}

/**
 * PATCH (update) data to Kobo API at path
 * @deprecated - instead, use react-query + Orval.
 */
export const fetchPatch = async <T>(path: string, data: Json, options?: FetchDataOptions) =>
  fetchData<T>(path, 'PATCH', data, options)

/**
 * PATCH (update) data to Kobo API at url
 * @deprecated - instead, use react-query + Orval.
 */
export const fetchPatchUrl = async <T>(path: string, data: Json, options?: FetchDataOptions) => {
  options = Object.assign({}, options, { prependRootUrl: false })
  return fetchData<T>(path, 'PATCH', data, options)
}

/**
 * PUT (replace) data to Kobo API at path
 * @deprecated - instead, use react-query + Orval.
 */
export const fetchPut = async <T>(path: string, data: Json, options?: FetchDataOptions) =>
  fetchData<T>(path, 'PUT', data, options)

/**
 * PUT (replace) data to Kobo API at url
 * @deprecated - instead, use react-query + Orval.
 */
export const fetchPutUrl = async <T>(path: string, data: Json, options?: FetchDataOptions) => {
  options = Object.assign({}, options, { prependRootUrl: false })
  return fetchData<T>(path, 'PUT', data, options)
}

/**
 * DELETE something from Kobo API at path, data is optional
 * @deprecated - instead, use react-query + Orval.
 */
export const fetchDelete = async <T>(path: string, data?: Json, options?: FetchDataOptions) =>
  fetchData<T>(path, 'DELETE', data, options)

/**
 * DELETE something from Kobo API at url, data is optional
 * @deprecated - instead, use react-query + Orval.
 */
export const fetchDeleteUrl = async <T>(path: string, data?: Json, options?: FetchDataOptions) => {
  options = Object.assign({}, options, { prependRootUrl: false })
  return fetchData<T>(path, 'DELETE', data, options)
}
