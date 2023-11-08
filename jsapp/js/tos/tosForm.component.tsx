import React, {useState, useEffect} from 'react';
import Button from 'js/components/common/button';
import envStore from 'js/envStore';
import sessionStore from 'js/stores/session';
import {fetchGet, fetchPatch, fetchPost, handleApiFail} from 'js/api';
import styles from './tosForm.module.scss';
import type {FailResponse, PaginatedResponse} from 'js/dataInterface';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {
  getInitialAccountFieldsValues,
  getProfilePatchData,
} from 'js/account/account.utils';
import AccountFieldsEditor from 'js/account/accountFieldsEditor.component';
import type {
  AccountFieldsValues,
  AccountFieldsErrors,
} from 'js/account/account.constants';
import {currentLang, notify} from 'js/utils';

const TOS_SLUG = 'terms_of_service';
/** Where `<language>` is language code, e.g. "fr" */
const TOS_SLUG_TRANSLATED = `${TOS_SLUG}_<language>`;

const ME_ENDPOINT = '/me/';
const TOS_ACCEPT_ENDPOINT = '/me/tos/';
const SITEWIDE_MESSAGES_ENDPOINT = '/sitewide_messages/';

interface MePatchFailResponse {
  responseJSON: {
    extra_details: AccountFieldsErrors;
  };
}

interface SitewideMessage {
  slug: string;
  /** HTML or Markdown code. For TOS Announcement this will definitely be HTML. */
  body: string;
}

type SitewideMessagesResponse = PaginatedResponse<SitewideMessage>;

// TODO: this needs more comments
export default function TOSForm() {
  // After "Accept" button is clicked, this will be true until the call(s) resolve
  const [isFormPending, setIsFormPending] = useState(false);
  const [announcementMessage, setAnnouncementMessage] = useState<string | undefined>();
  const [fields, setFields] = useState<AccountFieldsValues>(
    getInitialAccountFieldsValues()
  );
  const [fieldsErrors, setFieldsErrors] = useState<AccountFieldsErrors>({});

  const requiredFields = envStore.data.getUserMetadataRequiredFieldNames();

  // Get TOS message from endpoint
  useEffect(() => {
    const getTOS = async () => {
      try {
        const response = await fetchGet<SitewideMessagesResponse>(SITEWIDE_MESSAGES_ENDPOINT);

        // First we try to find and set the translated TOS message, if not present
        // we go with fallback. Otherwise we will display an error.
        const translatedSlug = TOS_SLUG_TRANSLATED.replace('<language>', currentLang());
        const translatedMessage = response.results.find((item) => item.slug === translatedSlug);
        const fallbackMessage = response.results.find((item) => item.slug === TOS_SLUG);
        if (translatedMessage) {
          setAnnouncementMessage(translatedMessage.body);
        } else if (fallbackMessage) {
          setAnnouncementMessage(fallbackMessage.body);
        } else {
          setAnnouncementMessage('');
          notify(t('TOS Update Message not found'), 'error');
        }
      } catch (err) {
        const failResult = err as FailResponse;
        handleApiFail(failResult);
        setAnnouncementMessage('');
      }
    };
    getTOS();
  }, []);

  // After both environment and session stores are ready, we build the form
  // fields with all the required metadata fields
  useEffect(() => {
    if ('email' in sessionStore.currentAccount && envStore.isReady) {
      const data = sessionStore.currentAccount;
      setFields({
        name: data.extra_details.name,
        organization: data.extra_details.organization,
        organization_website: data.extra_details.organization_website,
        sector: data.extra_details.sector,
        gender: data.extra_details.gender,
        bio: data.extra_details.bio,
        city: data.extra_details.city,
        country: data.extra_details.country,
        require_auth: data.extra_details.require_auth,
        twitter: data.extra_details.twitter,
        linkedin: data.extra_details.linkedin,
        instagram: data.extra_details.instagram,
      });
    }
  }, [sessionStore.isAuthStateKnown]);

  function onAccountFieldsEditorChange(newFields: AccountFieldsValues) {
    setFields(newFields);
  }

  /**
   * Submitting does two things (with two consecutive API calls):
   * 1. Updates user data for all required fields (if any)
   * 2. Accepts TOS
   */
  async function submitForm(evt: React.FormEvent<HTMLFormElement>) {
    evt.preventDefault();
    setIsFormPending(true);

    let hasAnyErrors = false;

    // If there are no required fields, there is no point doing a call to update
    // them.
    if (requiredFields.length > 0) {
      // Get data for the user endpoint
      const profilePatchData = getProfilePatchData(fields);

      try {
        await fetchPatch(ME_ENDPOINT, profilePatchData);
        // Remove any obsolete errors
        setFieldsErrors({});
        hasAnyErrors = false;
      } catch (err) {
        const patchFailResult = err as MePatchFailResponse;
        setFieldsErrors(patchFailResult.responseJSON.extra_details || {});
        hasAnyErrors = true;
      }
    }

    // If there are some errors in the form, we need user to fix them before
    // trying to submit the form again.
    if (!hasAnyErrors) {
      try {
        // Accepting TOS is simply POSTing to this endpoint
        await fetchPost(TOS_ACCEPT_ENDPOINT, {});
        // TODO ideally we could make the sessionStore fetch new account data
        // or even override the `accepted_tos` flag without fetching. But this
        // requires the `app.js` file to be reworked in a bit different fashion,
        // so that it could react to `sessionStore.accepted_tos` change. For now
        // we do ugly and simple forced reload :)
        window.location.replace('');
      } catch (err) {
        const failResult = err as FailResponse;
        handleApiFail(failResult);
      }
    }

    setIsFormPending(false);
  }

  function leaveForm() {
    setIsFormPending(true);
    sessionStore.logOut();
  }

  // We are waiting for few pieces of data: the message, fields definitions from
  // environment endpoint and fields data from me endpoint
  if (!announcementMessage) {
    return <LoadingSpinner hideMessage />;
  }

  return (
    <form className={styles.root} onSubmit={submitForm}>
      <section
        className={styles.message}
        dangerouslySetInnerHTML={{
          __html: announcementMessage,
        }}
      />

      {/* No point displaying the form and header if there are no requied fields */}
      {requiredFields.length > 0 && (
        <section className={styles.metaFields}>
          <h2 className={styles.fieldsHeader}>
            {t(
              'Please make sure the following details are filled out correctly:'
            )}
          </h2>

          <AccountFieldsEditor
            displayedFields={requiredFields}
            errors={fieldsErrors}
            values={fields}
            onChange={onAccountFieldsEditorChange}
          />
        </section>
      )}

      <footer className={styles.footer}>
        <Button
          type={'full'}
          color={'blue'}
          size={'l'}
          isSubmit
          isFullWidth
          isPending={isFormPending}
          label={t("I agree, let's go")}
        />

        <Button
          type={'bare'}
          color={'dark-blue'}
          size={'l'}
          isFullWidth
          isDisabled={isFormPending}
          label={t("I don't agree, log me out")}
          onClick={leaveForm}
        />
      </footer>
    </form>
  );
}
