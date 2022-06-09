/**
 * A collection of miscellaneous utility functions.
 *
 * NOTE: these are used also by the Form Builder coffee code (see
 * `jsapp/xlform/src/view.surveyApp.coffee`)
 *
 * TODO: group these functions by what are they doing or where are they mostly
 * (or uniquely) used, and split to smaller files.
 */

import moment from 'moment';
import alertify from 'alertifyjs';
import {Cookies} from 'react-cookie';
import { hashHistory } from 'react-router';
// importing whole constants, as we override ROOT_URL in tests
import constants from 'js/constants';

export const LANGUAGE_COOKIE_NAME = 'django_language';

export var assign = require('object-assign');

alertify.defaults.notifier.delay = 10;
alertify.defaults.notifier.position = 'bottom-left';
alertify.defaults.notifier.closeButton = true;

const cookies = new Cookies();

export function notify(msg: string, atype='success') {
  alertify.notify(msg, atype);
}

/**
 * Returns something like "Today at 4:06 PM", "Yesterday at 5:46 PM", "Last Saturday at 5:46 PM" or "February 11, 2021"
 */
export function formatTime(timeStr: string): string {
  var _m = moment(timeStr);
  return _m.calendar(null, {sameElse: 'LL'});
}

/**
 * Returns something like "March 15, 2021 4:06 PM"
 */
export function formatTimeDate(timeStr: string): string {
  var _m = moment(timeStr);
  return _m.format('LLL');
}

/**
 * Returns something like "Sep 4, 1986 8:30 PM"
 */
export function formatTimeDateShort(timeStr: string): string {
  const _m = moment(timeStr)
  return _m.format('lll')
}

/**
 * Returns something like "Mar 15, 2021"
 */
export function formatDate(timeStr: string): string {
  var _m = moment(timeStr);
  return _m.format('ll');
}

// works universally for v1 and v2 urls
export function getUsernameFromUrl(userUrl: string): string | null {
  const matched = userUrl.match(/\/users\/(.*)\//);
  if (matched !== null) {
    return matched[1];
  }
  return null;
}

// TODO: Test if works for both form and library routes, if not make it more general
export function getAssetUIDFromUrl(assetUrl: string): string | null {
  const matched = assetUrl.match(/.*\/([^/]+)\//);
  if (matched !== null) {
    return matched[1];
  }
  return null
}

export function buildUserUrl(username: string): string {
  if (username.startsWith(window.location.protocol)) {
    console.error("buildUserUrl() called with URL instead of username (incomplete v2 migration)");
    return username;
  }
  return `${constants.ROOT_URL}/api/v2/users/${username}/`;
}

declare global {
  interface Window {
    log: any,
    MFAEnabled: boolean,
  }
}

export var log = (function(){
  var _log: any = function(...args: any[]) {
    console.log.apply(console, args);
    return args[0];
  };
  _log.profileSeconds = function(n=1) {
    console.profile();
    window.setTimeout(function(){
      console.profileEnd();
    }, n * 1000);
  };
  return _log;
})();
window.log = log;

const originalSupportEmail = 'help@kobotoolbox.org';

// use this utility function to replace hardcoded email in transifex translations
//
// TODO: make this use environment endpoint's `support_email` property.
// Currently no place is using this correctly.
export function replaceSupportEmail(str: string, newEmail?: string): string {
  if (typeof newEmail === 'string') {
    return str.replace(originalSupportEmail, newEmail);
  } else {
    return str;
  }
}

// returns an HTML string where [bracket] notation is replaced with a hyperlink
export function replaceBracketsWithLink(str: string, url?: string): string {
  const bracketRegex = /\[([^\]]+)\]/g;
  if (!url) {
    return str.replace(bracketRegex, '$1');
  }
  const linkHtml = `<a href="${url}" target="_blank">$1</a>`;
  return str.replace(bracketRegex, linkHtml);
}

export function currentLang(): string {
  return cookies.get(LANGUAGE_COOKIE_NAME) || 'en';
}

interface LangObject {
  code: string
  name: string
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
      name: langName
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

export function addRequiredToLabel(label: string, isRequired: boolean = true): string {
  if (!isRequired) {
    return label;
  }
  const requiredTemplate = t('##field_label## (required)');
  return requiredTemplate.replace('##field_label##', label);
}

export function stringToColor(str: string, prc: number) {
  // Higher prc = lighter color, lower = darker
  prc = typeof prc === 'number' ? prc : -15;
  var hash = function(word: string) {
      var h = 0;
      for (var i = 0; i < word.length; i++) {
          h = word.charCodeAt(i) + ((h << 5) - h);
      }
      return h;
  };
  var shade = function(color: string, prc: number) {
      var num = parseInt(color, 16),
          amt = Math.round(2.55 * prc),
          R = (num >> 16) + amt,
          G = (num >> 8 & 0x00FF) + amt,
          B = (num & 0x0000FF) + amt;
      return (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
          (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
          (B < 255 ? B < 1 ? 0 : B : 255))
          .toString(16)
          .slice(1);
  };
  var int_to_rgba = function(i: number) {
      var color = ((i >> 24) & 0xFF).toString(16) +
          ((i >> 16) & 0xFF).toString(16) +
          ((i >> 8) & 0xFF).toString(16) +
          (i & 0xFF).toString(16);
      return color;
  };
  return shade(int_to_rgba(hash(str)), prc);
}

export function isAValidUrl(url: string) {
  try {
    new URL(url);
    return true;
  } catch(e) {
    return false;
  }
}

export function checkLatLng(geolocation: any[]) {
  if (geolocation && geolocation[0] && geolocation[1]) return true;
  else return false;
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
    '' // Keep this to fix issue with IE Edge sending an empty MIME type
  ];
  return VALID_ASSET_UPLOAD_FILE_TYPES.join(',');
}

export function escapeHtml(str: string): string {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

export function renderCheckbox(id: string, label: string, isImportant: boolean) {
  let additionalClass = '';
  if (isImportant) {
    additionalClass += 'alertify-toggle-important';
  }
  return `<div class="alertify-toggle checkbox ${additionalClass}"><label class="checkbox__wrapper"><input type="checkbox" class="checkbox__input" id="${id}"><span class="checkbox__label">${label}</span></label></div>`;
}

export function hasLongWords(text: string, limit: number = 25): boolean {
  const textArr = text.split(' ');
  const maxLength = Math.max(...(textArr.map((el) => {return el.length;})));
  return maxLength >= limit;
}

export function hasVerticalScrollbar(element: HTMLElement): boolean {
  return element.scrollHeight > element.offsetHeight;
}

export function getScrollbarWidth(): number {
  // Creating invisible container
  const outer: any = document.createElement('div');
  outer.style.visibility = 'hidden';
  outer.style.overflow = 'scroll'; // forcing scrollbar to appear
  outer.style.msOverflowStyle = 'scrollbar'; // needed for WinJS apps
  document.body.appendChild(outer);

  // Creating inner element and placing it in the container
  const inner = document.createElement('div');
  outer.appendChild(inner);

  // Calculating difference between container's full width and the child width
  const scrollbarWidth = (outer.offsetWidth - inner.offsetWidth);

  // Removing temporary elements from the DOM
  if (outer.parentNode !== null) {
    outer.parentNode.removeChild(outer);
  }

  return scrollbarWidth;
}

export function toTitleCase(str: string): string {
  return str.replace(/(^|\s)\S/g, (t) => {return t.toUpperCase();});
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
    let truncatedStringFront = truncatedString.substring(0, halfway);
    let truncatedStringBack = truncatedString.slice(
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
  let truncatedString = str.replace('https://', '').replace('http://', '');

  return truncateString(truncatedString, length);
}

/**
 * Removes file extension then calls truncateString()
 */
export function truncateFile(str: string, length: number) {
  // Remove file extension with simple regex that truncates everything past
  // the last occurance of `.` inclusively
  let truncatedString = str.replace(/\.[^/.]+$/, '');

  return truncateString(truncatedString, length);
}

/**
 * Generates a simple lowercase, underscored version of a string. Useful for
 * quick filename generation
 *
 * Inspired by the way backend handles generating autonames for translations:
 * https://github.com/kobotoolbox/kpi/blob/27220c2e65b47a7f150c5bef64db97226987f8fc/kpi/utils/autoname.py#L132-L138
 */
export function generateAutoname(str: string, startIndex: number = 0, endIndex: number = str.length) {
  return str
  .toLowerCase()
  .substring(startIndex, endIndex)
  .replace(/(\ |\.)/g, "_");
}

export function csrfSafeMethod(method: string) {
  // these HTTP methods do not require CSRF protection
  return /^(GET|HEAD|OPTIONS|TRACE)$/.test(method);
}
