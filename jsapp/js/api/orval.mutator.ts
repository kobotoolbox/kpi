import { type FetchDataOptions, fetchDataRaw } from '#/api'

interface RequestConfig extends Partial<RequestInit>, Partial<FetchDataOptions> {
  method?: 'GET' | 'PUT' | 'POST' | 'PATCH' | 'DELETE'
}

/**
 * A quick wrapper around fetchDataRaw to inject authentication.
 *
 * TODO: don't ignore RequestInit config.
 */
export const fetchWithAuth = async <T>(url: string, config: RequestConfig): Promise<T> => {
  const { method, body, errorMessageDisplay, includeHeaders, notifyAboutError, prependRootUrl, ..._configRest } = config
  const response = fetchDataRaw<T>(url, method!, body as string, {
    errorMessageDisplay,
    includeHeaders,
    notifyAboutError,
    prependRootUrl,
  })

  return response
}

export default fetchWithAuth
