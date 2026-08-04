import { Box, Group, ScrollArea, Stack } from '@mantine/core'
import Fuse from 'fuse.js'
import React from 'react'
import { actions } from '#/actions'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import ButtonNew from '#/components/common/ButtonNew'
import ToggleSwitch from '#/components/common/toggleSwitch'
import tableStore from '#/components/submissions/tableStore'
import { getColumnLabel } from '#/components/submissions/tableUtils'
import { FUSE_OPTIONS } from '#/constants'
import type { AssetResponse, SubmissionResponse } from '#/dataInterface'
import TextInput from '../common/TextInput'
import Alert from '../common/alert'

export interface ColumnsHideFormProps {
  asset: AssetResponse
  submissions: SubmissionResponse[]
  bulkActions: BulkActionResponse[]
  showGroupName: boolean
  translationIndex: number
}

interface ColumnsHideFormPropsInternal extends ColumnsHideFormProps {
  /** Called when the form is done with its job, so that the wrapping dropdown can close itself. */
  onRequestClose: () => void
}

interface ColumnsHideColumn {
  fieldId: string
  label: string
}

interface ColumnsHideFormState {
  isPending: boolean
  filterPhrase: string
  allColumns: ColumnsHideColumn[]
  selectedColumns: string[]
}

class ColumnsHideForm extends React.Component<ColumnsHideFormPropsInternal, ColumnsHideFormState> {
  private unlisteners: Function[] = []

  constructor(props: ColumnsHideFormPropsInternal) {
    super(props)
    this.state = {
      isPending: false, // for saving
      filterPhrase: '',
      allColumns: [], // {object[]}
      selectedColumns: [], // {string[]}
    }
  }

  componentDidMount() {
    this.unlisteners.push(actions.table.updateSettings.completed.listen(this.onTableUpdateSettingsCompleted.bind(this)))
    this.prepareColumns()
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {
      clb()
    })
  }

  prepareColumns() {
    const allColumnsIds = [
      ...tableStore.getHideableColumns(this.props.asset, this.props.submissions, this.props.bulkActions),
    ]

    const allColumns: ColumnsHideColumn[] = []
    allColumnsIds.forEach((fieldId) => {
      allColumns.push({
        fieldId: fieldId,
        label: getColumnLabel(this.props.asset, fieldId, this.props.showGroupName, this.props.translationIndex),
      })
    })

    this.setState({
      allColumns: allColumns,
      selectedColumns: tableStore.getSelectedColumns() || allColumnsIds,
    })
  }

  onTableUpdateSettingsCompleted() {
    this.props.onRequestClose()
  }

  onReset() {
    this.setState({ isPending: true })
    tableStore.showAllFields()
  }

  onApply() {
    this.setState({ isPending: true })
    tableStore.setFieldsVisibility(
      this.props.asset,
      this.props.submissions,
      this.props.bulkActions,
      this.state.selectedColumns,
    )
  }

  onFieldToggleChange(fieldId: string, isSelected: boolean) {
    const newSelectedColumns = [...this.state.selectedColumns]
    if (isSelected) {
      newSelectedColumns.push(fieldId)
    } else {
      newSelectedColumns.splice(newSelectedColumns.indexOf(fieldId), 1)
    }
    this.setState({ selectedColumns: newSelectedColumns })
  }

  onFilterPhraseChange(newPhrase: string) {
    this.setState({ filterPhrase: newPhrase })
  }

  getFilteredFieldsList(): ColumnsHideColumn[] {
    if (this.state.filterPhrase !== '') {
      const fuse = new Fuse(this.state.allColumns, {
        ...FUSE_OPTIONS,
        keys: ['fieldId', 'label'],
      })
      const fuseResults = fuse.search(this.state.filterPhrase)
      return fuseResults.map((fuseResult) => {
        return {
          fieldId: fuseResult.item.fieldId,
          label: fuseResult.item.label,
        }
      })
    }
    return this.state.allColumns
  }

  render() {
    const filteredFieldsList = this.getFilteredFieldsList()
    return (
      <Stack w={360} gap='sm' p='sm'>
        <Box fz='sm'>{t('These settings affects the experience for all project users.')}</Box>

        <TextInput
          value={this.state.filterPhrase}
          onChange={(evt) => this.onFilterPhraseChange(evt.currentTarget.value)}
          placeholder={t('Find a field')}
          size='sm'
        />

        {filteredFieldsList.length !== 0 && (
          <ScrollArea.Autosize mah={200} type='auto' dir='auto'>
            <Stack gap='sm'>
              {filteredFieldsList.map((fieldObj) => (
                <Box key={fieldObj.fieldId}>
                  <ToggleSwitch
                    checked={this.state.selectedColumns.includes(fieldObj.fieldId)}
                    onChange={(isSelected: boolean) => {
                      this.onFieldToggleChange(fieldObj.fieldId, isSelected)
                    }}
                    disabled={this.state.isPending}
                    label={fieldObj.label}
                  />
                </Box>
              ))}
            </Stack>
          </ScrollArea.Autosize>
        )}

        {filteredFieldsList.length === 0 && <Alert type='default'>{t('No results')}</Alert>}

        <Group gap='sm'>
          <ButtonNew
            variant='danger-secondary'
            size='sm'
            onClick={this.onReset.bind(this)}
            loading={this.state.isPending}
            flex={1}
          >
            {t('Reset')}
          </ButtonNew>

          <ButtonNew
            variant='light'
            size='sm'
            onClick={this.onApply.bind(this)}
            loading={this.state.isPending}
            flex={1}
          >
            {t('Apply')}
          </ButtonNew>
        </Group>
      </Stack>
    )
  }
}

export default ColumnsHideForm
