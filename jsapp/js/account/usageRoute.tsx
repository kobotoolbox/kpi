import React, {useEffect, useState} from 'react';
import moment from 'moment';
import styles from './usage.module.scss';
import {formatMonth} from '../utils';
import {getUsage} from './usage.api';
import Icon from '../components/common/icon';

const MAX_MONTHLY_SUBMISSIONS = 2; // TODO change this to 10000 if deploying
const MAX_GIGABYTES_STORAGE = 4;
const WARNING_PERCENT = 75;
const MAX_PERCENTAGE = 100;

interface UsageState {
  storage: number;
  monthlySubmissions: number;
  transcriptionMinutes: number;
  translationChars: number;
}

export default function Usage() {
  const [usage, setUsage] = useState<UsageState>({
    storage: 0,
    monthlySubmissions: 0,
    transcriptionMinutes: 0,
    translationChars: 0,
  });

  useEffect(() => {
    getUsage().then((data) => {
      setUsage({
        storage: data.total_storage_bytes / 1000000,
        monthlySubmissions: data.total_submission_count_current_month,
        transcriptionMinutes: data.total_nlp_asr_seconds / 60,
        translationChars: data.total_nlp_mt_characters,
      });
    });
  }, []);

  return (
    <div className={styles.root}>
      <h2>{t('Your account total use')}</h2>

      <div className={styles.header}>
        <Icon
          name='alert'
          size='s'
        />
        <p>
        {t('Please note these figures are only updated once per day. Numbers may not reflect immediately recent changes in account usage. For any questions concerning usage, please read the following article')}
        </p>

      </div>

      <div className={styles.row}>
        <div className={styles.box}>
          <strong className={styles.title}>{t('Submissions')}</strong>
          <div className={styles.date}>
            {formatMonth(new Date().toUTCString())}
          </div>
          <div className={styles.usage}>
            <strong className={styles.description}>{t('Monthly usage')}</strong>
            <strong>{usage.monthlySubmissions}</strong>
          </div>
        </div>
        <div className={styles.box}>
          <strong className={styles.title}>{t('Storage')}</strong>
          <div className={styles.date}>{t('per account')}</div>
          <div className={styles.usage}>
            <strong className={styles.description}>{t('Current use')}</strong>
            <strong>{usage.storage}</strong>
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
          <strong className={styles.title}>{t('Translation characters')}</strong>
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
