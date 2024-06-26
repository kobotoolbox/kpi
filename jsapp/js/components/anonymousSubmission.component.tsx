import React from 'react';
import ToggleSwitch from 'js/components/common/toggleSwitch';
import envStore from 'js/envStore';
import {HELP_ARTICLE_ANON_SUBMISSIONS_URL} from 'js/constants';
import Icon from 'js/components/common/icon';
import styles from './anonymousSubmission.module.scss';

interface AnonymousSubmissionProps {
  checked: boolean;
  disabled: boolean;
  onChange: (isChecked: boolean) => void;
}

export default function AnonymousSubmission(props: AnonymousSubmissionProps) {
  return (
    <div className={styles.root}>
      <ToggleSwitch
        checked={props.checked}
        disabled={props.disabled}
        onChange={props.onChange}
        label={t(
          'Allow submissions to this form without a username and password'
        )}
      />
      <a
        href={envStore.data.support_url + HELP_ARTICLE_ANON_SUBMISSIONS_URL}
        className='right-tooltip wrapped-tooltip'
        target='_blank'
        data-tip={t(
          'Allow anonymous submissions for this project. Previously, this was an account-wide setting. Click the icon to learn more.'
        )}
      >
        <Icon size='s' name='help' color='storm' />
      </a>
    </div>
  );
}
