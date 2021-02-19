import React from 'react';
import autoBind from 'react-autobind';
import assetUtils from 'js/assetUtils';
import MultiCheckbox from '../multiCheckbox';
import {bem} from 'js/bem';
import {actions} from 'js/actions';

/**
 * The content of the DATA_ATTACHMENT_COLUMNS modal
 *
 * @prop {function} onSetModalTitle - for changing the modal title by this component
 * @prop {function} onModalClose - causes the modal to close
 * @prop {function} triggerLoading - causes parent modal to show loading
 * @prop {object} parent - selected parent's asset
 * @prop {string} fileName
 * @prop {fields[]} fields - available columns exposed to child
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
    this.setState({columnsToDisplay: this.generateColumnFilters()})
    this.unlisteners.push(
      actions.dataShare.attachToParent.completed.listen(
        this.onAttachToParentCompleted
      ),
    );
    this.setModalTitle();
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  setModalTitle() {
    this.props.onSetModalTitle(
      t('Import data from ##PARENT_NAME##').replace('##PARENT_NAME##', this.props.parent.name)
    );
  }

  onColumnSelected(newList) {
    this.setState({columnsToDisplay: newList});
  }

  onSubmit(evt) {
    evt.preventDefault();
    let fields = this.state.columnsToDisplay.map((item) => {
      if (item.checked) {
        return item.label;
      }
    });
    var data = JSON.stringify({
      parent: this.props.parent.url,
      fields: fields,
      filename: this.props.filename,
    });
    actions.dataShare.attachToParent(this.props.asset.uid, data);
    this.setState({isLoading: true});
  }

  generateColumnFilters() {
    // We assume parent fields will be populated if they enabled data sharing
    return this.props.parent.data_sharing.fields.map((item) => {
      return {label: item, checked: true};
    });
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
              <a onClick={this.bulkSelect}>
                {t('select all')}
              </a>
              <span>
                {t('|')}
              </span>
              <a onClick={this.bulkDeselect}>
                {t('deselect all')}
              </a>
            </div>
          </div>
        </div>
        <div className='checkbox-wrapper'>
          <MultiCheckbox
            items={this.state.columnsToDisplay}
            onChange={this.onColumnSelected}
          />
        </div>
        <footer className='modal__footer'>
          <bem.KoboButton
            m='blue'
            type='submit'
            onClick={this.onSubmit}
            disabled={this.state.isPending}
          >
            {t('Accept')}
          </bem.KoboButton>
        </footer>
      </bem.FormModal__form>
    );
  }
}

export default dataAttachmentColumnsForm;
