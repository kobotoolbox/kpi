import React, {useState, useEffect} from 'react';
import Button from 'js/components/common/button';
import styles from './newFeatureDialog.module.scss';
import cx from 'classnames';

interface NewFeatureDialogProps {
  children: React.ReactNode;
  className?: string;
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
  content,
  supportArticle,
  disabled = false,
}: NewFeatureDialogProps) {
  const [showDialog, setShowDialog] = useState<boolean>(false);

  useEffect(() => {
    const dialogStatus = localStorage.getItem('dialogStatus');
    setShowDialog(!dialogStatus);
  }, [disabled]);

  function closeDialog() {
    localStorage.setItem('dialogStatus', 'shown');
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
              color='cloud'
              size='s'
              type='bare'
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
