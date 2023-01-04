import {action, makeAutoObservable} from 'mobx';
import {ANON_USERNAME} from 'js/constants';
import {dataInterface} from 'js/dataInterface';
import type {AccountResponse} from 'js/dataInterface';
import {log} from 'js/utils';
import type {Json} from 'js/components/common/common.interfaces';
import type {ProjectViewsSettings} from 'js/projects/customViewStore';

class SessionStore {
  currentAccount: AccountResponse | {username: string} = {
    username: ANON_USERNAME,
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
          }
          this.isAuthStateKnown = true;
        }
      ),
      action('verifyLoginFailure', (xhr: any) => {
        this.isPending = false;
        log('login not verified', xhr.status, xhr.statusText);
      })
    );
  }

  public refreshAccount() {
    dataInterface.getProfile().then(
      action(
        'refreshSuccess',
        (account: AccountResponse | {message: string}) => {
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
      action(
        'setDetailSuccess',
        (account: AccountResponse) => {
          if ('email' in account) {
            this.currentAccount = account;
          }
        }
      )
    );
  }
}

export default new SessionStore();
