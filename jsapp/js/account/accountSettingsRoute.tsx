import React, {useEffect, useState} from 'react';
import {observer} from 'mobx-react';
import {unstable_usePrompt as usePrompt} from 'react-router-dom';
import bem, {makeBem} from 'js/bem';
import sessionStore from 'js/stores/session';
import './accountSettings.scss';
import Checkbox from '../components/common/checkbox';
import TextBox from '../components/common/textBox';
import {notify, stringToColor} from 'js/utils';
import {addRequiredToLabel} from 'js/textUtils';
import envStore from '../envStore';
import WrappedSelect from '../components/common/wrappedSelect';
import {dataInterface} from '../dataInterface';
import type {LabelValuePair} from 'js/dataInterface';

bem.AccountSettings = makeBem(null, 'account-settings');
bem.AccountSettings__left = makeBem(bem.AccountSettings, 'left');
bem.AccountSettings__right = makeBem(bem.AccountSettings, 'right');
bem.AccountSettings__item = makeBem(bem.FormModal, 'item');
bem.AccountSettings__actions = makeBem(bem.AccountSettings, 'actions');

const fieldNames = {
  name: 'name',
  organization: 'organization',
  organization_website: 'organization_website',
  sector: 'sector',
  gender: 'gender',
  bio: 'bio',
  city: 'city',
  country: 'country',
  require_auth: 'require_auth',
  twitter: 'twitter',
  linkedin: 'linkedin',
  instagram: 'instagram',
};

interface Form {
  isPristine: boolean;
  fields: {
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
  };
  fieldsWithErrors: {
    extra_details?: {
      name?: string;
      organization?: string;
      organization_website?: string;
      sector?: string;
      gender?: string;
      bio?: string;
      city?: string;
      country?: string;
      require_auth?: string;
      twitter?: string;
      linkedin?: string;
      instagram?: string;
    };
  };
  sectorChoices: LabelValuePair[];
  countryChoices: LabelValuePair[];
}
const genderChoices: {[key: string]: string} = {
  male: t('Male'),
  female: t('Female'),
  other: t('Other'),
};

const choiceToSelectOptions = (
  value: string,
  choices: {[key: string]: string}
) => {
  return {
    value,
    label: choices[value],
  };
};

const genderSelectOptions = Object.keys(genderChoices).map((key) =>
  choiceToSelectOptions(key, genderChoices)
);

const AccountSettings = observer(() => {
  const environment = envStore.data;
  const [form, setForm] = useState<Form>({
    isPristine: true,
    fields: {
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
    },
    fieldsWithErrors: {},
    sectorChoices: environment.sector_choices,
    countryChoices: environment.country_choices,
  });

  useEffect(() => {
    if (
      !sessionStore.isPending &&
      sessionStore.isInitialLoadComplete &&
      !sessionStore.isInitialRoute
    ) {
      sessionStore.refreshAccount();
    }
  }, []);
  useEffect(() => {
    const currentAccount = sessionStore.currentAccount;
    if (
      !sessionStore.isPending &&
      sessionStore.isInitialLoadComplete &&
      'email' in currentAccount
    ) {
      setForm({
        ...form,
        fields: {
          name: currentAccount.extra_details.name,
          organization: currentAccount.extra_details.organization,
          organization_website:
            currentAccount.extra_details.organization_website,
          sector: currentAccount.extra_details.sector,
          gender: currentAccount.extra_details.gender,
          bio: currentAccount.extra_details.bio,
          city: currentAccount.extra_details.city,
          country: currentAccount.extra_details.country,
          require_auth: currentAccount.extra_details.require_auth,
          twitter: currentAccount.extra_details.twitter,
          linkedin: currentAccount.extra_details.linkedin,
          instagram: currentAccount.extra_details.instagram,
        },
        fieldsWithErrors: {},
      });
    }
  }, [sessionStore.isPending]);
  usePrompt({
    when: !form.isPristine,
    message: t('You have unsaved changes. Leave settings without saving?'),
  });
  const updateProfile = () => {
    // To patch correctly with recent changes to the backend,
    // ensure that we send empty strings if the field is left blank.

    // We should only overwrite user metadata that the user can see.
    // Fields that:
    //   (a) are enabled in constance
    //   (b) the frontend knows about

    // Make a list of user metadata fields to include in the patch
    const presentMetadataFields = Object.keys(
        // Fields enabled in constance
        environment.getUserMetadataFieldsAsSimpleDict()
      )
      // Intersected with:
      .filter((key) => (
        // Fields the frontend knows about
        fieldNames[key as keyof typeof fieldNames] !== undefined
      )
    );

    // Populate the patch with user form input, or empty strings.
    // eslint-disable-next-line @typescript-eslint/naming-convention, @typescript-eslint/no-explicit-any
    const extra_details: any = {};
    presentMetadataFields.forEach((key) => {
      extra_details[key] = form.fields[key as keyof typeof form.fields] || '';
    });
    // Always include require_auth, defaults to 'false'.
    extra_details.require_auth = form.fields.require_auth ? true : false;

    const profilePatchData = {extra_details};
    dataInterface
      .patchProfile(profilePatchData)
      .done(() => {
        onUpdateComplete();
      })
      .fail((...args: any) => {
        onUpdateFail(args);
      });
  };
  const onAnyFieldChange = (name: string, value: any) => {
    // Convert Selection option to just its value
    // Improvement idea: move this logic to wrappedSelect
    if (typeof value === 'object') {
      value = value['value'];
    }
    setForm({
      ...form,
      fields: {...form.fields, [name]: value},
      isPristine: false,
    });
  };
  const onUpdateComplete = () => {
    notify(t('Updated profile successfully'));
    setForm({
      ...form,
      isPristine: true,
      fieldsWithErrors: {},
    });
  };
  const onUpdateFail = (data: any) => {
    setForm({
      ...form,
      isPristine: false,
      fieldsWithErrors: data[0].responseJSON,
    });
  };

  const accountName = sessionStore.currentAccount.username;
  const initialsStyle = {
    background: `#${stringToColor(accountName)}`,
  };
  const metadata = environment.getUserMetadataFieldsAsSimpleDict();
  /** Get label and (required) for a given user metadata fieldname */
  const getLabel = (fieldName: string): string => {
    const label = metadata[fieldName]?.label || (console.error(`No label for fieldname "${fieldName}"`), fieldName);
    const required = metadata[fieldName]?.required || false;
    return addRequiredToLabel(label, required);
  };

  const sectorValue = form.sectorChoices.find(
    (sectorChoice) => sectorChoice.value === form.fields.sector
  );
  const countryValue = form.countryChoices.find(
    (countryChoice) => countryChoice.value === form.fields.country
  );

  return (
    <bem.AccountSettings>
      <bem.AccountSettings__actions>
        <bem.KoboButton
          className='account-settings-save'
          onClick={updateProfile.bind(form)}
          m={['blue']}
        >
          {t('Save Changes')}
          {!form.isPristine && ' *'}
        </bem.KoboButton>
      </bem.AccountSettings__actions>

      <bem.AccountSettings__item m={'column'}>
        <bem.AccountSettings__item m='username'>
          <bem.AccountBox__initials style={initialsStyle}>
            {accountName.charAt(0)}
          </bem.AccountBox__initials>

          <h4>{accountName}</h4>
        </bem.AccountSettings__item>

        {sessionStore.isInitialLoadComplete && (
          <bem.AccountSettings__item m='fields'>
            {/* Privacy */}
            <bem.AccountSettings__item>
              <label>{t('Privacy')}</label>

              {/* Require authentication to see forms and submit data */}
              <Checkbox
                checked={form.fields.require_auth}
                onChange={onAnyFieldChange.bind(
                  onAnyFieldChange,
                  fieldNames.require_auth
                )}
                name={fieldNames.require_auth}
                label={t('Require authentication to see forms and submit data')}
              />
            </bem.AccountSettings__item>

            {/* Full name */}
            {metadata.name && <bem.AccountSettings__item>
              <TextBox
                label={getLabel(fieldNames.name)}
                onChange={onAnyFieldChange.bind(
                  onAnyFieldChange,
                  fieldNames.name
                )}
                value={form.fields.name}
                errors={form.fieldsWithErrors.extra_details?.name}
                placeholder={t(
                  'Use this to display your real name to other users'
                )}
              />
            </bem.AccountSettings__item>}

            {/* Organization */}
            {metadata.organization && <bem.AccountSettings__item>
              <TextBox
                label={getLabel(fieldNames.organization)}
                onChange={onAnyFieldChange.bind(
                  onAnyFieldChange,
                  fieldNames.organization
                )}
                value={form.fields.organization}
                errors={form.fieldsWithErrors.extra_details?.organization}
              />
            </bem.AccountSettings__item>}

            {/* Organization Website */}
            {metadata.organization_website && <bem.AccountSettings__item>
              <TextBox
                label={getLabel(fieldNames.organization_website)}
                value={form.fields.organization_website}
                onChange={onAnyFieldChange.bind(
                  onAnyFieldChange,
                  fieldNames.organization_website
                )}
                errors={
                  form.fieldsWithErrors.extra_details?.organization_website
                }
              />
            </bem.AccountSettings__item>}

            {/* Primary Sector */}
            {metadata.sector && <bem.AccountSettings__item m='primary-sector'>
              <WrappedSelect
                label={getLabel(fieldNames.sector)}
                value={sectorValue}
                onChange={onAnyFieldChange.bind(
                  onAnyFieldChange,
                  fieldNames.sector
                )}
                options={form.sectorChoices}
                error={form.fieldsWithErrors.extra_details?.sector}
              />
            </bem.AccountSettings__item>}

            {/* Gender */}
            {metadata.gender && <bem.AccountSettings__item m='gender'>
              <WrappedSelect
                label={getLabel(fieldNames.gender)}
                value={choiceToSelectOptions(form.fields.gender, genderChoices)}
                onChange={onAnyFieldChange.bind(
                  onAnyFieldChange,
                  fieldNames.gender
                )}
                options={genderSelectOptions}
                error={form.fieldsWithErrors.extra_details?.gender}
              />
            </bem.AccountSettings__item>}

            {/* Bio */}
            {metadata.bio && <bem.AccountSettings__item m='bio'>
              <TextBox
                label={getLabel(fieldNames.bio)}
                value={form.fields.bio}
                onChange={onAnyFieldChange.bind(
                  onAnyFieldChange,
                  fieldNames.bio
                )}
                errors={form.fieldsWithErrors.extra_details?.bio}
              />
            </bem.AccountSettings__item>}

            {/* Country */}
            {metadata.country && <bem.AccountSettings__item m='country'>
              <WrappedSelect
                label={getLabel(fieldNames.country)}
                value={countryValue}
                onChange={onAnyFieldChange.bind(
                  onAnyFieldChange,
                  fieldNames.country
                )}
                options={form.countryChoices}
                error={form.fieldsWithErrors.extra_details?.country}
              />
            </bem.AccountSettings__item>}

            {/* City */}
            {metadata.city && <bem.AccountSettings__item m='city'>
              <TextBox
                label={getLabel(fieldNames.city)}
                value={form.fields.city}
                onChange={onAnyFieldChange.bind(
                  onAnyFieldChange,
                  fieldNames.city
                )}
                errors={form.fieldsWithErrors.extra_details?.city}
              />
            </bem.AccountSettings__item>}

            {/* Social */}
            {(metadata.twitter || metadata.linkedin || metadata.instagram) && <bem.AccountSettings__item>
              <label>{t('Social')}</label>

              {/* Twitter */}
              {metadata.twitter && <div className='account-settings-social-row'>
                <TextBox
                  startIcon='logo-twitter'
                  placeholder={getLabel(fieldNames.twitter)}
                  value={form.fields.twitter}
                  onChange={onAnyFieldChange.bind(
                    onAnyFieldChange,
                    fieldNames.twitter
                  )}
                  errors={form.fieldsWithErrors.extra_details?.twitter}
                />
              </div>}

              {/* LinkedIn */}
              {metadata.linkedin && <div className='account-settings-social-row'>
                <TextBox
                  startIcon='logo-linkedin'
                  placeholder={getLabel(fieldNames.linkedin)}
                  value={form.fields.linkedin}
                  onChange={onAnyFieldChange.bind(
                    onAnyFieldChange,
                    fieldNames.linkedin
                  )}
                  errors={form.fieldsWithErrors.extra_details?.linkedin}
                />
              </div>}

              {/* Instagram */}
              {metadata.instagram && <div className='account-settings-social-row'>
                <TextBox
                  startIcon='logo-instagram'
                  placeholder={getLabel(fieldNames.instagram)}
                  value={form.fields.instagram}
                  onChange={onAnyFieldChange.bind(
                    onAnyFieldChange,
                    fieldNames.instagram
                  )}
                  errors={form.fieldsWithErrors.extra_details?.instagram}
                />
              </div>}
            </bem.AccountSettings__item>}
          </bem.AccountSettings__item>
        )}
      </bem.AccountSettings__item>
    </bem.AccountSettings>
  );
});

export default AccountSettings;
