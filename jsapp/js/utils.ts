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
  consoleMsg?: Toast['message'],
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
notify.error = (msg: Toast['message'], opts?: ToastOptions, consoleMsg?: Toast['message']): Toast['id'] =>
  notify(msg, 'error', opts, consoleMsg);
notify.warning = (msg: Toast['message'], opts?: ToastOptions, consoleMsg?: Toast['message']): Toast['id'] =>
  notify(msg, 'warning', opts, consoleMsg);
notify.success = (msg: Toast['message'], opts?: ToastOptions, consoleMsg?: Toast['message']): Toast['id'] =>
  notify(msg, 'success', opts, consoleMsg);

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

// langString contains name and code e.g. "English (en)"
export function getLangAsObject(langString: string): LangObject | undefined {
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

export function getLangString(obj: LangObject): string | undefined {
  if (typeof obj === 'object' && obj.name && obj.code) {
    return `${obj.name} (${obj.code})`;
  } else {
    return undefined;
  }
}

export function stringToColor(str: string, prc?: number) {
  // Higher prc = lighter color, lower = darker
  prc = typeof prc === 'number' ? prc : -15;
  const hash = function (word: string) {
    let h = 0;
    for (let i = 0; i < word.length; i++) {
      h = word.charCodeAt(i) + ((h << 5) - h);
    }
    return h;
  };
  const shade = function (color: string, prc2: number) {
    const num = parseInt(color, 16);
    const amt = Math.round(2.55 * prc2);
    const R = (num >> 16) + amt;
    const G = ((num >> 8) & 0x00ff) + amt;
    const B = (num & 0x0000ff) + amt;
    return (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1);
  };
  const intToRgba = function (i: number) {
    const color =
      ((i >> 24) & 0xff).toString(16) +
      ((i >> 16) & 0xff).toString(16) +
      ((i >> 8) & 0xff).toString(16) +
      (i & 0xff).toString(16);
    return color;
  };
  return shade(intToRgba(hash(str)), prc);
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
