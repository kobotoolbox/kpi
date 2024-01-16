import React from 'react';
import styles from './newFeatureDialog.module.scss';

interface NewFeatureDialogProps {
  children: React.ReactNode;
  content: string;
}

export default function NewFeatureDialog(props: NewFeatureDialogProps) {
  return (
    <div className={styles.root}>
      <div className={styles.wrapper}>
      {props.children}
      </div>
      <div className={styles.dialog}>
        {props.content}
      </div>
    </div>
  );
}
