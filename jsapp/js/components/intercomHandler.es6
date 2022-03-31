import React from 'react';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import autoBind from 'react-autobind';
import _ from 'underscore';
import {actions} from '../actions';

// NOTE: change this boolean to switch to custom button (just make sure to
// check the TODO comment below)
export const USE_CUSTOM_INTERCOM_LAUNCHER = false;

const DEFAULT_SETTINGS = Object.freeze({
  action_color: '#2095f3',
  background_color: '#575b70'
});

class IntercomHandler extends React.Component {
  constructor(props){
    super(props);
    autoBind(this);
    this.currentSettings = Object.assign({}, DEFAULT_SETTINGS);
    this.updateHorizontalPaddingDebounced = _.debounce(this.updateHorizontalPadding, 500);
  }

  componentDidMount() {
    if (window.IntercomAppId) {
      this.listenTo(actions.navigation.routeUpdate, this.onRouteUpdate);
      this.listenTo(actions.auth.verifyLogin.loggedin, this.onLogIn);
      this.listenTo(actions.auth.logout.completed, this.onLogOut);
    } else {
      console.info('Intercom not enabled');
    }
  }

  componentWillUnmount() {
    if (USE_CUSTOM_INTERCOM_LAUNCHER) {
      window.removeEventListener('resize', this.updateHorizontalPaddingDebounced);
    }
  }

  onRouteUpdate() {
    // 'update' method triggers checking for new messages
    // NOTE: this is being throttled after being called 20 times per 30 minutes
    window.Intercom('update');
  }

  onLogIn(account) {
    if (this.isEmailValid(account.email)) {
      console.info('Intercom enabled and starting…');

      this.injectIntercomScripts();

      this.bootIntercom(account);

      if (USE_CUSTOM_INTERCOM_LAUNCHER) {
        this.currentSettings.custom_launcher_selector = '#custom_intercom_launcher';
        this.currentSettings.hide_default_launcher = true;
        this.currentSettings.alignment = 'left';
        window.Intercom('update', this.currentSettings);

        window.addEventListener('resize', this.updateHorizontalPaddingDebounced);

        this.updateHorizontalPadding();
      }
    } else {
      // logged in user doesn't support Intercom
      window.Intercom('shutdown');
    }
  }

  bootIntercom(account) {
    const name = account.extra_details.name;
    const legacyName = [account.first_name, account.last_name].filter((val) => {return val;}).join(' ');

    this.currentSettings.app_id = window.IntercomAppId;
    this.currentSettings.user_id = [account.username, window.location.host].join('@');
    this.currentSettings.username = account.username;
    this.currentSettings.email = account.email;
    this.currentSettings.name = name ? name : legacyName ? legacyName : account.username;
    this.currentSettings.created_at = Math.floor((new Date(account.date_joined)).getTime() / 1000);

    window.Intercom('boot', this.currentSettings);
  }

  onLogOut() {
    // 'shutdown' method clears all cached user messages
    window.Intercom('shutdown');
  }

  updateHorizontalPadding() {
    const $launcherEl = $(DEFAULT_SETTINGS.custom_launcher_selector);

    if (!window.Intercom || !$launcherEl.length) {
      return;
    }

    const leftPos = (
      $launcherEl[0].getBoundingClientRect().left +
      $launcherEl.width() +
      $(window)['scrollLeft']() -
      // move it by 1px to place it atop the border line
      1
    );

    // NOTE: updating horizontal_padding doesn't work very well while Intercom
    // bubble is being opened
    // NOTE: update object overwrites all properties, so we need to pass
    // everything every time
    this.currentSettings.horizontal_padding = leftPos;
    window.Intercom('update', this.currentSettings);
  }

  injectIntercomScripts() {
    var w = window;
    var ic = w.Intercom;
    if (typeof ic === 'function') {
      ic('reattach_activator');
      ic('update', this.settings);
    } else {
      var d = document;
      var i = function() {
        i.c(arguments);
      };
      i.q = [];
      i.c = function(args) {
        i.q.push(args);
      };
      w.Intercom = i;

      function l() {
        var s = d.createElement('script');
        s.type = 'text/javascript';
        s.async = true;
        s.src = `https://widget.intercom.io/widget/${window.IntercomAppId}`;
        var x = d.getElementsByTagName('script')[0];
        x.parentNode.insertBefore(s, x);
      }
      if (w.attachEvent) {
        w.attachEvent('onload', l);
      } else {
        w.addEventListener('load', l, false);
      }
    }
  }

  isEmailValid(email) {
    if (USE_CUSTOM_INTERCOM_LAUNCHER) {
      // TODO get these rules from API endpoint?
      return email.endsWith('example.com');
    } else {
      return true;
    }
  }

  render () {
    return null;
  }
}

reactMixin(IntercomHandler.prototype, Reflux.ListenerMixin);

export default IntercomHandler;
