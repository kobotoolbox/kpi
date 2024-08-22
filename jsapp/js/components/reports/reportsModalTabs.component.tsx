// Libraries
import React from 'react';
import cx from 'classnames';

/** These are all possible tabs. */
export type ReportsModalTabName = 'chart-type' | 'colors' | 'group-by' | 'translation';

export const DEFAULT_REPORTS_MODAL_TAB: ReportsModalTabName = 'chart-type';

interface ReportsModalTabsProps {
  /** A list of tabs to be displayed */
  tabs: ReportsModalTabName[];
  activeTabName: ReportsModalTabName;
  onRequestTabChange: (tabName: ReportsModalTabName) => void;
}

export default function ReportsModalTabs(props: ReportsModalTabsProps) {
  const displayedTabs: Array<{name: ReportsModalTabName; label: string}> = [];

  if (props.tabs.includes('chart-type')) {
    displayedTabs.push({name: 'chart-type', label: t('Chart Type')});
  }
  if (props.tabs.includes('colors')) {
    displayedTabs.push({name: 'colors', label: t('Colors')});
  }
  if (props.tabs.includes('group-by')) {
    displayedTabs.push({name: 'group-by', label: t('Group By')});
  }
  if (props.tabs.includes('translation')) {
    displayedTabs.push({name: 'translation', label: t('Translation')});
  }

  return displayedTabs.map((tab) => (
    <button
      className={cx({
        'legacy-modal-tab-button': true,
        'legacy-modal-tab-button--active': props.activeTabName === tab.name,
      })}
      onClick={() => {props.onRequestTabChange(tab.name);}}
      key={tab.name}
    >
      {tab.label}
    </button>
  ));
}
