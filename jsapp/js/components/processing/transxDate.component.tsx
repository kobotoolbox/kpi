import React from 'react';
import cx from 'classnames';
import {formatTime, formatTimeDateShort} from 'js/utils';
import styles from './transxDate.module.scss';

/**
 * Returns a human friendly date. Returns empty string if there is no sufficient
 * data provided.
 */
function getTransxDate(
  dateCreated?: string,
  dateModified?: string
): {
  long: string;
  short: string;
} {
  const output = {
    short: '',
    long: '',
  };

  if (dateCreated && dateModified) {
    if (dateCreated !== dateModified) {
      output.long = t('last modified ##date##').replace(
        '##date##',
        formatTime(dateModified)
      );
      output.short = formatTimeDateShort(dateModified);
    } else {
      output.long = t('created ##date##').replace(
        '##date##',
        formatTime(dateCreated)
      );
      output.short = formatTimeDateShort(dateCreated);
    }
  }
  return output;
}

interface TransxDateProps {
  dateCreated?: string;
  dateModified?: string;
}

export default function TransxDate(props: TransxDateProps) {
  const dateText = getTransxDate(props.dateCreated, props.dateModified);

  return (
    <>
      {dateText.long !== '' && (
        <time className={cx(styles.transxDate, styles.transxDateLong)}>{dateText.long}</time>
      )}
      {dateText.short !== '' && (
        <time className={cx(styles.transxDate, styles.transxDateShort)}>{dateText.short}</time>
      )}
    </>
  );
}
