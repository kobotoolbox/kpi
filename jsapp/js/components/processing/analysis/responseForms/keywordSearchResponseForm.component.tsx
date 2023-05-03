import React from 'react';
import CommonHeader from './commonHeader.component';
import commonStyles from './common.module.scss';
import styles from './keywordSearchResponseForm.module.scss';
import classnames from 'classnames';

interface KeywordSearchResponseFormProps {
  uid: string;
}

export default function KeywordSearchResponseForm(
  props: KeywordSearchResponseFormProps
) {
  return (
    <>
      <CommonHeader uid={props.uid} />

      <section
        className={classnames([commonStyles.alignedContent, styles.todo])}
      >
        TODO: 1. "Apply search" button 2. loading 3. instances found
      </section>
    </>
  );
}
