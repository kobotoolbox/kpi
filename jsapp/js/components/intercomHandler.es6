import React from 'react';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import autoBind from 'react-autobind';
import stores from '../stores';

const DEFAULT_SETTINGS = Object.freeze({
  custom_launcher_selector: '#custom_intercom_launcher',
  hide_default_launcher: true,
  alignment: 'left',
  action_color: '#2095f3',
  background_color: '#575b70',
  horizontal_padding: 57
});

class IntercomHandler extends React.Component {
  constructor(props){
    super(props);
    autoBind(this);
  }

  componentDidMount() {
    if (window.IntercomAppId) {
      console.info('Intercom starting…');
      this.injectIntercomScripts();
      this.listenTo(stores.session, ({currentAccount}) => {
        if (currentAccount) {
          this.onCurrentAccountChange(currentAccount);
        }
      });
    } else {
      console.info('Intercom not enabled');
    }
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
    } else {
      window.Intercom('shutdown');
    }
  }

  watchWindowSize() {
    // TODO
    // this function should update horizontal_padding on window resize event
    // to match the position of custom launcher
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
