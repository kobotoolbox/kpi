import React from 'react';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import reactMixin from 'react-mixin';
import _ from 'underscore';
import enketoHandler from 'js/enketoHandler';
import {dataInterface} from '../dataInterface';
import Checkbox from './checkbox';
import {actions} from '../actions';
import {bem} from '../bem';
import ui from '../ui';
import {stores} from '../stores';
import mixins from '../mixins';
import alertify from 'alertifyjs';
import ReactTable from 'react-table';
import Select from 'react-select';
import {DebounceInput} from 'react-debounce-input';
import {
  VALIDATION_STATUSES,
  VALIDATION_STATUSES_LIST,
  MODAL_TYPES,
  QUESTION_TYPES,
  GROUP_TYPES_BEGIN,
  GROUP_TYPES_END
} from '../constants';
import {
  formatTimeDate,
  renderCheckbox
} from 'utils';
import {getSurveyFlatPaths} from 'js/assetUtils';
import {getRepeatGroupAnswers} from 'js/submissionUtils';

/**
 * @prop asset
 * @prop pageSize
 * @prop pageRowsCount
 * @prop totalRowsCount
 * @prop selectedRows
 * @prop selectedAllPages
 * @prop onClearSelection
 * @prop onSelectAll
 * @prop onUpdateStatus
 * @prop onDelete
 */
class TableBulkOptions extends React.Component {
  constructor(props){
    super(props);
    this.state = {
    };
    autoBind(this);
  }

  onClearSelection() {
    this.props.onClearSelection();
  }

  onSelectAll() {
    this.props.onSelectAll();
  }

  onUpdateStatus(newStatus) {
    const data = {};
    let selectedCount;
    // setting empty value requires deleting the statuses with different API call
    const apiFn = newStatus === null ? actions.submissions.bulkDeleteStatus : actions.submissions.bulkPatch;

    if (this.props.selectedAllPages) {
      if (this.state.fetchState.filtered.length) {
        data.query = {};
        data['validation_status.uid'] = newStatus;
        this.state.fetchState.filtered.map((filteredItem) => {
          data.query[filteredItem.id] = filteredItem.value;
        });
      } else {
        data.confirm = true;
        data['validation_status.uid'] = newStatus;
      }
      selectedCount = this.state.resultsTotal;
    } else {
      data.submission_ids = Object.keys(this.state.selectedRows);
      data['validation_status.uid'] = newStatus;
      selectedCount = data.submission_ids.length;
    }

    const dialog = alertify.dialog('confirm');
    const opts = {
      title: t('Update status of selected submissions'),
      message: t('You have selected ## submissions. Are you sure you would like to update their status? This action is irreversible.').replace('##', selectedCount),
      labels: {ok: t('Update Validation Status'), cancel: t('Cancel')},
      onok: () => {
        apiFn(this.props.asset.uid, data)
          .done(() => {dialog.destroy();})
          .fail((jqxhr) => {
            console.error(jqxhr);
            alertify.error(t('Failed to update status.'));
            dialog.destroy();
          });
        // keep the dialog open
        return false;
      },
      oncancel: dialog.destroy
    };
    dialog.set(opts).show();
  }

  onDelete() {
    const apiFn = actions.submissions.bulkDelete;
    const data = {};
    let selectedCount;

    if (this.state.selectAll) {
      if (this.state.fetchState.filtered.length) {
        data.query = {};
        this.state.fetchState.filtered.map((filteredItem) => {
          data.query[filteredItem.id] = filteredItem.value;
        });
      } else {
        data.confirm = true;
      }
      selectedCount = this.state.resultsTotal;
    } else {
      data.submission_ids = Object.keys(this.state.selectedRows);
      selectedCount = data.submission_ids.length;
    }
    let msg, onshow;
    msg = t('You are about to permanently delete ##count## data entries.').replace('##count##', selectedCount);
    msg += `${renderCheckbox('dt1', t('All selected data associated with this form will be deleted.'))}`;
    msg += `${renderCheckbox('dt2', t('I understand that if I delete the selected entries I will not be able to recover them.'))}`;
    const dialog = alertify.dialog('confirm');
    onshow = (evt) => {
      let ok_button = dialog.elements.buttons.primary.firstChild;
      let $els = $('.alertify-toggle input');

      ok_button.disabled = true;

      $els.each(function() {$(this).prop('checked', false);});
      $els.change(function() {
        ok_button.disabled = false;
        $els.each(function () {
          if (!$(this).prop('checked')) {
            ok_button.disabled = true;
          }
        });
      });
    };

    const opts = {
      title: t('Delete selected submissions'),
      message: msg,
      labels: {ok: t('Delete selected'), cancel: t('Cancel')},
      onshow: onshow,
      onok: () => {
        apiFn(this.props.asset.uid, data)
          .done(() => {dialog.destroy();})
          .fail((jqxhr) => {
            console.error(jqxhr);
            alertify.error(t('Failed to delete submissions.'));
            dialog.destroy();
          });
        // keep the dialog open
        return false;
      },
      oncancel: () => {
        dialog.destroy();
      }
    };
    dialog.set(opts).show();
  }

  render() {
    let selectedCount = Object.keys(this.props.selectedRows).length;
    if (this.props.selectedAllPages) {
      selectedCount = this.props.totalRowsCount;
    }
    const selectedLabel = t('##count## selected').replace('##count##', selectedCount);

    const maxPageRes = Math.min(this.props.pageSize, this.props.pageRowsCount);
    const isSelectAllAvailable = (
      Object.keys(this.props.selectedRows).length === maxPageRes &&
      this.props.totalRowsCount > this.props.pageSize
    );

    return (
      <div>
        {selectedCount > 1 &&
          <span>
            <a className='select-all' onClick={this.onClearSelection}>
              {t('Clear selection')}
            </a>

            {selectedLabel}
          </span>
        }

        { !this.props.selectedAllPages && isSelectAllAvailable &&
          <a className='select-all' onClick={this.onSelectAll}>
            {t('Select all ##count##').replace('##count##', this.props.totalRowsCount)}
          </a>
        }

        {Object.keys(this.props.selectedRows).length > 0 &&
          <ui.PopoverMenu type='bulkUpdate-menu' triggerLabel={t('Change status')} >
            {this.userCan('validate_submissions', this.props.asset) &&
              VALIDATION_STATUSES_LIST.map((item, n) => {
                return (
                  <bem.PopoverMenu__link
                    onClick={this.onUpdateStatus.bind(this, item.value)}
                    key={n}
                  >
                    {t('Set status: ##status##').replace('##status##', item.label)}
                  </bem.PopoverMenu__link>
                );
              })
            }
          </ui.PopoverMenu>
        }

        {Object.keys(this.props.selectedRows).length > 0 && this.userCan('change_submissions', this.props.asset) &&
          <bem.KoboButton m={['small', 'red']}
            onClick={this.onDelete}>
            {t('Delete selected')}
          </bem.KoboButton>
        }
      </div>
    );
  }
}

reactMixin(TableBulkOptions.prototype, mixins.permissions);

export default TableBulkOptions;
