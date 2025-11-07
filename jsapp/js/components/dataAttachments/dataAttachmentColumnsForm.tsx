import React from 'react'

import { actions } from '#/actions'
import bem from '#/bem'
import Button from '#/components/common/button'
import LoadingSpinner from '#/components/common/loadingSpinner'
import MultiCheckbox from '#/components/common/multiCheckbox'
import dataAttachmentsUtils, { type ColumnFilter } from '#/components/dataAttachments/dataAttachmentsUtils'
import type { AssetResponse, PairedDataItem } from '#/dataInterface'

/**
 * Attributes from source needed to generate `columnsToDisplay`
 *
 * @namespace sourceAttributes
 * @prop {string} uid
 * @prop {string} name
 * @prop {string} url
 */
interface SourceAttributes {
  uid: string
  name: string
  url: string
}

interface DataAttachmentColumnsFormProps {
  onSetModalTitle: (newTitle: string) => void
  onModalClose: () => void
  asset: AssetResponse
  source: Pick<AssetResponse, 'uid' | 'name' | 'url'>
  filename: string
  fields: string[]
  attachmentUrl: string
}

interface DataAttachmentColumnsFormState {
  isInitialised: boolean
  isLoading: boolean
  columnsToDisplay: ColumnFilter[]
}

/**
 * The content of the DATA_ATTACHMENT_COLUMNS modal
 *
 * @prop {function} onSetModalTitle - for changing the modal title by this component
 * @prop {function} onModalClose - causes the modal to close
 * @prop {object} asset - current asset
 * @prop {sourceAttributes} source
 * @prop {string} filename
 * @prop {string[]} fields - selected fields to retrieve from source
 * @prop {string} attachmentUrl - if exists, we are patching an existing attachment
                                  otherwise, this is a new import
 */
class DataAttachmentColumnsForm extends React.Component<
  DataAttachmentColumnsFormProps,
  DataAttachmentColumnsFormState
> {
  private unlisteners: Function[] = []

  constructor(props: DataAttachmentColumnsFormProps) {
    super(props)
    this.state = {
      isInitialised: false,
      isLoading: false,
      columnsToDisplay: [],
    }
    this.unlisteners = []
  }

  componentDidMount() {
    // We must query for source's asset content in order to display their
    // available columns

    // TODO: See if we can simplify this to only call this if props does not
    // have any connected questions
    // See: https://github.com/kobotoolbox/kpi/issues/3912
    actions.resources.loadAsset({ id: this.props.source.uid }, true)

    this.unlisteners.push(
      actions.dataShare.attachToSource.started.listen(this.markComponentAsLoading.bind(this)),
      actions.dataShare.attachToSource.completed.listen(this.onAttachToSourceCompleted.bind(this)),
      actions.dataShare.attachToSource.failed.listen(this.stopLoading.bind(this)),
      actions.dataShare.patchSource.started.listen(this.markComponentAsLoading.bind(this)),
      actions.dataShare.patchSource.completed.listen(this.onPatchSourceCompleted.bind(this)),
      actions.dataShare.patchSource.failed.listen(this.stopLoading.bind(this)),
      actions.resources.loadAsset.completed.listen(this.onLoadAssetContentCompleted.bind(this)),
      actions.resources.loadAsset.failed.listen(this.stopLoading.bind(this)),
    )
    this.setModalTitle()
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb()
    })
  }

  setModalTitle() {
    this.props.onSetModalTitle(t('Import data from ##SOURCE_NAME##').replace('##SOURCE_NAME##', this.props.source.name))
  }

  onAttachToSourceCompleted() {
    this.props.onModalClose()
  }

  onBulkSelect(evt: React.TouchEvent<HTMLButtonElement>) {
    evt.preventDefault()

    const newList = this.state.columnsToDisplay.map((item) => {
      return { label: item.label, checked: true }
    })
    this.setState({ columnsToDisplay: newList })
  }

  onBulkDeselect(evt: React.TouchEvent<HTMLButtonElement>) {
    evt.preventDefault()

    const newList = this.state.columnsToDisplay.map((item) => {
      return { label: item.label, checked: false }
    })
    this.setState({ columnsToDisplay: newList })
  }

  onLoadAssetContentCompleted(response: AssetResponse) {
    if (Array.isArray(response.data_sharing?.fields) && response.data_sharing?.fields.length > 0) {
      this.setState({
        isInitialised: true,
        columnsToDisplay: dataAttachmentsUtils.generateColumnFilters(this.props.fields, response.data_sharing.fields),
      })
    } else {
      // empty `fields` implies all source questions are exposed
      this.setState({
        isInitialised: true,
        columnsToDisplay: dataAttachmentsUtils.generateColumnFilters(this.props.fields, response.content?.survey),
      })
    }
  }

  onPatchSourceCompleted(response: PairedDataItem) {
    this.setState({
      isLoading: false,
      columnsToDisplay: dataAttachmentsUtils.generateColumnFilters(this.props.fields, response.fields),
    })
    this.props.onModalClose()
  }

  // Actions take care of the error handling for this modal
  stopLoading() {
    this.setState({ isLoading: false })
  }

  onColumnSelected(newList: ColumnFilter[]) {
    this.setState({ columnsToDisplay: newList })
  }

  onSubmit(evt: React.TouchEvent<HTMLButtonElement>) {
    evt.preventDefault()

    const fields: string[] = []
    let data: {
      source?: string
      fields: string[]
      filename: string
    } = {
      fields: [],
      filename: '',
    }

    this.state.columnsToDisplay.forEach((item) => {
      if (item.checked) {
        fields.push(item.label)
      }
    })

    if (this.props.attachmentUrl) {
      data = {
        fields: fields,
        filename: this.props.filename,
      }
      actions.dataShare.patchSource(this.props.attachmentUrl, data)
    } else {
      data = {
        source: this.props.source.url,
        fields: fields,
        filename: this.props.filename,
      }
      actions.dataShare.attachToSource(this.props.asset.uid, data)
    }
  }

  markComponentAsLoading() {
    this.setState({ isLoading: true })
  }

  render() {
    return (
      // TODO: Don't use BEM elements
      // See: https://github.com/kobotoolbox/kpi/issues/3912
      <bem.FormModal__form m='data-attachment-columns'>
        <div className='header'>
          <span className='modal-description'>
            {t(
              'You are about to import ##SOURCE_NAME##. Select or deselect in the list below to narrow down the number of questions to import.',
            ).replace('##SOURCE_NAME##', this.props.source.name)}
          </span>

          <div className='bulk-options'>
            <span className='bulk-options__description'>{t('Select below the questions you want to import')}</span>

            <div className='bulk-options__buttons'>
              <Button type='secondary' size='s' onClick={this.onBulkSelect.bind(this)} label={t('Select all')} />

              <span>{t('|')}</span>

              <Button type='secondary' size='s' onClick={this.onBulkDeselect.bind(this)} label={t('Deselect all')} />
            </div>
          </div>
        </div>

        {!this.state.isInitialised && <LoadingSpinner message={t('Loading imported questions')} />}

        <MultiCheckbox
          type='frame'
          items={this.state.columnsToDisplay}
          onChange={this.onColumnSelected}
          disabled={this.state.isLoading}
          className='data-attachment-columns-multicheckbox'
        />

        {this.state.isLoading && <LoadingSpinner message={t('Updating imported questions')} />}

        <footer className='modal__footer'>
          <Button
            type='primary'
            size='l'
            isSubmit
            onClick={this.onSubmit.bind(this)}
            isDisabled={this.state.isLoading}
            label={t('Accept')}
            className='data-attachment-modal-footer-button'
          />
        </footer>
      </bem.FormModal__form>
    )
  }
}

export default DataAttachmentColumnsForm
