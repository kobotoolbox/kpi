import React from 'react';
import CommonHeader from './commonHeader.component';
import commonStyles from './common.module.scss';
// import styles from './keywordSearchResponseForm.module.scss';

interface KeywordSearchResponseFormProps {
  uid: string;
}

export default function KeywordSearchResponseForm(props: KeywordSearchResponseFormProps) {
  return (
    <>
      <CommonHeader uid={props.uid}/>

      <section className={commonStyles.alignedContent}>
        <pre>
        TODO:
        1. "Apply search" button
        2. loading
        3. instances found
        </pre>
      </section>
    </>
  );
}
