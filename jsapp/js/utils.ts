/**
 * A collection of miscellaneous utility functions.
 *
 * NOTE: these are used also by the Form Builder coffee code (see
 * `jsapp/xlform/src/view.surveyApp.coffee`)
 *
 * NOTE: We have other utils files related to asset, submissions, etc.
 */

import moment from 'moment';
import type {Toast, ToastOptions} from 'react-hot-toast';
import {toast} from 'react-hot-toast';
import {Cookies} from 'react-cookie';
import * as Sentry from '@sentry/react';
import random from 'lodash.random';

export const LANGUAGE_COOKIE_NAME = 'django_language';

const cookies = new Cookies();

/**
 * Pop up a notification with react-hot-toast
 * Some default options are set in the <Toaster/> component
 *
 * Also log messages to browser console to help with debugging.
 */
const notify = (
  msg: Toast['message'],
  atype = 'success',
  opts?: ToastOptions,
  consoleMsg?: Toast['message']
): Toast['id'] => {
  // To avoid changing too much, the default remains 'success' if unspecified.
  //   e.g. notify('yay!') // success

  // avoid displaying a (specific) JSON structure in the notification
  if (typeof msg === 'string' && msg[0] === '{') {
    try {
      const parsed = JSON.parse(msg);
      if (Object.keys(parsed).length === 1 && 'detail' in parsed) {
        msg = `${parsed.detail}`;
      }
    } catch (err) {
      console.error('notification starts with { but is not parseable JSON.');
    }
  }

  /* eslint-disable no-console */
  // If a specific console message is provided, display that instead of the default msg
  switch (atype) {
    case 'success':
      console.log('[notify] ✅ ' + (consoleMsg || msg));
      return toast.success(msg, opts);

    case 'error':
      console.error('[notify] ❌ ' + (consoleMsg || msg));
      return toast.error(msg, opts);

    case 'warning':
      console.warn('[notify] ⚠️ ' + (consoleMsg || msg));
      return toast(msg, Object.assign({icon: '⚠️'}, opts));

    case 'empty':
      console.log('[notify] 📢 ' + (consoleMsg || msg));
      return toast(msg, opts); // No icon

    // Defensively render empty if we're passed an unknown atype,
    // in case we missed something.
    //   e.g. notify('mystery!', '?') //
    default:
      console.log('[notify] 📢 ' + (consoleMsg || msg));
      return toast(msg, opts); // No icon
  }
  /* eslint-enable no-console */
};

// Convenience functions for code readability, consolidated here
notify.error = (
  msg: Toast['message'],
  opts?: ToastOptions,
  consoleMsg?: Toast['message']
): Toast['id'] => notify(msg, 'error', opts, consoleMsg);
notify.warning = (
  msg: Toast['message'],
  opts?: ToastOptions,
  consoleMsg?: Toast['message']
): Toast['id'] => notify(msg, 'warning', opts, consoleMsg);
notify.success = (
  msg: Toast['message'],
  opts?: ToastOptions,
  consoleMsg?: Toast['message']
): Toast['id'] => notify(msg, 'success', opts, consoleMsg);

export {notify};

/**
 * Returns a copy of arr with separator inserted in every other place.
 * It's like Array.join('\n'), but more generic.
 *
 * Usage: join(['hi', 'hello', 'how are you'], <br/>)
 *          => ['hi', <br/>, 'hello', <br/>, 'how are you']
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function join(arr: any[], separator: any): any[] {
  // Allocate enough indices to place separators between every element.
  const result = Array(arr.length * 2 - 1);
  result[0] = arr[0]; // Start with first element from original array
  for (let i = 1; i < arr.length; i++) {
    result[i * 2 - 1] = separator; // Place separators ...
    result[i * 2] = arr[i]; // ... and original elements from the array
  }
  return result;
}

/**
 * Returns something like "Today at 4:06 PM", "Yesterday at 5:46 PM", "Last Saturday at 5:46 PM" or "February 11, 2021"
 */
export function formatTime(timeStr: string): string {
  const myMoment = moment.utc(timeStr).local();
  return myMoment.calendar(null, {sameElse: 'LL'});
}

/**
 * Returns something like "Mar 15, 2021"
 */
export function formatDate(
  timeStr: string,
  localize = true,
  format = 'll'
): string {
  let myMoment = moment.utc(timeStr);
  if (localize) {
    myMoment = myMoment.local();
  }
  return myMoment.format(format);
}

/**
 * Takes a Unix timestamp. Returns a UTC string
 */
export function convertUnixTimestampToUtc(time: number): string {
  const date = new Date(time * 1000); //seconds to milliseconds
  return date.toISOString();
}

/**
 * Returns something like "March 15, 2021 4:06 PM"
 */
export function formatTimeDate(timeStr: string, localize = true): string {
  return formatDate(timeStr, localize, 'LLL');
}

/**
 * Returns something like "Sep 4, 1986 8:30 PM"
 */
export function formatTimeDateShort(timeStr: string, localize = true): string {
  return formatDate(timeStr, localize, 'lll');
}

/**
 * Returns something like "March 2021"
 */
export function formatMonth(timeStr: string, localize = true): string {
  return formatDate(timeStr, localize, 'MMMM YYYY');
}

/** Returns something like "07:59" */
export function formatSeconds(seconds: number) {
  // We don't care about milliseconds (sorry!).
  const secondsRound = Math.round(seconds);
  const minutes = Math.floor(secondsRound / 60);
  const secondsLeftover = secondsRound - minutes * 60;
  return `${String(minutes).padStart(2, '0')}:${String(
    secondsLeftover
  ).padStart(2, '0')}`;
}

export function formatRelativeTime(timeStr: string, localize = true): string {
  let myMoment = moment.utc(timeStr);
  if (localize) {
    myMoment = myMoment.local();
  }
  return myMoment.fromNow();
}

// TODO: Test if works for both form and library routes, if not make it more general
// See: https://github.com/kobotoolbox/kpi/issues/3909
export function getAssetUIDFromUrl(assetUrl: string): string | null {
  const matched = assetUrl.match(/.*\/([^/]+)\//);
  if (matched !== null) {
    return matched[1];
  }
  return null;
}

declare global {
  interface Window {
    log: () => void;

    // For legacy use. Instead, use `import * as Sentry from '@sentry/react';`.
    // See note on window.Raven in main.es6
    Raven?: Sentry.BrowserClient;
  }
}

export const log = (function () {
  const innerLogFn = function (...args: any[]) {
    // eslint-disable-next-line no-console
    console.log.apply(console, args);
    return args[0];
  };
  return innerLogFn;
})();
window.log = log;

export function currentLang(): string {
  return cookies.get(LANGUAGE_COOKIE_NAME) || 'en';
}

interface LangObject {
  code: string;
  name: string;
}

/** Alias for string but it always has `<name>(<code>)` format, e.g. "francais (fr)" */
export type LangString = string;

// langString contains name and code e.g. "English (en)"
export function getLangAsObject(langString: LangString): LangObject | undefined {
  const openingIndex = langString.indexOf('(');
  const closingIndex = langString.indexOf(')');

  const langCode = langString.substring(openingIndex + 1, closingIndex);

  const langName = langString.substring(0, openingIndex).trim();

  if (
    langCode &&
    langName &&
    // make sure langString contains just name and bracket-wrapped code
    langName.length + langCode.length + 3 === langString.length
  ) {
    return {
      code: langCode,
      name: langName,
    };
  } else {
    return undefined;
  }
}

export function getLangString(obj: LangObject): LangString | undefined {
  if (typeof obj === 'object' && obj.name && obj.code) {
    return `${obj.name} (${obj.code})`;
  } else {
    return undefined;
  }
}

export function isAValidUrl(url: string) {
  try {
    new URL(url);
    return true;
  } catch (e) {
    return false;
  }
}

export function checkLatLng(geolocation: any[]) {
  if (geolocation && geolocation[0] && geolocation[1]) {
    return true;
  } else {
    return false;
  }
}

export function validFileTypes() {
  const VALID_ASSET_UPLOAD_FILE_TYPES = [
    '.xls',
    '.xlsx',
    'application/xls',
    'application/vnd.ms-excel',
    'application/octet-stream',
    'application/vnd.openxmlformats',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '', // Keep this to fix issue with IE Edge sending an empty MIME type
  ];
  return VALID_ASSET_UPLOAD_FILE_TYPES.join(',');
}

export function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

export function renderCheckbox(id: string, label: string, isImportant = false) {
  let additionalClass = '';
  if (isImportant) {
    additionalClass += 'alertify-toggle-important';
  }
  return `<div class="alertify-toggle checkbox ${additionalClass}"><label class="checkbox__wrapper"><input type="checkbox" class="checkbox__input" id="${id}" data-cy="checkbox"><span class="checkbox__label">${label}</span></label></div>`;
}

export function hasVerticalScrollbar(element: HTMLElement): boolean {
  return element.scrollHeight > element.offsetHeight;
}

interface CSSStyleDeclarationForMicrosoft extends CSSStyleDeclaration {
  msOverflowStyle: string;
}

export function getScrollbarWidth(): number {
  // Creating invisible container
  const outer = document.createElement('div');
  const style: CSSStyleDeclarationForMicrosoft =
    outer.style as CSSStyleDeclarationForMicrosoft;
  style.visibility = 'hidden';
  style.overflow = 'scroll'; // forcing scrollbar to appear
  style.msOverflowStyle = 'scrollbar'; // needed for WinJS apps
  document.body.appendChild(outer);

  // Creating inner element and placing it in the container
  const inner = document.createElement('div');
  outer.appendChild(inner);

  // Calculating difference between container's full width and the child width
  const scrollbarWidth = outer.offsetWidth - inner.offsetWidth;

  // Removing temporary elements from the DOM
  if (outer.parentNode !== null) {
    outer.parentNode.removeChild(outer);
  }

  return scrollbarWidth;
}

export function launchPrinting() {
  window.print();
}

/**
 * Trunactes strings to specified length
 */
export function truncateString(str: string, length: number): string {
  let truncatedString = str;
  const halfway = Math.trunc(length / 2);

  if (length < truncatedString.length) {
    const truncatedStringFront = truncatedString.substring(0, halfway);
    const truncatedStringBack = truncatedString.slice(
      truncatedString.length - halfway
    );
    truncatedString = truncatedStringFront + '…' + truncatedStringBack;
  }

  return truncatedString;
}

/**
 * Removes protocol then calls truncateString()
 */
export function truncateUrl(str: string, length: number): string {
  const truncatedString = str.replace('https://', '').replace('http://', '');

  return truncateString(truncatedString, length);
}

/**
 * Removes file extension then calls truncateString()
 */
export function truncateFile(str: string, length: number) {
  // Remove file extension with simple regex that truncates everything past
  // the last occurance of `.` inclusively
  const truncatedString = str.replace(/\.[^/.]+$/, '');

  return truncateString(truncatedString, length);
}

/**
 * Truncates a floating point number to a fixed number of decimal places (default 2)
 */
export const truncateNumber = (decimal: number, decimalPlaces = 2) =>
  parseFloat(decimal.toFixed(decimalPlaces));

/**
 * Standard method for converting seconds to minutes for billing purposes
 */
 export const convertSecondsToMinutes = (seconds: number) =>
  Math.floor(truncateNumber(seconds/60, 1))

/**
 * Generates a simple lowercase, underscored version of a string. Useful for
 * quick filename generation
 *
 * Inspired by the way backend handles generating autonames for translations:
 * https://github.com/kobotoolbox/kpi/blob/27220c2e65b47a7f150c5bef64db97226987f8fc/kpi/utils/autoname.py#L132-L138
 */
export function generateAutoname(
  str: string,
  startIndex = 0,
  endIndex: number = str.length
) {
  return str
    .toLowerCase()
    .substring(startIndex, endIndex)
    .replace(/(\ |\.)/g, '_');
}

/**
 * Generates UUID string. Uses native crypto with a smart fallback function for
 * insecure contexts.
 */
export function generateUuid() {
  if (crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // That `randomUUID` function only exists in secure contexts, so locally
  // we need an alternative solution. This comes from a very educational
  // discussions at SO, see: https://stackoverflow.com/a/61011303/2311247
  return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (s) => {
    const c = Number.parseInt(s, 10);
    return (
      c ^
      (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))
    ).toString(16);
  });
}

/**
 * This is a function from `/jsapp/xlform/src/model.utils.coffee`. It's being
 * used to generate some unique-ish ids.
 *
 * @deprecated Use `generateUuid`.
 */
export function txtid() {
  const o = 'AAnCAnn'.replace(/[AaCn]/g, (c) => {
    const randChar = () => {
      let charI;
      charI = Math.floor(Math.random() * 52);
      charI += (charI <= 25 ? 65 : 71);
      return String.fromCharCode(charI);
    };
    const r = Math.random();
    if (c === 'a') {
      return randChar();
    } else if (c === 'A') {
      return String.fromCharCode(65 + (r * 26 | 0));
    } else if (c === 'C') {
      const newI = Math.floor(r * 62);
      if (newI > 52) {
        return String(newI - 52);
      } else {
        return randChar();
      }
    } else if (c === 'n') {
      return String(Math.floor(r * 10));
    }
    return '';
  });
  return o.toLowerCase();
}

export function csrfSafeMethod(method: string) {
  // these HTTP methods do not require CSRF protection
  return /^(GET|HEAD|OPTIONS|TRACE)$/.test(method);
}

export function downloadUrl(url: string) {
  const aEl = document.createElement('a');
  const splitUrl = url.split('/');
  const fileName = splitUrl[splitUrl.length - 1];
  aEl.href = url;
  aEl.setAttribute('download', fileName);
  aEl.click();
}

/**
 * An immutable function that removes element from index and inserts it at
 * another one.
 */
export function moveArrayElementToIndex(
  arr: any[],
  fromIndex: number,
  toIndex: number
) {
  const copiedArr = [...arr];
  const element = copiedArr[fromIndex];
  copiedArr.splice(fromIndex, 1);
  copiedArr.splice(toIndex, 0, element);
  return copiedArr;
}

export function getAudioDuration(src: string): Promise<number> {
  return new Promise((resolve) => {
    const audio = new Audio();
    $(audio).on('loadedmetadata', () => {
      resolve(audio.duration);
    });
    audio.src = src;
  });
}

/**
 * Exponentially increases the returned time each time this method is being
 * called, with some randomness included. You have to handle `callCount`
 * increasing yourself.
 *
 * Returns number in milliseconds.
 *
 * Note: min and max retry times should come from envStore. It's not in the
 * function itself to avoid a circular dependency.
 */
export function getExponentialDelayTime(
  callCount: number,
  /** minRetryTime - should probably use `min_retry_time` from env store. */
  minRetryTime: number,
  /** maxRetryTime - should probably use `max_retry_time` from env store. */
  maxRetryTime: number
) {
  // This magic number gives a nice grow for the delays.
  const magicFactor = 1.666;

  const count = Math.round(
    1000 *
      Math.max(
        minRetryTime, // Bottom limit
        Math.min(
          maxRetryTime, // Top limit
          random(magicFactor ** callCount, magicFactor ** (callCount + 1))
        )
      )
  );

  return count;
}
