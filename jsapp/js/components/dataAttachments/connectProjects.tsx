import './connect-projects.scss'

import React from 'react'

import alertify from 'alertifyjs'
import Select from 'react-select'
import { actions } from '#/actions'
import bem from '#/bem'
import Button from '#/components/common/button'
import Checkbox from '#/components/common/checkbox'
import LoadingSpinner from '#/components/common/loadingSpinner'
import MultiCheckbox, { type MultiCheckboxItem } from '#/components/common/multiCheckbox'
import TextBox from '#/components/common/textBox'
import ToggleSwitch from '#/components/common/toggleSwitch'
import dataAttachmentsUtils, { type ColumnFilter } from '#/components/dataAttachments/dataAttachmentsUtils'
import { MAX_DISPLAYED_STRING_LENGTH, MODAL_TYPES } from '#/constants'
import type { AssetResponse, AssetsResponse, FailResponse } from '#/dataInterface'
import envStore from '#/envStore'
import pageState from '#/pageState.store'
import { escapeHtml, generateAutoname } from '#/utils'

const DYNAMIC_DATA_ATTACHMENTS_SUPPORT_URL = 'dynamic_data_attachment.html'

interface ConnectProjectsProps {
  asset: AssetResponse
}

interface ConnectProjectsState {
  isInitialised: boolean
  isLoading: boolean
  // `data_sharing` is an empty object if never enabled before
  isShared: boolean
  isSharingAnyQuestions: boolean
  attachedSources: AttachedSourceItem[]
  sharingEnabledAssets: AssetsResponse | null
  newSource: AssetResponse | null
  newFilename: string
  columnsToDisplay: ColumnFilter[]
  fieldsErrors: any
}

interface AttachedSourceItem {
  sourceName: string
  sourceUrl: string
  sourceUid: string
  linkedFields: string[]
  filename: string
  attachmentUrl: string
}

/*
 * Modal for connecting project data
 */
class ConnectProjects extends React.Component<ConnectProjectsProps, ConnectProjectsState> {
  private unlisteners: Function[] = []

  constructor(props: ConnectProjectsProps) {
    super(props)

    const isShared = props.asset.data_sharing?.enabled || false

    let columnsToDisplay: ColumnFilter[] = []
    if (isShared) {
      columnsToDisplay = dataAttachmentsUtils.generateColumnFilters(
        this.props.asset.data_sharing.fields || [],
        this.props.asset.content?.survey || [],
      )
    }

    this.state = {
      isInitialised: false,
      isLoading: false,
      isShared: isShared,
      isSharingAnyQuestions: Boolean(props.asset.data_sharing?.fields?.length) || false,
      attachedSources: [],
      sharingEnabledAssets: null,
      newSource: null,
      newFilename: '',
      columnsToDisplay: columnsToDisplay,
      fieldsErrors: {},
    }

    this.unlisteners = []
  }

  /*
   * Setup
   */

  componentDidMount() {
    this.unlisteners.push(
      actions.dataShare.attachToSource.started.listen(this.markComponentAsLoading.bind(this)),
      actions.dataShare.attachToSource.completed.listen(this.refreshAttachmentList.bind(this)),
      actions.dataShare.attachToSource.failed.listen(this.onAttachToSourceFailed.bind(this)),
      actions.dataShare.detachSource.completed.listen(this.refreshAttachmentList.bind(this)),
      actions.dataShare.patchSource.started.listen(this.markComponentAsLoading.bind(this)),
      actions.dataShare.patchSource.completed.listen(this.onPatchSourceCompleted.bind(this)),
      actions.dataShare.getSharingEnabledAssets.completed.listen(this.onGetSharingEnabledAssetsCompleted.bind(this)),
      actions.dataShare.getAttachedSources.completed.listen(this.onGetAttachedSourcesCompleted.bind(this)),
      actions.dataShare.toggleDataSharing.completed.listen(this.onToggleDataSharingCompleted.bind(this)),
      actions.dataShare.updateColumnFilters.completed.listen(this.onUpdateColumnFiltersCompleted.bind(this)),
      actions.dataShare.updateColumnFilters.failed.listen(this.stopLoading.bind(this)),
      actions.dataShare.detachSource.failed.listen(this.stopLoading.bind(this)),
      actions.dataShare.patchSource.completed.listen(this.stopLoading.bind(this)),
      actions.dataShare.patchSource.failed.listen(this.stopLoading.bind(this)),
    )

    this.refreshAttachmentList()

    actions.dataShare.getSharingEnabledAssets()
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb()
    })
  }

  /*
   * `actions` Listeners
   */

  onAttachToSourceFailed(response: FailResponse) {
    this.setState({
      isLoading: false,
      fieldsErrors: response?.responseJSON || t('Please check file name'),
    })
  }

  onGetAttachedSourcesCompleted(response: AttachedSourceItem[]) {
    this.setState({
      isInitialised: true,
      isLoading: false,
      attachedSources: response,
    })
  }

  onGetSharingEnabledAssetsCompleted(response: AssetsResponse) {
    // NOTE: it is completely valid to connect a project back to itself, so
    // don't be alarmed about seeing your current project in this list.
    this.setState({ sharingEnabledAssets: response })
  }

  onToggleDataSharingCompleted(response: AssetResponse) {
    this.setState({
      isShared: response.data_sharing.enabled || false,
      isSharingAnyQuestions: false,
      columnsToDisplay: dataAttachmentsUtils.generateColumnFilters([], this.props.asset.content?.survey),
    })
  }

  // Safely update state after guaranteed column changes
  onUpdateColumnFiltersCompleted(response: AssetResponse) {
    this.setState({
      isLoading: false,
      columnsToDisplay: dataAttachmentsUtils.generateColumnFilters(
        response.data_sharing.fields || [],
        this.props.asset.content?.survey,
      ),
    })
  }

  onPatchSourceCompleted() {
    actions.dataShare.getAttachedSources(this.props.asset.uid)
  }

  refreshAttachmentList() {
    this.setState({
      newSource: null,
      newFilename: '',
      fieldsErrors: {},
    })
    actions.dataShare.getAttachedSources(this.props.asset.uid)
  }

  stopLoading() {
    this.setState({ isLoading: false })
  }

  /*
   * UI Listeners
   */

  onFilenameChange(newVal: string) {
    this.setState({
      newFilename: newVal,
      fieldsErrors: {},
    })
  }

  onSourceChange(newVal: AssetResponse | null) {
    if (newVal) {
      this.setState({
        newSource: newVal,
        newFilename: generateAutoname(newVal.name, 0, MAX_DISPLAYED_STRING_LENGTH.connect_projects),
        fieldsErrors: {},
      })
    }
  }

  onConfirmAttachment(evt: React.TouchEvent<HTMLButtonElement>) {
    evt.preventDefault()
    if (this.state.newFilename !== '' && this.state.newSource?.url) {
      this.setState({
        fieldsErrors: {},
      })

      this.showColumnFilterModal(this.props.asset, this.state.newSource, this.state.newFilename, [])
    } else {
      if (!this.state.newSource?.url) {
        this.setState((state) => {
          return {
            fieldsErrors: {
              ...state.fieldsErrors,
              source: t('No project selected'),
            },
          }
        })
      }
      if (this.state.newFilename === '') {
        this.setState((state) => {
          return {
            fieldsErrors: {
              ...state.fieldsErrors,
              filename: t('Field is empty'),
            },
          }
        })
      }
    }
  }

  onRemoveAttachment(attachmentUrl: string) {
    this.setState({ isLoading: true })
    actions.dataShare.detachSource(attachmentUrl)
  }

  onToggleSharingData() {
    const data = {
      data_sharing: {
        enabled: !this.state.isShared,
        fields: [],
      },
    }

    if (this.state.isShared) {
      actions.dataShare.toggleDataSharing(this.props.asset.uid, data)
    } else {
      const dialog = alertify.dialog('confirm')
      const opts = {
        title: `${t('Privacy Notice')}`,
        message: t(
          'This will attach the full dataset from "##ASSET_NAME##" as a background XML file to this form. While not easily visible, it is technically possible for anyone entering data to your form to retrieve and view this dataset. Do not use this feature if "##ASSET_NAME##" includes sensitive data.',
        ).replaceAll('##ASSET_NAME##', escapeHtml(this.props.asset.name)),
        labels: { ok: t('Acknowledge and continue'), cancel: t('Cancel') },
        onok: () => {
          actions.dataShare.toggleDataSharing(this.props.asset.uid, data)
          dialog.destroy()
        },
        oncancel: dialog.destroy,
      }
      dialog.set(opts).show()
    }
  }

  onColumnSelected(columnList: MultiCheckboxItem[]) {
    this.setState({ isLoading: true })

    const fields: string[] = []
    columnList.forEach((item) => {
      if (item.checked) {
        fields.push(item.label)
      }
    })

    const data = {
      data_sharing: {
        enabled: this.state.isShared,
        fields: fields,
      },
    }

    actions.dataShare.updateColumnFilters(this.props.asset.uid, data)
  }

  onSharingCheckboxChange(checked: boolean) {
    let columnsToDisplay = this.state.columnsToDisplay
    if (!checked) {
      columnsToDisplay = []
      const data = {
        data_sharing: {
          enabled: this.state.isShared,
          fields: [],
        },
      }
      actions.dataShare.updateColumnFilters(this.props.asset.uid, data)
    }

    this.setState({
      columnsToDisplay: columnsToDisplay,
      isSharingAnyQuestions: checked,
    })
  }

  /*
   * Utilities
   */

  generateFilteredAssetList() {
    const attachedSourceUids: string[] = []
    this.state.attachedSources.forEach((item) => {
      attachedSourceUids.push(item.sourceUid)
    })

    // Filter out attached projects from displayed asset list
    return this.state.sharingEnabledAssets?.results.filter((item) => !attachedSourceUids.includes(item.uid)) || []
  }

  showColumnFilterModal(
    asset: AssetResponse,
    source: Pick<AssetResponse, 'uid' | 'name' | 'url'>,
    filename: string,
    fields: string[],
    attachmentUrl?: string,
  ) {
    pageState.showModal({
      type: MODAL_TYPES.DATA_ATTACHMENT_COLUMNS,
      asset: asset,
      source: source,
      filename: filename,
      fields: fields,
      attachmentUrl: attachmentUrl,
    })
  }

  markComponentAsLoading() {
    this.setState({ isLoading: true })
  }

  /*
   * Rendering
   */

  renderSelect() {
    if (this.state.sharingEnabledAssets !== null) {
      const sharingEnabledAssets = this.generateFilteredAssetList()

      return (
        <bem.KoboSelect__wrapper
          m={{
            error: Boolean(this.state.fieldsErrors?.source),
          }}
        >
          <Select
            placeholder={t('Select a different project to import data from')}
            options={sharingEnabledAssets}
            value={this.state.newSource}
            isLoading={!this.state.isInitialised || this.state.isLoading}
            getOptionLabel={(option) => option.name}
            getOptionValue={(option) => option.url}
            noOptionsMessage={() => t('No projects to connect')}
            onChange={this.onSourceChange.bind(this)}
            className='kobo-select'
            classNamePrefix='kobo-select'
          />

          {this.state.fieldsErrors?.source && (
            <bem.KoboSelect__error>{this.state.fieldsErrors?.source}</bem.KoboSelect__error>
          )}
        </bem.KoboSelect__wrapper>
      )
    }
    return null
  }

  renderExports() {
    if (this.state.isShared) {
      return (
        <div className='connect-projects__export'>
          <div className='connect-projects__export-options'>
            <ToggleSwitch
              onChange={this.onToggleSharingData.bind(this)}
              label={t('Data sharing enabled')}
              checked={this.state.isShared}
            />

            <Checkbox
              name='sharing'
              checked={this.state.isSharingAnyQuestions}
              onChange={this.onSharingCheckboxChange.bind(this)}
              label={t('Select specific questions to share')}
            />
          </div>

          {this.state.isSharingAnyQuestions && (
            <div className='connect-projects__export-multicheckbox'>
              <span className='connect-projects__export-hint'>
                {t('Select any questions you want to share in the right side table')}
                {this.state.isLoading && <LoadingSpinner message={t('Updating shared questions')} />}
              </span>

              <MultiCheckbox
                type='frame'
                items={this.state.columnsToDisplay}
                disabled={this.state.isLoading}
                onChange={this.onColumnSelected.bind(this)}
              />
            </div>
          )}
        </div>
      )
    } else {
      return (
        <div className='connect-projects__export'>
          <div className='connect-projects__export-switch'>
            <ToggleSwitch
              onChange={this.onToggleSharingData.bind(this)}
              label={t('Data sharing disabled')}
              checked={this.state.isShared}
            />
          </div>
        </div>
      )
    }
  }

  renderImports() {
    return (
      <div className='connect-projects__import'>
        <div className='connect-projects__import-form'>
          {this.renderSelect()}

          <TextBox
            className='connect-projects-textbox'
            placeholder={t('Give a unique name to the import')}
            value={this.state.newFilename}
            size='m'
            onChange={this.onFilenameChange.bind(this)}
            errors={this.state.fieldsErrors.filename}
          />

          <Button type='primary' size='m' onClick={this.onConfirmAttachment.bind(this)} label={t('Import')} />
        </div>

        {/* Display attached projects */}
        <ul className='connect-projects__import-list'>
          <label>{t('Imported')}</label>

          {(!this.state.isInitialised || this.state.isLoading) && (
            <div className='connect-projects__import-list-item'>
              <LoadingSpinner message={t('Loading imported projects')} />
            </div>
          )}

          {!this.state.isLoading && this.state.attachedSources.length == 0 && (
            <li className='connect-projects__import-list-item--no-imports'>{t('No data imported')}</li>
          )}

          {!this.state.isLoading &&
            this.state.attachedSources.length > 0 &&
            this.state.attachedSources.map((item, n) => (
              <li key={n} className='connect-projects__import-list-item'>
                <i className='k-icon k-icon-check' />

                <div className='connect-projects__import-labels'>
                  <span className='connect-projects__import-labels-filename'>{item.filename}</span>

                  <span className='connect-projects__import-labels-source'>{item.sourceName}</span>
                </div>

                <div className='connect-projects__import-options'>
                  <Button
                    type='secondary'
                    size='m'
                    startIcon='settings'
                    onClick={() =>
                      this.showColumnFilterModal(
                        this.props.asset,
                        {
                          uid: item.sourceUid,
                          name: item.sourceName,
                          url: item.sourceUrl,
                        },
                        item.filename,
                        item.linkedFields,
                        item.attachmentUrl,
                      )
                    }
                  />

                  <Button
                    type='secondary-danger'
                    size='m'
                    startIcon='trash'
                    onClick={() => this.onRemoveAttachment(item.attachmentUrl)}
                  />
                </div>
              </li>
            ))}
        </ul>
      </div>
    )
  }

  render() {
    return (
      <bem.FormView__row>
        {/* Enable data sharing */}
        <bem.FormView__cell m={['page-title']}>
          <i className='k-icon k-icon-folder-out' />
          <h2>{t('Share data with other project forms')}</h2>
        </bem.FormView__cell>

        <bem.FormView__cell m={['box', 'padding']}>
          <bem.FormView__form>
            <span>
              {t(
                'Enable data sharing to allow other forms to import and use dynamic data from this project. Learn more about dynamic data attachments',
              )}
              &nbsp;
              <a href={envStore.data.support_url + DYNAMIC_DATA_ATTACHMENTS_SUPPORT_URL} target='_blank'>
                {t('here')}
              </a>
            </span>

            {this.renderExports()}
          </bem.FormView__form>
        </bem.FormView__cell>

        {/* Attach other projects data */}
        <bem.FormView__cell m={['page-title']}>
          <i className='k-icon k-icon-folder-in' />
          <h2>{t('Import other project data')}</h2>
        </bem.FormView__cell>

        <bem.FormView__cell m={['box', 'padding']}>
          <bem.FormView__form>
            <span>
              {t(
                'Connect with other project(s) to import dynamic data from them into this project. Learn more about dynamic data attachments',
              )}
              &nbsp;
              <a href={envStore.data.support_url + DYNAMIC_DATA_ATTACHMENTS_SUPPORT_URL} target='_blank'>
                {t('here')}
              </a>
            </span>
            {this.renderImports()}
          </bem.FormView__form>
        </bem.FormView__cell>
      </bem.FormView__row>
    )
  }
}

export default ConnectProjects
