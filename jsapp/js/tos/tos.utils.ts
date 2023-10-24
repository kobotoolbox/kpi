import type {AccountResponse} from 'js/dataInterface';
import type {EnvStoreData} from 'js/envStore';

export interface TOSFormField {
  label: string;
  value: any; // ?
}

export function buildTOSFormFields(
  userData?: AccountResponse,
  envData?: EnvStoreData
): TOSFormField[] | undefined {
  if (userData && envData) {
    return [];
  }
  return undefined;
}
