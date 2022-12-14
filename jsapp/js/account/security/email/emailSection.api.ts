import type {PaginatedResponse, FailResponse} from 'js/dataInterface';
import {fetchGet, fetchPost} from 'jsapp/js/api';

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
