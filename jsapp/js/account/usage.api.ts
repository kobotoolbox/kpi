import {fetchGet} from 'jsapp/js/api';

interface AssetUsage {
  asset: string;
  asset__name: string;
  submission_count_current_month: number;
  submission_count_all_time: number;
  nlp_usage_current_month: unknown;
  nlp_usage_all_time: unknown;
  storage_bytes: number;
}

interface UsageResponse {
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

export async function getUsage() {
  return fetchGet<UsageResponse>(USAGE_URL);
}
