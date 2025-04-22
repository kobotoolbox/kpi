import React from 'react'

import alertify from 'alertifyjs'
import { actions } from '#/actions'
import BulkDeleteMediaFiles from '#/attachments/BulkDeleteMediaFiles'
import bem from '#/bem'
import Badge from '#/components/common/badge'
import Button from '#/components/common/button'
import Icon from '#/components/common/icon'
import { PERMISSIONS_CODENAMES } from '#/components/permissions/permConstants'
import { userCan, userCanPartially } from '#/components/permissions/utils'
import type { DataTableSelectedRows, ReactTableStateFilteredItem } from '#/components/submissions/table.types'
import {
  VALIDATION_STATUS_OPTIONS,
  ValidationStatusAdditionalName,
} from '#/components/submissions/validationStatus.constants'
import type {
  ValidationStatusName,
  ValidationStatusOptionName,
} from '#/components/submissions/validationStatus.constants'
import { MODAL_TYPES } from '#/constants'
import type { AssetResponse, BulkSubmissionsRequest, SubmissionResponse } from '#/dataInterface'
import pageState from '#/pageState.store'
import PopoverMenu from '#/popoverMenu'
import { renderCheckbox } from '#/utils'
import { buildFilterQuery } from './tableUtils'

interface TableBulkOptionsProps {
  asset: AssetResponse
  pageSize: number
  data: SubmissionResponse[]
  totalRowsCount: number
  selectedRows: DataTableSelectedRows
  selectedAllPages: boolean
  fetchState: any
  onClearSelection: () => void
}

class TableBulkOptions extends React.Component<TableBulkOptionsProps> {
  currentDialog: AlertifyDialogInstance | null = null

  componentDidMount() {
    actions.submissions.bulkDeleteStatus.completed.listen(this.closeCurrentDialog.bind(this))
    actions.submissions.bulkDeleteStatus.failed.listen(this.closeCurrentDialog.bind(this))
    actions.submissions.bulkPatchStatus.completed.listen(this.closeCurrentDialog.bind(this))
    actions.submissions.bulkPatchStatus.failed.listen(this.closeCurrentDialog.bind(this))
    actions.submissions.bulkDelete.completed.listen(this.closeCurrentDialog.bind(this))
    actions.submissions.bulkDelete.failed.listen(this.closeCurrentDialog.bind(this))
  }

  closeCurrentDialog() {
    if (this.currentDialog !== null) {
      this.currentDialog.destroy()
      this.currentDialog = null
    }
  }

  onClearSelection() {
    this.props.onClearSelection()
  }

  onUpdateStatus(newStatus: ValidationStatusOptionName) {
    const requestObj: BulkSubmissionsRequest = {}
    let selectedCount

    // setting empty value requires deleting the statuses with different API call
    let apiFn = actions.submissions.bulkPatchStatus
    if (newStatus === ValidationStatusAdditionalName.no_status) {
      apiFn = actions.submissions.bulkDeleteStatus
    }

    if (this.props.selectedAllPages) {
      if (this.props.fetchState.filtered.length && this.props.asset.content?.survey) {
        // This is the case where user selected the "all pages" checkbox with
        // some data already being filtered.
        const filterQuery = buildFilterQuery(this.props.asset.content.survey, this.props.fetchState.filtered)
        requestObj.query = filterQuery.queryObj
        requestObj['validation_status.uid'] = newStatus as ValidationStatusName
      } else {
        // This is the case where user selected the "all pages" checkbox without
        // any data filtering.
        requestObj.confirm = true
        requestObj['validation_status.uid'] = newStatus as ValidationStatusName
      }
      selectedCount = this.props.totalRowsCount
    } else {
      requestObj.submission_ids = Object.keys(this.props.selectedRows)
      requestObj['validation_status.uid'] = newStatus as ValidationStatusName
      selectedCount = requestObj.submission_ids.length
    }

    this.closeCurrentDialog() // just for safety sake
    this.currentDialog = alertify.dialog('confirm')
    const opts = {
      title: t('Update status of selected submissions'),
      message: t(
        'You have selected ## submissions. Are you sure you would like to update their status? This action is irreversible.',
      ).replace('##', String(selectedCount)),
      labels: { ok: t('Update Validation Status'), cancel: t('Cancel') },
      onok: () => {
        apiFn(this.props.asset.uid, requestObj)
        // keep the dialog open
        return false
      },
      oncancel: this.closeCurrentDialog.bind(this),
    }
    this.currentDialog?.set(opts).show()
  }

  onDelete() {
    const requestObj: BulkSubmissionsRequest = {}
    let selectedCount

    if (this.props.selectedAllPages) {
      if (this.props.fetchState.filtered.length) {
        this.props.fetchState.filtered.map((filteredItem: ReactTableStateFilteredItem) => {
          if (!requestObj.query) {
            requestObj.query = {}
          }
          requestObj.query[filteredItem.id] = filteredItem.value
        })
      } else {
        requestObj.confirm = true
      }
      selectedCount = this.props.totalRowsCount
    } else {
      requestObj.submission_ids = Object.keys(this.props.selectedRows)
      selectedCount = requestObj.submission_ids.length
    }
    let msg
    msg = t(
      'You are about to permanently delete ##count## submissions. It is not possible to recover deleted submissions.',
    ).replace('##count##', String(selectedCount))
    msg = `${renderCheckbox('dt1', msg)}`

    this.closeCurrentDialog() // just for safety sake
    this.currentDialog = alertify.dialog('confirm')
    const onshow = () => {
      const ok_button = this.currentDialog?.elements.buttons.primary.firstChild as HTMLButtonElement
      const $els = $('.alertify-toggle input')

      ok_button.disabled = true

      $els.each(function () {
        $(this).prop('checked', false)
      })
      $els.change(() => {
        ok_button.disabled = false
        $els.each(function () {
          if (!$(this).prop('checked')) {
            ok_button.disabled = true
          }
        })
      })
    }

    const opts = {
      title: t('Delete selected submissions'),
      message: msg,
      labels: { ok: t('Delete selected'), cancel: t('Cancel') },
      onshow: onshow,
      onok: () => {
        actions.submissions.bulkDelete(this.props.asset.uid, requestObj)
        // keep the dialog open
        return false
      },
      oncancel: this.closeCurrentDialog.bind(this),
    }
    this.currentDialog?.set(opts).show()
  }

  onEdit() {
    pageState.showModal({
      type: MODAL_TYPES.BULK_EDIT_SUBMISSIONS,
      asset: this.props.asset,
      data: this.props.data,
      totalSubmissions: this.props.totalRowsCount,
      selectedSubmissions: Object.keys(this.props.selectedRows),
    })
  }

  /** Returns an array of SubmissionResponse's which delete-able attachments. */
  getSelectedSubmissionsWithAttachments() {
    return this.props.data.filter(
      (submission) =>
        Object.keys(this.props.selectedRows).includes(submission._id.toString()) &&
        submission._attachments.filter((attachment) => !attachment.is_deleted).length > 0,
    )
  }

  handleDeletedAttachment() {
    // Prompt table to refresh submission list
    actions.resources.refreshTableSubmissions()
  }

  render() {
    let selectedCount = Object.keys(this.props.selectedRows).length
    if (this.props.selectedAllPages) {
      selectedCount = this.props.totalRowsCount
    }
    const selectedLabel = t('##count## selected').replace('##count##', String(selectedCount))

    const maxPageRes = Math.min(this.props.pageSize, this.props.data.length)
    const isSelectAllAvailable =
      Object.keys(this.props.selectedRows).length === maxPageRes && this.props.totalRowsCount > this.props.pageSize

    return (
      <bem.TableMeta__bulkOptions>
        {selectedCount > 1 && (
          <Badge
            color='light-storm'
            size='s'
            label={
              <>
                {selectedLabel}
                &nbsp;
                <button className='bulk-clear-badge-icon' onClick={this.onClearSelection.bind(this)}>
                  <Icon name='close' size='xxs' />
                </button>
              </>
            }
            disableShortening
          />
        )}

        {Object.keys(this.props.selectedRows).length > 0 && (
          <PopoverMenu
            type='bulkUpdate-menu'
            triggerLabel={<Button type='secondary' size='s' label={t('Change status')} endIcon='angle-down' />}
          >
            {(userCan(PERMISSIONS_CODENAMES.validate_submissions, this.props.asset) ||
              userCanPartially(PERMISSIONS_CODENAMES.validate_submissions, this.props.asset)) &&
              VALIDATION_STATUS_OPTIONS.map((item, n) => (
                <bem.PopoverMenu__link onClick={this.onUpdateStatus.bind(this, item.value)} key={n}>
                  {t('Set status: ##status##').replace('##status##', item.label)}
                </bem.PopoverMenu__link>
              ))}
          </PopoverMenu>
        )}

        {Object.keys(this.props.selectedRows).length > 0 &&
          this.props.asset.deployment__active &&
          (userCan(PERMISSIONS_CODENAMES.change_submissions, this.props.asset) ||
            userCanPartially(PERMISSIONS_CODENAMES.change_submissions, this.props.asset)) && (
            <Button
              type='secondary'
              size='s'
              onClick={this.onEdit.bind(this)}
              isDisabled={this.props.selectedAllPages && isSelectAllAvailable}
              startIcon='edit'
              label={t('Edit')}
              className='table-meta__additional-text'
            />
          )}

        {Object.keys(this.props.selectedRows).length > 0 &&
          (userCan(PERMISSIONS_CODENAMES.delete_submissions, this.props.asset) ||
            userCanPartially(PERMISSIONS_CODENAMES.delete_submissions, this.props.asset)) && (
            <Button
              type='secondary-danger'
              size='s'
              onClick={this.onDelete.bind(this)}
              startIcon='trash'
              label={t('Delete')}
              className='table-meta__additional-text'
            />
          )}

        {Object.keys(this.props.selectedRows).length > 0 &&
          (userCan(PERMISSIONS_CODENAMES.delete_submissions, this.props.asset) ||
            userCanPartially(PERMISSIONS_CODENAMES.change_submissions, this.props.asset)) &&
          this.getSelectedSubmissionsWithAttachments().length > 0 && (
            <BulkDeleteMediaFiles
              selectedSubmissions={this.getSelectedSubmissionsWithAttachments()}
              asset={this.props.asset}
              onDeleted={this.handleDeletedAttachment}
            />
          )}
      </bem.TableMeta__bulkOptions>
    )
  }
}

export default TableBulkOptions
