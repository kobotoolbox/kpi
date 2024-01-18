import React, {useState, useEffect} from 'react';
import Button from 'js/components/common/button';
import styles from './newFeatureDialog.module.scss';

interface NewFeatureDialogProps {
  children: React.ReactNode;
  content: string;
  supportArticle?: string;
  /**
   * Manually disable the dialog. Useful if there are more than one for the
   * same feature on screen.
   */
  disabled?: boolean;
}

export default function NewFeatureDialog(props: NewFeatureDialogProps) {
  const [showDialog, setShowDialog] = useState<boolean>(false);

  useEffect(() => {
    const dialogStatus = localStorage.getItem('dialogStatus');
    if (!dialogStatus) {
      setShowDialog(true);
    }
  }, []);

  function closeDialog() {
    localStorage.setItem('dialogStatus', 'shown');
    setShowDialog(!showDialog);
  }

  console.log('diabled?', props.disabled);

  return (
    <div className={styles.root}>
      <div className={styles.wrapper}>{props.children}</div>
      {showDialog && !props.disabled && (
        <div className={styles.dialog}>
          <div className={styles.header}>
            {t('New feature')}
            <Button
              color='cloud'
              size='s'
              type='bare'
              startIcon='close'
              onClick={closeDialog}
            />
          </div>
          <div className={styles.content}>
            {props.content}
            &nbsp;
            {props.supportArticle && (
              <a
                href={props.supportArticle}
                target='_blank'
                className={styles.support}
              >
                {t('Learn more')}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
