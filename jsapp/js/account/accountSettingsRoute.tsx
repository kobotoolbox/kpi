import React, {useEffect, useState} from 'react';
import bem, {makeBem} from 'js/bem';
import {usePrompt} from 'js/router/promptBlocker';
import sessionStore from 'js/stores/session';
import './accountSettings.scss';
import Checkbox from '../components/common/checkbox';
import TextBox from '../components/common/textBox';
import {addRequiredToLabel, notify, stringToColor} from '../utils';
import {ACCOUNT_ROUTES} from './routes';
import ApiTokenDisplay from '../components/apiTokenDisplay';
import envStore, { EnvStoreDataItem } from '../envStore';
import WrappedSelect from '../components/common/wrappedSelect';
import {dataInterface} from '../dataInterface';

bem.AccountSettings = makeBem(null, 'account-settings');
bem.AccountSettings__left = makeBem(bem.AccountSettings, 'left');
bem.AccountSettings__right = makeBem(bem.AccountSettings, 'right');
bem.AccountSettings__item = makeBem(bem.FormModal, 'item');
bem.AccountSettings__actions = makeBem(bem.AccountSettings, 'actions');

interface Form{
  isPristine: boolean;
  fields: {
    name: string;
    email: string;
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
    email?: string[];
    extra_details?: {
      name?: string;
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
  sectorChoices: EnvStoreDataItem[];
  countryChoices: EnvStoreDataItem[];
  genderChoices: EnvStoreDataItem[];
}

function AccountSettings() {
  const [session] = useState(() => sessionStore);
  const environment = envStore.data;
  const [form, setForm] = useState<Form>({
    isPristine: true,
    fields: {
      name: '',
      email: '',
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
    genderChoices: [
      {
        value: 'male',
        label: t('Male'),
      },
      {
        value: 'female',
        label: t('Female'),
      },
      {
        value: 'other',
        label: t('Other'),
      },
    ],
  });

  useEffect(() => {
    if (
      !session.isPending &&
      session.isInitialLoadComplete &&
      !session.isInitialRoute
    )
      session.refreshAccount();
  }, []);
  useEffect(() => {
    const currentAccount = session.currentAccount;
    if (
      !session.isPending &&
      session.isInitialLoadComplete &&
      'email' in currentAccount
    )
      setForm({
        ...form,
        fields: {
          name: currentAccount.extra_details.name,
          email: currentAccount.email,
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
  }, [session.isInitialLoadComplete, session.isPending]);
  usePrompt(
    t('You have unsaved changes. Leave settings without saving?'),
    !form.isPristine
  );
  const updateProfile = () => {
    dataInterface.patchProfile({
      email: form.fields.email,
      extra_details: JSON.stringify({
        name: form.fields.name,
        organization: form.fields.organization,
        organization_website: form.fields.organizationWebsite,
        sector: form.fields.sector,
        gender: form.fields.gender,
        bio: form.fields.bio,
        city: form.fields.city,
        country: form.fields.country,
        require_auth: form.fields.requireAuth,
        twitter: form.fields.twitter,
        linkedin: form.fields.linkedin,
        instagram: form.fields.instagram,
      }),
    }).done(() => {
      onUpdateComplete()
    }).fail((...args: any) => {
      onUpdateFail(args)
    });
  };
  const onAnyFieldChange = (name: string, value: any) => {
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
    })
  };
  const onUpdateFail = (data: any) => {
    setForm({
      ...form,
      isPristine: false,
      fieldsWithErrors: data[0].responseJSON,
    })
  };
  const accountName = sessionStore.currentAccount.username;
  const initialsStyle = {
    background: `#${stringToColor(accountName)}`,
  };
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
            <bem.AccountSettings__item>
              <label>{t('Privacy')}</label>

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

            <bem.AccountSettings__item>
              <TextBox
                customModifiers='on-white'
                label={t('Name')}
                onChange={onAnyFieldChange.bind(
                  onAnyFieldChange, 
                  'name'
                  )}
                value={form.fields.name}
                errors={form.fieldsWithErrors.extra_details?.name}
                placeholder={t(
                  'Use this to display your real name to other users'
                )}
              />
            </bem.AccountSettings__item>

            <bem.AccountSettings__item>
              <TextBox
                customModifiers='on-white'
                label={addRequiredToLabel(t('Email'))}
                type='email'
                onChange={onAnyFieldChange.bind(
                  onAnyFieldChange,
                  'email'
                )}
                value={form.fields.email}
                errors={form.fieldsWithErrors.email}
              />
            </bem.AccountSettings__item>

            <bem.AccountSettings__item m='password'>
              <a
                href={`/#${ACCOUNT_ROUTES.CHANGE_PASSWORD}`}
                className='kobo-button kobo-button--blue'
              >
                {t('Modify Password')}
                </a>
            </bem.AccountSettings__item>

            <ApiTokenDisplay/>

            <bem.AccountSettings__item>
              <TextBox
                customModifiers='on-white'
                label={addRequiredToLabel(t('Organization'))}
                onChange={onAnyFieldChange.bind(
                  onAnyFieldChange,
                  'organization'
                )}
                value={form.fields.organization}
                errors={form.fieldsWithErrors.extra_details?.organization}
              />
            </bem.AccountSettings__item>

            <bem.AccountSettings__item>
              <TextBox
                customModifiers='on-white'
                label={t('Organization Website')}
                value={form.fields.organizationWebsite}
                onChange={onAnyFieldChange.bind(
                  onAnyFieldChange,
                  'organization_website'
                )}
                errors={form.fieldsWithErrors.extra_details?.organizationWebsite}
              />
            </bem.AccountSettings__item>

            <bem.AccountSettings__item m='primary-sector'>
              <WrappedSelect
                label={addRequiredToLabel(t('Primary Sector'))}
                value={form.fields.sector}
                onChange={onAnyFieldChange.bind(
                  onAnyFieldChange,
                  'sector'
                )}
                options={form.sectorChoices}
                error={form.fieldsWithErrors.extra_details?.sector}
              />
            </bem.AccountSettings__item>

            <bem.AccountSettings__item m='gender'>
              <WrappedSelect
                label={t('Gender')}
                value={form.fields.gender}
                onChange={onAnyFieldChange.bind(
                  onAnyFieldChange,
                  'gender'
                )}
                options={form.genderChoices}
                error={form.fieldsWithErrors.extra_details?.gender}
              />
            </bem.AccountSettings__item>

            <bem.AccountSettings__item m='bio'>
              <TextBox
                customModifiers='on-white'
                label={t('Bio')}
                value={form.fields.bio}
                onChange={onAnyFieldChange.bind(
                  onAnyFieldChange,
                  'bio'
                )}
                errors={form.fieldsWithErrors.extra_details?.bio}
              />
            </bem.AccountSettings__item>

            <bem.AccountSettings__item m='country'>
              <WrappedSelect
                label={t('Country')}
                value={form.fields.country}
                onChange={onAnyFieldChange.bind(
                  onAnyFieldChange, 
                  'country'
                )}
                options={form.countryChoices}
                error={form.fieldsWithErrors.extra_details?.country}
              />
            </bem.AccountSettings__item>

            <bem.AccountSettings__item m='city'>
              <TextBox
                customModifiers='on-white'
                label={t('City')}
                value={form.fields.city}
                onChange={onAnyFieldChange.bind(
                  onAnyFieldChange,
                  'city'
                )}
                errors={form.fieldsWithErrors.extra_details?.city}
              />
            </bem.AccountSettings__item>

            <bem.AccountSettings__item m='social'>
              <label>{t('Social')}</label>
              <label>
                <i className='k-icon k-icon-logo-twitter' />

                <TextBox
                  customModifiers='on-white'
                  value={form.fields.twitter}
                  onChange={onAnyFieldChange.bind(
                    onAnyFieldChange,
                    'twitter'
                  )}
                  errors={form.fieldsWithErrors.extra_details?.twitter}
                />
              </label>
              <label>
                <i className='k-icon k-icon-logo-linkedin' />

                <TextBox
                  customModifiers='on-white'
                  value={form.fields.linkedin}
                  onChange={onAnyFieldChange.bind(
                    onAnyFieldChange,
                    'linkedin'
                  )}
                  errors={form.fieldsWithErrors.extra_details?.linkedin}
                />
              </label>
              <label>
                <i className='k-icon k-icon-logo-instagram' />

                <TextBox
                  customModifiers='on-white'
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
}

export default AccountSettings;
