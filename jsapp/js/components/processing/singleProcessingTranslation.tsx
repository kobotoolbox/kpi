import React from 'react';
import {formatTime} from 'js/utils';
import type {Transx} from 'js/components/processing/singleProcessingStore';
import styles from './singleProcessingPreview.module.scss';
import bodyStyles from './processingBody.module.scss';
import {AsyncLanguageDisplayLabel} from 'js/components/languages/languagesUtils';

interface SingleProcessingTranslationProps {
  translation: Transx;
}

export default function SingleProcessingTranslation(props: SingleProcessingTranslationProps) {

  function renderLanguageAndDate() {
    const source = props.translation;

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
        <AsyncLanguageDisplayLabel code={props.translation.languageCode} />

        {dateText !== '' && (
          <time className={bodyStyles.transxHeaderDate}>{dateText}</time>
        )}
      </React.Fragment>
    );
  }

  return (
    <section className={styles.root}>
      <div className={bodyStyles.root}>
        <header className={bodyStyles.transxHeader}>
          {renderLanguageAndDate()}
        </header>

        <article className={bodyStyles.text}>
          {props.translation.value}
        </article>
      </div>
    </section>
  );
}

