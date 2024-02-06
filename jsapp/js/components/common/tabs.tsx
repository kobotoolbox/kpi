import React, {useState} from 'react';
import styles from './tabs.module.scss';

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

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault();

      const currentIndex = tabs.findIndex((tab) => tab.route === activeTab);

      const nextIndex = (currentIndex + 1) % tabs.length;

      setActiveTab(tabs[nextIndex].route);
      onChange(tabs[nextIndex].route);
    }
  };

  const renderTab = (tab: Tab) => {
    return {
      key: tab.route,
      onClick: () => {
        setActiveTab(tab.route);
        onChange(tab.route);
      },
      onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) =>
        handleTabKeyDown(event),
      className: `${styles.tab} ${
        activeTab === tab.route ? styles.active : ''
      }`,
      'aria-selected': activeTab === tab.route,
      tabIndex: activeTab === tab.route ? 0 : 1,
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
