import React from 'react';
import autoBind from 'react-autobind';
import alertify from 'alertifyjs';
import Dropzone from 'react-dropzone';
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
      uploadedAssets: null
    };

    autoBind(this);
  }

  /*
   * setup
   */

  componentDidMount() {
    this.refreshFormMedia();
  }

  refreshFormMedia() {
    dataInterface.getFormMedia(this.props.asset.uid).done((uploadedAssets) => {
      this.setState({uploadedAssets: uploadedAssets.results});
    });
  }

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

  onFileDrop(files) {
    if (files.length >= 1) {
      files.forEach(async (file) => {
        var base64File = await this.toBase64(file);
	    var formMediaJSON = {
	      description: 'default',
          file_type: 'form_media',
          metadata: JSON.stringify({filename: file.name}),
	      base64Encoded: base64File
	    };
	    dataInterface.postFormMedia(this.props.asset.uid, formMediaJSON).done(() => {
          this.refreshFormMedia();
	    }).fail((err) => {
          var backendErrorText = (err.responseJSON.base64Encoded != undefined) ? err.responseJSON.base64Encoded[0] : err.statusText;
          if (backendErrorText === FILE_ALREADY_EXISTS_UPLOAD_ERROR) {
            alertify.error(t('File already exists!'));
          // back end checks for valid base64 encoded string first
          } else if (backendErrorText === BAD_UPLOAD_MEDIA_ENCODING_ERROR) {
            alertify.error(t('Your uploaded media does not contain base64 valid content. Please check your media content.'));
          } else if (
              backendErrorText === BAD_UPLOAD_MEDIA_TYPE_ERROR ||
              backendErrorText === GENERIC_BAD_UPLOAD_MEDIA_ENCODING_ERROR
            ) {
              alertify.error(t('Your uploaded media does not contain one of our supported MIME filetypes: `image`, `audio`, `video`, `text/csv`, `application/xml`'));
          } else if (backendErrorText === INTERNAL_SERVER_ERROR) {
            alertify.error(t('File could not be uploaded!'));
          }
	    });
      });
    }
  }

  onSubmitURL() {
    var urlInputField = $(document).find('input.form-media__url-input').eq(0);
    var url = urlInputField.val();

    // Clear the url field
    urlInputField.val('');

    if (url === '') {
      alertify.warning(t('URL is empty!'));
    } else {
      var formMediaJSON = {
        description: 'default',
        file_type: 'form_media',
        metadata: JSON.stringify({redirect_url: url}),
      };
      dataInterface.postFormMedia(this.props.asset.uid, formMediaJSON).done(() => {
        dataInterface.getFormMedia(this.props.asset.uid).done((uploadedAssets) => {
          this.setState({uploadedAssets: uploadedAssets.results});
        });
      }).fail((err) => {
        var backendErrorText = (err.responseJSON != undefined) ? err.responseJSON.metadata[0] : err.statusText;
        if (backendErrorText === BAD_URL_ERROR) {
          alertify.warning(t('The URL you entered is not valid'));
        } else if (backendErrorText === FILE_ALREADY_EXISTS_URL_ERROR ) {
          alertify.error(t('File already exists!'));
        } else if (backendErrorText === BAD_URL_MEDIA_TYPE_ERROR) {
          alertify.error(t('Your URL media does not contain one of our supported MIME filetypes: `image`, `audio`, `video`, `text/csv`, `application/xml`'));
        } else if (backendErrorText === INTERNAL_SERVER_ERROR) {
          alertify.error(t('Your URL media failed to upload!'));
        }
      });
    }
  }

  removeMedia(url) {
    dataInterface.deleteFormMedia(url).done(() => {
      this.refreshFormMedia();
    }).fail(() => {
      alertify.error(t('Failed to delete media!'));
    });
  }

  /*
   * rendering
   */

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
          <div className='form-media__upload-url'>
            <label className='form-media__label'>{t('You can also add files using a URL')}</label>
            <input className='form-media__url-input' placeholder={t('Paste URL here')}/><button className='mdl-button mdl-button--raised mdl-button--colored form-media__url-button'>{t('ADD')}</button>
          </div>
        </div>

        <div className='form-media__file-list'>
          <label className='form-media__list-label'>{t('File(s) uploaded to this project')}</label>
            <ul>
              {this.state.uploadedAssets !== null && this.state.uploadedAssets.map((item, n) => {
                return (
                  <li key={n} className='form-media__list-item'>
                    {this.renderIcon(item)}
                    {this.renderFileName(item)}
                    <i className='k-icon-trash' onClick={() => this.removeMedia(item.url)}/>
                  </li>
                );
              })}
              {(this.state.uploadedAssets === null || this.state.uploadedAssets.length == 0) &&
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
