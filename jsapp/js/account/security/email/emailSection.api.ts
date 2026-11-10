import { fetchDelete, fetchGet, fetchPost, handleApiFail } from '#/api'
import type { FailResponse, PaginatedResponse } from '#/dataInterface'

export interface EmailResponse {
  primary: boolean
  email: string
  verified: boolean
}

const LIST_URL = '/me/emails/'

export async function getUserEmails() {
  return fetchGet<PaginatedResponse<EmailResponse>>(LIST_URL)
}

/** Doesn't toast on failure; pass the error to `handleSetUserEmailFail`. */
export async function setUserEmail(newEmail: string) {
  return fetchPost<EmailResponse | FailResponse>(LIST_URL, { email: newEmail }, { notifyAboutError: false })
}

/** Returns messages to show by the email field, or toasts the error if there are none. */
export function handleSetUserEmailFail(err: FailResponse): string[] {
  // Email change needs a recent login, and there's no in-app re-authentication yet.
  if (err.responseJSON?.code === 'reauthentication_required') {
    return [t('For security, please log out and log back in, then change your email address right away.')]
  }
  const errors = err.responseJSON?.email
  if (Array.isArray(errors)) return errors
  if (typeof errors === 'string') return [errors]
  handleApiFail(err)
  return []
}

/** Removes all unverified/non-primary emails (there should only be one anyway)*/
export async function deleteUnverifiedUserEmails() {
  return fetchDelete(LIST_URL)
}
