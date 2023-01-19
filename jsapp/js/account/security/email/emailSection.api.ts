import type {PaginatedResponse} from 'js/dataInterface';
import {fetchGet, fetchPost, fetchDelete} from 'jsapp/js/api';

export interface EmailResponse {
  primary: boolean;
  email: string;
  verified: boolean;
}

const LIST_URL = '/me/emails/';

export async function getUserEmails() {
  return fetchGet<PaginatedResponse<EmailResponse>>(LIST_URL);
}

export async function setUserEmail(newEmail: string) {
  return fetchPost<EmailResponse>(LIST_URL, {email: newEmail});
}

/** Removes all unverified/non-primary emails (there should only be one anyway)*/
export async function deleteUnverifiedUserEmails() {
  return fetchDelete(LIST_URL);
}
