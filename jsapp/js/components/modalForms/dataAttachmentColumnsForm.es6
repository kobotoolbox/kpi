import React from 'react';
import autoBind from 'react-autobind';
import assetUtils from 'js/assetUtils';
import MultiCheckbox from '../multiCheckbox';
import {bem} from 'js/bem';
import {actions} from 'js/actions';

/**
 * Attributes from parent needed to generate `columnsToDisplay`
 *
 * @namespace parentAttributes
 * @prop {string} uid
 * @prop {string} name
 * @prop {string} url
 */

/**
 * The content of the DATA_ATTACHMENT_COLUMNS modal
 *
 * @prop {function} onSetModalTitle - for changing the modal title by this component
 * @prop {function} onModalClose - causes the modal to close
 * @prop {function} triggerLoading - causes parent modal to show loading
 * @prop {function} generateAvailableColumns - generates columns for multicheckbox
 * @prop {object} asset - current asset
 * @prop {parentAttributes} parent
 * @prop {string} fileName
 * @prop {string[]} fields - child selected fields
 * @prop {string} attachmentUrl - if exists, we are patching an existing attachment
                                  otherwise, this is a new import
 */
class dataAttachmentColumnsForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isLoading: false,
      columnsToDisplay: [],
    };
    autoBind(this);
    this.unlisteners = [];
  }

  componentDidMount() {
    // We must query for parent's asset content in order to display their
    // available columns
    actions.resources.loadAsset({id: this.props.parent.uid});

    this.unlisteners.push(
      actions.dataShare.attachToParent.completed.listen(
        this.onAttachToParentCompleted
      ),
      actions.dataShare.patchParent.completed.listen(
        this.onPatchParentCompleted
      ),
      actions.resources.loadAsset.completed.listen(
        this.onLoadAssetContentCompleted
      ),
    );
    this.setModalTitle();
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  setModalTitle() {
    this.props.onSetModalTitle(
      t('Import data from ##PARENT_NAME##')
        .replace('##PARENT_NAME##', this.props.parent.name)
    );
  }

  onAttachToParentCompleted() {
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
      response.data_sharing.fields !== undefined &&
      response.data_sharing.fields.length > 0
    ) {
      this.setState({
        columnsToDisplay: this.generateColumnFilters(
          response.data_sharing.fields
        ),
      });
    } else {
      // empty `fields` implies all parent questions are exposed
      this.setState({
        columnsToDisplay: this.generateColumnFilters(
          this.props.generateAvailableColumns(response.content.survey)
        ),
      });
    }
  }
  onPatchParentCompleted(response) {
    this.setState({
      isLoading: false,
      columnsToDisplay: this.generateColumnFilters(
        response.fields
      ),
    });
    this.props.onModalClose();
  }

  onColumnSelected(newList) {
    this.setState({columnsToDisplay: newList});
  }

  onSubmit(evt) {
    evt.preventDefault();

    let fields = [];
    var data = '';

    this.state.columnsToDisplay.map((item) => {
      if (item.checked) {
        fields.push(item.label);
      }
    });

    if (this.props.attachmentUrl) {
      data = JSON.stringify({
        fields: fields,
        filename: this.props.filename,
      });
      actions.dataShare.patchParent(this.props.attachmentUrl, data);
    } else {
      data = JSON.stringify({
        parent: this.props.parent.url,
        fields: fields,
        filename: this.props.filename,
      });
      actions.dataShare.attachToParent(this.props.asset.uid, data);
    }
    this.setState({isLoading: true});
  }

  generateColumnFilters(fields) {
    // Empty child fields implies import all questions
    if (this.props.fields.length == 0 || this.props.fields.length == fields.length) {
      return fields.map((item) => {
        return {label: item, checked: true};
      });
    } else if (this.props.fields.length !== fields.length) {
      return fields.map((item) => {
        return {label: item, checked: this.props.fields.includes(item)};
      });
    }
  }

  render() {
    return (
      <bem.FormModal__form m='data-attachment-columns'>
        <div className='header'>
          <span className='modal-description'>
            {t('You are about to import ##PARENT_NAME##. Select or deselect in the list below to narrow down the number of questions to import.').replace('##PARENT_NAME##', this.props.parent.name)}
          </span>
          <div className='bulk-options-wrapper'>
            <span className='bulk-description'>
              {t('Select below the questions you want to import')}
            </span>
            <div className='bulk-options'>
              <a onClick={this.onBulkSelect}>
                {t('select all')}
              </a>
              <span>
                {t('|')}
              </span>
              <a onClick={this.onBulkDeselect}>
                {t('deselect all')}
              </a>
            </div>
          </div>
        </div>
        <MultiCheckbox
          items={this.state.columnsToDisplay}
          onChange={this.onColumnSelected}
        />
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

export default dataAttachmentColumnsForm;
