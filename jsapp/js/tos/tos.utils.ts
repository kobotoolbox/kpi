import type {AccountResponse} from 'js/dataInterface';
import type {EnvStoreData} from 'js/envStore';

export interface TOSFormField {
  name: string;
  label: string;
  value: any; // ?
}

/**
 * Builds a list of required fields from environment store data, and then
 * ensures all the existing values for them are filled out.
 */
export function buildTOSFormFields(
  userData: AccountResponse,
  envData: EnvStoreData
): TOSFormField[] {
  return envData.user_metadata_fields.filter((field) => field.required).map((field) => {
    return {
      name: field.name,
      label: field.label,
      value: userData.extra_details[field.name],
    };
  });
}
