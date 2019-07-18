/**
 * The Project Management app bundle file.
 */

import RunRoutes, {routes} from './app';
import RegistrationPasswordApp from './registrationPasswordApp';
import {AppContainer} from 'react-hot-loader'
import $ from 'jquery';
import 'babel-polyfill'; // required to support Array.prototypes.includes in IE11
import {Cookies} from 'react-cookie';
import React from 'react';
import {render} from 'react-dom';

require('../scss/main.scss');

const cookies = new Cookies();

var el = (function(){
  var $d = $('<div>', {'class': 'kpiapp'});
  $('body').prepend($d);
  return $d.get(0);
})();

window.csrftoken = cookies.get('csrftoken');

function csrfSafeMethod(method) {
    // these HTTP methods do not require CSRF protection
    return (/^(GET|HEAD|OPTIONS|TRACE)$/.test(method));
}
$.ajaxSetup({
    beforeSend: function(xhr, settings) {
        if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
            xhr.setRequestHeader('X-CSRFToken', csrftoken);
        }
    }
});

if (document.head.querySelector('meta[name=kpi-root-url]')) {

  render(<RunRoutes routes={routes} />, el);

  if (module.hot) {
    module.hot.accept('./app', () => {
      let RunRoutes = require('./app').default;
      render(<AppContainer><RunRoutes routes={routes} /></AppContainer>, el);
    });
  }
} else {
  console.error('no kpi-root-url meta tag set. skipping react-router init');
}

document.addEventListener('DOMContentLoaded', (evt) => {
  const registrationPasswordAppEl = document.getElementById('registration-password-app');
  if (registrationPasswordAppEl) {
    render(<AppContainer><RegistrationPasswordApp /></AppContainer>, registrationPasswordAppEl);
  }
});
