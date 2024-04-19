import React, { useState } from 'react';
import cx from 'classnames';
import Button from 'js/components/common/button';
import {ACCOUNT_ROUTES} from 'js/account/routes';
import {useNavigate} from 'react-router-dom';
import styles from './overLimitBanner.module.scss';
import Icon from 'js/components/common/icon';

interface OverLimitBannerProps {
  warning?: boolean;
  info?: boolean;
  limits: string[];
  interval: string;
  usagePage: boolean;
}

const OverLimitBanner = (props: OverLimitBannerProps) => {
  const [isBannerVisible, setBannerVisibility] = useState(true);
  const navigate = useNavigate();

  const hideBanner = () => {
    setBannerVisibility(false);
  };

  if (!props.limits.length || !isBannerVisible) {
    return null;
  }
  return (
    <div
      className={cx(styles.limitBannerContainer, {
        [styles.warningBanner]: props.warning,
        [styles.infoBanner]: props.info,
        [styles.usagePage]: props.usagePage,
      })}
    >
      <Icon
        name={'alert'}
        size='m'
        color={props.info ? 'blue' : props.warning ? 'amber' : 'red'}
      />
      <div className={styles.bannerContent}>
        {!props.info && (
          <>
            {props.warning
              ? t('You are approaching your')
              : t('You have reached your')}{' '}
            <strong>
              {props.interval === 'month' ? t('monthly') : t('yearly')}{' '}
              {props.limits.map((item, i) => (
                <span key={i}>
                  {i > 0 && props.limits.length > 2 && ', '}
                  {i === props.limits.length - 1 && i > 0 && t(' and ')}
                  {item}
                </span>
              ))}{' '}
              {t('limit')}
              {props.limits.length > 1 && 's'}
            </strong>
            {'. '}
            {t('Please')}{' '}
            {props.warning && (
              <>
                {!props.usagePage && (
                  <>
                    <a
                      href={`#${ACCOUNT_ROUTES.USAGE}`}
                      className={styles.bannerLink}
                    >
                      {t('review your usage')}
                    </a>{' '}
                    {t('and')}{' '}
                  </>
                )}
                <a
                  href={`#${ACCOUNT_ROUTES.PLAN}`}
                  className={styles.bannerLink}
                >
                  {t('upgrade your plan')}
                </a>{' '}
                {props.usagePage ? t('as soon as possible') : t('if needed')}
              </>
            )}
            {!props.warning && (
              <>
                <a
                  href={`#${ACCOUNT_ROUTES.PLAN}`}
                  className={styles.bannerLink}
                >
                  {t('upgrade your plan')}
                </a>
                {
                  ' as soon as possible or ' /* tone down the language for now */
                }
                <a
                  href='https://www.kobotoolbox.org/contact/'
                  target='_blank'
                  className={styles.bannerLink}
                >
                  {'contact us'}
                </a>
                {' to speak with our team'}
                {!props.usagePage && (
                  <>
                    {'. '}
                    <a
                      href={`#${ACCOUNT_ROUTES.USAGE}`}
                      className={styles.bannerLink}
                    >
                      {t('Review your usage in account settings')}
                    </a>
                  </>
                )}
              </>
            )}
            {'.'}
          </>
        )}
        {props.info && !props.warning && (
          <>
            {t(
              'Submissions, transcription minutes, and translation characters reflect usage for either the current month or year, based on your plan settings.'
            )}
          </>
        )}
      </div>
      {!props.info && props.warning && !props.usagePage && (
        <Button
          type={'frame'}
          color={'dark-blue'}
          endIcon='arrow-right'
          size='s'
          label={t('Monitor usage')}
          onClick={() => navigate(ACCOUNT_ROUTES.USAGE)}
          aria-label={t('monitor usage')}
          classNames={[styles.bannerBtn]}
        />
      )}
      {(!props.info && (!props.warning || props.usagePage)) && (
        <Button
          type={'frame'}
          color={'dark-blue'}
          endIcon='arrow-right'
          size='s'
          label={t('Upgrade now')}
          onClick={() => navigate(ACCOUNT_ROUTES.PLAN)}
          aria-label={t('upgrade now')}
          classNames={[styles.bannerBtn]}
        />
      )}
      {props.info && (
        <Button
          type={'bare'}
          color={'gray'}
          size='l'
          startIcon='close'
          onClick={hideBanner}
          aria-label={t('close')}
          classNames={[styles.bannerBtn]}
        />
      )}
    </div>
  );
};

export default OverLimitBanner;
