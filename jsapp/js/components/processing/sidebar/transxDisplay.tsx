import React, {useCallback} from 'react';
import {formatTime} from 'js/utils';
import type {Transx} from 'js/components/processing/singleProcessingStore';
import bodyStyles from '../processingBody.module.scss';
import {AsyncLanguageDisplayLabel} from 'js/components/languages/languagesUtils';
import styles from './transxDisplay.module.scss';

interface TransxDisplayProps {
  transx: Transx;
}

export default function TransxDisplay(props: TransxDisplayProps) {
  const renderLanguageAndDate = useCallback(() => {
    const source = props.transx;

    const contentLanguageCode = source?.languageCode;
    if (contentLanguageCode === undefined) {
      return null;
    }

    let dateText = '';
    if (source) {
      if (source.dateCreated !== source?.dateModified) {
        dateText = t('last modified ##date##').replace(
          '##date##',
          formatTime(source.dateModified)
        );
      } else {
        dateText = t('created ##date##').replace(
          '##date##',
          formatTime(source.dateCreated)
        );
      }
    }

    return (
      <React.Fragment>
        <AsyncLanguageDisplayLabel code={props.transx.languageCode} />

        {dateText !== '' && (
          <time className={bodyStyles.transxHeaderDate}>{dateText}</time>
        )}
      </React.Fragment>
    );
  }, []);

  return (
    <section className={styles.root}>
      <div className={bodyStyles.root}>
        <header className={bodyStyles.transxHeader}>
          {renderLanguageAndDate()}
        </header>

        <article className={bodyStyles.text}>{props.transx.value}</article>
      </div>
    </section>
  );
}
