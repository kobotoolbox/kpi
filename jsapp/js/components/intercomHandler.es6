import React from 'react';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import autoBind from 'react-autobind';
import _ from 'underscore';
import stores from '../stores';

const DEFAULT_SETTINGS = Object.freeze({
  custom_launcher_selector: '#custom_intercom_launcher',
  hide_default_launcher: true,
  alignment: 'left',
  action_color: '#2095f3',
  background_color: '#575b70'
});

class IntercomHandler extends React.Component {
  constructor(props){
    super(props);
    autoBind(this);

    this.updateHorizontalPaddingDebounced = _.debounce(this.updateHorizontalPadding, 500);
  }

  componentDidMount() {
    if (window.IntercomAppId) {
      console.info('Intercom enabled and starting…');
      this.injectIntercomScripts();
      this.listenTo(stores.session, ({currentAccount}) => {
        if (currentAccount) {
          this.onCurrentAccountChange(currentAccount);
        }
      });
      window.addEventListener('resize', this.updateHorizontalPaddingDebounced);
    } else {
      console.info('Intercom not enabled');
    }
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.updateHorizontalPaddingDebounced);
  }

  onCurrentAccountChange(account) {
    if (this.isEmailValid(account.email)) {
      window.Intercom('boot', Object.assign({
        app_id: window.IntercomAppId,
        email: account.email,
        created_at: account.date_joined,
        name: `${account.first_name} ${account.last_name}`,
        user_id: account.username
      }, DEFAULT_SETTINGS));
      this.updateHorizontalPadding();
    } else {
      window.Intercom('shutdown');
    }
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
      // move it over border line
      1
    );

    // NOTE updating horizontal_padding doesn't work very well while Intercom
    // bubble is being opened
    window.Intercom('update', {
      alignment: 'left',
      horizontal_padding: leftPos
    });
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
        i.c(arguments)
      };
      i.q = [];
      i.c = function(args) {
        i.q.push(args)
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

  // TODO get these rules from API endpoint?
  isEmailValid(email) {
    if (email.endsWith('example.com')) {
      return true;
    } else {
      return false;
    }
  }

  render () {
    return null;
  }
}

reactMixin(IntercomHandler.prototype, Reflux.ListenerMixin);

export default IntercomHandler;
