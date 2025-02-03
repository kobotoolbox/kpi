import type {AccountFieldsValues} from './account.constants';

export function getInitialAccountFieldsValues(): AccountFieldsValues {
  return {
    name: '',
    organization: '',
    organization_website: '',
    organization_type: '',
    sector: '',
    gender: '',
    bio: '',
    city: '',
    country: '',
    require_auth: false,
    newsletter_subscription: false,
    twitter: '',
    linkedin: '',
    instagram: '',
  };
}

/**
 * For given field values produces an object to use with the `/me` endpoint for
 * updating the `extra_details`.
 */
export function getProfilePatchData(fields: Partial<AccountFieldsValues>) {
  return {extra_details: fields};
}
