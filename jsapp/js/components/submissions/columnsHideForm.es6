import React from 'react';
import autoBind from 'react-autobind';
import Fuse from 'fuse.js';
import {bem} from 'js/bem';
import ToggleSwitch from 'js/components/common/toggleSwitch';
import TextBox from 'js/components/common/textBox';
import {
  getColumnLabel,
  getAllColumns,
  getSelectedColumns,
} from 'js/components/submissions/tableUtils';
import tableStore from 'js/components/submissions/tableStore';
import {FUSE_OPTIONS} from 'js/constants';
import './columnsHideDropdown.scss';

/**
 * @prop {object} asset
 * @prop {object[]} submissions
 * @prop {boolean} showGroupName
 * @prop {number} translationIndex
 */
class ColumnsHideForm extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      isPending: false, // for saving
      filterPhrase: '',
      allColumns: [], // {object[]}
      selectedColumns: [], // {string[]}
    };
    autoBind(this);
  }

  componentDidMount() {
    const allColumnsIds = [...getAllColumns(this.props.asset, this.props.submissions)];

    const allColumns = [];
    allColumnsIds.forEach((fieldId) => {
      allColumns.push({
        fieldId: fieldId,
        label: getColumnLabel(
          this.props.asset.content.survey,
          fieldId,
          this.props.showGroupName,
          this.props.translationIndex,
        ),
      });
    });

    this.setState({
      allColumns: allColumns,
      selectedColumns: getSelectedColumns(this.props.asset) || allColumnsIds,
    });
  }

  onReset() {
    console.log('onReset');
    tableStore.showAllFields();
  }

  onApply() {
    console.log('onApply');
    tableStore.setFieldsVisibility(this.props.submissions, this.state.selectedColumns);
  }

  onFieldToggleChange(fieldId, isSelected) {
    let newSelectedColumns = [...this.state.selectedColumns];
    if (isSelected) {
      newSelectedColumns.push(fieldId);
    } else {
      newSelectedColumns.splice(newSelectedColumns.indexOf(fieldId), 1);
    }
    this.setState({selectedColumns: newSelectedColumns});
  }

  onFilterPhraseChange(newPhrase) {
    this.setState({filterPhrase: newPhrase});
  }

  getFilteredFieldsList() {
    if (this.state.filterPhrase !== '') {
      let fuse = new Fuse(this.state.allColumns, {...FUSE_OPTIONS, keys: ['fieldId', 'label']});
      return fuse.search(this.state.filterPhrase);
    }
    return this.state.allColumns;
  }

  render() {
    const filteredFieldsList = this.getFilteredFieldsList();
    return (
      <React.Fragment>
        <header>warning message</header>

        <TextBox
          value={this.state.filterPhrase}
          onChange={this.onFilterPhraseChange}
          placeholder={t('Find a field')}
        />

        {filteredFieldsList.map((fieldObj) => {
          // fieldObj can be either one of allColumns or a fuse result object
          let fieldId = fieldObj.fieldId || fieldObj.item.fieldId;
          let label = fieldObj.label || fieldObj.item.label;
          return (
            <div key={fieldId}>
              <ToggleSwitch
                checked={this.state.selectedColumns.includes(fieldId)}
                onChange={this.onFieldToggleChange.bind(this, fieldId)}
                label={label}
              />
            </div>
          );
        })}

        {filteredFieldsList.length === 0 &&
          t('No results')
        }

        <footer>
          <bem.KoboLightButton m='red' onClick={this.onReset}>
            {t('Reset')}
          </bem.KoboLightButton>

          <bem.KoboLightButton m='blue' onClick={this.onApply}>
            {t('Apply')}
          </bem.KoboLightButton>
        </footer>
      </React.Fragment>
    );
  }
}

export default ColumnsHideForm;
