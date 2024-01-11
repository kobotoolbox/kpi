import React from 'react';
import Checkbox from '../components/common/checkbox';
import TextBox from '../components/common/textBox';
import {addRequiredToLabel} from 'js/textUtils';
import envStore from '../envStore';
import styles from './accountFieldsEditor.module.scss';
import cx from 'classnames';
import KoboSelect from 'js/components/common/koboSelect';
import type {
  UserFieldName,
  AccountFieldsValues,
  AccountFieldsErrors,
} from './account.constants';

// See: kobo/apps/accounts/forms.py (KoboSignupMixin)
const ORGANIZATION_TYPE_SELECT_OPTIONS = [
  {value: 'non-profit', label: t('Non-profit organization')},
  {value: 'government', label: t('Government institution')},
  {value: 'educational', label: t('Educational organization')},
  {value: 'commercial', label: t('A commercial/for-profit company')},
  {value: 'none', label: t('I am not associated with any organization')},
];
const GENDER_SELECT_OPTIONS = [
  {value: 'male', label: t('Male')},
  {value: 'female', label: t('Female')},
  {value: 'other', label: t('Other')},
];

type UserFieldValue = string | boolean;

interface AccountFieldsEditorProps {
  /**
   * A list of fields to display in editor. Regardless of this list, all
   * the fields values will be returned with `onChange` callback (to avoid
   * losing data). If this is not provided, we display all fields :)
   */
  displayedFields?: UserFieldName[];
  /** Errors to be displayed for fields */
  errors?: AccountFieldsErrors;
  /**
   * We need values for all fields, even if only few are displayed (via
   * `displayedFields` prop)
   */
  values: AccountFieldsValues;
  onChange: (fields: AccountFieldsValues) => void;
  /**
   * Handles the require authentication checkbox. If not provided, the checkbox
   * will be displayed.
   */
  isRequireAuthDisplayed?: boolean;
}

/**
 * A component that displays fields from user account and allows editing their
 * values. It DOES NOT handle the API calls to update the values on the endpoint.
 */
export default function AccountFieldsEditor(props: AccountFieldsEditorProps) {
  if (!envStore.isReady) {
    return null;
  }

  const metadata = envStore.data.getUserMetadataFieldsAsSimpleDict();

  /** Get label for a given user metadata fieldname */
  function getLabel(fieldName: UserFieldName): string {
    return (
      metadata[fieldName]?.label ||
      (console.error(`No label for fieldname "${fieldName}"`), fieldName)
    );
  }

  /** Is this label required? */
  function isRequired(fieldName: UserFieldName): boolean {
    return metadata[fieldName]?.required || false;
  }

  /** Get label and (required) for a given user metadata fieldname */
  function getLabelWithRequired(fieldName: UserFieldName): string {
    return addRequiredToLabel(getLabel(fieldName), isRequired(fieldName));
  }

  function isFieldRequired(fieldName: UserFieldName): boolean {
    return metadata[fieldName]?.required || false;
  }

  function onAnyFieldChange(
    fieldName: UserFieldName,
    newValue: UserFieldValue
  ) {
    const newValues = {...props.values, [fieldName]: newValue};
    props.onChange(newValues);
  }

  const cleanedUrl = (value: string) => {
    if (!value) {
      return '';
    }
    value = ('' + value).trim();
    if (!value.match(/.\../)) {
      return value;
    } // "dotless". don't change it
    if (!value.match(/^https?:\/\/.*/)) {
      value = 'https://' + value; // add missing protocol
    }
    return value;
  };

  function updateWebsiteAddress(input: string) {
    onAnyFieldChange('organization_website', cleanedUrl(input));
  }

  function onWebsiteKeydown(event: string) {
    if (event === 'Enter') {
      onAnyFieldChange(
        'organization_website',
        cleanedUrl(props.values.organization_website)
      );
    }
  }

  /**
   * Field will be displayed if it is enabled on Back end and not omitted
   * in `displayedFields`.
   *
   * NOTE: Organization-related fields are treated differently. See:
   *       - isOrganizationTypeFieldToBeDisplayed()
   *       - areOrganizationFieldsToBeSkipped()
   */
  function isFieldToBeDisplayed(name: UserFieldName) {
    return (
      // Check if field is enabled by Back-end configuration
      name in metadata &&
      // Check if parent code is not limiting displayed fields to a selection
      (!props.displayedFields ||
        // Check if parent code is limiting displayed fields to a selection, and
        // that selection includes the field
        props.displayedFields.includes(name))
    );
  }

  /**
   * Always show 'organization_type' if it is enabled on Back end and
   * 'organization' or 'organization_website' would be shown.
   *
   * Organization Type is used as a toggle for those fields ('skip logic')
   * so it needs to be reachable regardless of props.displayedFields
   */
  function isOrganizationTypeFieldToBeDisplayed() {
    return (
      'organization_type' in metadata &&
      (isFieldToBeDisplayed('organization_type') ||
        isFieldToBeDisplayed('organization') ||
        isFieldToBeDisplayed('organization_website'))
    );
  }

  /**
   * 'Skip logic' for 'organization' and 'organization_website', controlled
   * by the value of 'organization_type' dropdown.
   */
  function areOrganizationFieldsToBeSkipped() {
    return (
      isOrganizationTypeFieldToBeDisplayed() &&
      props.values.organization_type === 'none'
    );
  }

  let count = 0; // field counter to adjust wrapping with spacers

  return (
    <div>
      <div className={styles.row}>
        {/* Privacy */}
        {props.isRequireAuthDisplayed !== false && (
          <div className={styles.field}>
            <label className={styles.checkboxLabel}>{t('Privacy')}</label>

            <Checkbox
              checked={props.values.require_auth}
              onChange={(isChecked: boolean) =>
                onAnyFieldChange('require_auth', isChecked)
              }
              label={t('Require authentication to see forms and submit data')}
            />
          </div>
        )}
      </div>

      <div className={styles.flexFields}>
        {/* Full name */}
        {isFieldToBeDisplayed('name') && ++count && (
          <div className={styles.field}>
            <TextBox
              label={getLabel('name')}
              required={isRequired('name')}
              onChange={onAnyFieldChange.bind(onAnyFieldChange, 'name')}
              value={props.values.name}
              errors={props.errors?.name}
              placeholder={t(
                'Use this to display your real name to other users'
              )}
            />
          </div>
        )}

        {/* Gender */}
        {isFieldToBeDisplayed('gender') && ++count && (
          <div className={styles.field}>
            <KoboSelect
              label={getLabel('gender')}
              isRequired={isRequired('gender')}
              name='gender'
              type='outline'
              size='l'
              isClearable={!isFieldRequired('gender')}
              isSearchable
              selectedOption={props.values.gender}
              onChange={(value: string | null) =>
                onAnyFieldChange('gender', value || '')
              }
              options={GENDER_SELECT_OPTIONS}
              error={props.errors?.gender}
            />
          </div>
        )}

        {/* Insert a blank spacer to start a new row for these */}
        {!!(count % 2) && isFieldToBeDisplayed('country') && isFieldToBeDisplayed('city') && ++count && (
          <div className={styles.field}/>
        )}

        {/* Country */}
        {isFieldToBeDisplayed('country') && ++count && (
          <div className={styles.field}>
            <KoboSelect
              label={getLabel('country')}
              isRequired={isRequired('country')}
              name='country'
              type='outline'
              size='l'
              isClearable={!isFieldRequired('country')}
              isSearchable
              selectedOption={props.values.country}
              onChange={(value: string | null) =>
                onAnyFieldChange('country', value || '')
              }
              options={envStore.data.country_choices}
              error={props.errors?.country}
            />
          </div>
        )}

        {/* City */}
        {isFieldToBeDisplayed('city') && ++count && (
          <div className={styles.field}>
            <TextBox
              label={getLabel('city')}
              required={isRequired('city')}
              value={props.values.city}
              onChange={onAnyFieldChange.bind(onAnyFieldChange, 'city')}
              errors={props.errors?.city}
            />
          </div>
        )}
        {/* Primary Sector */}
        {isFieldToBeDisplayed('sector') && ++count && (
          <div className={styles.field}>
            <KoboSelect
              label={getLabel('sector')}
              isRequired={isRequired('sector')}
              name='sector'
              type='outline'
              size='l'
              isClearable={!isFieldRequired('sector')}
              isSearchable
              selectedOption={props.values.sector}
              onChange={(value: string | null) =>
                onAnyFieldChange('sector', value || '')
              }
              options={envStore.data.sector_choices}
              error={props.errors?.sector}
            />
          </div>
        )}

        {/* Organization Type */}
        {isOrganizationTypeFieldToBeDisplayed() && ++count && (
          <div className={cx(styles.field, styles.orgTypeDropdown)}>
            <KoboSelect
              label={getLabel('organization_type')}
              isRequired={isRequired('organization_type')}
              name='organization_type'
              type='outline'
              size='l'
              isClearable={!isFieldRequired('organization_type')}
              selectedOption={props.values.organization_type}
              onChange={(value: string | null) =>
                onAnyFieldChange('organization_type', value || '')
              }
              options={ORGANIZATION_TYPE_SELECT_OPTIONS}
              error={props.errors?.organization_type}
            />
          </div>
        )}


        {/* Insert a blank spacer to start a new row for these */}
        {!!(count % 2) && isFieldToBeDisplayed('organization') && isFieldToBeDisplayed('organization_website') && (
          <div className={styles.field}/>
        )}

        {/* Organization */}
        {isFieldToBeDisplayed('organization') &&
          !areOrganizationFieldsToBeSkipped() && (
            <div className={styles.field}>
              <TextBox
                label={getLabel('organization')}
                required={isRequired('organization')}
                onChange={onAnyFieldChange.bind(
                  onAnyFieldChange,
                  'organization'
                )}
                value={props.values.organization}
                errors={props.errors?.organization}
              />
            </div>
          )}

        {/* Organization Website */}
        {isFieldToBeDisplayed('organization_website') &&
          !areOrganizationFieldsToBeSkipped() && (
            <div className={styles.field}>
              <TextBox
                label={getLabel('organization_website')}
                type='url'
                value={props.values.organization_website}
                required={isRequired('organization_website')}
                onChange={onAnyFieldChange.bind(
                  onAnyFieldChange,
                  'organization_website'
                )}
                onBlur={updateWebsiteAddress}
                onKeyPress={onWebsiteKeydown}
                errors={props.errors?.organization_website}
              />
            </div>
          )}
      </div>

      <div className={styles.row}>
        {/* Bio */}
        {isFieldToBeDisplayed('bio') && (
          <div className={styles.field}>
            <TextBox
              type='text-multiline'
              label={getLabel('bio')}
              required={isRequired('bio')}
              value={props.values.bio}
              onChange={onAnyFieldChange.bind(onAnyFieldChange, 'bio')}
              errors={props.errors?.bio}
            />
          </div>
        )}
      </div>

      <div className={styles.row}>
        {/* Social */}
        {(isFieldToBeDisplayed('twitter') ||
          isFieldToBeDisplayed('linkedin') ||
          isFieldToBeDisplayed('instagram')) && (
          <>
            <div className={styles.socialLabel}>{t('Social')}</div>

            {/* Twitter */}
            {isFieldToBeDisplayed('twitter') && (
              <div className={styles.field}>
                <TextBox
                  startIcon='logo-twitter'
                  placeholder={getLabelWithRequired('twitter')}
                  value={props.values.twitter}
                  onChange={onAnyFieldChange.bind(onAnyFieldChange, 'twitter')}
                  errors={props.errors?.twitter}
                />
              </div>
            )}

            {/* LinkedIn */}
            {isFieldToBeDisplayed('linkedin') && (
              <div className={styles.field}>
                <TextBox
                  startIcon='logo-linkedin'
                  placeholder={getLabelWithRequired('linkedin')}
                  value={props.values.linkedin}
                  onChange={onAnyFieldChange.bind(onAnyFieldChange, 'linkedin')}
                  errors={props.errors?.linkedin}
                />
              </div>
            )}

            {/* Instagram */}
            {isFieldToBeDisplayed('instagram') && (
              <div className={styles.field}>
                <TextBox
                  startIcon='logo-instagram'
                  placeholder={getLabelWithRequired('instagram')}
                  value={props.values.instagram}
                  onChange={onAnyFieldChange.bind(
                    onAnyFieldChange,
                    'instagram'
                  )}
                  errors={props.errors?.instagram}
                />
              </div>
            )}
          </>
        )}
      </div>

      <div className={styles.row}>
        {/* Newsletter subscription opt-in */}
        {isFieldToBeDisplayed('newsletter_subscription') && (
          <>
            <div className={styles.field}>
              <label className={styles.checkboxLabel}>{t('Newsletter')}</label>
              <Checkbox
                checked={props.values.newsletter_subscription}
                onChange={(isChecked: boolean) =>
                  onAnyFieldChange('newsletter_subscription', isChecked)
                }
                label={getLabel('newsletter_subscription')}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
