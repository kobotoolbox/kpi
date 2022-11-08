import React, {useEffect, useState} from 'react';
import {observer} from 'mobx-react';
import bem, {makeBem} from 'js/bem';
import {usePrompt} from 'js/router/promptBlocker';
import sessionStore from 'js/stores/session';
import './accountSettings.scss';
import Checkbox from '../components/common/checkbox';
import TextBox from '../components/common/textBox';
import {addRequiredToLabel, stringToColor} from '../utils';

bem.AccountSettings = makeBem(null, 'account-settings');
bem.AccountSettings__left = makeBem(bem.AccountSettings, 'left');
bem.AccountSettings__right = makeBem(bem.AccountSettings, 'right');
bem.AccountSettings__item = makeBem(bem.FormModal, 'item');
bem.AccountSettings__actions = makeBem(bem.AccountSettings, 'actions');

function AccountSettings() {
  const [session] = useState(() => sessionStore);
  const [form, setForm] = useState({
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
  const updateProfile = () => {};
  const onAnyFieldChange = (name: string, value: boolean) => {
    setForm({
      ...form,
      fields: {...form.fields, [name]: value},
      isPristine: false,
    });
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
          onClick={updateProfile()}
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
                onChange={onAnyFieldChange}
                value={form.fields.name}
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
                value={form.fields.email}
                onChange={onAnyFieldChange}
              />
            </bem.AccountSettings__item>
          </bem.AccountSettings__item>
        )}
      </bem.AccountSettings__item>
    </bem.AccountSettings>
  );
}

export default observer(AccountSettings);
