import React from 'react';
import autoBind from 'react-autobind';
import MultiCheckbox from 'js/components/common/multiCheckbox';
import {bem} from 'js/bem';
import {actions} from 'js/actions';
import {LoadingSpinner} from 'js/ui';

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
 * @prop {function} triggerParentLoading - triggers loading on parent modal
 * @prop {function} generateColumnFilters - generates columns for multicheckbox
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
      isInitalised: false,
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
      actions.dataShare.attachToParent.failed.listen(
        this.stopLoading
      ),
      actions.dataShare.patchParent.completed.listen(
        this.onPatchParentCompleted
      ),
      actions.dataShare.patchParent.failed.listen(
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
      response.data_sharing?.fields?.length > 0
    ) {
      this.setState({
        isInitialised: true,
        columnsToDisplay: this.props.generateColumnFilters(
          this.props.fields,
          response.data_sharing.fields,
        ),
      });
    } else {
      // empty `fields` implies all parent questions are exposed
      this.setState({
        isInitialised: true,
        columnsToDisplay: this.props.generateColumnFilters(
          this.props.fields,
          response.content.survey,
        ),
      });
    }
  }
  onPatchParentCompleted(response) {
    this.setState({
      isLoading: false,
      columnsToDisplay: this.props.generateColumnFilters(
        this.props.fields,
        response.fields,
      ),
    });
    this.props.onModalClose();
  }
  stopLoading() {
    this.setState({isLoading: false});
  }

  onColumnSelected(newList) {
    this.setState({columnsToDisplay: newList});
  }

  onSubmit(evt) {
    evt.preventDefault();
    this.setState({isLoading: true});
    this.props.triggerParentLoading();

    const fields = [];
    let data = '';

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
  }

  render() {
    return (
      <bem.FormModal__form m='data-attachment-columns'>
        <div className='header'>
          <span className='modal-description'>
            {t('You are about to import ##PARENT_NAME##. Select or deselect in the list below to narrow down the number of questions to import.').replace('##PARENT_NAME##', this.props.parent.name)}
          </span>

          <div className='bulk-options'>
            <span className='bulk-options__description'>
              {t('Select below the questions you want to import')}
            </span>

            <div className='bulk-options__buttons'>
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

        {!this.state.isInitialised &&
          <LoadingSpinner message={t('Loading imported questions')} />
        }

        <MultiCheckbox
          items={this.state.columnsToDisplay}
          onChange={this.onColumnSelected}
          disabled={this.state.isLoading}
        />

        {this.state.isLoading &&
          <LoadingSpinner message={t('Loading imported questions')} />
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

export default dataAttachmentColumnsForm;
