import React, {
  useState,
  useEffect,
} from 'react';
import {dataInterface} from 'js/dataInterface';
import TextBox from 'js/components/common/textBox';
import Button from 'js/components/common/button';
import {notify} from 'js/utils';
import styles from './apiTokenSection.module.scss';

const HIDDEN_TOKEN_VALUE = '*'.repeat(40);

/**
 * Displays secret API token of a logged in user.
 * The token is obfuscated until a "show me" button is clicked.
 */
export default function ApiTokenDisplay() {
  const [token, setToken] = useState(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const toggleTokenVisibility = () => {
    setIsVisible(!isVisible);
  };

  useEffect(() => {
    if (isVisible && token === null) {
      const fetchToken = async () => {
        setIsFetching(true);
        try {
          const result = await dataInterface.apiToken();
          setToken(result.token);
        } catch {
          notify.error(t('Failed to get API token'));
        } finally {
          setIsFetching(false);
        }
      };

      fetchToken();
    }
  }, [isVisible]);

  return (
  <div className={styles.root}>
    <div className={styles.titleSection}>
      <h2 className={styles.title}>{t('API Key')}</h2>
    </div>

    <div className={styles.bodySection}>
      <TextBox
        customModifiers='on-white'
        type={isVisible && !isFetching && token !== null ? 'text' : 'password'}
        value={token !== null ? token : HIDDEN_TOKEN_VALUE}
        readOnly
      />
    </div>

    <div className={styles.optionsSection}>
      <Button
        label='Display'
        size='m'
        color='blue'
        type='frame'
        onClick={toggleTokenVisibility}
      />
    </div>
  </div>

  );
}
