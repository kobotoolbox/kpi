import {fetchGet, fetchPost} from 'jsapp/js/api';
import {getOrganization} from 'js/account/stripe.api';
import {createContext} from 'react';
import {PaginatedResponse} from '../dataInterface';

interface NlpUsage {
  total_nlp_asr_seconds: number;
  total_nlp_mt_characters: number;
}

export interface AssetUsage {
  asset: string;
  asset__name: string;
  submission_count_current_month: number;
  submission_count_all_time: number;
  nlp_usage_current_month: NlpUsage;
  nlp_usage_all_time: NlpUsage;
  storage_bytes: number;
}

export interface UsageResponse {
  current_month_start: string;
  current_year_start: string;
  per_asset_usage: AssetUsage[];
  total_submission_count: {
    current_month: number;
    current_year: number;
    all_time: number;
  };
  total_storage_bytes: number;
  total_nlp_usage: {
    asr_seconds_current_month: number;
    mt_characters_current_month: number;
    asr_seconds_current_year: number;
    mt_characters_current_year: number;
    asr_seconds_all_time: number;
    mt_characters_all_time: number;
  };
}

const USAGE_URL = '/api/v2/service_usage/';

const PER_ASSET_USAGE_URL = '/api/v2/asset_usage/';

export async function getUsage(organization_id: string | null = null) {
  if (organization_id) {
    return fetchPost<UsageResponse>(USAGE_URL, {organization_id});
  }
  return fetchGet<UsageResponse>(USAGE_URL);
}

export async function getUsageForOrganization() {
  try {
    const organizations = await getOrganization();
    return await getUsage(organizations.results?.[0].id);
  } catch (error) {
    return null;
  }
}

export async function getPerAssetUsage() {
  try {
    const perAssetUsage = await fetchGet<PaginatedResponse<AssetUsage>>(
      PER_ASSET_USAGE_URL
    );
    return perAssetUsage;
  } catch (error) {
    return null;
  }
}
