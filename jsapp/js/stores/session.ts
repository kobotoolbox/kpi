import {action, makeAutoObservable} from 'mobx';
import {ANON_USERNAME} from 'js/constants';
import {AccountResponse, dataInterface} from 'js/dataInterface';
import {log} from 'js/utils';

class SessionStore {
  currentAccount: AccountResponse | {username: string} = {
    username: ANON_USERNAME,
  };
  isAuthStateKnown = false;
  isLoggedIn = false;
  isInitialLoadComplete = false;
  isPending = false;

  constructor() {
    makeAutoObservable(this);
    this.verifyLogin();
  }

  verifyLogin() {
    this.isPending = true;
    dataInterface.getProfile().then(
      action('verifyLoginSuccess', (account: AccountResponse | {message: string}) => {
        this.isPending = false;
        this.isInitialLoadComplete = true;
        this.isAuthStateKnown = true;
        if ("email" in account) {
          this.currentAccount = account;
          this.isLoggedIn = true;
        }
      }),
      action('verifyLoginFailure', (xhr: any) => {
        this.isPending = false;
        log('login not verified', xhr.status, xhr.statusText);
      })
    );
  }
}
//   init() {
//     actions.misc.updateProfile.completed.listen(this.onUpdateProfileCompleted);
//     this.listenTo(actions.auth.verifyLogin.loggedin, this.onLoggedIn);
//     this.listenTo(actions.auth.verifyLogin.anonymous, this.onNotLoggedIn);
//     this.listenTo(actions.auth.verifyLogin.failed, this.onVerifyLoginFailed);
//     actions.auth.verifyLogin();
//   },

//   onUpdateProfileCompleted(response) {
//     this.currentAccount = response;
//     this.trigger({currentAccount: this.currentAccount});
//   },

//   onLoggedIn(account) {
//     this.isAuthStateKnown = true;
//     this.isLoggedIn = true;
//     this.currentAccount = account;
//     this.trigger();
//   },

//   onNotLoggedIn(data) {
//     log('login confirmed anonymous', data.message);
//     this.isAuthStateKnown = true;
//     this.trigger();
//   },

//   onVerifyLoginFailed(xhr) {
//     log('login not verified', xhr.status, xhr.statusText);
//   },
// });

export default new SessionStore();
