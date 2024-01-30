import React, {useEffect, useState} from 'react';
import {observer} from 'mobx-react';
import {unstable_usePrompt as usePrompt} from 'react-router-dom';
import bem, {makeBem} from 'js/bem';
import sessionStore from 'js/stores/session';
import './accountSettings.scss';
import {notify, stringToColor} from 'js/utils';
import {dataInterface} from '../dataInterface';
import AccountFieldsEditor from './accountFieldsEditor.component';
import Icon from 'js/components/common/icon';
import envStore from 'js/envStore';
import {
  getInitialAccountFieldsValues,
  getProfilePatchData,
} from './account.utils';
import type {
  AccountFieldsValues,
  AccountFieldsErrors,
} from './account.constants';
import {HELP_ARTICLE_ANON_SUBMISSIONS_URL} from 'js/constants';

bem.AccountSettings = makeBem(null, 'account-settings');
bem.AccountSettings__left = makeBem(bem.AccountSettings, 'left');
bem.AccountSettings__right = makeBem(bem.AccountSettings, 'right');
bem.AccountSettings__item = makeBem(bem.FormModal, 'item');
bem.AccountSettings__actions = makeBem(bem.AccountSettings, 'actions');

interface Form {
  isPristine: boolean;
  /**
   * Whether we have loaded the user metadata values. Used to avoid displaying
   * blank form with values coming in a moment later (in visible way).
   */
  isUserDataLoaded: boolean;
  fields: AccountFieldsValues;
  fieldsWithErrors: {
    extra_details?: AccountFieldsErrors;
  };
}

const AccountSettings = observer(() => {
  const [form, setForm] = useState<Form>({
    isPristine: true,
    isUserDataLoaded: false,
    fields: getInitialAccountFieldsValues(),
    fieldsWithErrors: {},
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
        isUserDataLoaded: true,
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
    const profilePatchData = getProfilePatchData(form.fields);
    dataInterface
      .patchProfile(profilePatchData)
      .done(() => {
        onUpdateComplete();
      })
      .fail((...args: any) => {
        onUpdateFail(args);
      });
  };

  const onAccountFieldsEditorChange = (fields: AccountFieldsValues) => {
    setForm({
      ...form,
      fields: fields,
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

        {sessionStore.isInitialLoadComplete && form.isUserDataLoaded && (
          <bem.AccountSettings__item m='fields'>
            <bem.AccountSettings__item m='anonymous-submission-notice'>
              <Icon name='information' color='amber' size='m' />
              <div className='anonymous-submission-notice-copy'>
                <strong>
                  {t(
                    'You can now control whether to allow anonymous submissions in web forms for each project. Previously, this was an account-wide setting.'
                  )}
                </strong>
                &nbsp;
                <div>
                  {t(
                    'This privacy feature is now a per-project setting. New projects will require authentication by default.'
                  )}
                </div>
                &nbsp;
                <a
                  href={
                    envStore.data.support_url +
                    HELP_ARTICLE_ANON_SUBMISSIONS_URL
                  }
                  target='_blank'
                >
                  {t('Learn more about these changes here.')}
                </a>
              </div>
            </bem.AccountSettings__item>

            <AccountFieldsEditor
              errors={form.fieldsWithErrors.extra_details}
              values={form.fields}
              onChange={onAccountFieldsEditorChange}
            />
          </bem.AccountSettings__item>
        )}
      </bem.AccountSettings__item>
    </bem.AccountSettings>
  );
});

export default AccountSettings;
