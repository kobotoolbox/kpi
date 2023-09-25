import React, {useState} from 'react';
import Usage from './usage.component';
import styles from './usageContent.module.scss';
import classNames from 'classnames';

interface TabState {
  currentTab: 'organization' | 'perAsset';
}

export default function UsageContent() {
  const [tab, setTab] = useState<TabState>({
    currentTab: 'organization',
  });

  function renderTabContent() {
    switch (tab.currentTab) {
      case 'organization':
        return <Usage />;
      case 'perAsset':
        return <h2>hello</h2>;
      default:
        return null;
    }
  }

  return (
    <div>
      <section className={styles.root}>
        <ul className={styles.tabs}>
          <li
            className={classNames({
              [styles.tab]: true,
              [styles.activeTab]: tab.currentTab === 'organization',
            })}
            onClick={() => setTab({currentTab: 'organization'})}
          >
            {t('My organization')}
          </li>

          <li
            className={classNames({
              [styles.tab]: true,
              [styles.activeTab]: tab.currentTab === 'perAsset',
            })}
            onClick={() => setTab({currentTab: 'perAsset'})}
          >
            {t('Per asset')}
          </li>
        </ul>

        <section className={styles.body}>
          {renderTabContent()}
        </section>
      </section>
    </div>
  );
}
