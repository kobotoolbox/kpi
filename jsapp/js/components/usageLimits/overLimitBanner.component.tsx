import cx from 'classnames';
import Button from 'js/components/common/button';
import {useNavigate} from 'react-router-dom';
import styles from './overLimitBanner.module.scss';
import Icon from 'js/components/common/icon';
import {ACCOUNT_ROUTES} from 'js/account/routes.constants';
import envStore from 'jsapp/js/envStore';
import subscriptionStore from 'jsapp/js/account/subscriptionStore';
import {
  OrganizationUserRole,
  useOrganizationQuery,
} from 'jsapp/js/account/organization/organizationQuery';
import {
  getSimpleMMOLabel,
  shouldUseTeamLabel,
} from 'jsapp/js/account/organization/organization.utils';
import Markdown from 'react-markdown';

interface OverLimitBannerProps {
  warning?: boolean;
  limits: string[];
  interval: string;
  accountPage: boolean;
}

/*
 * Translated texts to be used for each limit
 */
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

/*
 * Returns the text for the limit based on the interval
 */
const getLimitText = (limit: string, interval: string) => {
  if (limit === 'storage') {
    return t('storage');
  }
  if (!limitsText[limit]) {
    return limit;
  }

  return limitsText[limit][interval as 'month' | 'year'];
};

/*
 * Returns a formatted string with all the limits
 */
const getAllLimits = (limits: string[], interval: string) => {
  if (limits.length === 0) {
    return '';
  }

  const items = limits.map((limit) => `**${getLimitText(limit, interval)}**`);

  if (items.length === 1) {
    return `${items[0]}`;
  }

  return `${items.slice(0, -1).join(', ')} and ${items.slice(-1)[0]}`;
};

/*
 * Returns the base message to be displayed in the banner
 */
const getMessage = ({
  isWarning,
  isMmo,
  isTeamLabelActive,
  limits,
}: {
  isWarning: boolean;
  isMmo: boolean;
  isTeamLabelActive: boolean;
  limits: string;
}) => {
  let message = '';
  if (isWarning) {
    if (isMmo && isTeamLabelActive) {
      message = t('Your team is approaching the ##LIMITS## limit.');
    } else if (isMmo) {
      message = t('Your organization is approaching the ##LIMITS## limit.');
    } else {
      message = t('You are approaching the ##LIMITS## limit.');
    }
  } else if (isMmo && isTeamLabelActive) {
    message = t('Your team has reached the ##LIMITS## limit.');
  } else if (isMmo) {
    message = t('Your organization has reached the ##LIMITS## limit.');
  } else {
    message = t('You have reached the ##LIMITS## limit.');
  }

  return message.replace('##LIMITS##', limits);
};

const OverLimitBanner = (props: OverLimitBannerProps) => {
  const navigate = useNavigate();

  const orgQuery = useOrganizationQuery();

  if (
    !orgQuery.data ||
    !envStore.isReady ||
    !subscriptionStore.isInitialised ||
    !props.limits.length
  ) {
    return null;
  }

  const {limits, interval, warning} = props;
  const {is_mmo: isMmo, request_user_role: userRole} = orgQuery.data;
  const subscription = subscriptionStore.activeSubscriptions[0];

  // Get all the limits in a formatted string
  const allLimits = getAllLimits(limits, interval);

  // If the user is a member of an MMO, we don't show a warning:
  if (isMmo && userRole === OrganizationUserRole.member && !!warning) {
    return null;
  }

  // Get the first part of the message
  const message1 = getMessage({
    isWarning: !!warning,
    isMmo,
    isTeamLabelActive: shouldUseTeamLabel(envStore.data, subscription),
    limits: allLimits,
  });

  // We have different second part of the message for admins and owners of MMOs
  let message2 = '';
  if (isMmo) {
    const teamOrOrganization = getSimpleMMOLabel(
      envStore.data,
      subscription,
      false,
      false
    );

    if (userRole === OrganizationUserRole.owner) {
      if (warning) {
        message2 = t(
          'Purchase additional submissions add-ons to continue collecting and submitting data.'
        );
      } else {
        message2 = t(
          'Please purchase an add-on to increase your submission limits.'
        );
      }
    } else if (warning) {
      message2 = t(
        "Once the limit has been reached, you won't be able to collect or submit any new data until the ##TEAM_OR_ORGANIZATION## owner has purchased additional submissions."
      ).replace('##TEAM_OR_ORGANIZATION##', teamOrOrganization);
    } else {
      message2 = t(
        "You won't be able to collect or submit any new data until the ##TEAM_OR_ORGANIZATION## owner has purchased additional submissions."
      ).replace('##TEAM_OR_ORGANIZATION##', teamOrOrganization);
    }
  } else if (warning) {
    message2 = t(
      "Once the limit has been reached, you won't be able to collect or submit any new data until you upgrade your plan or purchase an add-on."
    );
  } else {
    message2 = t(
      'Please upgrade your plan or purchase an add-on to increase your usage limits.'
    );
  }

  // Only owners can see the call to action links
  const shouldDisplayCTA = !isMmo || userRole === OrganizationUserRole.owner;
  const ctaText = shouldDisplayCTA
    ? `[${t('Learn more')}](https://www.kobotoolbox.org/pricing/)`
    : '';

  return (
    <div
      className={cx(styles.limitBannerContainer, {
        [styles.warningBanner]: props.warning,
        [styles.accountPage]: props.accountPage,
      })}
    >
      <Icon
        name={'alert'}
        size='m'
        color={props.warning ? 'amber' : 'mid-red'}
      />
      <div className={styles.bannerContent}>
        <Markdown>{`${message1} ${message2} ${ctaText}`}</Markdown>
      </div>
      {shouldDisplayCTA && props.warning && !props.accountPage && (
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
      {shouldDisplayCTA && (!props.warning || props.accountPage) && (
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
