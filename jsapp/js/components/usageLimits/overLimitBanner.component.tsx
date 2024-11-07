import React, {useCallback} from 'react';
import cx from 'classnames';
import Button from 'js/components/common/button';
import {useNavigate} from 'react-router-dom';
import styles from './overLimitBanner.module.scss';
import Icon from 'js/components/common/icon';
import {ACCOUNT_ROUTES} from 'js/account/routes.constants';
import {useOrganizationQuery} from 'jsapp/js/account/stripe.api';
import envStore from 'jsapp/js/envStore';

interface OverLimitBannerProps {
  warning?: boolean;
  limits: string[];
  interval: string;
  accountPage: boolean;
}

const limitsText: {
  [key: string]: {
    month: string;
    year: string;
  };
} = {
  submission: {
    month: t('monthly submissions'),
    year: t('yearly submissions'),
  },
  'machine translation': {
    month: t('monthly machine translation'),
    year: t('yearly machine translation'),
  },
  'automated transcription': {
    month: t('monthly automated transcription'),
    year: t('yearly automated transcription'),
  },
};

const getLimitText = (limit: string, interval: string) => {
  if (limit === 'storage') {return t('storage');}
  return limitsText[limit][interval as 'month' | 'year'];
};

const getMessage = (isWarning: boolean, isMmo: boolean, shouldUseTeamlabel: boolean) => {
  if (isWarning) {
    if (isMmo && shouldUseTeamlabel) {
      return t('Your team is approaching the following limits:');
    } else if (isMmo) {
      return t('Your organization is approaching the following limits:');
    }
    return t('You are approaching the following limits:');
  }
  if (isMmo && shouldUseTeamlabel) {
    return t('Your team has reached the following limits:');
  } else if (isMmo) {
    return t('Your organization has reached the following limits:');
  }
  return t('You have reached the following limits:');
};

const OverLimitBanner = (props: OverLimitBannerProps) => {
  const navigate = useNavigate();

  const orgQuery = useOrganizationQuery();

  console.log('Org data:', orgQuery.data);

  if (!orgQuery.data || !props.limits.length) {
    return null;
  }

  const {limits, interval, warning} = props;
  const {is_mmo} = orgQuery.data;
  const shouldUseTeamlabel = !!envStore.data?.use_team_label;

  const textMessage = getMessage(!!warning, is_mmo, shouldUseTeamlabel);
  const textLimits = limits.map((limit) => getLimitText(limit, interval)).join(', ');

  return (
    <div
      className={cx(styles.limitBannerContainer, {
        [styles.warningBanner]: props.warning,
        [styles.accountPage]: props.accountPage,
      })}
    >
      <Icon name={'alert'} size='m' color={props.warning ? 'amber' : 'mid-red'} />
      <div className={styles.bannerContent}>
        {textMessage}{' '}
        <strong>
        {textLimits}
        </strong>
        {'. '}
        {/* {props.warning
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
        {'. '} */}
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
          type='text'
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
          type='text'
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
