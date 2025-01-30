import type {AnchorHTMLAttributes} from 'react';
import {useEffect, useState} from 'react';
import KoboModal from '../modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import KoboModalContent from 'js/components/modals/koboModalContent';
import KoboModalFooter from 'js/components/modals/koboModalFooter';
import Button from 'js/components/common/button';
import sessionStore from 'js/stores/session';
import {useNavigate} from 'react-router-dom';
import styles from './overLimitModal.module.scss';
import {ACCOUNT_ROUTES} from 'js/account/routes.constants';
import envStore from 'jsapp/js/envStore';
import Markdown from 'react-markdown';
import {useOrganizationQuery} from 'jsapp/js/account/organization/organizationQuery';

interface OverLimitModalProps {
  show: boolean;
  limits: string[];
  dismissed: () => void;
  interval: 'month' | 'year';
}

const getLimitReachedMessage = (isMmo: boolean, shouldUseTeamLabel: boolean) => {
  if (isMmo && shouldUseTeamLabel) {
    return t('Your team has reached the following limits included with your current plan:');
  } else if (isMmo) {
    return t('Your organization has reached the following limits included with your current plan:');
  }
  return t('You have reached the following limits included with your current plan:');
};

// We need to use a custom component here to open links using target="_blank"
const LinkRendererTargetBlank = (props: AnchorHTMLAttributes<HTMLAnchorElement>) => (
  <a href={props.href} target='_blank'>
    {props.children}
  </a>
);

function OverLimitModal(props: OverLimitModalProps) {
  const [isModalOpen, setIsModalOpen] = useState(true);
  const accountName = sessionStore.currentAccount.username;
  const navigate = useNavigate();
  const [show, setShow] = useState(props.show);
  const toggleModal = () => {
    setIsModalOpen(!isModalOpen);
  };

  const handleClose = () => {
    toggleModal();
    setShow(false);
    props.dismissed();
  };

  useEffect(() => {
    setShow(props.show);
  }, [props.show]);

  const orgQuery = useOrganizationQuery();

  if (!orgQuery.data || !envStore.isReady || !props.limits.length) {
    return null;
  }

  const {is_mmo} = orgQuery.data;
  const shouldUseTeamLabel = !!envStore.data?.use_team_label;


  const greetingMessage = t('Dear ##ACCOUNT_NAME##,').replace(
    '##ACCOUNT_NAME##',
    accountName
  );
  const limitReachedMessage = getLimitReachedMessage(is_mmo, shouldUseTeamLabel);

  const upgradeMessage = t(
    'Please upgrade your plan as soon as possible or [contact us](##CONTACT_LINK##) to speak with our team.'
  ).replace('##CONTACT_LINK##', 'https://www.kobotoolbox.org/contact/');

  const reviewUsageMessage = t(
    'You can [review your usage in account settings](##USAGE_LINK##).'
  ).replace('##USAGE_LINK##', `#${ACCOUNT_ROUTES.USAGE}`);

  return (
    <div>
      <KoboModal isOpen={show} onRequestClose={toggleModal} size='medium'>
        <KoboModalHeader>
          {t('You have reached your plan limit')}
        </KoboModalHeader>

        <KoboModalContent>
          <div className={styles.content}>
            <div className={styles.messageGreeting}>{greetingMessage}</div>
            <div>
              {limitReachedMessage}{' '}
              {props.limits.map((limit, index) => (
                <>
                  <strong>{limit}</strong>
                  {index < props.limits.length - 1 && ', '}
                </>
              ))}
            </div>
            <div>
              <Markdown components={{a: LinkRendererTargetBlank}}>{upgradeMessage}</Markdown>
              <Markdown>{reviewUsageMessage}</Markdown>
            </div>
          </div>
        </KoboModalContent>

        <KoboModalFooter alignment='end'>
          <Button
            type='secondary'
            size='l'
            onClick={handleClose}
            label={t('remind me later')}
            isUpperCase
          />

          <Button
            type='primary'
            size='l'
            onClick={() => navigate(ACCOUNT_ROUTES.PLAN)}
            label={t('upgrade now')}
            isUpperCase
          />
        </KoboModalFooter>
      </KoboModal>
    </div>
  );
}

export default OverLimitModal;
