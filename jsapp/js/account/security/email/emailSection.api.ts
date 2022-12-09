import type {PaginatedResponse, FailResponse} from 'js/dataInterface';
import {ROOT_URL} from 'js/constants';

export interface EmailResponse {
  primary: boolean;
  email: string;
  verified: boolean;
}

export async function getUserEmails() {
  return fetch(`${ROOT_URL}/me/emails`)
    .then((response) => response.json() as Promise<PaginatedResponse<EmailResponse>>)
    .catch((error) => console.log(error));
}
