import React from 'react';
import autoBind from 'react-autobind';
import reactMixin from 'react-mixin';
import {actions} from 'js/actions';
import {bem} from 'js/bem';
import {stores} from 'js/stores';
import ui from 'js/ui';
import mixins from 'js/mixins';
import alertify from 'alertifyjs';
import {
  MODAL_TYPES,
  VALIDATION_STATUSES_LIST,
} from 'js/constants';
import {renderCheckbox} from 'utils';

/**
 * @prop asset
 * @prop pageSize
 * @prop data
 * @prop totalRowsCount
 * @prop selectedRows
 * @prop selectedAllPages
 * @prop fetchState
 * @prop onClearSelection
 */
class TableBulkOptions extends React.Component {
  constructor(props){
    super(props);

    this.currentDialog = null;

    autoBind(this);
  }

  componentDidMount() {
    actions.submissions.bulkDeleteStatus.completed.listen(this.closeCurrentDialog);
    actions.submissions.bulkDeleteStatus.failed.listen(this.closeCurrentDialog);
    actions.submissions.bulkPatchStatus.completed.listen(this.closeCurrentDialog);
    actions.submissions.bulkPatchStatus.failed.listen(this.closeCurrentDialog);
    actions.submissions.bulkDelete.completed.listen(this.closeCurrentDialog);
    actions.submissions.bulkDelete.failed.listen(this.closeCurrentDialog);
  }

  closeCurrentDialog() {
    if (this.currentDialog !== null) {
      this.currentDialog.destroy();
      this.currentDialog = null;
    }
  }

  onClearSelection() {
    this.props.onClearSelection();
  }

  onUpdateStatus(newStatus) {
    const data = {};
    let selectedCount;
    // setting empty value requires deleting the statuses with different API call
    const apiFn = newStatus === null ? actions.submissions.bulkDeleteStatus : actions.submissions.bulkPatchStatus;

    if (this.props.selectedAllPages) {
      if (this.props.fetchState.filtered.length) {
        data.query = {};
        data['validation_status.uid'] = newStatus;
        this.props.fetchState.filtered.map((filteredItem) => {
          data.query[filteredItem.id] = filteredItem.value;
        });
      } else {
        data.confirm = true;
        data['validation_status.uid'] = newStatus;
      }
      selectedCount = this.props.totalRowsCount;
    } else {
      data.submission_ids = Object.keys(this.props.selectedRows);
      data['validation_status.uid'] = newStatus;
      selectedCount = data.submission_ids.length;
    }

    this.closeCurrentDialog(); // just for safety sake
    this.currentDialog = alertify.dialog('confirm');
    const opts = {
      title: t('Update status of selected submissions'),
      message: t('You have selected ## submissions. Are you sure you would like to update their status? This action is irreversible.').replace('##', selectedCount),
      labels: {ok: t('Update Validation Status'), cancel: t('Cancel')},
      onok: () => {
        apiFn(this.props.asset.uid, data);
        // keep the dialog open
        return false;
      },
      oncancel: this.closeCurrentDialog,
    };
    this.currentDialog.set(opts).show();
  }

  onDelete() {
    const data = {};
    let selectedCount;

    if (this.props.selectedAllPages) {
      if (this.props.fetchState.filtered.length) {
        data.query = {};
        this.props.fetchState.filtered.map((filteredItem) => {
          data.query[filteredItem.id] = filteredItem.value;
        });
      } else {
        data.confirm = true;
      }
      selectedCount = this.props.totalRowsCount;
    } else {
      data.submission_ids = Object.keys(this.props.selectedRows);
      selectedCount = data.submission_ids.length;
    }
    let msg, onshow;
    msg = t('You are about to permanently delete ##count## data entries.').replace('##count##', selectedCount);
    msg += `${renderCheckbox('dt1', t('All selected data associated with this form will be deleted.'))}`;
    msg += `${renderCheckbox('dt2', t('I understand that if I delete the selected entries I will not be able to recover them.'))}`;

    this.closeCurrentDialog(); // just for safety sake
    this.currentDialog = alertify.dialog('confirm');
    onshow = () => {
      let ok_button = this.currentDialog.elements.buttons.primary.firstChild;
      let $els = $('.alertify-toggle input');

      ok_button.disabled = true;

      $els.each(function() {$(this).prop('checked', false);});
      $els.change(function() {
        ok_button.disabled = false;
        $els.each(function() {
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
        actions.submissions.bulkDelete(this.props.asset.uid, data);
        // keep the dialog open
        return false;
      },
      oncancel: this.closeCurrentDialog,
    };
    this.currentDialog.set(opts).show();
  }

  onEdit() {
    stores.pageState.showModal({
      type: MODAL_TYPES.BULK_EDIT_SUBMISSIONS,
      asset: this.props.asset,
      data: this.props.data,
      totalSubmissions: this.props.totalRowsCount,
      selectedSubmissions: Object.keys(this.props.selectedRows),
    });
  }

  render() {
    let selectedCount = Object.keys(this.props.selectedRows).length;
    if (this.props.selectedAllPages) {
      selectedCount = this.props.totalRowsCount;
    }
    const selectedLabel = t('##count## selected').replace('##count##', selectedCount);

    const maxPageRes = Math.min(this.props.pageSize, this.props.data.length);
    const isSelectAllAvailable = (
      Object.keys(this.props.selectedRows).length === maxPageRes &&
      this.props.totalRowsCount > this.props.pageSize
    );

    return (
      <bem.TableMeta__bulkOptions>
        {selectedCount > 1 &&
          <bem.KoboLightBadge>
            {selectedLabel}
            <a className='bulk-clear-badge-icon' onClick={this.onClearSelection}>&times;</a>
          </bem.KoboLightBadge>
        }

        {selectedCount > 1 && <span>:</span>}

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
          <bem.KoboLightButton
            m='blue'
            onClick={this.onEdit}
            disabled={this.props.selectedAllPages && isSelectAllAvailable}
          >
            <i className='k-icon k-icon-edit table-meta__additional-text'/>
            {t('Edit')}
          </bem.KoboLightButton>
        }

        {Object.keys(this.props.selectedRows).length > 0 && this.userCan('change_submissions', this.props.asset) &&
          <bem.KoboLightButton
            m='red'
            onClick={this.onDelete}
          >
            <i className='k-icon k-icon-trash table-meta__additional-text'/>
            {t('Delete')}
          </bem.KoboLightButton>
        }
      </bem.TableMeta__bulkOptions>
    );
  }
}

reactMixin(TableBulkOptions.prototype, mixins.permissions);

export default TableBulkOptions;
