import {fetchGet} from 'jsapp/js/api';

interface AssetUsage {
  asset: string;
  asset__name: string;
  submission_count_current_month: number;
  submission_count_all_time: number;
  nlp_usage_current_month: unknown,
  nlp_usage_all_time: unknown,
  storage_bytes: number;
}

interface UsageResponse {
  per_asset_usage: AssetUsage[],
  total_submission_count_current_month: number,
  total_submission_count_all_time: number,
  total_storage_bytes: number,
  total_nlp_asr_seconds: number,
  total_nlp_mt_characters: number,
}

const USAGE_URL = '/api/v2/service_usage/';

export async function getUsage() {
  return fetchGet<UsageResponse>(USAGE_URL);
}
