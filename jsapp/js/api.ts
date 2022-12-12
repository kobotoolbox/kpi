// Thin kobo api wrapper around fetch
import {ROOT_URL} from './constants';
import {Json} from './components/common/common.interfaces';

export const fetchGet = async <T>(path: string) => {
  const response = await fetch(ROOT_URL + path, {
    headers: {
      Accept: 'application/json',
    },
  });
  return (await response.json()) as Promise<T>;
};

const fetchData = async <T>(path: string, method: string, data?: Json) => {
  let csrfToken = '';
  const csrfCookie = document.cookie.match(/csrftoken=(\w{64})/);
  if (csrfCookie) {
    csrfToken = csrfCookie[1];
  }

  const response = await fetch(ROOT_URL + path, {
    method: method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-CSRFToken': csrfToken,
    },
    body: JSON.stringify(data),
  });
  return (await response.json()) as Promise<T>;
};

export const fetchPost = async <T>(path: string, data: Json) => {
  return fetchData<T>(path, 'POST', data);
};

export const fetchPatch = async <T>(path: string, data: Json) => {
  return fetchData<T>(path, 'PATCH', data);
};

export const fetchPut = async <T>(path: string, data: Json) => {
  return fetchData<T>(path, 'PUT', data);
};

export const fetchDelete = async <T>(path: string, data?: Json) => {
  return fetchData<T>(path, 'DELETE', data);
};
