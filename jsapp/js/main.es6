/**
 * The Project Management app bundle file. All the required setup is done here
 * plus it is the file that is handling the root rendering.
 */

import 'jquery-ui/ui/widgets/sortable';
import moment from 'moment';
import AllRoutes from 'js/router/allRoutes';
import RegistrationPasswordApp from './registrationPasswordApp';
import React from 'react';
import {Cookies} from 'react-cookie';
import {createRoot} from 'react-dom/client';
import * as Sentry from '@sentry/react';
import {csrfSafeMethod, currentLang} from 'utils';
import '../scss/main.scss';
import Modal from 'react-modal';

const sentryDsnEl = document.head.querySelector('meta[name=sentry-dsn]');
if (sentryDsnEl !== null) {
  Sentry.init({
    dsn: sentryDsnEl.content,
    tracesSampleRate: 0.0,
    sendClientReports: false,
    autoSessionTracking: false,
  });
  window.Raven = Sentry; // Legacy use (formbuilder)
  /*
    In TS files, it's safe to do

        import * as Sentry from '@sentry/react';
           ...
        Sentry.captureMessage(...);

    even if Sentry is disabled (and Sentry.init doesn't run.)

    In CoffeeScript, you can keep using

        window.Raven?.captureMessage(...)

    Support for `import` syntax (or literal JS in backticks) varies between
    CoffeeScript versions. We might invoke Sentry as a CommonJS module (perhaps
    with wrapping) but I'd rather leave that as TODO until working on other
    CoffeeScript/Formbuilder changes.
  */
}

// Tell moment library what is the app language
moment.locale(currentLang());

// Setup Google Analytics
const gaTokenEl = document.head.querySelector('meta[name=google-analytics-token]');
if (gaTokenEl !== null && gaTokenEl.content) {
  window.dataLayer = window.dataLayer || [];
  window.gtag = function() {window.dataLayer.push(arguments);};
  window.gtag('js', new Date());
  window.gtag('config', gaTokenEl.content);
}

// Setup the authentication of AJAX calls
$.ajaxSetup({
  beforeSend: function (xhr, settings) {
    let csrfToken = '';
    try {
      // Need to support old token (64 characters - prior to Django 4.1)
      // and new token (32 characters).
      csrfToken = document.cookie.match(/csrftoken=(\w{32,64})/)[1];
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
  const root = createRoot(el);
  root.render(<AllRoutes />);
} else {
  console.warn('no kpi-root-path meta tag set. skipping react-router init');
}

// Handles rendering a small app in the registration form
document.addEventListener('DOMContentLoaded', () => {
  const registrationPasswordAppEl = document.getElementById(
    'registration-password-app'
  );
  if (registrationPasswordAppEl) {
    const root = createRoot(registrationPasswordAppEl);
    root.render(
        <RegistrationPasswordApp />
    );
  }
});
