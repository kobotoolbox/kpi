// Thin kobo api wrapper around fetch
import {ROOT_URL} from './constants';
import type {Json} from './components/common/common.interfaces';

const JSON_HEADER = 'application/json';

const fetchData = async <T>(
  /** If you have full url to be called, remember to use `prependRootUrl`. */
  path: string,
  method = 'GET',
  data?: Json,
  /**
   * Useful if you already have a full URL to be called and there is no point
   * adding `ROOT_URL` to it.
   */
  prependRootUrl = true,
) => {
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

  const url = prependRootUrl ? ROOT_URL + path : path;

  const response = await fetch(url, {
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

/** POST data to Kobo API at url */
export const fetchPostUrl = async <T>(url: string, data: Json) =>
  fetchData<T>(url, 'POST', data, false);

/** PATCH (update) data to Kobo API at path */
export const fetchPatch = async <T>(path: string, data: Json) =>
  fetchData<T>(path, 'PATCH', data);

/** PUT (replace) data to Kobo API at path */
export const fetchPut = async <T>(path: string, data: Json) =>
  fetchData<T>(path, 'PUT', data);

/** DELETE data to Kobo API at path, data is optional */
export const fetchDelete = async (path: string, data?: Json) =>
  fetchData<unknown>(path, 'DELETE', data);
