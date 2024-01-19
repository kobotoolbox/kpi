import React, {useState, useEffect} from 'react';
import Button from 'js/components/common/button';
import styles from './newFeatureDialog.module.scss';
import cx from 'classnames';

interface NewFeatureDialogProps {
  children: React.ReactNode;
  className?: string;
  /**
   * Used to differentiate between dialogs for different features.
   * Tip: Use the feature name. It's added to the end of the localstorage key.
   * If two or more dialogs have the same featureKey, clicking one should dismiss all of them.
   */
  featureKey: string;
  content: string;
  supportArticle?: string;
  /**
   * Manually disable the dialog. Useful if there are more than one for the
   * same feature on screen.
   */
  disabled?: boolean;
}

export default function NewFeatureDialog({
  children,
  className = '',
  featureKey,
  content,
  supportArticle,
  disabled = false,
}: NewFeatureDialogProps) {
  const [showDialog, setShowDialog] = useState<boolean>(false);

  useEffect(() => {
    const dialogStatus = localStorage.getItem(`kpiDialogStatus-${featureKey}`);
    setShowDialog(!dialogStatus);
  }, [disabled]);

  function closeDialog() {
    localStorage.setItem(`kpiDialogStatus-${featureKey}`, 'shown');
    setShowDialog(!showDialog);
  }

  return (
    <div className={cx(styles.root, {className: className})}>
      <div className={styles.wrapper}>{children}</div>
      {showDialog && !disabled && (
        <div className={styles.dialog}>
          <div className={styles.header}>
            {t('New feature')}
            <Button
              color='dark-blue'
              size='s'
              type='full'
              startIcon='close'
              onClick={closeDialog}
            />
          </div>
          <div className={styles.content}>
            {content}
            &nbsp;
            {supportArticle && (
              <a
                href={supportArticle}
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
