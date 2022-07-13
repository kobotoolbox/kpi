import clonedeep from 'lodash.clonedeep';
import Reflux from 'reflux';
import {actions} from 'js/actions';
import {
  log,
  currentLang,
} from 'js/utils';
import {ANON_USERNAME} from 'js/constants';
import type {
  LabelValuePair,
  FailResponse,
} from 'js/dataInterface';

interface ProfileExtraDetails {
  bio?: string;
  city?: string;
  country?: LabelValuePair[];
  gender?: LabelValuePair;
  instagram?: string;
  linkedin?: string;
  metadata?: string;
  name?: string;
  organization?: string;
  organization_website?: string;
  require_auth?: boolean;
  sector?: LabelValuePair;
  twitter?: string;
  /** We store this for usage statistics only. */
  last_ui_language?: string;
}

export interface ProfileUpdateData {
  email: string;
  extra_details: ProfileExtraDetails;
  current_password?: string;
  new_password?: string;
}

export interface ProfileData {
  date_joined: string;
  email: string;
  extra_details: ProfileExtraDetails;
  first_name: string;
  git_rev: {
    branch: string;
    long: string;
    short: string;
    tag: boolean | string;
  };
  gravatar: string;
  is_staff: boolean;
  is_superuser: boolean;
  last_login: string;
  last_name: string;
  projects_url: string;
  server_time: string;
  username: string;
}

/** This is a fake no-user account. */
const ANON_USERNAME_ACCOUNT: ProfileData = {
  date_joined: '',
  email: '',
  extra_details: {},
  first_name: '',
  git_rev: {
    short: '',
    long: '',
    branch: '',
    tag: false,
  },
  gravatar: '',
  is_staff: false,
  is_superuser: false,
  last_login: '',
  last_name: '',
  projects_url: '',
  server_time: '',
  username: ANON_USERNAME,
};

class SessionStore extends Reflux.Store {
  currentAccount: ProfileData = ANON_USERNAME_ACCOUNT;
  isAuthStateKnown = false;
  isLoggedIn = false;

  init() {
    actions.misc.updateProfile.completed.listen(this.onUpdateProfileCompleted.bind(this));
    actions.auth.verifyLogin.loggedin.listen(this.onLoggedIn.bind(this));
    actions.auth.verifyLogin.anonymous.listen(this.onNotLoggedIn.bind(this));
    actions.auth.verifyLogin.failed.listen(this.onVerifyLoginFailed.bind(this));

    actions.auth.verifyLogin();
  }

  onUpdateProfileCompleted(response: ProfileData) {
    this.currentAccount = response;
    this.notifyListeners();
  }

  onLoggedIn(response: ProfileData) {
    this.isAuthStateKnown = true;
    this.isLoggedIn = true;
    this.currentAccount = response;
    this.notifyListeners();
    this.saveUiLanguage();
  }

  onNotLoggedIn(response: {message: string}) {
    log('login confirmed anonymous', response.message);
    this.isAuthStateKnown = true;
    this.isLoggedIn = false;
    this.currentAccount = ANON_USERNAME_ACCOUNT;
    this.notifyListeners();
  }

  onVerifyLoginFailed(response: FailResponse) {
    log('login not verified', response.status, response.statusText);
  }

  notifyListeners() {
    this.trigger({
      currentAccount: this.currentAccount,
      isAuthStateKnown: this.isAuthStateKnown,
      isLoggedIn: this.isLoggedIn,
    });
  }

  saveUiLanguage() {
    const currentLanguage = currentLang();

    // We want to save the language if it differs from the one we saved.
    if (
      !this.currentAccount.extra_details.last_ui_language ||
      this.currentAccount.extra_details.last_ui_language !== currentLanguage
    ) {
      const newExtraDetails = clonedeep(this.currentAccount.extra_details);
      newExtraDetails.last_ui_language = currentLang();
      // We call the backend without much care about the result.
      actions.misc.updateProfile(
        {
          email: this.currentAccount.email,
          extra_details: JSON.stringify(newExtraDetails),
        },
        {
          onComplete: () => {
            log('UI language saved');
          },
        }
      );
    }
  }
}

/** This store keeps information about logged in user (or its absence). */
const sessionStore = new SessionStore();
sessionStore.init();

export default sessionStore;
