import React from 'react';
import Fuse from 'fuse.js';
import bem, {makeBem} from 'js/bem';
import {actions} from 'js/actions';
import ToggleSwitch from 'js/components/common/toggleSwitch';
import TextBox from 'js/components/common/textBox';
import {getColumnLabel} from 'js/components/submissions/tableUtils';
import tableStore from 'js/components/submissions/tableStore';
import {FUSE_OPTIONS} from 'js/constants';
import koboDropdownActions from 'js/components/common/koboDropdownActions';
import type {AssetResponse, SubmissionResponse} from 'js/dataInterface';
import './columnsHideDropdown.scss';
import Button from 'js/components/common/button';

bem.ColumnsHideForm = makeBem(null, 'columns-hide-form', 'section');
bem.ColumnsHideForm__message = makeBem(bem.ColumnsHideForm, 'message', 'p');
bem.ColumnsHideForm__list = makeBem(bem.ColumnsHideForm, 'list', 'ul');
bem.ColumnsHideForm__listItem = makeBem(bem.ColumnsHideForm, 'list-item', 'li');
bem.ColumnsHideForm__footer = makeBem(bem.ColumnsHideForm, 'footer', 'footer');

export interface ColumnsHideFormProps {
  asset: AssetResponse;
  submissions: SubmissionResponse[];
  showGroupName: boolean;
  translationIndex: number;
}

interface ColumnsHideColumn {
  fieldId: string;
  label: string;
}

interface ColumnsHideFormState {
  isPending: boolean;
  filterPhrase: string;
  allColumns: ColumnsHideColumn[];
  selectedColumns: string[];
}

class ColumnsHideForm extends React.Component<
  ColumnsHideFormProps,
  ColumnsHideFormState
> {
  private unlisteners: Function[] = [];

  constructor(props: ColumnsHideFormProps) {
    super(props);
    this.state = {
      isPending: false, // for saving
      filterPhrase: '',
      allColumns: [], // {object[]}
      selectedColumns: [], // {string[]}
    };
  }

  componentDidMount() {
    this.unlisteners.push(
      actions.table.updateSettings.completed.listen(
        this.onTableUpdateSettingsCompleted.bind(this)
      )
    );
    this.prepareColumns();
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb();
    });
  }

  prepareColumns() {
    const allColumnsIds = [
      ...tableStore.getHideableColumns(this.props.submissions),
    ];

    const allColumns: ColumnsHideColumn[] = [];
    allColumnsIds.forEach((fieldId) => {
      allColumns.push({
        fieldId: fieldId,
        label: getColumnLabel(
          this.props.asset,
          fieldId,
          this.props.showGroupName,
          this.props.translationIndex
        ),
      });
    });

    this.setState({
      allColumns: allColumns,
      selectedColumns: tableStore.getSelectedColumns() || allColumnsIds,
    });
  }

  onTableUpdateSettingsCompleted() {
    koboDropdownActions.hideAnyDropdown();
  }

  onReset() {
    this.setState({isPending: true});
    tableStore.showAllFields();
  }

  onApply() {
    this.setState({isPending: true});
    tableStore.setFieldsVisibility(
      this.props.submissions,
      this.state.selectedColumns
    );
  }

  onFieldToggleChange(fieldId: string, isSelected: boolean) {
    let newSelectedColumns = [...this.state.selectedColumns];
    if (isSelected) {
      newSelectedColumns.push(fieldId);
    } else {
      newSelectedColumns.splice(newSelectedColumns.indexOf(fieldId), 1);
    }
    this.setState({selectedColumns: newSelectedColumns});
  }

  onFilterPhraseChange(newPhrase: string) {
    this.setState({filterPhrase: newPhrase});
  }

  getFilteredFieldsList(): ColumnsHideColumn[] {
    if (this.state.filterPhrase !== '') {
      const fuse = new Fuse(this.state.allColumns, {
        ...FUSE_OPTIONS,
        keys: ['fieldId', 'label'],
      });
      const fuseResults = fuse.search(this.state.filterPhrase);
      return fuseResults.map((fuseResult) => ({
        fieldId: fuseResult.item.fieldId,
        label: fuseResult.item.label,
      }));
    }
    return this.state.allColumns;
  }

  render() {
    const filteredFieldsList = this.getFilteredFieldsList();
    return (
      <bem.ColumnsHideForm>
        <bem.ColumnsHideForm__message>
          {t('These settings affects the experience for all project users.')}
        </bem.ColumnsHideForm__message>

        <TextBox
          value={this.state.filterPhrase}
          onChange={this.onFilterPhraseChange.bind(this)}
          placeholder={t('Find a field')}
        />

        {filteredFieldsList.length !== 0 && (
          <bem.ColumnsHideForm__list dir='auto'>
            {filteredFieldsList.map((fieldObj) => {
              return (
                <bem.ColumnsHideForm__listItem key={fieldObj.fieldId}>
                  <ToggleSwitch
                    checked={this.state.selectedColumns.includes(
                      fieldObj.fieldId
                    )}
                    onChange={(isSelected: boolean) => {
                      this.onFieldToggleChange(fieldObj.fieldId, isSelected);
                    }}
                    disabled={this.state.isPending}
                    label={fieldObj.label}
                  />
                </bem.ColumnsHideForm__listItem>
              );
            })}
          </bem.ColumnsHideForm__list>
        )}

        {filteredFieldsList.length === 0 && (
          <bem.ColumnsHideForm__message>
            {t('No results')}
          </bem.ColumnsHideForm__message>
        )}

        <bem.ColumnsHideForm__footer>
          <Button
            type='secondary-danger'
            size='s'
            isFullWidth
            onClick={this.onReset.bind(this)}
            isPending={this.state.isPending}
            label={t('Reset')}
          />

          <Button
            type='secondary'
            size='s'
            isFullWidth
            onClick={this.onApply.bind(this)}
            isPending={this.state.isPending}
            label={t('Apply')}
          />
        </bem.ColumnsHideForm__footer>
      </bem.ColumnsHideForm>
    );
  }
}

export default ColumnsHideForm;
