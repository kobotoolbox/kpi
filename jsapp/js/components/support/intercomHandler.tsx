import React from 'react';
import {actions} from 'js/actions';
import type {AccountResponse} from 'js/dataInterface';

interface IntercomSettings {
  action_color: string;
  background_color: string;
  app_id?: string;
  user_id?: string;
  username?: string;
  email?: string;
  name?: string;
  created_at?: number;
}

declare global {
  interface Window {
    IntercomAppId?: string;
    Intercom?: (actionName: string, data?: any) => void;
  }
}

const DEFAULT_SETTINGS: IntercomSettings = Object.freeze({
  action_color: '#2095f3',
  background_color: '#575b70',
});

class IntercomHandler extends React.Component {
  currentSettings: IntercomSettings = Object.assign({}, DEFAULT_SETTINGS);

  componentDidMount() {
    if (window.IntercomAppId) {
      actions.navigation.routeUpdate.listen(this.onRouteUpdate.bind(this));
      actions.auth.verifyLogin.loggedin.listen(this.onLogIn.bind(this));
      actions.auth.logout.completed.listen(this.onLogOut.bind(this));
    } else {
      console.info('Intercom not enabled');
    }
  }

  onRouteUpdate() {
    // 'update' method triggers checking for new messages
    // NOTE: this is being throttled after being called 20 times per 30 minutes
    if (window.Intercom) {
      window.Intercom('update');
    }
  }

  onLogIn(account: AccountResponse) {
    console.info('Intercom enabled and starting…');
    this.injectIntercomScripts();
    this.bootIntercom(account);
  }

  bootIntercom(account: AccountResponse) {
    const name = account.extra_details.name;
    const legacyName = [account.first_name, account.last_name]
      .filter((val) => val)
      .join(' ');

    this.currentSettings.app_id = window.IntercomAppId;
    this.currentSettings.user_id = [
      account.username,
      window.location.host,
    ].join('@');
    this.currentSettings.username = account.username;
    this.currentSettings.email = account.email;
    this.currentSettings.name = name
      ? name
      : legacyName
      ? legacyName
      : account.username;
    this.currentSettings.created_at = Math.floor(
      new Date(account.date_joined).getTime() / 1000
    );

    if (window.Intercom) {
      window.Intercom('boot', this.currentSettings);
    }
  }


  onLogOut() {
    // 'shutdown' method clears all cached user messages
    if (window.Intercom) {
      window.Intercom('shutdown');
    }
  }

  injectIntercomScripts() {
    if (typeof window.Intercom === 'function') {
      window.Intercom('reattach_activator');
      window.Intercom('update', this.currentSettings);
    } else {
      const d = document;
      const i = function () {
        i.c(arguments);
      };
      i.q = [] as any[];
      i.c = function (args: any) {
        i.q.push(args);
      };
      window.Intercom = i;

      window.addEventListener(
        'load',
        () => {
          const tempScriptEl = d.createElement('script');
          tempScriptEl.type = 'text/javascript';
          tempScriptEl.async = true;
          tempScriptEl.src = `https://widget.intercom.io/widget/${window.IntercomAppId}`;
          const x = d.getElementsByTagName('script')[0];
          x?.parentNode?.insertBefore(tempScriptEl, x);
        },
        false
      );
    }
  }

  render() {
    return null;
  }
}

export default IntercomHandler;
