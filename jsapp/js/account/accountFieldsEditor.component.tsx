import React from 'react';
import Checkbox from '../components/common/checkbox';
import TextBox from '../components/common/textBox';
import {addRequiredToLabel} from 'js/textUtils';
import envStore from '../envStore';
import styles from './accountFieldsEditor.module.scss';
import cx from 'classnames';
import KoboAccessibleSelect from 'js/components/special/koboAccessibleSelect';
import type {
  UserFieldName,
  AccountFieldsValues,
  AccountFieldsErrors,
} from './account.constants';
import {ORGANIZATION_TYPES, type OrganizationTypeName} from 'jsapp/js/account/organization/organizationQuery';

const ORGANIZATION_TYPE_SELECT_OPTIONS = Object.keys(ORGANIZATION_TYPES)
  .map((typeName) => {
    return {
      value: typeName,
      label: ORGANIZATION_TYPES[typeName as OrganizationTypeName].label,
    };
});

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
  onFieldChange: (fieldName: UserFieldName, value: UserFieldValue) => void;
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
    props.onFieldChange(fieldName, newValue);
  }

  const cleanedUrl = (value: string) => {
    if (!value) {
      return '';
    }
    value = ('' + value).trim();
    if (!value.match(/.\../)) {
      return value;
    } // "dotless". don't change it
    if (!value.match(/^https?:\/?\/?.*/)) {
      value = 'http://' + value; // add missing protocol
    }
    // normalize '://' and trailing slash if URL is valid
    try {value = new URL(value).toString();} catch (e) {/**/}
    return value;
  };

  function updateWebsiteAddress(input: string) {
    const cleaned = cleanedUrl(input);
    if (cleaned !== input) {
      onAnyFieldChange('organization_website', cleaned);
    }
  }

  function onWebsiteKeydown(event: string) {
    if (event === 'Enter') {
      updateWebsiteAddress(props.values.organization_website);
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

  /**
   * There's a subtle aspect of this layout that is hard to achieve with CSS
   * only. There are pairs of fields that, if they appear together, they
   * should to start a new row so they can appear side-by-side. But, if just
   * one of these fields appears, it should share a row with its neighbor.
   *
   * It's tricky:
   *
   *  (1) A flex child can't force a flex to wrap early, except by being too
   *      wide to share a row. One solution is to insert a spacer the same size
   *      as a field, only when it is preceded by an odd number of fields. We
   *      can determine this with a JS counter in the render function, or in CSS
   *      with an :nth- pseudo-selectors. (*CSS idea is unverified -ph)
   *  (2) We can only tell if that spacer is needed based on fields that appear
   *      later in the form, which rules out most CSS selectors. In JS, we can
   *      use boolean logic in the render function. Or in CSS we can use the
   *      newly-landed :has(), or place the spacers later in the DOM and reorder
   *      them with flex order. (*CSS idea is unverified -ph)
   *
   * Both solutions are a little dicey
   *
   * 1. Use the newly-landed :has() along with :nth-child() to conditionally add
   *    a spacer into the flow if it's needed. (Hypothetical solution.)
   * 2. Increment a counter in JavaScript to count even or odd rows, and use
   *    JS logic. (This was the first thing I tried and it works.)
   *
   * In the interest of keeping "presentational" concerns in CSS as much as
   * possible and avoid weaving a counter variable in a render statement,
   * I may try the CSS solution.
   *   -ph
   */
  let fieldCount = 0; // field counter to adjust wrapping with spacers

  return (
    <div>
      <div className={styles.flexFields}>
        {/* Full name */}
        {/* Comma operator evaluates left-to-right, returns rightmost operand.
            We increment fieldCount and ignore the result. */}
        {isFieldToBeDisplayed('name') && (fieldCount++, (
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
              renderFocused
            />
          </div>
        ))}

        {/* Gender */}
        {isFieldToBeDisplayed('gender') && (fieldCount++, (
          <div className={styles.field}>
            <KoboAccessibleSelect
              label={getLabel('gender')}
              required={isRequired('gender')}
              name='gender'
              // type='outline'
              // size='l'
              isClearable={!isFieldRequired('gender')}
              // selectedOption={props.values.gender}
              value={props.values.gender}
              onChange={(value: string | null) =>
                onAnyFieldChange('gender', value || '')
              }
              options={GENDER_SELECT_OPTIONS}
              error={props.errors?.gender}
            />
          </div>
        ))}


        {/*
          Start a new row for country and city if both are present.
          Insert a spacer if the preceding number of rows is odd.
        */}
        {!!(fieldCount % 2) &&
          isFieldToBeDisplayed('country') &&
          isFieldToBeDisplayed('city') &&
          fieldCount++ && <div className={styles.field} />}

        {/* Country */}
        {isFieldToBeDisplayed('country') && (fieldCount++, (
          <div className={styles.field}>
            <KoboAccessibleSelect
              label={getLabel('country')}
              required={isRequired('country')}
              name='country'
              // type='outline'
              // size='l'
              isClearable={!isFieldRequired('country')}
              // isSearchable
              value={props.values.country}
              onChange={(value: string | null) =>
                onAnyFieldChange('country', value || '')
              }
              options={envStore.data.country_choices}
              error={props.errors?.country}
            />
          </div>
        ))}

        {/* City */}
        {isFieldToBeDisplayed('city') && (fieldCount++, (
          <div className={styles.field}>
            <TextBox
              label={getLabel('city')}
              required={isRequired('city')}
              value={props.values.city}
              onChange={onAnyFieldChange.bind(onAnyFieldChange, 'city')}
              errors={props.errors?.city}
            />
          </div>
        ))}
        {/* Primary Sector */}
        {isFieldToBeDisplayed('sector') && (fieldCount++, (
          <div className={styles.field}>
            <KoboAccessibleSelect
              label={getLabel('sector')}
              required={isRequired('sector')}
              name='sector'
              // type='outline'
              // size='l'
              isClearable={!isFieldRequired('sector')}
              // isSearchable
              value={props.values.sector}
              onChange={(value: string | null) =>
                onAnyFieldChange('sector', value || '')
              }
              options={envStore.data.sector_choices}
              error={props.errors?.sector}
            />
          </div>
        ))}

        {/* Organization Type */}
        {isOrganizationTypeFieldToBeDisplayed() && (fieldCount++, (
          <div className={cx(styles.field, styles.orgTypeDropdown)}>
            <KoboAccessibleSelect
              label={getLabel('organization_type')}
              required={isRequired('organization_type')}
              name='organization_type'
              // type='outline'
              // size='l'
              isClearable={!isFieldRequired('organization_type')}
              value={props.values.organization_type}
              onChange={(value: string | null) =>
                onAnyFieldChange('organization_type', value || '')
              }
              options={ORGANIZATION_TYPE_SELECT_OPTIONS}
              error={props.errors?.organization_type}
              noMaxMenuHeight
            />
          </div>
        ))}

        {/*
          Start a new row for these two organization fields if both are present.
          Insert a spacer if the preceding number of rows is odd.
        */}
        {!!(fieldCount % 2) &&
          isFieldToBeDisplayed('organization') &&
          isFieldToBeDisplayed('organization_website') && (
            <div className={styles.field} />
          )}
        {/*
          At this point we can stop counting fields because we don't need to
          know if we're on the even or odd side anymore.
        */}

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
