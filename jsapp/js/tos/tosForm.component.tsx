import type React from 'react';
import {useState, useEffect} from 'react';
import Button from 'js/components/common/button';
import envStore from 'js/envStore';
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
import {useSession} from '../stores/useSession';

/** A slug for the `sitewide_messages` endpoint */
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

/**
 * This form displays a TOS announcement message together with user metadata
 * fields editor (only for required fields). There is an accept button that will
 * cause the UI to be unlocked, and decline button that will log out the user.
 */
export default function TOSForm() {
  // After "Accept" button is clicked, this will be true until the call(s) resolve
  const [isFormPending, setIsFormPending] = useState(false);
  const [announcementMessage, setAnnouncementMessage] = useState<
    string | undefined
  >();
  const [formFields, setFormFields] = useState<AccountFieldsValues>(
    getInitialAccountFieldsValues()
  );
  const [fieldsErrors, setFieldsErrors] = useState<AccountFieldsErrors>({});
  const [editedFields, setEditedFields] = useState<
    Partial<AccountFieldsValues>
  >({});

  const fieldsToShow = envStore.data.getUserMetadataRequiredFieldNames();
  if (
    envStore.data.getUserMetadataFieldsAsSimpleDict().newsletter_subscription
  ) {
    fieldsToShow.push('newsletter_subscription');
  }

  const {currentLoggedAccount, logOut} = useSession();

  // Get TOS message from endpoint
  useEffect(() => {
    const getTOS = async () => {
      try {
        const response = await fetchGet<SitewideMessagesResponse>(
          SITEWIDE_MESSAGES_ENDPOINT
        );

        // First we try to find and set the translated TOS message, if not present
        // we go with fallback. Otherwise we will display an error.
        const translatedSlug = TOS_SLUG_TRANSLATED.replace(
          '<language>',
          currentLang()
        );
        const translatedMessage = response.results.find(
          (item) => item.slug === translatedSlug
        );
        const fallbackMessage = response.results.find(
          (item) => item.slug === TOS_SLUG
        );
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

  // After session store is ready, we fill in all the fields for the form
  // (including the non-required ones that will be hidden, but passed to the API
  // so that they will not get erased).
  useEffect(() => {
    if (!currentLoggedAccount) {
      return;
    }

    setFormFields({
      name: currentLoggedAccount.extra_details.name,
      organization: currentLoggedAccount.extra_details.organization,
      organization_website:
        currentLoggedAccount.extra_details.organization_website,
      organization_type: currentLoggedAccount.extra_details.organization_type,
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
    });
  }, [currentLoggedAccount]);

  const onFieldChange = (fieldName: string, value: string | boolean) => {
    setFormFields({
      ...formFields,
      [fieldName]: value,
    });
    setEditedFields({
      ...editedFields,
      [fieldName]: value,
    });
  };

  /**
   * Submitting does two things (with two consecutive API calls):
   * 1. Updates user data for all required fields (if any)
   * 2. Accepts TOS
   * When TOS is successfully accepted, we reload the page to display
   * the unblocked UI.
   */
  async function submitForm(evt: React.FormEvent<HTMLFormElement>) {
    evt.preventDefault();
    setIsFormPending(true);

    let hasAnyErrors = false;

    // If there are no required fields, there is no point doing a call to update
    // them.
    if (fieldsToShow.length > 0) {
      // Get data for the user endpoint
      const profilePatchData = getProfilePatchData(editedFields);

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
    logOut();
  }

  // We are waiting for few pieces of data: the message, fields definitions from
  // environment endpoint and fields data from me endpoint
  if (!announcementMessage || !envStore.isReady || !currentLoggedAccount) {
    return <LoadingSpinner message={false} />;
  }

  return (
    <form className={styles.root} onSubmit={submitForm}>
      <section
        className={styles.message}
        dangerouslySetInnerHTML={{
          __html: announcementMessage,
        }}
      />

      {/* No point displaying the form and header if there are no required fields */}
      {fieldsToShow.length > 0 && (
        <section className={styles.metaFields}>
          <h2 className={styles.fieldsHeader}>
            {t(
              'Please make sure the following details are filled out correctly:'
            )}
          </h2>

          <AccountFieldsEditor
            displayedFields={fieldsToShow}
            errors={fieldsErrors}
            values={formFields}
            onFieldChange={onFieldChange}
          />
        </section>
      )}

      <footer className={styles.footer}>
        <Button
          type='primary'
          size={'l'}
          isSubmit
          isFullWidth
          isPending={isFormPending}
          label={t("I agree, let's go")}
        />

        <Button
          type='secondary'
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
