import React, {useEffect, useState} from 'react';
import Checkbox from 'js/components/common/checkbox';
import Icon from 'js/components/common/icon';
import styles from './anonymousSubmission.module.scss';

interface AnonymousSubmissionState {
  isEnabled: boolean;
}

export default function AnonymousSubmission() {
  const [state, setState] = useState<AnonymousSubmissionState>({
    isEnabled: false,
  });

  return (
    <div className={styles.root}>
      <Checkbox
        checked={state.isEnabled}
        onChange={() => {
          setState({isEnabled: !state.isEnabled});
        }}
      />
      <div className={styles.copy}>
        {t('Allow anonymous submissions to this form')}
      </div>
      <a href={'#'} data-tip={t('Tooltip?')}>
        <Icon size='s' name='help' color='storm' />
      </a>
    </div>
  );
}
