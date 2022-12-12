// Thin kobo api wrapper around fetch
import {ROOT_URL} from './constants';
import {Json} from './components/common/common.interfaces';

const JSON_HEADER = 'application/json';

/** GET Kobo API at path */
export const fetchGet = async <T>(path: string) => {
  const response = await fetch(ROOT_URL + path, {
    headers: {
      Accept: JSON_HEADER,
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
      Accept: JSON_HEADER,
      'Content-Type': JSON_HEADER,
      'X-CSRFToken': csrfToken,
    },
    body: JSON.stringify(data),
  });
  return (await response.json()) as Promise<T>;
};

/** POST data to Kobo API at path */
export const fetchPost = async <T>(path: string, data: Json) => {
  return fetchData<T>(path, 'POST', data);
};

/** PATCH (update) data to Kobo API at path */
export const fetchPatch = async <T>(path: string, data: Json) => {
  return fetchData<T>(path, 'PATCH', data);
};

/** PUT (replace) data to Kobo API at path */
export const fetchPut = async <T>(path: string, data: Json) => {
  return fetchData<T>(path, 'PUT', data);
};

/** DELETE data to Kobo API at path, data is optional */
export const fetchDelete = async <T>(path: string, data?: Json) => {
  return fetchData<T>(path, 'DELETE', data);
};
