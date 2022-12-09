import type {PaginatedResponse, FailResponse} from 'js/dataInterface';
import {ROOT_URL} from 'js/constants';

export interface EmailResponse {
  primary: boolean;
  email: string;
  verified: boolean;
}

export async function getUserEmails(): Promise<PaginatedResponse<EmailResponse>> {
  return fetch(`${ROOT_URL}/me/emails`)
    .then((response) => response.json())
    .catch((error) => console.log(error));
}

export async function setUserEmail(newEmail: string): Promise<EmailResponse> {
  return fetch(`${ROOT_URL}/me/emails`, {
    method: 'POST',
    body: JSON.stringify({'email': newEmail}),
  })
    .then((response) => response.json())
    .catch((error) => console.log(error));
}
