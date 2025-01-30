import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import {observer} from 'mobx-react';
import Dropzone from 'react-dropzone';
import Checkbox from 'js/components/common/checkbox';
import bem from 'js/bem';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import sessionStore from 'js/stores/session';
import mixins from 'js/mixins';
import {withRouter} from 'js/router/legacy';
import {renderBackButton} from './modalHelpers';
import {validFileTypes} from 'utils';
import {ASSET_TYPES} from 'js/constants';
import envStore from 'js/envStore';
import Button from 'js/components/common/button';

/**
 * @prop {function} onSetModalTitle
 * @prop {file} [file] optional preloaded file
 */
const LibraryUploadForm = observer(class LibraryUploadForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isPending: false,
      isUploadAsTemplateChecked: false,
      currentFile: this.props.file || null,
    };

    autoBind(this);
  }

  isSubmitEnabled() {
    return (
      !this.state.isPending &&
      this.state.currentFile !== null
    );
  }

  onFileDrop(files) {
    if (files[0]) {
      this.setState({currentFile: files[0]});
    }
  }

  onUploadAsTemplateChange(isChecked) {
    this.setState({isUploadAsTemplateChecked: isChecked});
  }

  onSubmit(evt) {
    evt.preventDefault();
    // The modal will be closed from outside this component upon successful
    // import, thus we never set it back to `false` here.
    // TODO: This should be improved, but we should migrate the modal to using
    // new `KoboModal` component first.
    this.setState({isPending: true});

    // Only pass desired type if user wants to upload as template. Back-end code
    // will create either a block, or a collection - based on the file content.
    const options = {};
    if (this.state.isUploadAsTemplateChecked) {
      options.desired_type = ASSET_TYPES.template.id;
    }

    this.dropFiles([this.state.currentFile], [], evt, options);
  }

  render() {
    if (!sessionStore.isLoggedIn) {
      return (<LoadingSpinner/>);
    }

    return (
      <bem.FormModal__form className='project-settings'>
        <bem.Modal__subheader>
          {t('Import an XLSForm from your computer.')}
        </bem.Modal__subheader>

        {!this.state.isPending &&
          <React.Fragment>
            <bem.FormModal__item>
              <Dropzone
                onDrop={this.onFileDrop.bind(this)}
                multiple={false}
                className='dropzone'
                activeClassName='dropzone-active'
                rejectClassName='dropzone-reject'
                accept={validFileTypes()}
              >
                <i className='k-icon k-icon-file-xls' />
                {this.state.currentFile &&
                  this.state.currentFile.name
                }
                {!this.state.currentFile &&
                  t(' Drag and drop the XLSForm file here or click to browse')
                }
              </Dropzone>
            </bem.FormModal__item>

            <bem.FormModal__item>
              <Checkbox
                checked={this.state.is}
                disabled={this.state.isPending}
                onChange={this.onUploadAsTemplateChange.bind(this)}
                label={t('Upload as template')}
              />

              <small>
                {t('Note that this will be ignored when uploading a collection file.')}
                {' '}
                <a
                  href={
                    envStore.data.support_url +
                    'question_library.html#importing-collections'
                  }
                  target='_blank'
                >
                  {t('Learn more')}
                </a>
              </small>
            </bem.FormModal__item>
          </React.Fragment>
        }
        {this.state.isPending &&
          <div className='dropzone'>
            <LoadingSpinner message={t('Uploading file…')}/>
          </div>
        }

        <bem.Modal__footer>
          {renderBackButton(this.state.isPending)}

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
    );
  }
});

reactMixin(LibraryUploadForm.prototype, mixins.droppable);

export default withRouter(LibraryUploadForm);
