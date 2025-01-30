import type {LabelValuePair, TransxLanguages} from 'js/dataInterface';
import {makeAutoObservable} from 'mobx';
import {fetchGet} from 'js/api';
import type {UserFieldName} from './account/account.constants';

const ENV_ENDPOINT = '/environment/';

export interface EnvironmentResponse {
  mfa_has_availability_list: boolean;
  terms_of_service_url: string;
  privacy_policy_url: string;
  source_code_url: string;
  support_email: string;
  support_url: string;
  community_url: string;
  academy_url: string;
  project_metadata_fields: EnvStoreFieldItem[];
  user_metadata_fields: UserMetadataField[];
  sector_choices: string[][];
  operational_purpose_choices: string[][];
  country_choices: string[][];
  interface_languages: string[][];
  transcription_languages: TransxLanguages;
  translation_languages: TransxLanguages;
  submission_placeholder: string;
  use_team_label: boolean;
  frontend_min_retry_time: number;
  frontend_max_retry_time: number;
  asr_mt_features_enabled: boolean;
  mfa_localized_help_text: string;
  mfa_enabled: boolean;
  mfa_per_user_availability: boolean;
  mfa_code_length: number;
  stripe_public_key: string | null;
  social_apps: SocialApp[];
  free_tier_thresholds: FreeTierThresholds;
  free_tier_display: FreeTierDisplay;
  enable_custom_password_guidance_text: boolean;
  custom_password_localized_help_text: string;
  enable_password_entropy_meter: boolean;
  /**
   * Whether the TOS message is defined. This causes the whole TOS Screen checks
   * to be put into motion; i.e. when this is `false` we don't bother to check
   * if we should display TOS Screen to user :)
   */
  terms_of_service__sitewidemessage__exists: boolean;
  open_rosa_server: string;
  project_history_log_lifespan: number;
}

/*
 * NOTE: This store is written to use MobX, but its imports do not need to be
 * exported with `observer()`. We also do not need to add this to a root store.
 *
 * This is because this store's value does not actually change as they store
 * constant environment variables that are set by the docker container. Thus it
 * JustWorks™ given our frontend architecture.
 */

export interface UserMetadataField {
  name: UserFieldName;
  required: boolean;
  label: string;
}

export interface EnvStoreFieldItem {
  name: string;
  required: boolean;
  label: string;
}

export interface SocialApp {
  name: string;
  provider: string;
  provider_id: string;
  client_id: string;
}

export interface FreeTierThresholds {
  storage: number | null;
  data: number | null;
  transcription_minutes: number | null;
  translation_chars: number | null;
}

export interface FreeTierDisplay {
  name: string | null;
  feature_list: [string] | [];
}

type ProjectMetadataFieldKey =
  | 'description'
  | 'sector'
  | 'country'
  | 'operational_purpose'
  | 'collects_pii';

export class EnvStoreData {
  public terms_of_service_url = '';
  public privacy_policy_url = '';
  public source_code_url = '';
  public support_email = '';
  public support_url = '';
  public community_url = '';
  public academy_url = '';
  public min_retry_time = 4; // seconds
  public max_retry_time: number = 4 * 60; // seconds
  public project_metadata_fields: EnvStoreFieldItem[] = [];
  public user_metadata_fields: UserMetadataField[] = [];
  public sector_choices: LabelValuePair[] = [];
  public operational_purpose_choices: LabelValuePair[] = [];
  public country_choices: LabelValuePair[] = [];
  public interface_languages: LabelValuePair[] = [];
  public transcription_languages: TransxLanguages = {};
  public translation_languages: TransxLanguages = {};
  public submission_placeholder = '';
  public use_team_label = true;
  public asr_mt_features_enabled = false;
  public mfa_localized_help_text = '';
  public mfa_enabled = false;
  public mfa_per_user_availability = false;
  public mfa_has_availability_list = false;
  public mfa_code_length = 6;
  public stripe_public_key: string | null = null;
  public social_apps: SocialApp[] = [];
  public free_tier_thresholds: FreeTierThresholds = {
    storage: null,
    data: null,
    transcription_minutes: null,
    translation_chars: null,
  };
  public free_tier_display: FreeTierDisplay = {name: null, feature_list: []};
  public enable_custom_password_guidance_text = false;
  public custom_password_localized_help_text = '';
  public enable_password_entropy_meter = false;
  public terms_of_service__sitewidemessage__exists = false;
  public open_rosa_server = '';

  getProjectMetadataField(
    fieldName: ProjectMetadataFieldKey
  ): EnvStoreFieldItem | boolean {
    for (const f of this.project_metadata_fields) {
      if (f.name === fieldName) {
        return f;
      }
    }
    return false;
  }

  public getProjectMetadataFieldsAsSimpleDict() {
    // dict[name] => {name, required, label}
    const dict: Partial<{
      [fieldName in ProjectMetadataFieldKey]: EnvStoreFieldItem;
    }> = {};
    for (const field of this.project_metadata_fields) {
      dict[field.name as keyof typeof dict] = field;
    }
    return dict;
  }

  public getUserMetadataFieldsAsSimpleDict() {
    // dict[name] => {name, required, label}
    const dict: {[fieldName: string]: UserMetadataField} = {};
    for (const field of this.user_metadata_fields) {
      dict[field.name] = field;
    }
    return dict;
  }

  public getUserMetadataRequiredFieldNames(): UserFieldName[] {
    return this.user_metadata_fields
      .filter((item) => item.required)
      .map((item) => item.name);
  }

  public getUserMetadataFieldNames(): UserFieldName[] {
    return this.user_metadata_fields.map((item) => item.name);
  }
}

class EnvStore {
  data: EnvStoreData;
  isReady = false;

  constructor() {
    makeAutoObservable(this);
    this.data = new EnvStoreData();
    this.fetchData();
  }

  async fetchData() {
    // Error handling is done inside `fetchGet`
    const response = await fetchGet<EnvironmentResponse>(ENV_ENDPOINT);
    this.onGetEnvCompleted(response);
  }

  /**
   * A DRY utility function that turns an array of two items into an object with
   * 'value' and 'label' properties.
   */
  private nestedArrToChoiceObjs = (i: string[]): LabelValuePair => {
    return {
      value: i[0],
      label: i[1],
    };
  };

  private onGetEnvCompleted(response: EnvironmentResponse) {
    this.data.terms_of_service_url = response.terms_of_service_url;
    this.data.privacy_policy_url = response.privacy_policy_url;
    this.data.source_code_url = response.source_code_url;
    this.data.support_email = response.support_email;
    this.data.support_url = response.support_url;
    this.data.community_url = response.community_url;
    this.data.academy_url = response.academy_url;
    this.data.min_retry_time = response.frontend_min_retry_time;
    this.data.max_retry_time = response.frontend_max_retry_time;
    this.data.project_metadata_fields = response.project_metadata_fields;
    this.data.user_metadata_fields = response.user_metadata_fields;
    this.data.submission_placeholder = response.submission_placeholder;
    this.data.use_team_label = response.use_team_label;
    this.data.mfa_localized_help_text = response.mfa_localized_help_text;
    this.data.mfa_enabled = response.mfa_enabled;
    this.data.mfa_per_user_availability = response.mfa_per_user_availability;
    this.data.mfa_has_availability_list = response.mfa_has_availability_list;
    this.data.mfa_code_length = response.mfa_code_length;
    this.data.stripe_public_key = response.stripe_public_key;
    this.data.social_apps = response.social_apps;
    this.data.free_tier_thresholds = response.free_tier_thresholds;
    this.data.free_tier_display = response.free_tier_display;
    this.data.open_rosa_server = response.open_rosa_server;

    if (response.sector_choices) {
      this.data.sector_choices = response.sector_choices.map(
        this.nestedArrToChoiceObjs
      );
    }
    if (response.operational_purpose_choices) {
      this.data.operational_purpose_choices =
        response.operational_purpose_choices.map(this.nestedArrToChoiceObjs);
    }
    if (response.country_choices) {
      this.data.country_choices = response.country_choices.map(
        this.nestedArrToChoiceObjs
      );
    }
    if (response.interface_languages) {
      this.data.interface_languages = response.interface_languages.map(
        this.nestedArrToChoiceObjs
      );
    }

    this.data.asr_mt_features_enabled = response.asr_mt_features_enabled;

    this.data.enable_custom_password_guidance_text =
      response.enable_custom_password_guidance_text;
    this.data.custom_password_localized_help_text =
      response.custom_password_localized_help_text;
    this.data.enable_password_entropy_meter =
      response.enable_password_entropy_meter;

    this.data.terms_of_service__sitewidemessage__exists =
      response.terms_of_service__sitewidemessage__exists;

    this.isReady = true;
  }

  public getSectorLabel(sectorName: string): string | undefined {
    const foundSector = this.data.sector_choices.find(
      (item: LabelValuePair) => item.value === sectorName
    );
    if (foundSector) {
      return foundSector.label;
    }
    return undefined;
  }

  public getCountryLabel(code: string): string | undefined {
    const foundCountry = this.data.country_choices.find(
      (item: LabelValuePair) => item.value === code
    );
    if (foundCountry) {
      return foundCountry.label;
    }
    return undefined;
  }
}

/**
 * This store keeps all environment data (constants) like languages, countries,
 * external urls…
 */
export default new EnvStore();
