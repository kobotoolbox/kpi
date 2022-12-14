// Thin kobo api wrapper around fetch
import {ROOT_URL} from './constants';
import {Json} from './components/common/common.interfaces';

const JSON_HEADER = 'application/json';

const fetchData = async <T>(path: string, method = 'GET', data?: Json) => {
  const headers: {[key: string]: string} = {
    Accept: JSON_HEADER,
  };

  if (data) {
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
  return (await response.json()) as Promise<T>;
};

/** GET Kobo API at path */
export const fetchGet = async <T>(path: string) => {
  return fetchData<T>(path);
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
