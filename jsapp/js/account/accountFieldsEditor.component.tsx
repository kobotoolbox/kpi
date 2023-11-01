import React from 'react';
import Checkbox from '../components/common/checkbox';
import TextBox from '../components/common/textBox';
import {addRequiredToLabel} from 'js/textUtils';
import envStore from '../envStore';
import styles from './accountFieldsEditor.module.scss';
import KoboSelect from 'js/components/common/koboSelect';
import type {UserFieldName} from './account.constants';

const genderSelectOptions = [
  {value: 'male', label: t('Male')},
  {value: 'female', label: t('Female')},
  {value: 'other', label: t('Other')},
];

type UserFieldValue = string | boolean;

export interface AccountFieldsValues {
  name: string;
  organization: string;
  organization_website: string;
  sector: string;
  gender: string;
  bio: string;
  city: string;
  country: string;
  require_auth: boolean;
  twitter: string;
  linkedin: string;
  instagram: string;
}

interface AccountFieldsEditorProps {
  /**
   * A list of fields to display in editor. Regardless of this list, all
   * the fields values will be returned with `onChange` callback (to avoid
   * losing data). If this is not provided, we display all fields :)
   */
  displayedFields?: UserFieldName[];
  /** Errors to be displayed for fields */
  errors?: {[name in UserFieldName]?: string};
  /**
   * We need values for all fields, even if only few are displayed (via
   * `displayedFields` prop)
   */
  values: AccountFieldsValues;
  onChange: (fields: AccountFieldsValues) => void;
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
      name in metadata &&
      (!props.displayedFields || props.displayedFields.includes(name))
    );
  }

  return (
    <div>
      {/* Privacy */}
      {isFieldToBeDisplayed('require_auth') && (
        <div className={styles.row}>
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

      {/* Full name */}
      {isFieldToBeDisplayed('name') && (
        <div className={styles.row}>
          <TextBox
            label={getLabel('name')}
            onChange={onAnyFieldChange.bind(onAnyFieldChange, 'name')}
            value={props.values.name}
            errors={props.errors?.name}
            placeholder={t('Use this to display your real name to other users')}
          />
        </div>
      )}

      {/* Organization */}
      {isFieldToBeDisplayed('organization') && (
        <div className={styles.row}>
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
        <div className={styles.row}>
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

      {/* Primary Sector */}
      {isFieldToBeDisplayed('sector') && (
        <div className={styles.row}>
          <label htmlFor='sector'>{getLabel('sector')}</label>
          <KoboSelect
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

      {/* Gender */}
      {isFieldToBeDisplayed('gender') && (
        <div className={styles.row}>
          <label htmlFor='gender'>{getLabel('gender')}</label>
          <KoboSelect
            name='gender'
            type='outline'
            size='l'
            isClearable
            isSearchable
            selectedOption={props.values.gender}
            onChange={(value: string | null) =>
              onAnyFieldChange('gender', value || '')
            }
            options={genderSelectOptions}
            error={props.errors?.gender}
          />
        </div>
      )}

      {/* Bio */}
      {isFieldToBeDisplayed('bio') && (
        <div className={styles.row}>
          <TextBox
            label={getLabel('bio')}
            value={props.values.bio}
            onChange={onAnyFieldChange.bind(onAnyFieldChange, 'bio')}
            errors={props.errors?.bio}
          />
        </div>
      )}

      {/* Country */}
      {isFieldToBeDisplayed('country') && (
        <div className={styles.row}>
          <label htmlFor='country'>{getLabel('country')}</label>
          <KoboSelect
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
        <div className={styles.row}>
          <TextBox
            label={getLabel('city')}
            value={props.values.city}
            onChange={onAnyFieldChange.bind(onAnyFieldChange, 'city')}
            errors={props.errors?.city}
          />
        </div>
      )}

      {/* Social */}
      {(isFieldToBeDisplayed('twitter') ||
        isFieldToBeDisplayed('linkedin') ||
        isFieldToBeDisplayed('instagram')) && (
        <>
          <label>{t('Social')}</label>

          {/* Twitter */}
          {isFieldToBeDisplayed('twitter') && (
            <div className={styles.row}>
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
            <div className={styles.row}>
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
            <div className={styles.row}>
              <TextBox
                startIcon='logo-instagram'
                placeholder={getLabel('instagram')}
                value={props.values.instagram}
                onChange={onAnyFieldChange.bind(onAnyFieldChange, 'instagram')}
                errors={props.errors?.instagram}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
