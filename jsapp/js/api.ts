// Thin kobo api wrapper around fetch
import {ROOT_URL} from './constants';
import type {Json} from './components/common/common.interfaces';

const JSON_HEADER = 'application/json';

const fetchData = async <T>(path: string, method = 'GET', data?: Json) => {
  const headers: {[key: string]: string} = {
    Accept: JSON_HEADER,
  };

  if (method === 'DELETE' || data) {
    const csrfCookie = document.cookie.match(/csrftoken=(\w{64})/);
    if (csrfCookie) {
      headers['X-CSRFToken'] = csrfCookie[1];
    }

    headers['Content-Type'] = JSON_HEADER;
  }

  const response = await fetch(ROOT_URL + path, {
    method: method,
    headers,
    body: JSON.stringify(data),
  });
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.indexOf('application/json') !== -1) {
    return (await response.json()) as Promise<T>;
  }
  return {} as T;
};

/** GET Kobo API at path */
export const fetchGet = async <T>(path: string) => fetchData<T>(path);

/** POST data to Kobo API at path */
export const fetchPost = async <T>(path: string, data: Json) =>
  fetchData<T>(path, 'POST', data);

/** PATCH (update) data to Kobo API at path */
export const fetchPatch = async <T>(path: string, data: Json) =>
  fetchData<T>(path, 'PATCH', data);

/** PUT (replace) data to Kobo API at path */
export const fetchPut = async <T>(path: string, data: Json) =>
  fetchData<T>(path, 'PUT', data);

/** DELETE data to Kobo API at path, data is optional */
export const fetchDelete = async (path: string, data?: Json) =>
  fetchData<unknown>(path, 'DELETE', data);
