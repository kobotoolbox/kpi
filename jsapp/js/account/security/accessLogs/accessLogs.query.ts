import { fetchGet, fetchPost } from '#/api'
import { endpoints } from '#/api.endpoints'
import type { FailResponse, PaginatedResponse } from '#/dataInterface'

export interface AccessLog {
  /** User URL */
  user: string
  user_uid: string
  /** Date string */
  date_created: string
  username: string
  metadata: {
    auth_type: 'digest' | 'submission-group' | string
    // Both `source` and `ip_address` appear only for `digest` type
    /** E.g. "Firefox (Ubuntu)" */
    source?: string
    ip_address?: string
  }
  /** For `submission-group` type, here is the number of submisssions. */
  count: number
}

export async function getAccessLogs(limit: number, offset: number) {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  })
  // Note: little crust ahead of time to make a simpler transition to generated react-query helpers.
  return {
    status: 200 as const,
    data: await fetchGet<PaginatedResponse<AccessLog>>(endpoints.ACCESS_LOGS_URL + '?' + params, {
      errorMessageDisplay: t('There was an error getting the list.'),
    }),
  }
}

/**
 * Starts the exporting process of the access logs.
 * @returns {Promise<void>} A promise that starts the export.
 */
export const startAccessLogsExport = () =>
  fetchPost(endpoints.ACCESS_LOGS_EXPORT_URL, {}, { notifyAboutError: false }).catch((error) => {
    const failResponse: FailResponse = {
      status: 500,
      statusText: error.message || t('An error occurred while exporting the logs'),
    }
    throw failResponse
  })
