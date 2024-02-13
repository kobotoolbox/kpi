import React, {useState} from 'react';
import styles from './tabs.module.scss';
import cx from 'classnames';

interface Tab {
  label: string;
  route: string;
}

export interface TabsProps {
  tabs: Tab[];
  selectedTab: string;
  onChange: (route: string) => void;
}

export default function Tabs({tabs, selectedTab, onChange}: TabsProps) {
  const [activeTab, setActiveTab] = useState(selectedTab);
  const [focus, setFocus] = useState(false);

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();

      const currentIndex = tabs.findIndex((tab) => tab.route === activeTab);
      const offset = event.key === 'ArrowRight' ? 1 : tabs.length - 1;
      const nextIndex = (currentIndex + offset) % tabs.length;

      setActiveTab(tabs[nextIndex].route);
      onChange(tabs[nextIndex].route);
      setFocus(true);
    }
  };

  const handleTabBlur = () => {
    setFocus(false);
  };

  const renderTab = (tab: Tab) => {
    const isActiveTab = activeTab === tab.route;

    return {
      key: tab.route,
      onClick: () => {
        setActiveTab(tab.route);
        onChange(tab.route);
      },
      onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) =>
        handleTabKeyDown(event),
      onBlur: handleTabBlur,
      className: cx(styles.tab, {
        [styles.active]: isActiveTab,
        [styles.focus]: focus && isActiveTab,
      }),
      'aria-selected': isActiveTab,
      tabIndex: isActiveTab ? 0 : -1,
      role: 'tab',
    };
  };

  return (
    <div className={styles.root} role='tablist'>
      {tabs.map((tab) => (
        <button {...renderTab(tab)} key={tab.route}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}
