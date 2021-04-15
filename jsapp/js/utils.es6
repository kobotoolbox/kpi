/**
 * A collection of miscellaneous utility functions.
 *
 * NOTE: these are used also by the Form Builder coffee code (see
 * `jsapp/xlform/src/view.surveyApp.coffee`)
 *
 * TODO: group these functions by what are they doing or where are they mostly
 * (or uniquely) used, and split to smaller files.
 */

import clonedeep from 'lodash.clonedeep';
import moment from 'moment';
import alertify from 'alertifyjs';
import {Cookies} from 'react-cookie';
// imporitng whole constants, as we override ROOT_URL in tests
import constants from 'js/constants';

export const LANGUAGE_COOKIE_NAME = 'django_language';

export var assign = require('object-assign');

alertify.defaults.notifier.delay = 10;
alertify.defaults.notifier.position = 'bottom-left';
alertify.defaults.notifier.closeButton = true;

const cookies = new Cookies();

export function notify(msg, atype='success') {
  alertify.notify(msg, atype);
}

/**
 * @returns {string} something like "Today at 4:06 PM", "Yesterday at 5:46 PM", "Last Saturday at 5:46 PM" or "February 11, 2021"
 */
export function formatTime(timeStr) {
  var _m = moment(timeStr);
  return _m.calendar(null, {sameElse: 'LL'});
}

/**
 * @returns {string} something like "March 15, 2021 4:06 PM"
 */
export function formatTimeDate(timeStr) {
  var _m = moment(timeStr);
  return _m.format('LLL');
}

/**
 * @returns {string} something like "Mar 15, 2021"
 */
export function formatDate(timeStr) {
  var _m = moment(timeStr);
  return _m.format('ll');
}

export function getAnonymousUserPermission(permissions) {
  return permissions.filter(function(perm){
    if (perm.user__username === undefined) {
      perm.user__username = perm.user.match(/\/users\/(.*)\//)[1];
    }
    return perm.user__username === constants.ANON_USERNAME;
  })[0];
}

export function surveyToValidJson(survey) {
  // HACK: This is done as a fix for https://github.com/kobotoolbox/kpi/pull/735
  // I'm not entirely sure what this is about but definitely BAD CODE™!
  //
  // skip logic references only preserved after initial call
  // to "survey.toFlatJSON()"
  survey.toFlatJSON();
  // returning the result of the second call to "toFlatJSON()"
  return JSON.stringify(survey.toFlatJSON());
}

// TODO: move nullifyTranslations and unnullifyTranslations to formBuilderUtils.es6 file

/**
 * This function reverses what `nullifyTranslations` did to the form data.
 * @param {string} surveyDataJSON
 * @param {object} assetContent
 * @return {string} fixed surveyDataJSON
 */
export function unnullifyTranslations(surveyDataJSON, assetContent) {
  let surveyData = JSON.parse(surveyDataJSON);

  let translatedProps = [];
  if (assetContent.translated) {
     translatedProps = assetContent.translated;
  }

  // TRANSLATIONS HACK (Part 2/2):
  // set default_language
  let defaultLang = assetContent.translations_0;
  if (!defaultLang) {
    defaultLang = null;
  }
  if (!surveyData.settings[0].default_language && defaultLang !== null) {
    surveyData.settings[0].default_language = defaultLang;
  }

  if (defaultLang !== null) {
    // replace every "translatedProp" with "translatedProp::defaultLang"
    if (surveyData.choices) {
      surveyData.choices.forEach((choice) => {
        translatedProps.forEach((translatedProp) => {
          if (typeof choice[translatedProp] !== 'undefined') {
            choice[`${translatedProp}::${defaultLang}`] = choice[translatedProp];
            delete choice[translatedProp];
          }
        });
      });
    }
    if (surveyData.survey) {
      surveyData.survey.forEach((surveyRow) => {
        translatedProps.forEach((translatedProp) => {
          if (typeof surveyRow[translatedProp] !== 'undefined') {
            if (typeof surveyData.settings[0] !== 'undefined'
                && typeof surveyData.settings[0].style === 'string'
                && surveyData.settings[0].style.includes('theme-grid')
                && surveyRow.type === 'begin_group'
                && (surveyRow[translatedProp] === null || surveyRow[translatedProp] === '')) {
              delete surveyRow[translatedProp];
            }
            surveyRow[`${translatedProp}::${defaultLang}`] = surveyRow[translatedProp];
            delete surveyRow[translatedProp];
          }
        });
      });
    }
  }

  return JSON.stringify(surveyData);
}

/**
 * @typedef NullifiedTranslations
 * @property {object} survey - Modified survey.
 * @property {Array<string|null>} translations - Modified translations.
 * @property {Array<string|null>} translations_0 - The original default language name.
 */

/**
 * A function that adjust the translations data to the Form Builder code.
 * Requires the sibling `unnullifyTranslations` function to be called before
 * saving the form.
 * @param {Array<string|null>} [translations]
 * @param {Array<string>} translatedProps
 * @param {Array<object>} survey
 * @param {object} baseSurvey
 * @return {NullifiedTranslations}
 */
export function nullifyTranslations(translations, translatedProps, survey, baseSurvey) {
  const data = {
    survey: clonedeep(survey),
    translations: clonedeep(translations)
  };

  if (typeof translations === 'undefined') {
    data.translations = [null];
    return data;
  }

  if (data.translations.length > 1 && data.translations.indexOf(null) !== -1) {
    throw new Error('There is an unnamed translation in your form definition.\nPlease give a name to all translations in your form.\nUse "Manage Translations" option from form landing page.');
  }

  /*
  TRANSLATIONS HACK (Part 1/2):
  all the coffee code assumes first language to be null, and we don't want
  to introduce potential code-breaking refactor in old code, so we store
  first language, then replace with null and reverse this just before saving
  NOTE: when importing assets from Library into form, we need to make sure
  the default language is the same (or force baseSurvey default language)
  */
  if (baseSurvey) {
    const formDefaultLang = baseSurvey._initialParams.translations_0 || null;
    if (data.translations[0] === formDefaultLang) {
      // case 1: nothing to do - same default language in both
    } else if (data.translations.includes(formDefaultLang)) {
      // case 2: imported asset has form default language but not as first, so
      // we need to reorder things
      const defaultLangIndex = data.translations.indexOf(formDefaultLang);
      data.translations.unshift(data.translations.pop(defaultLangIndex));
      data.survey.forEach((row) => {
        translatedProps.forEach((translatedProp) => {
          const transletedPropArr = row[translatedProp];
          if (transletedPropArr) {
            transletedPropArr.unshift(transletedPropArr.pop(defaultLangIndex));
          }
        });
      });
    }

    if (!data.translations.includes(formDefaultLang)) {
      // case 3: imported asset doesn't have form default language, so we
      // force it onto the asset as the first language and try setting some
      // meaningful property value
      data.translations.unshift(formDefaultLang);
      data.survey.forEach((row) => {
        translatedProps.forEach((translatedProp) => {
          if (row[translatedProp]) {
            let propVal = null;
            if (row.name) {
              propVal = row.name;
            } else if (row.$autoname) {
              propVal = row.$autoname;
            }
            row[translatedProp].unshift(propVal);
          }
        });
      });
    }
  }

  // no need to nullify null
  if (data.translations[0] !== null) {
    data.translations_0 = data.translations[0];
    data.translations[0] = null;
  }

  return data;
}

export function redirectTo(href) {
  window.location.href = href;
}

// works universally for v1 and v2 urls
export function getUsernameFromUrl(userUrl) {
  return userUrl.match(/\/users\/(.*)\//)[1];
}

export function buildUserUrl(username) {
  if (username.startsWith(window.location.protocol)) {
    console.error("buildUserUrl() called with URL instead of username (incomplete v2 migration)");
    return username;
  }
  return `${constants.ROOT_URL}/api/v2/users/${username}/`;
}

export function parsePermissions(owner, permissions) {
  var users = [];
  var perms = {};
  if (!permissions) {
    return [];
  }
  permissions.map((perm) => {
    perm.user__username = perm.user.match(/\/users\/(.*)\//)[1];
    const codename = perm.permission.match(/\/permissions\/(.+)\//);
    if (codename !== null) {
      console.error("parsePermissions(): converting new-style permission URL to codename (incomplete v2 migration)");
      perm.permission = codename[1];
    }
    return perm;
  }).filter((perm)=> {
    return ( perm.user__username !== owner && perm.user__username !== constants.ANON_USERNAME);
  }).forEach((perm)=> {
    if(users.indexOf(perm.user__username) === -1) {
      users.push(perm.user__username);
      perms[perm.user__username] = [];
    }
    perms[perm.user__username].push(perm);
  });
  return users.map((username)=>{
    return {
      username: username,
      can: perms[username].reduce((cans, perm)=> {
        var permCode = perm.permission.includes('_submissions') ? perm.permission : perm.permission.split('_')[0];
        cans[permCode] = perm;
        return cans;
      }, {})
    };
  });
}


export var log = (function(){
  var _log = function(...args) {
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


var __strings = [];

const originalSupportEmail = 'help@kobotoolbox.org';

// use this utility function to replace hardcoded email in transifex translations
export function replaceSupportEmail(str) {
  if (typeof supportDetails !== 'undefined') {
    return str.replace(originalSupportEmail, supportDetails.email);
  } else {
    return str;
  }
}

export function currentLang() {
  return cookies.get(LANGUAGE_COOKIE_NAME) || 'en';
}

// langString contains name and code e.g. "English (en)"
export function getLangAsObject(langString) {
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

export function getLangString(obj) {
  if (typeof obj === 'object' && obj.name && obj.code) {
    return `${obj.name} (${obj.code})`;
  } else {
    return undefined;
  }
}

log.t = function () {
  let _t = {};
  __strings.forEach(function(str){ _t[str] = str; })
  console.log(JSON.stringify(_t, null, 4));
};

// unique id for forms with inputs and labels
let lastId = 0;
export var newId = function(prefix='id') {
  lastId++;
  return `${prefix}${lastId}`;
};

export var randString = function () {
  return Math.random().toString(36).match(/\.(\S{6}).*/)[1];
};

export function stringToColor(str, prc) {
  // Higher prc = lighter color, lower = darker
  prc = typeof prc === 'number' ? prc : -15;
  var hash = function(word) {
      var h = 0;
      for (var i = 0; i < word.length; i++) {
          h = word.charCodeAt(i) + ((h << 5) - h);
      }
      return h;
  };
  var shade = function(color, prc) {
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
  var int_to_rgba = function(i) {
      var color = ((i >> 24) & 0xFF).toString(16) +
          ((i >> 16) & 0xFF).toString(16) +
          ((i >> 8) & 0xFF).toString(16) +
          (i & 0xFF).toString(16);
      return color;
  };
  return shade(int_to_rgba(hash(str)), prc);
}

export function isAValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch(e) {
    return false;
  }
}

export function checkLatLng(geolocation) {
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

export function koboMatrixParser(params) {
  let content = {};
  if (params.content)
    content = JSON.parse(params.content);
  if (params.source)
    content = JSON.parse(params.source);

  if (!content.survey)
    return params;

  var hasMatrix = false;
  var surveyLength = content.survey.length;

  // add open/close tags for kobomatrix groups
  for (var i = 0; i < surveyLength; i++) {
    if (content.survey[i].type === 'kobomatrix') {
      content.survey[i].type = 'begin_kobomatrix';
      content.survey[i].appearance = 'field-list';
      surveyLength++;
      content.survey.splice(i + 1, 0, {type: 'end_kobomatrix', '$kuid': `/${content.survey[i].$kuid}`});
    }
  }

  // add columns as items in the group
  for (i = 0; i < surveyLength; i++) {
    if (content.survey[i].type === 'begin_kobomatrix') {
      var j = i;
      hasMatrix = true;
      var matrix = localStorage.getItem(`koboMatrix.${content.survey[i].$kuid}`);

      if (matrix != null) {
        matrix = JSON.parse(matrix);
        for (var kuid of matrix.cols) {
          i++;
          surveyLength++;
          content.survey.splice(i, 0, matrix[kuid]);
        }

        for (var k of Object.keys(matrix.choices)) {
          content.choices.push(matrix.choices[k]);
        }
      }
      // TODO: handle corrupt matrix data
    }
  }

  if (hasMatrix) {
    if (params.content)
      params.content = JSON.stringify(content);
    if (params.source)
      params.source = JSON.stringify(content);
  }
  return params;
}

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

export function readParameters(str) {
  if (typeof str !== 'string') {
    return null;
  }

  const params = {};

  let separator = ' ';
  if (str.includes(';')) {
    separator = ';';
  } else if (str.includes(',')) {
    separator = ',';
  }
  const otherSeparators = ';, '.replace(separator, '');
  const cleanStr = str.replace(new RegExp(' *= *', 'g'), '=');
  const parts = cleanStr.split(new RegExp(`[${otherSeparators}]*${separator}[${otherSeparators}]*`, 'g'));

  parts.forEach((part) => {
    if (part.includes('=')) {
      const key = part.slice(0, part.indexOf('='));
      const value = part.slice(key.length + 1);
      params[key] = value;
    }
  });

  if (Object.keys(params).length < 1) {
    return null;
  }
  return params;
}

export function writeParameters(obj) {
  let params = [];
  Object.keys(obj).forEach((key) => {
    if (obj[key] !== undefined && obj[key] !== null) {
      let value = obj[key];
      if (typeof value === 'object') {
        value = JSON.stringify(value);
      }
      params.push(`${key}=${value}`);
    }
  });
  return params.join(';');
}

export function renderCheckbox(id, label, isImportant) {
  let additionalClass = '';
  if (isImportant) {
    additionalClass += 'alertify-toggle-important';
  }
  return `<div class="alertify-toggle checkbox ${additionalClass}"><label class="checkbox__wrapper"><input type="checkbox" class="checkbox__input" id="${id}"><span class="checkbox__label">${label}</span></label></div>`;
}

/**
 * @param {string} text
 * @param {number} [limit] - how long the long word is
 * @return {boolean}
 */
export function hasLongWords(text, limit = 25) {
  const textArr = text.split(' ');
  const maxLength = Math.max(...(textArr.map((el) => {return el.length;})));
  return maxLength >= limit;
}

/**
 * @param {Node} element
 */
export function hasVerticalScrollbar(element) {
  return element.scrollHeight > element.offsetHeight;
}

/**
 * @returns {number}
 */
export function getScrollbarWidth() {
  // Creating invisible container
  const outer = document.createElement('div');
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
  outer.parentNode.removeChild(outer);

  return scrollbarWidth;
}

/**
 * @param {string} str
 * @returns {string}
 */
export function toTitleCase(str) {
  return str.replace(/(^|\s)\S/g, (t) => {return t.toUpperCase();});
}

export function launchPrinting() {
  window.print();
}
