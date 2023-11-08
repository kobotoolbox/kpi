import React from 'react';
import Checkbox from '../components/common/checkbox';
import TextBox from '../components/common/textBox';
import {addRequiredToLabel} from 'js/textUtils';
import envStore from '../envStore';
import styles from './accountFieldsEditor.module.scss';
import KoboSelect from 'js/components/common/koboSelect';
import type {
  UserFieldName,
  AccountFieldsValues,
  AccountFieldsErrors,
} from './account.constants';

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

  /** Get label and (required) for a given user metadata fieldname */
  function getLabel(fieldName: UserFieldName): string {
    const label =
      metadata[fieldName]?.label ||
      (console.error(`No label for fieldname "${fieldName}"`), fieldName);
    const required = metadata[fieldName]?.required || false;
    return addRequiredToLabel(label, required);
  }

  function onAnyFieldChange(
    fieldName: UserFieldName,
    newValue: UserFieldValue
  ) {
    const newValues = {...props.values, [fieldName]: newValue};
    props.onChange(newValues);
  }

  /**
   * Field will be displayed if it's enabled on Back end and it's not omitted
   * in `displayedFields`.
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

  return (
    <div>
      <div className={styles.row}>
        {/* Privacy */}
        {props.isRequireAuthDisplayed !== false && (
          <div className={styles.field}>
            <label>{t('Privacy')}</label>

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

      <div className={styles.row}>
        {/* Full name */}
        {isFieldToBeDisplayed('name') && (
          <div className={styles.field}>
            <TextBox
              label={getLabel('name')}
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
        {isFieldToBeDisplayed('gender') && (
          <div className={styles.field}>
            <KoboSelect
              label={getLabel('gender')}
              name='gender'
              type='outline'
              size='l'
              isClearable
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
      </div>

      <div className={styles.row}>
        {/* Country */}
        {isFieldToBeDisplayed('country') && (
          <div className={styles.field}>
            <KoboSelect
              label={getLabel('country')}
              name='country'
              type='outline'
              size='l'
              isClearable
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
        {isFieldToBeDisplayed('city') && (
          <div className={styles.field}>
            <TextBox
              label={getLabel('city')}
              value={props.values.city}
              onChange={onAnyFieldChange.bind(onAnyFieldChange, 'city')}
              errors={props.errors?.city}
            />
          </div>
        )}
      </div>

      <div className={styles.row}>
        {/* Organization */}
        {isFieldToBeDisplayed('organization') && (
          <div className={styles.field}>
            <TextBox
              label={getLabel('organization')}
              onChange={onAnyFieldChange.bind(onAnyFieldChange, 'organization')}
              value={props.values.organization}
              errors={props.errors?.organization}
            />
          </div>
        )}

        {/* Organization Website */}
        {isFieldToBeDisplayed('organization_website') && (
          <div className={styles.field}>
            <TextBox
              label={getLabel('organization_website')}
              value={props.values.organization_website}
              onChange={onAnyFieldChange.bind(
                onAnyFieldChange,
                'organization_website'
              )}
              errors={props.errors?.organization_website}
            />
          </div>
        )}
      </div>

      <div className={styles.row}>
        {/* Primary Sector */}
        {isFieldToBeDisplayed('sector') && (
          <div className={styles.field}>
            <KoboSelect
              label={getLabel('sector')}
              name='sector'
              type='outline'
              size='l'
              isClearable
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
      </div>

      <div className={styles.row}>
        {/* Bio */}
        {isFieldToBeDisplayed('bio') && (
          <div className={styles.field}>
            <TextBox
              label={getLabel('bio')}
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
                  placeholder={getLabel('twitter')}
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
                  placeholder={getLabel('linkedin')}
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
                  placeholder={getLabel('instagram')}
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
    </div>
  );
}
