import React from 'react';
import classNames from 'classnames';
import KoboDropdown from 'js/components/common/koboDropdown';
import {PERMISSIONS_CODENAMES} from 'js/components/permissions/permConstants';
import {SortValues} from 'js/components/submissions/tableConstants';
import './tableColumnSortDropdown.scss';
import {userCan} from 'js/components/permissions/utils';
import type {AssetResponse} from 'js/dataInterface';

const CLEAR_BUTTON_CLASS_NAME = 'table-column-sort-dropdown-clear';

interface TableColumnSortDropdownProps {
  asset: AssetResponse;
  /** one of table columns */
  fieldId: string;
  sortValue: SortValues | null;
  onSortChange: (fieldId: string, sortValue: SortValues | null) => void;
  onHide: (fieldId: string) => void;
  isFieldFrozen: boolean;
  onFrozenChange: (fieldId: string, isFrozen: boolean) => void;
  /**
   * To be put inside trigger, before the predefined content. Please note that
   * the trigger as a whole is clickable, so this additional content would need
   * stopPropagation to be clickable.
   */
  additionalTriggerContent?: React.ReactNode;
}

/**
 * A wrapper around KoboDropdown to be used in table header to sort columns.
 */
export default function TableColumnSortDropdown(
  props: TableColumnSortDropdownProps
) {
  function renderTrigger() {
    let sortIcon = ['k-icon'];
    if (props.sortValue && props.sortValue === SortValues.ASCENDING) {
      sortIcon.push('k-icon-sort-ascending');
    }
    if (props.sortValue && props.sortValue === SortValues.DESCENDING) {
      sortIcon.push('k-icon-sort-descending');
    }

    return (
      <div className='table-column-sort-dropdown-trigger' dir='auto'>
        {props.additionalTriggerContent}
        {props.sortValue && <i className={sortIcon.join(' ')} />}
        <i className='k-icon k-icon-caret-up' />
        <i className='k-icon k-icon-caret-down' />
      </div>
    );
  }

  function clearSort() {
    props.onSortChange(props.fieldId, null);
  }

  function changeSort(
    sortValue: SortValues,
    evt: React.MouseEvent<HTMLButtonElement>
  ) {
    const eventTarget = evt.target as HTMLButtonElement;

    // When clicking on clear icon button, we need to avoid triggering also the
    // change sort button. We can't use `stopPropagation` on `clearSort` as it
    // breaks `onMenuClick` functionality.
    if (eventTarget?.classList?.contains(CLEAR_BUTTON_CLASS_NAME)) {
      return;
    }
    props.onSortChange(props.fieldId, sortValue);
  }

  function hideField() {
    props.onHide(props.fieldId);
  }

  function changeFieldFrozen(isFrozen: boolean) {
    props.onFrozenChange(props.fieldId, isFrozen);
  }

  function renderSortButton(buttonSortValue: SortValues) {
    return (
      <button
        className={classNames({
          'sort-dropdown-menu-button': true,
          'sort-dropdown-menu-button--active': props.sortValue === buttonSortValue
        })}
        onClick={(evt) => {
          changeSort(buttonSortValue, evt);
        }}
      >
        {buttonSortValue === SortValues.ASCENDING && [
          <i key='0' className='k-icon k-icon-sort-ascending' />,
          <span key='1'>{t('Sort A→Z')}</span>,
        ]}
        {buttonSortValue === SortValues.DESCENDING && [
          <i key='0' className='k-icon k-icon-sort-descending' />,
          <span key='1'>{t('Sort Z→A')}</span>,
        ]}

        {props.sortValue === buttonSortValue && (
          <i
            onClick={clearSort}
            className={classNames(
              'k-icon',
              'k-icon-close',
              CLEAR_BUTTON_CLASS_NAME
            )}
          />
        )}
      </button>
    );
  }

  return (
    <KoboDropdown
      hideOnMenuClick
      name='table-column-sort'
      triggerContent={renderTrigger()}
      menuContent={
        <React.Fragment>
          {renderSortButton(SortValues.ASCENDING)}
          {renderSortButton(SortValues.DESCENDING)}

          {userCan(PERMISSIONS_CODENAMES.change_asset, props.asset) && (
            <button className='sort-dropdown-menu-button' onClick={hideField}>
              <i className='k-icon k-icon-hide' />
              <span>{t('Hide field')}</span>
            </button>
          )}
          {userCan(PERMISSIONS_CODENAMES.change_asset, props.asset) && (
            <button
              className='sort-dropdown-menu-button'
              onClick={() => {
                changeFieldFrozen(!props.isFieldFrozen);
              }}
            >
              {props.isFieldFrozen && [
                <i key='0' className='k-icon k-icon-unfreeze' />,
                <span key='1'>{t('Unfreeze field')}</span>,
              ]}
              {!props.isFieldFrozen && [
                <i key='0' className='k-icon k-icon-freeze' />,
                <span key='1'>{t('Freeze field')}</span>,
              ]}
            </button>
          )}
        </React.Fragment>
      }
    />
  );
}
