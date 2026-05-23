import React from 'react'

import cx from 'classnames'
import { observer } from 'mobx-react'
import autoBind from 'react-autobind'
import Dropzone from 'react-dropzone'

import bem from '#/bem'
import Button from '#/components/common/button'
import Checkbox from '#/components/common/checkbox'
import LoadingSpinner from '#/components/common/loadingSpinner'
import myLibraryStore from '#/components/library/myLibraryStore'
import { ASSET_TYPES, MODAL_TYPES } from '#/constants'
import { dataInterface } from '#/dataInterface'
import { pollImportUntilDone } from '#/dropzone.utils'
import envStore from '#/envStore'
import pageState from '#/pageState.store'
import { withRouter } from '#/router/legacy'
import sessionStore from '#/stores/session'
import { escapeHtml, join, notify, validFileTypes } from '#/utils'

import ModalBackButton from './ModalBackButton'

/**
 * @prop {function} onSetModalTitle
 * @prop {file} [file] optional preloaded file
 */
const LibraryUploadForm = observer(
  class LibraryUploadForm extends React.Component {
    constructor(props) {
      super(props)
      this.state = {
        isPending: false,
        isUploadAsTemplateChecked: false,
        currentFile: this.props.file || null,
      }

      autoBind(this)
    }

    isSubmitEnabled() {
      return !this.state.isPending && this.state.currentFile !== null
    }

    onFileDrop(files) {
      if (files[0]) {
        this.setState({ currentFile: files[0] })
      }
    }

    onUploadAsTemplateChange(isChecked) {
      this.setState({ isUploadAsTemplateChecked: isChecked })
    }

    onSubmit(evt) {
      evt.preventDefault()
      this.setState({ isPending: true })

      const file = this.state.currentFile
      const reader = new FileReader()
      reader.onload = () => {
        const params = {
          name: file.name,
          base64Encoded: reader.result,
          library: true,
        }
        // Only pass desired type if user wants to upload as template. Back-end code will create either a block, or
        // a collection - based on the file content.
        if (this.state.isUploadAsTemplateChecked) {
          params.desired_type = ASSET_TYPES.template.id
        }
        dataInterface
          .createImport(params)
          .done((data) => {
            // Keep previous behavior: switch to a dedicated upload modal that stays visible until import processing
            // finishes.
            pageState.switchModal({
              type: MODAL_TYPES.UPLOADING_XLS,
              filename: file.name,
            })

            pollImportUntilDone(data.uid).then(
              () => {
                myLibraryStore.fetchData(true)
                notify(t('XLS Import completed'))
                pageState.hideModal()
              },
              (response) => {
                const errLines = []
                errLines.push(t('Import Failed!'))
                if (file.name) {
                  errLines.push(<code>Name: {file.name}</code>)
                }
                if (response?.messages?.error) {
                  errLines.push(
                    <code>
                      {response.messages.error_type}: {escapeHtml(response.messages.error)}
                    </code>,
                  )
                }
                notify.error(<div>{join(errLines, <br />)}</div>)
                pageState.hideModal()
              },
            )
          })
          .fail(() => {
            notify.error(t('Failed to create import.'))
            this.setState({ isPending: false })
          })
      }
      reader.onerror = () => {
        notify.error(t('Failed to read file.'))
        this.setState({ isPending: false })
      }
      reader.readAsDataURL(file)
    }

    render() {
      if (!sessionStore.isLoggedIn) {
        return <LoadingSpinner />
      }

      return (
        <bem.FormModal__form className='project-settings'>
          <bem.Modal__subheader>{t('Import an XLSForm from your computer.')}</bem.Modal__subheader>

          {!this.state.isPending && (
            <React.Fragment>
              <bem.FormModal__item>
                <Dropzone onDrop={this.onFileDrop.bind(this)} multiple={false} accept={validFileTypes()}>
                  {({ getRootProps, getInputProps, isDragActive, isDragReject }) => (
                    <div
                      {...getRootProps({
                        className: cx('dropzone', { 'dropzone-active': isDragActive, 'dropzone-reject': isDragReject }),
                      })}
                    >
                      <input {...getInputProps()} />
                      <i className='k-icon k-icon-file-xls' />
                      {this.state.currentFile && this.state.currentFile.name}
                      {!this.state.currentFile && t(' Drag and drop the XLSForm file here or click to browse')}
                    </div>
                  )}
                </Dropzone>
              </bem.FormModal__item>

              <bem.FormModal__item>
                <Checkbox
                  checked={this.state.isUploadAsTemplateChecked}
                  disabled={this.state.isPending}
                  onChange={this.onUploadAsTemplateChange.bind(this)}
                  label={t('Upload as template')}
                />

                <small>
                  {t('Note that this will be ignored when uploading a collection file.')}{' '}
                  <a href={envStore.data.support_url + 'import_collection.html'} target='_blank'>
                    {t('Learn more')}
                  </a>
                </small>
              </bem.FormModal__item>
            </React.Fragment>
          )}
          {this.state.isPending && (
            <div className='dropzone'>
              <LoadingSpinner message={t('Uploading file…')} />
            </div>
          )}

          <bem.Modal__footer>
            <ModalBackButton isDisabled={this.state.isPending} />

            <Button
              type='primary'
              size='l'
              isSubmit
              onClick={this.onSubmit.bind(this)}
              isDisabled={!this.isSubmitEnabled()}
              label={t('Upload')}
            />
          </bem.Modal__footer>
        </bem.FormModal__form>
      )
    }
  },
)

export default withRouter(LibraryUploadForm)
