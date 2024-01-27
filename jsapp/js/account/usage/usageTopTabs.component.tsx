import React, {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {ACCOUNT_ROUTES} from '../routes';
import styles from './usageTopTabs.module.scss';

/*
 * Top tabs which allow the user to navigate between `account total` and `project breakdown`
 * usage pages
 */
export default function UsageTopTabs() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(ACCOUNT_ROUTES.USAGE);

  const handleTabClick = (route: string) => {
    navigate(route);
    setActiveTab(route);
  };

  const handleKeyDown = (route: string) => (event: React.KeyboardEvent) => {
    if (event.key === 'Tab') {
      const nextTab =
        route === ACCOUNT_ROUTES.USAGE_PROJECT_BREAKDOWN
          ? ACCOUNT_ROUTES.USAGE
          : ACCOUNT_ROUTES.USAGE_PROJECT_BREAKDOWN;
      setActiveTab(nextTab);
      navigate(nextTab);
    }
  };

  const renderTab = (route: string) => {
    return {
      key: route,
      onClick: () => handleTabClick(route),
      className: `${styles.tab} ${activeTab === route ? styles.active : ''}`,
      'aria-selected': activeTab === route,
      tabIndex: activeTab === route ? 0 : -1,
      onKeyDown: handleKeyDown(route),
    };
  };

  return (
    <div className={styles.root} role='tablist'>
      <button {...renderTab(ACCOUNT_ROUTES.USAGE)}>{t('Account Total')}</button>
      <button {...renderTab(ACCOUNT_ROUTES.USAGE_PROJECT_BREAKDOWN)}>
        {t('Per Project Total')}
      </button>
    </div>
  );
}
