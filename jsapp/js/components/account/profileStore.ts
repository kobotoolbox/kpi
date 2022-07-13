import clonedeep from 'lodash.clonedeep';
import {makeAutoObservable, toJS} from 'mobx';
import type {
  LabelValuePair,
  FailResponse,
} from 'js/dataInterface';
import {notify} from 'js/utils';
import {ROOT_URL} from 'js/constants';

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
  ui_language?: string;
}

export interface ProfileUpdateData {
  email: string;
  extra_details: ProfileExtraDetails;
  current_password?: string;
  new_password?: string;
}

interface ProfileData {
  date_joined: string;
  email: string;
  extra_details: ProfileExtraDetails;
  first_name: string;
  git_rev: {
    short: string;
    long: string;
    branch: string;
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

const FALLBACK_LANG = 'en';

class ProfileStore {
  public data: ProfileData = {
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
    username: '',
  };
  public isLoading = false;
  public isInitialised = false;

  public get uiLanguage() {
    return this.data.extra_details.ui_language || FALLBACK_LANG;
  }

  constructor() {
    makeAutoObservable(this);
    this.fetchProfile();
  }

  private fetchProfile() {
    this.isLoading = true;
    $.ajax({
      method: 'GET',
      url: `${ROOT_URL}/me/`,
    })
      .done(this.onFetchProfileDone.bind(this))
      .fail(this.onAnyFail.bind(this));
  }

  private onFetchProfileDone(response: ProfileData) {
    console.log('onFetchProfileDone', response);
    this.data = response;
    this.isLoading = false;
    this.isInitialised = true;
  }

  private onAnyFail(response: FailResponse) {
    this.isLoading = false;
    notify(response.responseText, 'error');
  }

  /**
   * NOTE: Initially we will start off with this method being private, and all
   * the updating will be done through different public methods. If this ends up
   * being suboptimal, we can switch.
   */
  private updateProfile(data: ProfileUpdateData) {
    this.isLoading = true;
    $.ajax({
      method: 'PATCH',
      url: `${ROOT_URL}/me/`,
      data: JSON.stringify(data),
      dataType: 'json',
      contentType: 'application/json',
    })
      .done(this.onUpdateProfileDone.bind(this))
      .fail(this.onAnyFail.bind(this));
  }

  private onUpdateProfileDone(response: ProfileData) {
    if (this.data.extra_details.ui_language !== response.extra_details.ui_language) {
      console.log('different language!', this.data.extra_details.ui_language, response.extra_details.ui_language);
      if ('reload' in window.location) {
        window.location.reload();
      } else {
        window.alert(t('Please refresh the page'));
      }
    }

    this.data = response;
    this.isLoading = false;
  }

  /** Updates the UI language (async). */
  public setUiLanguage(langCode: string) {
    // NOTE: we can't deep clone existing this.data.extra_details, as MobX is
    // doing some magic with observable values, we need to convert it back to
    // plain JS object.
    const newExtraDetails = clonedeep(toJS(this.data.extra_details));
    newExtraDetails.ui_language = langCode;
    this.updateProfile({
      email: this.data.email,
      extra_details: newExtraDetails,
    });
  }
}

export default new ProfileStore();
