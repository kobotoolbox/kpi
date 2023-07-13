// Thin kobo api wrapper around fetch
import {ROOT_URL} from './constants';
import type {Json} from './components/common/common.interfaces';
import type {FailResponse} from 'js/dataInterface';
import {notify} from 'js/utils';
import throttle from 'lodash.throttle';

const JSON_HEADER = 'application/json';

const notifyServerErrorThrottled = throttle(
  (errorMessage: string) => {
    notify(errorMessage, 'error');
  },
  500 // half second
);

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

  if (!response.ok) {
    // This will be returned with the promise rejection. It can include that
    // response JSON, but not all endpoints/situations will produce one.
    const failResponse: FailResponse = {
      status: response.status,
      statusText: response.statusText,
    };

    // For server issues, we simply reject with no additional data. We expect
    // the UI to not react with notifications or other indicators.
    if (
      response.status === 401 ||
      response.status === 403 ||
      response.status === 404 ||
      response.status >= 500
    ) {
      let errorMessage = t('An error occurred');
      errorMessage += ' ';
      errorMessage += response.status;
      errorMessage += ' ';
      errorMessage += response.statusText;

      // We only want to display the server issues notification once, even with
      // multiple calls failing
      notifyServerErrorThrottled(errorMessage);

      if (window.Raven) {
        window.Raven.captureMessage(errorMessage);
      }
      return Promise.reject(failResponse);
    }

    if (contentType && contentType.indexOf('application/json') !== -1) {
      failResponse.responseText = await response.text();
      try {
        failResponse.responseJSON = JSON.parse(failResponse.responseText);
      } catch {
        // If the response text is not a proper JSON, we simply don't add it to
        // the rejection object.
      }
    }

    return Promise.reject(failResponse);
  }

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
