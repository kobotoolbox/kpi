/**
 * The Project Management app bundle file. All the required setup is done here
 * plus it is the file that is handling the root rendering.
 */

require('jquery-ui/ui/widgets/sortable');
import moment from 'moment';
import AllRoutes from 'js/router/allRoutes';
import RegistrationPasswordApp from './registrationPasswordApp';
import DesignSystemApp from 'js/designSystem/designSystemApp';
import {AppContainer} from 'react-hot-loader';
import '@babel/polyfill'; // required to support Array.prototypes.includes in IE11
import React from 'react';
import {Cookies} from 'react-cookie';
import {render} from 'react-dom';
import {csrfSafeMethod, currentLang} from 'utils';
require('../scss/main.scss');
import Modal from 'react-modal';

// Tell moment library what is the app language
moment.locale(currentLang());

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

if (document.head.querySelector('meta[name=kpi-root-path]')) {
  // Create the element for rendering the app into
  const el = (() => {
    const $d = $('<div>', {id: 'kpiapp'});
    $('body').prepend($d);
    Modal.setAppElement('#kpiapp');
    return $d.get(0);
  })();

  render(<AllRoutes />, el);

  if (module.hot) {
    module.hot.accept('js/app', () => {
      let AllRoutes = require('js/app').default;
      render(
        <AppContainer>
          <AllRoutes />
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

// Handles rendering a dev app with design system.
document.addEventListener('DOMContentLoaded', () => {
  const designSystemAppEl = document.getElementById('design-system-app');
  if (designSystemAppEl) {
    Modal.setAppElement('#design-system-app');
    render(
      <AppContainer>
        <DesignSystemApp />
      </AppContainer>,
      designSystemAppEl
    );
  }
});
