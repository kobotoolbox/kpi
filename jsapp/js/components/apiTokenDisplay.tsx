import React, {
  useState,
  useEffect,
} from 'react';
import bem from 'js/bem';
import {dataInterface} from 'js/dataInterface';
import TextBox from 'js/components/common/textBox';
import Button from 'js/components/common/button';
import {notify} from 'js/utils';

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
        } catch (error) {
          notify.error(t('Failed to get API token'));
        } finally {
          setIsFetching(false);
        }
      };

      fetchToken();
    }
  }, [isVisible]);

  return (
    <bem.FormModal__item m='api-token'>
      <label>{t('API token')}</label>

      <TextBox
        customModifiers='on-white'
        type={isVisible && !isFetching && token !== null ? 'text' : 'password'}
        value={token !== null ? token : HIDDEN_TOKEN_VALUE}
        readOnly
      />

      <Button
        isPending={isFetching}
        type='bare'
        color='storm'
        size='m'
        startIcon={isVisible ? 'hide' : 'view'}
        onClick={toggleTokenVisibility}
      />
    </bem.FormModal__item>
  );
}
