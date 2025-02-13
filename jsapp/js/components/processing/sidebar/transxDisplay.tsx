import React, {useCallback} from 'react';
import type {Transx} from 'js/components/processing/singleProcessingStore';
import bodyStyles from '../processingBody.module.scss';
import {AsyncLanguageDisplayLabel} from 'js/components/languages/languagesUtils';
import TransxDate from 'js/components/processing/transxDate.component';
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

    return (
      <React.Fragment>
        <AsyncLanguageDisplayLabel code={props.transx.languageCode} />

        <TransxDate
          dateCreated={source.dateCreated}
          dateModified={source.dateModified}
        />
      </React.Fragment>
    );
  }, []);

  return (
    <section className={styles.root}>
      <div className={bodyStyles.root}>
        <header className={bodyStyles.transxHeader}>
          {renderLanguageAndDate()}
        </header>

        <article className={bodyStyles.text} dir='auto'>
          {props.transx.value}
        </article>
      </div>
    </section>
  );
}
