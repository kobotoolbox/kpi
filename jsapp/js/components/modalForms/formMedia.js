import './formMedia.scss'

import React from 'react'

import autoBind from 'react-autobind'
import Dropzone from 'react-dropzone'
import { actions } from '#/actions'
import bem, { makeBem } from '#/bem'
import Button from '#/components/common/button'
import InlineMessage from '#/components/common/inlineMessage'
import LoadingSpinner from '#/components/common/loadingSpinner'
import TextBox from '#/components/common/textBox'
import { ASSET_FILE_TYPES, MAX_DISPLAYED_STRING_LENGTH } from '#/constants'
import envStore from '#/envStore'
import { notify, truncateString, truncateUrl } from '#/utils'

const DEFAULT_MEDIA_DESCRIPTION = 'default'
const MEDIA_SUPPORT_URL = 'upload_media.html'

bem.FormMediaUploadUrl = makeBem(null, 'form-media-upload-url')
bem.FormMediaUploadUrl__label = makeBem(bem.FormMediaUploadUrl, 'label', 'label')
bem.FormMediaUploadUrl__form = makeBem(bem.FormMediaUploadUrl, 'form')

/**
 * @prop {object} asset
 *
 * Modal for uploading form media
 */
class FormMedia extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      uploadedAssets: [],
      fieldsErrors: {},
      inputURL: '',
      // to show loading icon instead of nothing on first load
      isInitialised: false,
      // to show loading icon while uploading any file
      isUploadFilePending: false,
      isUploadURLPending: false,
    }

    autoBind(this)
  }

  /*
   * setup
   */

  componentDidMount() {
    actions.media.loadMedia(this.props.asset.uid)

    actions.media.loadMedia.completed.listen(this.onGetMediaCompleted)
    actions.media.uploadMedia.failed.listen(this.onUploadFailed)
  }

  /*
   * action listeners
   */

  onGetMediaCompleted(uploadedAssets) {
    this.setState({
      uploadedAssets: uploadedAssets.results,
      isUploadFilePending: false,
      isUploadURLPending: false,
      isInitialised: true,
    })
  }

  onUploadFailed(response) {
    this.setState({
      fieldsErrors: response.responseJSON,
      isUploadFilePending: false,
      isUploadURLPending: false,
    })
  }

  /*
   * Utilities
   */

  toBase64(file) {
    return new Promise((resolve, reject) => {
      var reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  /*
   * Backend requires form media payload to include the following
   *
   * @namespace formMediaJSON
   * @param {string} description - can be anything, when in doubt use 'default'
   * @param {string} filetype - should be `ASSET_FILE_TYPES.form_media.id`
   * @param {string} metadata - Won't break if not included, but should contain
   *                            the JSON stringified filename for downloading
   * @param {string} base64Encoded
   *
   * @param {formMediaJSON} formMediaJSON
   *
   * Taken from: https://github.com/kobotoolbox/kpi/blob/a5302750fa0974d075495bfc070afc85ff5cf60d/kpi/views/v2/asset_file.py#L49-L67
   */

  uploadMedia(formMediaJSON) {
    // Reset error message before uploading again
    this.setState({ fieldsErrors: {} })
    actions.media.uploadMedia(this.props.asset.uid, formMediaJSON)
  }

  /*
   * DOM listeners
   */

  onFileDrop(files) {
    if (files.length >= 1) {
      this.setState({ isUploadFilePending: true })

      files.forEach(async (file) => {
        var base64File = await this.toBase64(file)

        this.uploadMedia({
          description: DEFAULT_MEDIA_DESCRIPTION,
          file_type: ASSET_FILE_TYPES.form_media.id,
          metadata: JSON.stringify({ filename: file.name }),
          base64Encoded: base64File,
        })
      })
    }
  }

  onInputURLChange(inputURL) {
    this.setState({ inputURL: inputURL })
  }

  onSubmitURL() {
    var url = this.state.inputURL

    if (url === '') {
      notify.warning(t('URL is empty!'))
    } else {
      this.setState({
        isUploadURLPending: true,
        inputURL: '',
      })

      this.uploadMedia({
        description: DEFAULT_MEDIA_DESCRIPTION,
        file_type: ASSET_FILE_TYPES.form_media.id,
        metadata: JSON.stringify({ redirect_url: url }),
      })
    }
  }

  onDeleteMedia(evt, url) {
    evt.preventDefault()
    actions.media.deleteMedia(this.props.asset.uid, url)
  }

  /*
   * rendering
   */

  renderFileName(item) {
    // Check if current item is uploaded via URL. `redirect_url` is the indicator
    var fileName = item.metadata.filename
    if (item.metadata.redirect_url) {
      fileName = truncateUrl(item.metadata.redirect_url, MAX_DISPLAYED_STRING_LENGTH.form_media)
    } else {
      fileName = truncateString(fileName, MAX_DISPLAYED_STRING_LENGTH.form_media)
    }

    return (
      <a
        href={item?.content}
        target='_blank'
        // Added manually by frontend, not backend. See uploadMedia()
        download={item?.metadata?.filename}
      >
        {fileName}
      </a>
    )
  }

  renderIcon(item) {
    const iconClassNames = ['form-media__file-type', 'k-icon']
    // Check if current item is uploaded via URL. `redirect_url` is the indicator
    if (item.metadata.redirect_url) {
      iconClassNames.push('k-icon-link')
    } else {
      iconClassNames.push('k-icon-media-files')
    }

    return <i className={iconClassNames.join(' ')} />
  }

  render() {
    return (
      <bem.FormView m='form-media'>
        <bem.FormMedia>
          {this.props.asset.deployment__active && (
            <InlineMessage
              icon='alert'
              type='warning'
              message={t('You must redeploy this form to see media changes.')}
            />
          )}

          <bem.FormMedia__title>
            <bem.FormMedia__label>{t('Attach files')}</bem.FormMedia__label>

            {envStore.isReady && envStore.data.support_url && (
              <a
                className='title-help'
                target='_blank'
                href={envStore.data.support_url + MEDIA_SUPPORT_URL}
                data-tip={t('Learn more about form media')}
              >
                <i className='k-icon k-icon-help' />
              </a>
            )}
          </bem.FormMedia__title>

          <bem.FormMedia__upload>
            {!this.state.isUploadFilePending && (
              <Dropzone onDrop={this.onFileDrop.bind(this)} className='kobo-dropzone kobo-dropzone--form-media'>
                {this.state.fieldsErrors?.base64Encoded && (
                  <InlineMessage type='error' icon='alert' message={this.state.fieldsErrors?.base64Encoded} />
                )}
                <i className='k-icon k-icon-upload' />
                {t('Drag and drop files here')}
                <div className='dropzone-description'>
                  {t('or')} <a>{t('click here to browse')}</a>
                </div>
              </Dropzone>
            )}

            {this.state.isUploadFilePending && (
              <div className='kobo-dropzone kobo-dropzone--form-media'>
                <LoadingSpinner message={t('Uploading file…')} />
              </div>
            )}

            <bem.FormMediaUploadUrl>
              <bem.FormMediaUploadUrl__label>{t('You can also add files using a URL')}</bem.FormMediaUploadUrl__label>

              <bem.FormMediaUploadUrl__form>
                <TextBox
                  type='url'
                  placeholder={t('Paste URL here')}
                  errors={this.state.fieldsErrors?.metadata}
                  value={this.state.inputURL}
                  onChange={this.onInputURLChange}
                />

                <Button
                  type='secondary'
                  size='l'
                  label={t('Add')}
                  onClick={this.onSubmitURL}
                  isDisabled={!this.state.inputURL}
                  isPending={this.state.isUploadURLPending}
                />
              </bem.FormMediaUploadUrl__form>
            </bem.FormMediaUploadUrl>
          </bem.FormMedia__upload>

          <bem.FormMedia__list>
            <bem.FormMedia__label>{t('Attached files')}</bem.FormMedia__label>

            <ul>
              {(!this.state.isInitialised || this.state.isUploadFilePending || this.state.isUploadURLPending) && (
                <bem.FormMedia__listItem>
                  <LoadingSpinner message={t('loading media')} />
                </bem.FormMedia__listItem>
              )}

              {this.state.isInitialised && !this.state.uploadedAssets.length && (
                <bem.FormMedia__listItem>{t('No files uploaded yet')}</bem.FormMedia__listItem>
              )}

              {this.state.uploadedAssets.map((item, n) => (
                <bem.FormMedia__listItem key={n}>
                  {this.renderIcon(item)}

                  {this.renderFileName(item)}

                  <Button
                    type='secondary-danger'
                    size='m'
                    startIcon='trash'
                    onClick={(evt) => this.onDeleteMedia(evt, item.url)}
                  />
                </bem.FormMedia__listItem>
              ))}
            </ul>
          </bem.FormMedia__list>
        </bem.FormMedia>
      </bem.FormView>
    )
  }
}

export default FormMedia
