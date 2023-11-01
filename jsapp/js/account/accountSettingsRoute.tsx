import React, {useEffect, useState} from 'react';
import {observer} from 'mobx-react';
import {unstable_usePrompt as usePrompt} from 'react-router-dom';
import bem, {makeBem} from 'js/bem';
import sessionStore from 'js/stores/session';
import './accountSettings.scss';
import {notify, stringToColor} from '../utils';
import envStore from '../envStore';
import {dataInterface} from '../dataInterface';
import AccountFieldsEditor from './accountFieldsEditor.component';
import type {AccountFieldsValues} from './accountFieldsEditor.component';
import {USER_FIELD_NAMES} from './account.constants';
import type {UserFieldName} from './account.constants';
import {getInitialAccountFieldsValues} from './account.utils';

bem.AccountSettings = makeBem(null, 'account-settings');
bem.AccountSettings__left = makeBem(bem.AccountSettings, 'left');
bem.AccountSettings__right = makeBem(bem.AccountSettings, 'right');
bem.AccountSettings__item = makeBem(bem.FormModal, 'item');
bem.AccountSettings__actions = makeBem(bem.AccountSettings, 'actions');

interface Form {
  isPristine: boolean;
  fields: AccountFieldsValues;
  fieldsWithErrors: {
    extra_details?: {[name in UserFieldName]?: string};
  };
}

const AccountSettings = observer(() => {
  const environment = envStore.data;
  const [form, setForm] = useState<Form>({
    isPristine: true,
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
        key in USER_FIELD_NAMES
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

        {sessionStore.isInitialLoadComplete && (
          <bem.AccountSettings__item m='fields'>
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
