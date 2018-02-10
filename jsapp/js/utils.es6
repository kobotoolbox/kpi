
import moment from 'moment';
import alertify from 'alertifyjs';
import $ from 'jquery';
import cookie from 'react-cookie';
import Promise from 'es6-promise';

export const LANGUAGE_COOKIE_NAME = 'django_language';

export var assign = require('object-assign');

alertify.defaults.notifier.delay = 10;
alertify.defaults.notifier.position = 'bottom-left';
alertify.defaults.notifier.closeButton = true;

export function notify(msg, atype='success') {
  alertify.notify(msg, atype);
}

export function formatTime(timeStr) {
  var _m = moment(timeStr);
  return _m.calendar(null, {sameElse: 'LL'});
}

export function formatTimeDate(timeStr) {
  var _m = moment(timeStr);
  return _m.format('LLL');
}

export function formatDate(timeStr) {
  var _m = moment(timeStr);
  return _m.format('ll');
}

export var anonUsername = 'AnonymousUser';
export function getAnonymousUserPermission(permissions) {
  return permissions.filter(function(perm){
    if (perm.user__username === undefined) {
      perm.user__username = perm.user.match(/\/users\/(.*)\//)[1];
    }
    return perm.user__username === anonUsername;
  })[0];
}

export function surveyToValidJson(survey) {
  // skip logic references only preserved after initial call
  // to "survey.toFlatJSON()"
  survey.toFlatJSON();
  // returning the result of the second call to "toFlatJSON()"
  return JSON.stringify(survey.toFlatJSON());
}

export function redirectTo(href) {
  window.location.href = href;
}

export function parsePermissions(owner, permissions) {
  var users = [];
  var perms = {};
  if (!permissions) {
    return [];
  }
  permissions.map((perm) => {
    perm.user__username = perm.user.match(/\/users\/(.*)\//)[1];
    return perm;
  }).filter((perm)=> {
    return ( perm.user__username !== owner && perm.user__username !== anonUsername);
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


/*global gettext*/
if (window.gettext) {
  var _gettext = window.gettext;
} else {
  var _gettext = function(s){
    return s;
  };
}
export function t(str) {
  return _gettext(str);
};


// these values may appear in transifex (esp. email) and need to
// be replaced in all the translations before removing this hard
// coded value.
const originalSupportEmail = 'help@kobotoolbox.org';
const originalSupportUrl = 'http://help.kobotoolbox.org';

let supportDetails = {
  url: originalSupportUrl,
  email: originalSupportEmail,
};

export function setSupportDetails(details) {
  assign(supportDetails, details);
}

export function replaceSupportEmail(str) {
  return str.replace(originalSupportEmail, supportDetails.email);
}

export function supportUrl() {
  return supportDetails.url;
}

export function currentLang() {
  return cookie.load(LANGUAGE_COOKIE_NAME) || 'en';
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

export function isLibrary(router) {
  return false;
  // return !!router.getCurrentPathname().match(/library/);
}

export function stringToColor(str, prc) {
  // Higher prc = lighter color, lower = darker
  var prc = typeof prc === 'number' ? prc : -15;
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
  if (params.content)
    var content = JSON.parse(params.content);
  if (params.source)
    var content = JSON.parse(params.source);

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
      content.survey.splice(i + 1, 0, {type: "end_kobomatrix", "$kuid": `/${content.survey[i].$kuid}`});
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
