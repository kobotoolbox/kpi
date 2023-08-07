// Thin kobo api wrapper around fetch
import {ROOT_URL} from './constants';
import type {Json} from './components/common/common.interfaces';
import type {FailResponse} from 'js/dataInterface';
import {notify} from 'js/utils';

const JSON_HEADER = 'application/json';

// TODO: Figure out how to improve UX if there are many errors happening
// simultaneously (other than deciding not to show them.)
//
// const notifyServerErrorThrottled = throttle(
//   (errorMessage: string) => {
//     notify(errorMessage, 'error');
//   },
//   500 // half second
// );

const fetchData = async <T>(
  /** If you have full url to be called, remember to use `prependRootUrl`. */
  path: string,
  method = 'GET',
  data?: Json,
  /**
   * Useful if you already have a full URL to be called and there is no point
   * adding `ROOT_URL` to it.
   */
  prependRootUrl = true
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

  if (!response.ok) {
    // This will be returned with the promise rejection. It can include that
    // response JSON, but not all endpoints/situations will produce one.
    const failResponse: FailResponse = {
      status: response.status,
      statusText: response.statusText,
    };

    // For these codes, reject the promise, and display a toast with HTTP status
    if (
      response.status === 401 ||
      response.status === 403 ||
      response.status === 404 ||
      response.status >= 500
    ) {
      let errorMessage = t('An error occurred');
      errorMessage += ' — ';
      errorMessage += response.status;
      errorMessage += ' ';
      errorMessage += response.statusText;
      notify(errorMessage, 'error');

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
