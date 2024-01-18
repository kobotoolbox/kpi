import React, {useState} from 'react';
import ToggleSwitch from 'js/components/common/toggleSwitch';
import envStore from 'js/envStore';
import {HELP_ARTICLE_ANON_SUBMISSIONS_URL, MODAL_TYPES} from 'js/constants';
import Icon from 'js/components/common/icon';
import styles from './anonymousSubmission.module.scss';
import NewFeatureDialog from './newFeatureDialog.component';

interface AnonymousSubmissionProps {
  checked: boolean;
  onChange: (isChecked: boolean) => void;
  modalType?: string | undefined;
  stores?: any;
}

export default function AnonymousSubmission(props: AnonymousSubmissionProps) {
  console.log('anon; stores', props.stores);
  return (
    <div className={styles.root}>
      <NewFeatureDialog
        content={t(
          'This feature was originally “Require authentication to see forms and submit data”. This is now a per-project setting.'
        )}
        supportArticle={
          envStore.data.support_url + HELP_ARTICLE_ANON_SUBMISSIONS_URL
        }
        disabled={props.modalType === MODAL_TYPES.SHARING}
      >
        <ToggleSwitch
          checked={props.checked}
          onChange={props.onChange}
          label={t(
            'Allow web submissions to this form without a username and password'
          )}
        />
      </NewFeatureDialog>
      <a
        href={envStore.data.support_url + HELP_ARTICLE_ANON_SUBMISSIONS_URL}
        className='right-tooltip wrapped-tooltip'
        target='_blank'
        data-tip={t(
          'Allow anyone to see this form and add submissions. Click the icon to learn more.'
        )}
      >
        <Icon size='s' name='help' color='storm' />
      </a>
    </div>
  );
}
