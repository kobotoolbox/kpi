import React, {useState, useEffect} from 'react';
import Button from 'js/components/common/button';
import envStore from 'js/envStore';
import sessionStore from 'js/stores/session';
import {fetchGetUrl, handleApiFail} from 'js/api';
import styles from './tosForm.module.scss';
import type {FailResponse} from 'js/dataInterface';
import type {TOSGetResponse} from './tos.constants';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {getInitialAccountFieldsValues} from 'js/account/account.utils';
import AccountFieldsEditor from 'js/account/accountFieldsEditor.component';
import type {AccountFieldsValues} from 'js/account/accountFieldsEditor.component';
import type {UserFieldName} from 'js/account/account.constants';

type FieldsErrors = {[name in UserFieldName]?: string | undefined};

export default function TOSForm() {
  // Initialize:
  // 1. get required fields from envStore
  // 2. get data for fields from session store
  // 3. get tos text from new endpoint

  // endpoint:
  // https://kobo-tos.free.beeceptor.com/
  // GET --> TOSResponse
  // POST --> TOSPostResponse

  // when submitting form:
  // 1. make call to session to update missing required fields
  // 2. make call to new endpoint to accept TOS
  // After "Accept" button is clicked, this will be true until the call(s) resolve

  const [isFormPending, setIsFormPending] = useState(false);
  const [message, setMessage] = useState<string | undefined>();
  const [fields, setFields] = useState<AccountFieldsValues>(getInitialAccountFieldsValues());
  const [fieldsErrors, setFieldsErrors] = useState<FieldsErrors>({});

  // Get TOS message from endpoint
  useEffect(() => {
    const getTOS = async () => {
      try {
        const response = await fetchGetUrl<TOSGetResponse>(
          'https://kobo-tos.free.beeceptor.com'
        );
        setMessage(response.text);
      } catch (error) {
        const errorObj = error as FailResponse;
        handleApiFail(errorObj);
        setMessage('error happened');
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

  function submitForm(evt: React.FormEvent<HTMLFormElement>) {
    evt.preventDefault();
    setIsFormPending(true);
    console.log('submit!', fields, fieldsErrors);
  }

  function leaveForm() {
    setIsFormPending(true);
    sessionStore.logOut();
  }

  // We are waiting for few pieces of data: the message, fields definitions from
  // environment endpoint and fields data from me endpoint
  if (!message) {
    return <LoadingSpinner hideMessage />;
  }

  return (
    <form className={styles.root} onSubmit={submitForm}>
      <section
        className={styles.message}
        dangerouslySetInnerHTML={{
          __html: message,
        }}
      />

      <section className={styles.metaFields}>
        <h2 className={styles.fieldsHeader}>
          {t('Please make sure the following details are filled out correctly:')}
        </h2>

        <AccountFieldsEditor
          displayedFields={envStore.data.getUserMetadataRequiredFieldNames()}
          errors={fieldsErrors}
          values={fields}
          onChange={onAccountFieldsEditorChange}
        />
      </section>

      <footer className={styles.footer}>
        <Button
          type={'full'}
          color={'blue'}
          size={'l'}
          isSubmit
          isFullWidth
          isDisabled={isFormPending}
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
