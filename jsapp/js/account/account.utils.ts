import type {AccountFieldsValues} from './accountFieldsEditor.component';
import envStore from '../envStore';
import {USER_FIELD_NAMES} from './account.constants';

export function getInitialAccountFieldsValues(): AccountFieldsValues {
  return {
    name: '',
    organization: '',
    organization_website: '',
    sector: '',
    gender: '',
    bio: '',
    city: '',
    country: '',
    require_auth: false,
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
  const output = {
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
    // HACK: override the types during value setting, as TS doesn't have
    // the means to know if we're dealing with `boolean` or `string` inside
    // this loop
    (output.extra_details as {[key: string]: any})[fieldName] = fields[fieldName];
  });

  // Always include require_auth, defaults to 'false'.
  output.extra_details.require_auth = fields.require_auth ? true : false;

  return output;
}
