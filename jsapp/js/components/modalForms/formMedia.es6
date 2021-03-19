import React from 'react';
import autoBind from 'react-autobind';
import alertify from 'alertifyjs';
import Dropzone from 'react-dropzone';
import TextBox from 'js/components/common/textBox';
import {actions} from '../../actions';
import {bem} from 'js/bem';
import {ASSET_FILE_TYPES} from '../../constants';

/**
 * @prop {object} asset
 *
 * Modal for uploading form media
 */
class FormMedia extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      uploadedAssets: null,
      fieldsErrors: {},
      inputURL: '',
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
    actions.media.loadMedia(this.props.asset.uid);

    actions.media.loadMedia.completed.listen(this.onGetMediaCompleted);
    actions.media.uploadMedia.failed.listen(this.onUploadFailed);
  }

  /*
   * action listeners
   */

  onGetMediaCompleted(uploadedAssets) {
    this.setState({
      uploadedAssets: uploadedAssets.results,
      isUploadFilePending: false,
      isUploadURLPending: false,
      isVirgin: false,
    });
  }

  onUploadFailed(response) {
    this.setState({
      fieldsErrors: response.responseJSON,
      isUploadFilePending: false,
      isUploadURLPending: false
    });
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
    // Reset error message before uploading again
    this.setState({fieldsErrors: {}});
    actions.media.uploadMedia(this.props.asset.uid, formMediaJSON);
  }

  /*
   * DOM listeners
   */

  onFileDrop(files) {
    if (files.length >= 1) {
      this.setState({isUploadFilePending: true});

      files.forEach(async (file) => {
        var base64File = await this.toBase64(file);

        this.uploadMedia({
	      description: 'default',
          file_type: ASSET_FILE_TYPES.form_media.id,
          metadata: JSON.stringify({filename: file.name}),
	      base64Encoded: base64File
	    });
      });
    }
  }

  onInputURLChange(inputURL) {
    this.setState({inputURL: inputURL});
  }

  onSubmitURL() {
    var url = this.state.inputURL;

    if (url === '') {
      alertify.warning(t('URL is empty!'));
    } else {
      this.setState({
        isUploadURLPending: true,
        inputURL: ''
      });

      this.uploadMedia({
        description: 'default',
        file_type: ASSET_FILE_TYPES.form_media.id,
        metadata: JSON.stringify({redirect_url: url}),
      });
    }
  }

  onDeleteMedia(url) {
    actions.media.deleteMedia(this.props.asset.uid, url);
  }

  uploadedAssetsIsEmpty() {
    return (
      this.state.uploadedAssets === null ||
      this.state.uploadedAssets === undefined
    );
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
              {this.state.fieldsErrors.base64Encoded &&
                <bem.FormView__cell m='error'>
                  <i className='k-icon-alert' />
                  <p>{this.state.fieldsErrors.base64Encoded}</p>
                </bem.FormView__cell>
              }
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
            <TextBox
              type='url'
              placeholder={t('Paste URL here')}
              errors={this.state.fieldsErrors.metadata}
              value={this.state.inputURL}
              onChange={this.onInputURLChange}
            />
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
              {!this.uploadedAssetsIsEmpty() &&
                  this.state.uploadedAssets.map((item, n) => {
                    return (
                      <li key={n} className="form-media__list-item">
                        {this.renderIcon(item)}
                        {this.renderFileName(item)}
                        <i
                          className="k-icon-trash"
                          onClick={() => this.onDeleteMedia(item.url)}
                        />
                      </li>
                    );
                  })
              }
              {!this.state.isVirgin &&
                (this.uploadedAssetsIsEmpty() ||
                  this.state.uploadedAssets.length == 0) &&
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
