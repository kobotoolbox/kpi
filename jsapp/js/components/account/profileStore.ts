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
}

interface ProfileUpdateData {
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

class ProfileStore {
  constructor() {
    makeAutoObservable(this);
  }

  private fetchSelfProfile() {
    $.ajax({
      dataType: 'json',
      method: 'GET',
      url: `${ROOT_URL}/me/`,
    });
  }

  private updateSelfProfile(data: ProfileUpdateData) {
    $.ajax({
      data: data,
      dataType: 'json',
      method: 'PATCH',
      url: `${ROOT_URL}/me/`,
    });
  }
}

export default new ProfileStore();
