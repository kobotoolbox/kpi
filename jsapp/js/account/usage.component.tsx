import React, {useEffect, useState} from 'react';
import styles from './usage.module.scss';
import {formatMonth} from '../utils';
import {getUsage} from './usage.api';
import Icon from '../components/common/icon';
import {NavLink} from 'react-router-dom';
import Button from '../components/common/button';

interface UsageState {
  storage: number;
  monthlySubmissions: number;
  transcriptionMinutes: number;
  translationChars: number;
  showBanner: boolean;
}

export default function Usage() {
  const [usage, setUsage] = useState<UsageState>({
    storage: 0,
    monthlySubmissions: 0,
    transcriptionMinutes: 0,
    translationChars: 0,
    showBanner: true,
  });

  function truncate(decimal: number) {
    return parseFloat(decimal.toFixed(2));
  }

  useEffect(() => {
    getUsage().then((data) => {
      setUsage({
        ...usage,
        storage: truncate(data.total_storage_bytes / 1000000000), // bytes to GB
        monthlySubmissions: data.total_submission_count_current_month,
        transcriptionMinutes: truncate(data.total_nlp_asr_seconds / 60), // seconds to minutes
        translationChars: data.total_nlp_mt_characters,
      });
    });
  }, []);

  function hideHeader() {
    setUsage({
      ...usage,
      showBanner: false,
    });
  }

  return (
    <div className={styles.root}>
      <h2>{t('Your account total use')}</h2>

      {usage.showBanner && (
        <div className={styles.header}>
          <Icon name='alert' size='s' />
          <div className={styles.article}>
            <p>
              {t(
                'Please note these figures are only updated once per refresh. Numbers may not reflect immediately recent changes in account usage. For any questions concerning usage, please read the '
              )}
            </p>
            <NavLink to='#'>{t('following article')}</NavLink>
          </div>
          <Button
            type='bare'
            color='blue'
            size='m'
            label={t('OK')}
            isFullWidth
            onClick={hideHeader}
          />
        </div>
      )}

      <div className={styles.row}>
        <div className={styles.box}>
          <strong className={styles.title}>{t('Submissions')}</strong>
          <div className={styles.date}>
            {formatMonth(new Date().toUTCString())}
          </div>
          <div className={styles.usage}>
            <strong className={styles.description}>{t('Monthly use')}</strong>
            <strong>{usage.monthlySubmissions}</strong>
          </div>
        </div>
        <div className={styles.box}>
          <strong className={styles.title}>{t('Storage')}</strong>
          <div className={styles.date}>{t('per account')}</div>
          <div className={styles.usage}>
            <strong className={styles.description}>{t('Current use')}</strong>
            <strong>{usage.storage}&nbsp;GB</strong>
          </div>
        </div>
        <div className={styles.box}>
          <strong className={styles.title}>{t('Transcription minutes')}</strong>
          <div className={styles.date}>
            {formatMonth(new Date().toUTCString())}
          </div>
          <div className={styles.usage}>
            <strong className={styles.description}>{t('Monthly usage')}</strong>
            <strong>{usage.transcriptionMinutes}</strong>
          </div>
        </div>
        <div className={styles.box}>
          <strong className={styles.title}>
            {t('Translation characters')}
          </strong>
          <div className={styles.date}>
            {formatMonth(new Date().toUTCString())}
          </div>
          <div className={styles.usage}>
            <strong className={styles.description}>{t('Monthly usage')}</strong>
            <strong>{usage.translationChars}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}
