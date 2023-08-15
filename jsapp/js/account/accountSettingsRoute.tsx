import React, {useEffect, useState} from 'react';
import {observer} from 'mobx-react';
import {unstable_usePrompt as usePrompt} from 'react-router-dom';
import bem, {makeBem} from 'js/bem';
import sessionStore from 'js/stores/session';
import './accountSettings.scss';
import Checkbox from '../components/common/checkbox';
import TextBox from '../components/common/textBox';
import {addRequiredToLabel, notify, stringToColor} from '../utils';
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
  full_name: 'full_name',
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
    full_name: string;
    organization: string;
    organizationWebsite: string;
    sector: string;
    gender: string;
    bio: string;
    city: string;
    country: string;
    requireAuth: boolean;
    twitter: string;
    linkedin: string;
    instagram: string;
  };
  fieldsWithErrors: {
    extra_details?: {
      full_name?: string;
      organization?: string;
      organizationWebsite?: string;
      sector?: string;
      gender?: string;
      bio?: string;
      city?: string;
      country?: string;
      requireAuth?: string;
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
      full_name: '',
      organization: '',
      organizationWebsite: '',
      sector: '',
      gender: '',
      bio: '',
      city: '',
      country: '',
      requireAuth: false,
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
          full_name: currentAccount.extra_details.full_name,
          organization: currentAccount.extra_details.organization,
          organizationWebsite:
            currentAccount.extra_details.organization_website,
          sector: currentAccount.extra_details.sector,
          gender: currentAccount.extra_details.gender,
          bio: currentAccount.extra_details.bio,
          city: currentAccount.extra_details.city,
          country: currentAccount.extra_details.country,
          requireAuth: currentAccount.extra_details.require_auth,
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
    const profilePatchData = {
      extra_details: {
        full_name: form.fields.full_name || '',
        organization: form.fields.organization || '',
        organization_website: form.fields.organizationWebsite || '',
        sector: form.fields.sector || '',
        gender: form.fields.gender || '',
        bio: form.fields.bio || '',
        city: form.fields.city || '',
        country: form.fields.country || '',
        require_auth: form.fields.requireAuth ? true : false, // false if empty
        twitter: form.fields.twitter || '',
        linkedin: form.fields.linkedin || '',
        instagram: form.fields.instagram || '',
      },
    };
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
  const userMetadataFieldDict = environment.getUserMetadataFieldsAsSimpleDict();
  const getFieldLabel = (fieldName: string): string =>
    userMetadataFieldDict[fieldName]?.label ||
    (console.error(`No label for fieldname "${fieldName}"`), fieldName);
  const isFieldRequired = (fieldName: string): boolean =>
    userMetadataFieldDict[fieldName]?.required || false;
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
                checked={form.fields.requireAuth}
                onChange={onAnyFieldChange.bind(
                  onAnyFieldChange,
                  'requireAuth'
                )}
                name='requireAuth'
                label={t('Require authentication to see forms and submit data')}
              />
            </bem.AccountSettings__item>

            {/* Full name */}
            <bem.AccountSettings__item>
              <TextBox
                customModifiers='on-white'
                label={addRequiredToLabel(
                  getFieldLabel(fieldNames.full_name),
                  isFieldRequired(fieldNames.full_name)
                )}
                onChange={onAnyFieldChange.bind(onAnyFieldChange, 'full_name')}
                value={form.fields.full_name}
                errors={form.fieldsWithErrors.extra_details?.full_name}
                placeholder={t(
                  'Use this to display your real name to other users'
                )}
              />
            </bem.AccountSettings__item>

            {/* Organization */}
            <bem.AccountSettings__item>
              <TextBox
                customModifiers='on-white'
                label={addRequiredToLabel(
                  getFieldLabel(fieldNames.organization),
                  isFieldRequired(fieldNames.organization)
                )}
                onChange={onAnyFieldChange.bind(
                  onAnyFieldChange,
                  'organization'
                )}
                value={form.fields.organization}
                errors={form.fieldsWithErrors.extra_details?.organization}
              />
            </bem.AccountSettings__item>

            {/* Organization Website */}
            <bem.AccountSettings__item>
              <TextBox
                customModifiers='on-white'
                label={addRequiredToLabel(
                  getFieldLabel(fieldNames.organization_website),
                  isFieldRequired(fieldNames.organization_website)
                )}
                value={form.fields.organizationWebsite}
                onChange={onAnyFieldChange.bind(
                  onAnyFieldChange,
                  'organizationWebsite'
                )}
                errors={
                  form.fieldsWithErrors.extra_details?.organizationWebsite
                }
              />
            </bem.AccountSettings__item>

            {/* Primary Sector */}
            <bem.AccountSettings__item m='primary-sector'>
              <WrappedSelect
                label={addRequiredToLabel(
                  getFieldLabel(fieldNames.sector),
                  isFieldRequired(fieldNames.sector)
                )}
                value={sectorValue}
                onChange={onAnyFieldChange.bind(onAnyFieldChange, 'sector')}
                options={form.sectorChoices}
                error={form.fieldsWithErrors.extra_details?.sector}
              />
            </bem.AccountSettings__item>

            {/* Gender */}
            <bem.AccountSettings__item m='gender'>
              <WrappedSelect
                label={addRequiredToLabel(
                  getFieldLabel(fieldNames.gender),
                  isFieldRequired(fieldNames.gender)
                )}
                value={choiceToSelectOptions(form.fields.gender, genderChoices)}
                onChange={onAnyFieldChange.bind(onAnyFieldChange, 'gender')}
                options={genderSelectOptions}
                error={form.fieldsWithErrors.extra_details?.gender}
              />
            </bem.AccountSettings__item>

            {/* Bio */}
            <bem.AccountSettings__item m='bio'>
              <TextBox
                customModifiers='on-white'
                label={addRequiredToLabel(
                  getFieldLabel(fieldNames.bio),
                  isFieldRequired(fieldNames.bio)
                )}
                value={form.fields.bio}
                onChange={onAnyFieldChange.bind(onAnyFieldChange, 'bio')}
                errors={form.fieldsWithErrors.extra_details?.bio}
              />
            </bem.AccountSettings__item>

            {/* Country */}
            <bem.AccountSettings__item m='country'>
              <WrappedSelect
                label={addRequiredToLabel(
                  getFieldLabel(fieldNames.country),
                  isFieldRequired(fieldNames.country)
                )}
                value={countryValue}
                onChange={onAnyFieldChange.bind(onAnyFieldChange, 'country')}
                options={form.countryChoices}
                error={form.fieldsWithErrors.extra_details?.country}
              />
            </bem.AccountSettings__item>

            {/* City */}
            <bem.AccountSettings__item m='city'>
              <TextBox
                customModifiers='on-white'
                label={addRequiredToLabel(
                  getFieldLabel(fieldNames.city),
                  isFieldRequired(fieldNames.city)
                )}
                value={form.fields.city}
                onChange={onAnyFieldChange.bind(onAnyFieldChange, 'city')}
                errors={form.fieldsWithErrors.extra_details?.city}
              />
            </bem.AccountSettings__item>

            {/* Social */}
            <bem.AccountSettings__item m='social'>
              <label>{t('Social')}</label>

              {/* Twitter */}
              <label>
                <i className='k-icon k-icon-logo-twitter' />

                <TextBox
                  customModifiers='on-white'
                  placeholder={addRequiredToLabel(
                    getFieldLabel(fieldNames.twitter),
                    isFieldRequired(fieldNames.twitter)
                  )}
                  value={form.fields.twitter}
                  onChange={onAnyFieldChange.bind(onAnyFieldChange, 'twitter')}
                  errors={form.fieldsWithErrors.extra_details?.twitter}
                />
              </label>

              {/* LinkedIn */}
              <label>
                <i className='k-icon k-icon-logo-linkedin' />

                <TextBox
                  customModifiers='on-white'
                  placeholder={addRequiredToLabel(
                    getFieldLabel(fieldNames.linkedin),
                    isFieldRequired(fieldNames.linkedin)
                  )}
                  value={form.fields.linkedin}
                  onChange={onAnyFieldChange.bind(onAnyFieldChange, 'linkedin')}
                  errors={form.fieldsWithErrors.extra_details?.linkedin}
                />
              </label>

              {/* Instagram */}
              <label>
                <i className='k-icon k-icon-logo-instagram' />

                <TextBox
                  customModifiers='on-white'
                  placeholder={addRequiredToLabel(
                    getFieldLabel(fieldNames.instagram),
                    isFieldRequired(fieldNames.instagram)
                  )}
                  value={form.fields.instagram}
                  onChange={onAnyFieldChange.bind(
                    onAnyFieldChange,
                    'instagram'
                  )}
                  errors={form.fieldsWithErrors.extra_details?.instagram}
                />
              </label>
            </bem.AccountSettings__item>
          </bem.AccountSettings__item>
        )}
      </bem.AccountSettings__item>
    </bem.AccountSettings>
  );
});

export default AccountSettings;
