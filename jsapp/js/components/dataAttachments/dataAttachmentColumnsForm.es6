import React from 'react';
import autoBind from 'react-autobind';
import dataAttachmentsUtils from 'js/components/dataAttachments/dataAttachmentsUtils';
import MultiCheckbox from 'js/components/common/multiCheckbox';
import bem from 'js/bem';
import {actions} from 'js/actions';
import LoadingSpinner from 'js/components/common/loadingSpinner';

/**
 * Attributes from source needed to generate `columnsToDisplay`
 *
 * @namespace sourceAttributes
 * @prop {string} uid
 * @prop {string} name
 * @prop {string} url
 */

/**
 * The content of the DATA_ATTACHMENT_COLUMNS modal
 *
 * @prop {function} onSetModalTitle - for changing the modal title by this component
 * @prop {function} onModalClose - causes the modal to close
 * @prop {object} asset - current asset
 * @prop {sourceAttributes} source
 * @prop {string} fileName
 * @prop {string[]} fields - selected fields to retrieve from source
 * @prop {string} attachmentUrl - if exists, we are patching an existing attachment
                                  otherwise, this is a new import
 */
class DataAttachmentColumnsForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isInitalised: false,
      isLoading: false,
      columnsToDisplay: [],
    };
    autoBind(this);
    this.unlisteners = [];
  }

  componentDidMount() {
    // We must query for source's asset content in order to display their
    // available columns

    // TODO: See if we can simplify this to only call this if props does not
    // have any connected questions
    actions.resources.loadAsset({id: this.props.source.uid});

    this.unlisteners.push(
      actions.dataShare.attachToSource.started.listen(
        this.markComponentAsLoading
      ),
      actions.dataShare.attachToSource.completed.listen(
        this.onAttachToSourceCompleted
      ),
      actions.dataShare.attachToSource.failed.listen(
        this.stopLoading
      ),
      actions.dataShare.patchSource.started.listen(
        this.markComponentAsLoading
      ),
      actions.dataShare.patchSource.completed.listen(
        this.onPatchSourceCompleted
      ),
      actions.dataShare.patchSource.failed.listen(
        this.stopLoading
      ),
      actions.resources.loadAsset.completed.listen(
        this.onLoadAssetContentCompleted
      ),
      actions.resources.loadAsset.failed.listen(
        this.stopLoading
      ),
    );
    this.setModalTitle();
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  setModalTitle() {
    this.props.onSetModalTitle(
      t('Import data from ##SOURCE_NAME##')
        .replace('##SOURCE_NAME##', this.props.source.name)
    );
  }

  onAttachToSourceCompleted() {
    this.props.onModalClose();
  }
  onBulkSelect() {
    let newList = this.state.columnsToDisplay.map((item) => {
      return {label: item.label, checked: true}
    });
    this.setState({columnsToDisplay: newList})
  }
  onBulkDeselect() {
    let newList = this.state.columnsToDisplay.map((item) => {
      return {label: item.label, checked: false}
    });
    this.setState({columnsToDisplay: newList})
  }
  onLoadAssetContentCompleted(response) {
    if (
      response.data_sharing?.fields?.length > 0
    ) {
      this.setState({
        isInitialised: true,
        columnsToDisplay: dataAttachmentsUtils.generateColumnFilters(
          this.props.fields,
          response.data_sharing.fields,
        ),
      });
    } else {
      // empty `fields` implies all source questions are exposed
      this.setState({
        isInitialised: true,
        columnsToDisplay: dataAttachmentsUtils.generateColumnFilters(
          this.props.fields,
          response.content.survey,
        ),
      });
    }
  }
  onPatchSourceCompleted(response) {
    this.setState({
      isLoading: false,
      columnsToDisplay: dataAttachmentsUtils.generateColumnFilters(
        this.props.fields,
        response.fields,
      ),
    });
    this.props.onModalClose();
  }
  // Actions take care of the error handling for this modal
  stopLoading() {
    this.setState({isLoading: false});
  }

  onColumnSelected(newList) {
    this.setState({columnsToDisplay: newList});
  }

  onSubmit(evt) {
    evt.preventDefault();

    const fields = [];
    let data = '';

    this.state.columnsToDisplay.forEach((item) => {
      if (item.checked) {
        fields.push(item.label);
      }
    });

    if (this.props.attachmentUrl) {
      data = {
        fields: fields,
        filename: this.props.filename,
      };
      actions.dataShare.patchSource(this.props.attachmentUrl, data);
    } else {
      data = {
        source: this.props.source.url,
        fields: fields,
        filename: this.props.filename,
      };
      actions.dataShare.attachToSource(this.props.asset.uid, data);
    }
  }

  markComponentAsLoading() {
    this.setState({isLoading: true});
  }

  render() {
    return (
      // TODO: Use BEM elements
      <bem.FormModal__form m='data-attachment-columns'>
        <div className='header'>
          <span className='modal-description'>
            {t('You are about to import ##SOURCE_NAME##. Select or deselect in the list below to narrow down the number of questions to import.').replace('##SOURCE_NAME##', this.props.source.name)}
          </span>

          <div className='bulk-options'>
            <span className='bulk-options__description'>
              {t('Select below the questions you want to import')}
            </span>

            <div className='bulk-options__buttons'>
              <bem.KoboLightButton
                m='blue'
                onClick={this.onBulkSelect}
              >
                {t('Select all')}
              </bem.KoboLightButton>

              <span>
                {t('|')}
              </span>

              <bem.KoboLightButton
                m='blue'
                onClick={this.onBulkDeselect}
              >
                {t('Deselect all')}
              </bem.KoboLightButton>
            </div>
          </div>
        </div>

        {!this.state.isInitialised &&
          <LoadingSpinner message={t('Loading imported questions')}/>
        }

        <MultiCheckbox
          items={this.state.columnsToDisplay}
          onChange={this.onColumnSelected}
          disabled={this.state.isLoading}
        />

        {this.state.isLoading &&
          <LoadingSpinner message={t('Updating imported questions')}/>
        }

        <footer className='modal__footer'>
          <bem.KoboButton
            m='blue'
            type='submit'
            onClick={this.onSubmit}
            disabled={this.state.isLoading}
          >
            {t('Accept')}
          </bem.KoboButton>
        </footer>

      </bem.FormModal__form>
    );
  }
}

export default DataAttachmentColumnsForm;
