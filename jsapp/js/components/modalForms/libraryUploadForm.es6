import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import Dropzone from 'react-dropzone';
import Select from 'react-select';
import bem from 'js/bem';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {stores} from 'js/stores';
import mixins from 'js/mixins';
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
class LibraryUploadForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isSessionLoaded: !!stores.session.isLoggedIn,
      isPending: false,
      // default is block
      desiredType: DESIRED_TYPES[0],
      currentFile: this.props.file || null,
    };

    autoBind(this);
  }

  componentDidMount() {
    this.listenTo(stores.session, () => {
      this.setState({isSessionLoaded: true});
    });
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
    if (!this.state.isSessionLoaded) {
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
                <i className='k-icon k-icon-xls-file' />
                {this.state.currentFile &&
                  this.state.currentFile.name
                }
                {!this.state.currentFile &&
                  t(' Drag and drop the XLSForm file here or click to browse')
                }
              </Dropzone>
            </bem.FormModal__item>

            <bem.FormModal__item>
              <label htmlFor='desired-type'>
                {t('Choose desired type')}
              </label>

              <Select
                id='desired-type'
                value={this.state.desiredType}
                onChange={this.onDesiredTypeChange}
                options={DESIRED_TYPES}
                className='kobo-select'
                classNamePrefix='kobo-select'
                menuPlacement='auto'
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
}

reactMixin(LibraryUploadForm.prototype, Reflux.ListenerMixin);
reactMixin(LibraryUploadForm.prototype, mixins.droppable);
LibraryUploadForm.contextTypes = {router: PropTypes.object};

export default LibraryUploadForm;
