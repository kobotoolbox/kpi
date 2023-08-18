import React from 'react';
import cx from 'classnames';
import Button from 'js/components/common/button';
import {ACCOUNT_ROUTES} from 'js/account/routes';
import {useNavigate} from 'react-router-dom';
import styles from './overLimitBanner.module.scss';
import Icon from 'js/components/common/icon';

interface OverLimitBannerProps {
  warning?: boolean;
  limits: string[];
  interval: string;
}

const OverLimitBanner = (props: OverLimitBannerProps) => {
  const navigate = useNavigate();
  if (!props.limits.length) {
    return null;
  }

  return (
    <div
      className={cx(styles.limitBannerContainer, {
        [styles.warningBanner]: props.warning,
      })}
    >
      <Icon
        name={props.warning ? 'alert' : 'warning'}
        size='m'
        color={props.warning ? 'amber' : 'red'}
      />
      <div className={styles.bannerContent}>
        {props.warning
          ? t('You are close to surpassing your')
          : t('You have surpassed your')}{' '}
        <strong>
          {`${props.interval}ly`}{' '}
          {props.limits.map((item, i) => (
            <span key={i}>
              {i > 0 && ', '}
              {i === props.limits.length - 1 && i > 0 && 'and '}
              {item}
            </span>
          ))}{' '}
          {t('limit')}
          {props.limits.length > 1 && 's'}
        </strong>
        {'. '}
        {props.warning && (
          <>
            {t(
              'Please review you current usage and consider upgrading to a plan with larger capacity if necessary. You can'
            )}{' '}
            <a href={`#${ACCOUNT_ROUTES.PLAN}`} className={styles.bannerLink}>
              {t('upgrade in the plans section')}
            </a>
          </>
        )}
        {!props.warning && (
          <>
            {t(
              'Please upgrade to a plan with a larger capacity to continue collecting data this ##PERIOD##. You can'
            ).replace(/##PERIOD##/g, props.interval)}{' '}
            <a href={`#${ACCOUNT_ROUTES.USAGE}`} className={styles.bannerLink}>
              {t('review your usage here')}
            </a>
          </>
        )}
        {t(', or learn more about the KoboToolbox limits and plans in our ')}
        <a
          aria-label={t('paid plans page')}
          href={'https://www.kobotoolbox.org/how-it-works/'}
          className={styles.bannerLink}
        >
          {t('paid plans page')}
        </a>
        .
      </div>
      {props.warning && (
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
      {!props.warning && (
        <Button
          type={'full'}
          color={'dark-red'}
          endIcon='arrow-right'
          size='s'
          label={t('Upgrade now')}
          onClick={() => navigate(ACCOUNT_ROUTES.PLAN)}
          aria-label={t('upgrade now')}
          classNames={[styles.bannerBtn]}
        />
      )}
    </div>
  );
};

export default OverLimitBanner;
