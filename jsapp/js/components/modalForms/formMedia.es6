import React from 'react';
import autoBind from 'react-autobind';
import alertify from 'alertifyjs';
import Dropzone from 'react-dropzone';
import {bem} from 'js/bem';
import {dataInterface} from 'js/dataInterface';
import {
  t,
} from 'js/utils';
import {
} from 'js/constants';

/*
Modal for uploading form media, part of #2487.
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
	    dataInterface.postFormMedia(this.props.asset.uid, formMediaJSON).done((res) => {
          this.refreshFormMedia();
	    }).fail((err) => {
	      alertify.error(err.responseText);
	    });
      });
    }
  }

//TODO: Figure out a way to import from URL
/* async onSubmitURL() {
 *   var url = $(document).find('input.form-media__url-input').eq(0).val();
 *   var formMediaJSON = {
 *     description: 'default',
 *     file_type: 'form_media',
 *     metadata: JSON.stringify({filename: 'default'}),
 *     content: url
 *   };
 *   dataInterface.postFormMedia(this.props.asset.uid, formMediaJSON).done(() => {
 *     dataInterface.getFormMedia(this.props.asset.uid).done((uploadedAssets) => {
 *       this.setState({uploadedAssets: uploadedAssets.results});
 *     });
 *   }).fail((err) => {
 *     alertify.error(err.responseText);
 *   });
 * }
 */

  removeMedia(url) {
      dataInterface.deleteFormMedia(url).done((res) => {
        this.refreshFormMedia();
      }).fail((err) => {
        alertify.error(err.responseText);
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
                    <i className='form-media__file-type fa fa-file'/>
                    <a href={item.content}>{item.metadata.filename}</a>
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
