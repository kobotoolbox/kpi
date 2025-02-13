import type React from 'react';
import {useEffect, useState} from 'react';
import Button from 'js/components/common/button';
import InlineMessage from 'js/components/common/inlineMessage';
import {unstable_usePrompt as usePrompt} from 'react-router-dom';
import bem, {makeBem} from 'js/bem';
import './accountSettings.scss';
import {notify} from 'js/utils';
import {dataInterface} from '../dataInterface';
import AccountFieldsEditor from './accountFieldsEditor.component';
import Avatar from 'js/components/common/avatar';
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
import {useSession} from '../stores/useSession';
import {useOrganizationQuery} from './organization/organizationQuery';

bem.AccountSettings = makeBem(null, 'account-settings', 'form');
bem.AccountSettings__left = makeBem(bem.AccountSettings, 'left');
bem.AccountSettings__right = makeBem(bem.AccountSettings, 'right');
bem.AccountSettings__item = makeBem(bem.FormModal, 'item');
bem.AccountSettings__actions = makeBem(bem.AccountSettings, 'actions');

const AccountSettings = () => {
  const [isPristine, setIsPristine] = useState(true);
  const [fieldErrors, setFieldErrors] = useState<AccountFieldsErrors>({});
  const [formFields, setFormFields] = useState<AccountFieldsValues>(
    getInitialAccountFieldsValues()
  );
  const [editedFields, setEditedFields] = useState<
    Partial<AccountFieldsValues>
  >({});

  const {currentLoggedAccount, refreshAccount} = useSession();

  const [displayedFields, setDisplayedFields] = useState<Array<keyof AccountFieldsValues>>([]);

  const orgQuery = useOrganizationQuery();

  useEffect(() => {

    if (!currentLoggedAccount || !orgQuery.data) {
      return;
    }

    const fields = {
      name: currentLoggedAccount.extra_details.name,
      organization_type: currentLoggedAccount.extra_details.organization_type,
      organization: currentLoggedAccount.extra_details.organization,
      organization_website: currentLoggedAccount.extra_details.organization_website,
      sector: currentLoggedAccount.extra_details.sector,
      gender: currentLoggedAccount.extra_details.gender,
      bio: currentLoggedAccount.extra_details.bio,
      city: currentLoggedAccount.extra_details.city,
      country: currentLoggedAccount.extra_details.country,
      require_auth: currentLoggedAccount.extra_details.require_auth,
      twitter: currentLoggedAccount.extra_details.twitter,
      linkedin: currentLoggedAccount.extra_details.linkedin,
      instagram: currentLoggedAccount.extra_details.instagram,
      newsletter_subscription:
        currentLoggedAccount.extra_details.newsletter_subscription,
    };

    setFormFields(fields);

    const fieldKeys = Object.keys(fields) as Array<keyof AccountFieldsValues>;

    const organization = orgQuery.data;

    // We will not display organization fields if user is a member of an MMO,
    // only displaying these fields in organization settings view
    setDisplayedFields(
      !organization?.is_mmo
        ? fieldKeys
        : fieldKeys.filter((key) =>
            ![
              'organization',
              'organization_website',
              'organization_type',
            ].includes(key)
          )
    );

  }, [currentLoggedAccount, orgQuery.data]);

  usePrompt({
    when: !isPristine,
    message: t('You have unsaved changes. Leave settings without saving?'),
  });

  const onUpdateComplete = () => {
    notify(t('Updated profile successfully'));
    setIsPristine(true);
    setFieldErrors({});
  };

  const onUpdateFail = (errors: AccountFieldsErrors) => {
    setFieldErrors(errors);
  };

  const updateProfile = (e: React.FormEvent) => {
    e?.preventDefault?.(); // Prevent form submission page reload

    const patchData = getProfilePatchData(editedFields);
    dataInterface
      .patchProfile(patchData)
      .done(() => {
        onUpdateComplete();
        refreshAccount();
      })
      .fail((...args: any) => {
        onUpdateFail(args[0].responseJSON);
      });
  };

  const onFieldChange = (fieldName: string, value: string | boolean) => {
    setFormFields({
      ...formFields,
      [fieldName]: value,
    });
    setEditedFields({
      ...editedFields,
      [fieldName]: value,
    });
    setIsPristine(false);
  };

  const accountName = currentLoggedAccount?.username || '';

  return (
    <bem.AccountSettings onSubmit={updateProfile}>
      <bem.AccountSettings__actions>
        <Button
          type='primary'
          className='account-settings-save'
          size={'l'}
          isSubmit
          label={t('Save Changes') + (isPristine ? '' : ' *')}
        />
      </bem.AccountSettings__actions>

      <bem.AccountSettings__item m={'column'}>
        <bem.AccountSettings__item m='username'>
          <Avatar size='m' username={accountName} isUsernameVisible />
        </bem.AccountSettings__item>

        {currentLoggedAccount && (
          <bem.AccountSettings__item m='fields'>
            <InlineMessage
              type='warning'
              icon='information'
              message={
                <>
                  <strong>
                    {t(
                      'You can now control whether to allow anonymous submissions in web forms for each project. Previously, this was an account-wide setting.'
                    )}
                  </strong>
                  &nbsp;
                  {t(
                    'This privacy feature is now a per-project setting. New projects will require authentication by default.'
                  )}
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
                </>
              }
              className='anonymous-submission-notice'
            />

            <AccountFieldsEditor
              errors={fieldErrors}
              values={formFields}
              onFieldChange={onFieldChange}
              displayedFields={displayedFields}
            />
          </bem.AccountSettings__item>
        )}
      </bem.AccountSettings__item>
    </bem.AccountSettings>
  );
};

export default AccountSettings;
