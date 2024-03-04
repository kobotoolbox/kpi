import type {AccountFieldsValues} from './account.constants';
import envStore from '../envStore';
import {USER_FIELD_NAMES} from './account.constants';

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
export function getProfilePatchData(fields: AccountFieldsValues) {
  // HACK: dumb down the `output` type here, so TS doesn't have a problem with
  // types inside the `forEach` loop below, and the output is compatible with
  // functions from `api.ts` file.
  const output: {extra_details: {[key: string]: any}} = {
    extra_details: getInitialAccountFieldsValues(),
  };

  // To patch correctly with recent changes to the backend,
  // ensure that we send empty strings if the field is left blank.

  // We should only overwrite user metadata that the user can see.
  // Fields that:
  //   (a) are enabled in constance
  //   (b) the frontend knows about

  // Make a list of user metadata fields to include in the patch
  const presentMetadataFields =
    // Fields enabled in constance
    envStore.data
      .getUserMetadataFieldNames()
      // Intersected with:
      .filter(
        (fieldName) =>
          // Fields the frontend knows about
          fieldName in USER_FIELD_NAMES
      );

  // Populate the patch with user form input, or empty strings.
  presentMetadataFields.forEach((fieldName) => {
    output.extra_details[fieldName] = fields[fieldName] || '';
  });

  // Always include require_auth, defaults to 'false'.
  output.extra_details.require_auth = fields.require_auth ? true : false;

  return output;
}
