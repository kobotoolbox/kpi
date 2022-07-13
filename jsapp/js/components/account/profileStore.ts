import clonedeep from 'lodash.clonedeep';
import {makeAutoObservable} from 'mobx';
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
  lang?: string;
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
    return this.data.extra_details.lang || FALLBACK_LANG;
  }

  constructor() {
    makeAutoObservable(this);
    this.fetchProfile();
  }

  private fetchProfile() {
    this.isLoading = true;
    $.ajax({
      dataType: 'json',
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
      data: data,
      dataType: 'json',
      method: 'PATCH',
      url: `${ROOT_URL}/me/`,
    })
      .done(this.onUpdateProfileDone.bind(this))
      .fail(this.onAnyFail.bind(this));
  }

  private onUpdateProfileDone(response: ProfileData) {
    this.data = response;
    this.isLoading = false;
  }

  /** Updates the UI language. */
  public setUiLanguage(langCode: string) {
    const newExtraDetails = clonedeep(this.data.extra_details);
    newExtraDetails.lang = langCode;
    this.updateProfile({
      email: this.data.email,
      extra_details: newExtraDetails,
    });
  }
}

export default new ProfileStore();
