import React from 'react';
import autoBind from 'react-autobind';
import alertify from 'alertifyjs';
import Dropzone from 'react-dropzone';
import {actions} from '../../actions';
import {bem} from 'js/bem';
import {dataInterface} from 'js/dataInterface';

const BAD_URL_ERROR = '`redirect_url` is invalid';
const BAD_URL_MEDIA_TYPE_ERROR = '`redirect_url`: Only `image`, `audio`, `video`, `text/csv`, `application/xml` MIME types are allowed';
const BAD_UPLOAD_MEDIA_ENCODING_ERROR = 'Invalid content'; // `base64Encoded` for invalid base64 encoded string
const BAD_UPLOAD_MEDIA_TYPE_ERROR = 'Only `image`, `audio`, `video`, `text/csv`, `application/xml` MIME types are allowed'
const GENERIC_BAD_UPLOAD_MEDIA_ENCODING_ERROR = 'Bad Request'; // `statusText` for 400 response
const FILE_ALREADY_EXISTS_URL_ERROR = '`redirect_url`: File already exists';
const FILE_ALREADY_EXISTS_UPLOAD_ERROR = 'File already exists';
const INTERNAL_SERVER_ERROR = 'INTERNAL SERVER ERROR'; // `statusText` for a 500 response

/*
 * Modal for uploading form media
 */
class FormMedia extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      uploadedAssets: null,
      // to show loading icon instead of nothing on first load
      isVirgin: true,
      // to show loading icon while uploading any file
      isUploadFilePending: false,
      isUploadURLPending: false
    };

    autoBind(this);
  }

  /*
   * setup
   */

  componentDidMount() {
    const callbacks = {
      onComplete: this.onGetMediaCompleted.bind(this),
      onFail: this.onGetMediaFailed.bind(this)
    };
    actions.media.loadMedia(this.props.asset.uid, callbacks);
    this.setState({isVirgin: false});
  }

  /*
   * action listeners
   */

  onGetMediaCompleted(uploadedAssets) {
    this.setState({
      uploadedAssets: uploadedAssets.results,
      isUploadFilePending: false,
      isUploadURLPending: false
    });
  }

  onGetMediaFailed(response) {
    // TODO do we need to do more than say 'something went wrong'?
  }

  onUploadFailed(response) {
    // TODO handle the bad uploads here. Do something about all those constants
    this.setState({
      isUploadFilePending: false,
      isUploadURLPending: false
    });
  }

  onDeleteMediaFailed(response) {
    // TODO do we need to do more than say 'something went wrong'?
  }

  /*
   * Utilities
   */

  toBase64(file) {
    return new Promise(function(resolve, reject) {
      var reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = function() {
          return resolve(reader.result);
      };
      reader.onerror = function(error) {
          return reject(error);
      };
    });
  }

  uploadMedia(formMediaJSON) {
    const callbacks = {
      onComplete: this.onGetMediaCompleted.bind(this),
      onFail: this.onUploadFailed.bind(this)
    }
    actions.media.uploadMedia(this.props.asset.uid, formMediaJSON, callbacks);
  }

  /*
   * DOM listeners
   */

  onFileDrop(files) {
    if (files.length >= 1) {
      this.setState({isUploadFilePending: true});

      files.forEach(async (file) => {
        var base64File = await this.toBase64(file);
	    var formMediaJSON = {
	      description: 'default',
          file_type: 'form_media',
          metadata: JSON.stringify({filename: file.name}),
	      base64Encoded: base64File
	    };
        this.uploadMedia(formMediaJSON);
      });
    }
  }

  onSubmitURL() {
    var urlInputField = $(document).find('input.form-media__url-input').eq(0);
    var url = urlInputField.val();

    if (url === '') {
      alertify.warning(t('URL is empty!'));
    } else {
      // Clear the url field after submitting
      urlInputField.val('');
      this.setState({isUploadURLPending: true})

      var formMediaJSON = {
        description: 'default',
        file_type: 'form_media',
        metadata: JSON.stringify({redirect_url: url}),
      };
      this.uploadMedia(formMediaJSON);
    }
  }

  onDeleteMedia(url) {
    const callbacks = {
      onComplete: this.onGetMediaCompleted.bind(this),
      onFail: this.onDeleteMediaFailed.bind(this)
    };
    actions.media.deleteMedia(this.props.asset.uid, url, callbacks);
  }

  /*
   * rendering
   */

  renderButton() {
    const buttonClassNames = ['formBuilder-header__button', 'formBuilder-header__button--save'];
    if (this.state.isUploadURLPending) {
      buttonClassNames.push('formBuilder-header__button--savepending');
    }
    return (
      <button className={buttonClassNames.join(' ')}>
        <i />
        {t('ADD')}
      </button>
    );
  }

  renderFileName(item){
    // Check if current item is uploaded vis URL. `redirect_url` is the indicator
    var fileName = item.metadata.filename;
    if (item.metadata.redirect_url) {
      // Shorten URL to exactly 50 chars
      var url = item.metadata.redirect_url;
      var urlBack = url.slice(url.length - 22);
      var urlFront = url.replace('https://', '').replace('http://', '').substr(0, 25);
      fileName = urlFront + '...' + urlBack;
    }

    return (
      <a href={item.content} target='_blank'>{fileName}</a>
    );
  }

  renderIcon(item) {
    const iconClassNames = ['form-media__file-type', 'fa'];
    // Check if current item is uploaded vis URL. `redirect_url` is the indicator
    if (item.metadata.redirect_url) {
      iconClassNames.push('fa-link');
    } else {
      iconClassNames.push('fa-file');
    }

    return (
      <i className={iconClassNames.join(' ')}/>
    );
  }

  renderLoading(message = t('loading…')) {
    return (
      <bem.Loading>
        <bem.Loading__inner>
          <i />
          {message}
        </bem.Loading__inner>
      </bem.Loading>
    );
  }

  render() {
    return (
      <bem.FormModal__form className='project-settings project-settings--upload-file media-settings--upload-file' onSubmit={this.onSubmitURL}>
	    <div className='form-media__upload'>
          {!this.state.isUploadFilePending &&
            <Dropzone
                onDrop={this.onFileDrop.bind(this)}
                className='dropzone'
            >
              <i className='k-icon-upload' />
              {t(' Drag and drop files here')}
              <div className='form-media__desc'>
                {t('or')} <a>{t('click here to browse')}</a>
              </div>
            </Dropzone>
          }
          {this.state.isUploadFilePending &&
            <div className='dropzone'>
              {this.renderLoading(t('Uploading file…'))}
            </div>
          }
          <div className='form-media__upload-url'>
            <label className='form-media__label'>{t('You can also add files using a URL')}</label>
            <input className='form-media__url-input' placeholder={t('Paste URL here')}/>
            {this.renderButton()}
          </div>
        </div>

        <div className='form-media__file-list'>
          <label className='form-media__list-label'>{t('File(s) uploaded to this project')}</label>
            <ul>
              {(this.state.isVirgin || this.state.isUploadFilePending || this.state.isUploadURLPending) &&
                <li className='form-media__default-item form-media__list-item'>
                  {this.renderLoading(t('loading media'))}
                </li>
              }
              {this.state.uploadedAssets !== null && this.state.uploadedAssets.map((item, n) => {
                return (
                  <li key={n} className='form-media__list-item'>
                    {this.renderIcon(item)}
                    {this.renderFileName(item)}
                    <i className='k-icon-trash' onClick={() => this.onDeleteMedia(item.url)}/>
                  </li>
                );
              })}
              {!this.state.isVirgin && (this.state.uploadedAssets === null || this.state.uploadedAssets.length == 0) &&
                <li className='form-media__default-item form-media__list-item'>
                    {t('No files uploaded yet')}
                </li>
              }
            </ul>
        </div>
      </bem.FormModal__form>
    );
  }
}

export default FormMedia;
