import {actions} from 'js/actions';
import type {EnvironmentResponse} from 'js/dataInterface';
import {makeAutoObservable} from 'mobx';

export interface EnvStoreDataItem {
  value: string;
  /** Note: the labels are always localized in the current UI language */
  label: string;
}

export interface EnvStoreFieldItem {
  name: string;
  required: boolean;
}

class EnvStoreData {
  public terms_of_service_url = '';
  public privacy_policy_url = '';
  public source_code_url = '';
  public support_email = '';
  public support_url = '';
  public community_url = '';
  public min_retry_time = 4; // seconds
  public max_retry_time: number = 4 * 60; // seconds
  public project_metadata_fields: EnvStoreFieldItem[] = [];
  public user_metadata_fields: EnvStoreFieldItem[] = [];
  public sector_choices: EnvStoreDataItem[] = [];
  public operational_purpose_choices: EnvStoreDataItem[] = [];
  public country_choices: EnvStoreDataItem[] = [];
  /** languages come from `kobo/static_lists.py` **/
  public all_languages: EnvStoreDataItem[] = [];
  public interface_languages: EnvStoreDataItem[] = [];
  public submission_placeholder = '';
  public mfa_localized_help_text: {[name: string]: string} = {};
  public mfa_enabled = false;
  public mfa_code_length = 6;
  public stripe_public_key: string | null = null;
  public stripe_pricing_table_id: string | null = null;

  public getProjectMetadataField(fieldName: string): EnvStoreFieldItem | boolean {
    for (const f of this.project_metadata_fields) {
      if (f.name === fieldName) {
        return f;
      }
    }
    return false;
  }
  public getUserMetadataField(fieldName: string): EnvStoreFieldItem | boolean {
    for (const f of this.user_metadata_fields) {
      if (f.name === fieldName) {
        return f;
      }
    }
    return false;
  }
}

class EnvStore {
  data: EnvStoreData;
  isReady = false;

  constructor() {
    makeAutoObservable(this);
    this.data = new EnvStoreData();
    actions.auth.getEnvironment.completed.listen(this.onGetEnvCompleted.bind(this));
    actions.auth.getEnvironment();
  }

  /**
   * A DRY utility function that turns an array of two items into an object with
   * 'value' and 'label' properties.
   */
  private nestedArrToChoiceObjs = (i: string[]): EnvStoreDataItem => {
    return {
      value: i[0],
      label: i[1],
    };
  };

  onGetEnvCompleted(response: EnvironmentResponse) {
    this.data.terms_of_service_url = response.terms_of_service_url;
    this.data.privacy_policy_url = response.privacy_policy_url;
    this.data.source_code_url = response.source_code_url;
    this.data.support_email = response.support_email;
    this.data.support_url = response.support_url;
    this.data.community_url = response.community_url;
    this.data.min_retry_time = response.frontend_min_retry_time;
    this.data.max_retry_time = response.frontend_max_retry_time;
    this.data.project_metadata_fields = response.project_metadata_fields;
    this.data.user_metadata_fields = response.user_metadata_fields;
    this.data.submission_placeholder = response.submission_placeholder;
    this.data.mfa_localized_help_text = response.mfa_localized_help_text;
    this.data.mfa_enabled = response.mfa_enabled;
    this.data.mfa_code_length = response.mfa_code_length;
    this.data.stripe_public_key = response.stripe_public_key;
    this.data.stripe_pricing_table_id = response.stripe_pricing_table_id;

    if (response.sector_choices) {
      this.data.sector_choices = response.sector_choices.map(this.nestedArrToChoiceObjs);
    }
    if (response.operational_purpose_choices) {
      this.data.operational_purpose_choices = response.operational_purpose_choices.map(this.nestedArrToChoiceObjs);
    }
    if (response.country_choices) {
      this.data.country_choices = response.country_choices.map(this.nestedArrToChoiceObjs);
    }
    if (response.interface_languages) {
      this.data.interface_languages = response.interface_languages.map(this.nestedArrToChoiceObjs);
    }
    if (response.all_languages) {
      this.data.all_languages = response.all_languages.map(this.nestedArrToChoiceObjs);
    }

    this.isReady = true;
  }

  get languages() {
    return this.data.all_languages;
  }

  public getLanguage(code: string): EnvStoreDataItem | undefined {
    return this.data.all_languages.find(
      (item: EnvStoreDataItem) => item.value === code
    );
  }

  public getSectorLabel(sectorName: string): string | undefined {
    const foundSector = this.data.sector_choices.find(
      (item: EnvStoreDataItem) => item.value === sectorName
    );
    if (foundSector) {
      return foundSector.label;
    }
    return undefined;
  }

  public getCountryLabel(code: string): string | undefined {
    const foundCountry = this.data.country_choices.find(
      (item: EnvStoreDataItem) => item.value === code
    );
    if (foundCountry) {
      return foundCountry.label;
    }
    return undefined;
  }

  /** Returns a know language label or the provided code. */
  public getLanguageDisplayLabel(code: string): string {
    let displayLabel = code;
    const envStoreLanguage = this.getLanguage(code);
    if (envStoreLanguage) {
      displayLabel = envStoreLanguage.label;
    }
    return displayLabel;
  }

  /** Case-insensitive lookup by localized name */
  public getLanguageByName(label: string): EnvStoreDataItem | undefined {
    return this.data.all_languages.find(
      (item: EnvStoreDataItem) => item.label.toLocaleLowerCase() === label.toLocaleLowerCase()
    );
  }
}

/**
 * This store keeps all environment data (constants) like languages, countries,
 * external urls…
 */

export default new EnvStore;
