// Libraries
import React from 'react';
import cx from 'classnames';

/** These are all possible tabs. */
export enum ReportsModalTabNames {
  'chart-type' = 'chart-type',
  colors = 'colors',
  'group-by' = 'group-by',
  translation = 'translation',
}

export const DEFAULT_REPORTS_MODAL_TAB = ReportsModalTabNames['chart-type'];

interface ReportsModalTabsProps {
  /** A list of tabs to be displayed */
  tabs: ReportsModalTabNames[];
  activeTabName: ReportsModalTabNames;
  onRequestTabChange: (tabName: ReportsModalTabNames) => void;
}

/**
 * This is a helper component that displays tabs for reports modals. You can
 * tell it which tabs you want to display, and it uses a callback whenever one
 * of the tabs is selected.
 */
export default function ReportsModalTabs(props: ReportsModalTabsProps) {
  const displayedTabs: Array<{name: ReportsModalTabNames; label: string}> = [];

  if (props.tabs.includes(ReportsModalTabNames['chart-type'])) {
    displayedTabs.push({
      name: ReportsModalTabNames['chart-type'],
      label: t('Chart Type')
    });
  }
  if (props.tabs.includes(ReportsModalTabNames.colors)) {
    displayedTabs.push({
      name: ReportsModalTabNames.colors,
      label: t('Colors')
    });
  }
  if (props.tabs.includes(ReportsModalTabNames['group-by'])) {
    displayedTabs.push({
      name: ReportsModalTabNames['group-by'],
      label: t('Group By')
    });
  }
  if (props.tabs.includes(ReportsModalTabNames.translation)) {
    displayedTabs.push({
      name: ReportsModalTabNames.translation,
      label: t('Translation')
    });
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
