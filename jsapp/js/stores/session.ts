import {action, makeAutoObservable} from 'mobx';
import {ANON_USERNAME} from 'js/users/utils';
import {dataInterface} from 'js/dataInterface';
import type {AccountResponse, FailResponse} from 'js/dataInterface';
import {log, currentLang} from 'js/utils';
import type {Json} from 'js/components/common/common.interfaces';
import type {ProjectViewsSettings} from 'js/projects/customViewStore';

class SessionStore {
  currentAccount: AccountResponse | {username: string; date_joined: string} = {
    username: ANON_USERNAME,
    date_joined: '',
  };
  isAuthStateKnown = false;
  isLoggedIn = false;
  isInitialLoadComplete = false;
  isPending = false;
  isInitialRoute = true;

  constructor() {
    makeAutoObservable(this);
    this.verifyLogin();
    // TODO make this not awful
    setTimeout(() => (this.isInitialRoute = false), 1000);
  }

  private verifyLogin() {
    this.isPending = true;
    dataInterface.getProfile().then(
      action(
        'verifyLoginSuccess',
        (account: AccountResponse | {message: string}) => {
          this.isPending = false;
          this.isInitialLoadComplete = true;
          if ('email' in account) {
            this.currentAccount = account;
            this.isLoggedIn = true;
            // Save UI language to Back-end for language usage statistics.
            // Logging in causes the whole page to be reloaded, so we don't need
            // to do it more than once.
            this.saveUiLanguage();
          }
          this.isAuthStateKnown = true;
        }
      ),
      action('verifyLoginFailure', (xhr: FailResponse) => {
        this.isPending = false;
        log('login not verified', xhr.status, xhr.statusText);
      })
    );
  }

  public refreshAccount() {
    this.isPending = true;
    dataInterface.getProfile().then(
      action(
        'refreshSuccess',
        (account: AccountResponse | {message: string}) => {
          this.isPending = false;
          if ('email' in account) {
            this.currentAccount = account;
          }
        }
      )
    );
  }

  /** Updates one of the `extra_details`. */
  public setDetail(detailName: string, value: Json | ProjectViewsSettings) {
    dataInterface.patchProfile({extra_details: {[detailName]: value}}).then(
      action('setDetailSuccess', (account: AccountResponse) => {
        if ('email' in account) {
          this.currentAccount = account;
        }
      })
    );
  }

  private saveUiLanguage() {
    // We want to save the language if it differs from the one we saved or if
    // none is saved yet.
    if (
      'extra_details' in this.currentAccount &&
      this.currentAccount.extra_details.last_ui_language !== currentLang()
    ) {
      this.setDetail('last_ui_language', currentLang());
    }
  }
}

export default new SessionStore();
