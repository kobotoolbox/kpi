import {fetchGet} from 'jsapp/js/api';
import {PROJECT_FIELDS} from 'jsapp/js/projects/projectViews/constants';
import type {ProjectsTableOrder} from 'jsapp/js/projects/projectsTable/projectsTable';
import type {ProjectFieldName} from 'jsapp/js/projects/projectViews/constants';

export interface AssetUsage {
  count: string;
  next: string | null;
  previous: string | null;
  results: AssetWithUsage[];
}

export interface AssetWithUsage {
  asset: string;
  uid: string;
  asset__name: string;
  nlp_usage_current_month: {
    total_nlp_asr_seconds: number;
    total_nlp_mt_characters: number;
  };
  nlp_usage_current_year: {
    total_nlp_asr_seconds: number;
    total_nlp_mt_characters: number;
  };
  nlp_usage_all_time: {
    total_nlp_asr_seconds: number;
    total_nlp_mt_characters: number;
  };
  storage_bytes: number;
  submission_count_current_month: number;
  submission_count_current_year: number;
  submission_count_all_time: number;
  deployment_status: string;
}

export interface UsageResponse {
  current_month_start: string;
  current_month_end: string;
  current_year_start: string;
  current_year_end: string;
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
const ORGANIZATION_USAGE_URL =
  '/api/v2/organizations/##ORGANIZATION_ID##/service_usage/';

const ASSET_USAGE_URL = '/api/v2/asset_usage/';
const ORGANIZATION_ASSET_USAGE_URL =
  '/api/v2/organizations/##ORGANIZATION_ID##/asset_usage/';

export async function getUsage(organization_id: string | null = null) {
  if (organization_id) {
    return fetchGet<UsageResponse>(
      ORGANIZATION_USAGE_URL.replace('##ORGANIZATION_ID##', organization_id),
      {
        includeHeaders: true,
        errorMessageDisplay: t('There was an error fetching usage data.'),
      }
    );
  }
  return fetchGet<UsageResponse>(USAGE_URL, {
    includeHeaders: true,
    errorMessageDisplay: t('There was an error fetching usage data.'),
  });
}

export async function getAssetUsage(url = ASSET_USAGE_URL) {
  return fetchGet<AssetUsage>(url, {
    includeHeaders: true,
    errorMessageDisplay: t('There was an error fetching asset usage data.'),
  });
}

export async function getAssetUsageForOrganization(
  pageNumber: number | string,
  order?: ProjectsTableOrder,
  organizationId = ''
) {
  // if the user isn't in an organization, just get their personal asset usage
  if (!organizationId) {
    return await getAssetUsage(ASSET_USAGE_URL);
  }

  const apiUrl = ORGANIZATION_ASSET_USAGE_URL.replace(
    '##ORGANIZATION_ID##',
    organizationId
  );

  const params = new URLSearchParams({
    page: pageNumber.toString(),
  });

  if (
    order?.fieldName &&
    order.direction &&
    (order.direction === 'ascending' || order.direction === 'descending')
  ) {
    const orderingPrefix = order.direction === 'ascending' ? '' : '-';
    const fieldDefinition = PROJECT_FIELDS[order.fieldName as ProjectFieldName];
    params.set('ordering', orderingPrefix + fieldDefinition.apiOrderingName);
  }

  return await getAssetUsage(`${apiUrl}?${params}`);
}
