/**
 * The Project Management app bundle file. All the required setup is done here
 * plus it is the file that is handling the root rendering.
 */

require('jquery-ui/ui/widgets/sortable');
import moment from 'moment';
import AllRoutes from 'js/router/allRoutes';
import RegistrationPasswordApp from './registrationPasswordApp';
import {AppContainer} from 'react-hot-loader';
import '@babel/polyfill'; // required to support Array.prototypes.includes in IE11
import React from 'react';
import {hashHistory} from 'react-router';
import {Cookies} from 'react-cookie';
import {render} from 'react-dom';
import {
  csrfSafeMethod,
  currentLang,
} from 'utils';
require('../scss/main.scss');

// Tell moment library what is the app language
moment.locale(currentLang());

// Send a pageview to Google Analytics for every change in routes
hashHistory.listen(() => {
  if (typeof ga === 'function') {
    ga('send', 'pageview', window.location.hash);
  }
});

// Setup the authentication of AJAX calls
$.ajaxSetup({
  beforeSend: function (xhr, settings) {
    let csrfToken = '';
    try {
      csrfToken = document.cookie.match(/csrftoken=(\w{64})/)[1];
    } catch (err) {
      console.error('Cookie not matched');
    }
    if (!csrfSafeMethod(settings.type) && !this.crossDomain) {
      const cookies = new Cookies();
      xhr.setRequestHeader(
        'X-CSRFToken',
        csrfToken || cookies.get('csrftoken')
      );
    }
  },
});

// Create the element for rendering the app into
const el = (() => {
  const $d = $('<div>', {class: 'kpiapp'});
  $('body').prepend($d);
  return $d.get(0);
})();

if (document.head.querySelector('meta[name=kpi-root-path]')) {
  render(<AllRoutes/>, el);

  if (module.hot) {
    module.hot.accept('js/app', () => {
      let AllRoutes = require('js/app').default;
      render(
        <AppContainer>
          <AllRoutes/>
        </AppContainer>,
        el
      );
    });
  }
} else {
  console.error('no kpi-root-path meta tag set. skipping react-router init');
}

// Handles rendering a small app in the registration form
document.addEventListener('DOMContentLoaded', () => {
  const registrationPasswordAppEl = document.getElementById(
    'registration-password-app'
  );
  if (registrationPasswordAppEl) {
    render(
      <AppContainer>
        <RegistrationPasswordApp />
      </AppContainer>,
      registrationPasswordAppEl
    );
  }
});
