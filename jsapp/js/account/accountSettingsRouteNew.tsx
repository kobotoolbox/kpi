import React, {useEffect, useState} from 'react';
import {observer} from 'mobx-react';
import bem, {makeBem} from 'js/bem';
import {usePrompt} from 'js/router/promptBlocker';
import sessionStore from 'js/stores/session';
import './accountSettings.scss';

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
    if (!session.isPending && session.isInitialLoadComplete)
      session.verifyLogin();
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
    </bem.AccountSettings>
  );
}

export default observer(AccountSettings);

