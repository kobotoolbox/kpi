import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import {observer} from 'mobx-react';
import Dropzone from 'react-dropzone';
import WrappedSelect from 'js/components/common/wrappedSelect';
import bem from 'js/bem';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import sessionStore from 'js/stores/session';
import mixins from 'js/mixins';
import {withRouter} from 'js/router/legacy';
import {renderBackButton} from './modalHelpers';
import {validFileTypes} from 'utils';
import {ASSET_TYPES} from 'js/constants';

const DESIRED_TYPES = [
  {
    value: ASSET_TYPES.block.id,
    label: ASSET_TYPES.block.label,
  },
  {
    value: ASSET_TYPES.template.id,
    label: ASSET_TYPES.template.label,
  },
];

/**
 * @prop {function} onSetModalTitle
 * @prop {file} [file] optional preloaded file
 */
const LibraryUploadForm = observer(class LibraryUploadForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isPending: false,
      // default is block
      desiredType: DESIRED_TYPES[0],
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

  onDesiredTypeChange(newValue) {
    this.setState({desiredType: newValue});
  }

  onSubmit(evt) {
    evt.preventDefault();
    this.setState({isPending: true});
    this.dropFiles(
      [this.state.currentFile],
      [],
      evt,
      {desired_type: this.state.desiredType.value}
    );
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
              <WrappedSelect
                label={t('Choose desired type')}
                value={this.state.desiredType}
                onChange={this.onDesiredTypeChange}
                options={DESIRED_TYPES}
                isLimitedHeight
              />
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

          <bem.KoboButton
            m='blue'
            type='submit'
            onClick={this.onSubmit}
            disabled={!this.isSubmitEnabled()}
          >
            {t('Upload')}
          </bem.KoboButton>
        </bem.Modal__footer>
      </bem.FormModal__form>
    );
  }
});

reactMixin(LibraryUploadForm.prototype, mixins.droppable);

export default withRouter(LibraryUploadForm);
