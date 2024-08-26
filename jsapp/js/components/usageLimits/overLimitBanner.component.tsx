import React from 'react';
import cx from 'classnames';
import Button from 'js/components/common/button';
import {useNavigate} from 'react-router-dom';
import styles from './overLimitBanner.module.scss';
import Icon from 'js/components/common/icon';
import {ACCOUNT_ROUTES} from 'js/account/routes.constants';

interface OverLimitBannerProps {
  warning?: boolean;
  limits: string[];
  interval: string;
  accountPage: boolean;
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
        [styles.accountPage]: props.accountPage,
      })}
    >
      <Icon name={'alert'} size='m' color={props.warning ? 'amber' : 'mid-red'} />
      <div className={styles.bannerContent}>
        {props.warning
          ? t('You are approaching your')
          : t('You have reached your')}
        <strong>
          {' '}
          {(props.limits.length > 1 || props.limits[0] !== 'storage') &&
          props.interval === 'month'
            ? t('monthly')
            : t('yearly')}{' '}
          {props.limits.map((item, i) => (
            <span key={i}>
              {i > 0 && props.limits.length > 2 && ', '}
              {i === props.limits.length - 1 && i > 0 && t(' and ')}
              {item}
            </span>
          ))}{' '}
          {props.limits.length > 1 ? t('limit') : t('limits')}
        </strong>
        {'. '}
        {props.warning && (
          <>
            <a
              href={'https://www.kobotoolbox.org/pricing/'}
              className={styles.bannerLink}
            >
              {t('Learn more')}
            </a>{' '}
            {t('about upgrading your plan.')}
          </>
        )}
        {!props.warning && (
          <>
            <span>
              {t(
                'Please upgrade your plan or purchase an add-on to increase your usage limits.'
              )}
            </span>
          </>
        )}
      </div>
      {props.warning && !props.accountPage && (
        <Button
          type={'bare'}
          color={'dark-blue'}
          endIcon='arrow-right'
          size='m'
          label={t('Monitor usage')}
          onClick={() => navigate(ACCOUNT_ROUTES.USAGE)}
          aria-label={t('monitor usage')}
          className={styles.bannerBtn}
        />
      )}
      {(!props.warning || props.accountPage) && (
        <Button
          type={'bare'}
          color={'dark-blue'}
          endIcon='arrow-right'
          size='m'
          label={t('Upgrade now')}
          onClick={() => navigate(ACCOUNT_ROUTES.PLAN)}
          aria-label={t('upgrade now')}
          className={styles.bannerBtn}
        />
      )}
    </div>
  );
};

export default OverLimitBanner;
