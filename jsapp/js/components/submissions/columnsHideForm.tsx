import { Box, Group, ScrollArea, Stack, Switch } from '@mantine/core'
import Fuse from 'fuse.js'
import React from 'react'
import { actions } from '#/actions'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import ButtonNew from '#/components/common/ButtonNew'
import { PERMISSIONS_CODENAMES } from '#/components/permissions/permConstants'
import { userCan } from '#/components/permissions/utils'
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

  /**
   * With `change_asset` the selection goes through `actions.table.updateSettings`,
   * so we show progress and let `onTableUpdateSettingsCompleted` close the
   * dropdown. Otherwise `tableStore` applies it synchronously as a session
   * override - no request to wait for, so close right away.
   */
  private applySelection(applyToStore: () => void) {
    const isSavedToAsset = userCan(PERMISSIONS_CODENAMES.change_asset, this.props.asset)

    if (isSavedToAsset) {
      this.setState({ isPending: true })
    }

    applyToStore()

    if (!isSavedToAsset) {
      this.props.onRequestClose()
    }
  }

  onReset() {
    this.applySelection(() => {
      tableStore.showAllFields()
    })
  }

  onApply() {
    this.applySelection(() => {
      tableStore.setFieldsVisibility(
        this.props.asset,
        this.props.submissions,
        this.props.bulkActions,
        this.state.selectedColumns,
      )
    })
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
      <Stack w={360} gap='sm' p='sm' mah='calc(100vh - 200px)' mih={200}>
        <Box fz='sm'>
          {userCan(PERMISSIONS_CODENAMES.change_asset, this.props.asset)
            ? t('These settings affect the experience for all project users.')
            : t('These settings only apply to your current session.')}
        </Box>

        <TextInput
          value={this.state.filterPhrase}
          onChange={(evt) => this.onFilterPhraseChange(evt.currentTarget.value)}
          placeholder={t('Find a field')}
          size='sm'
        />

        {filteredFieldsList.length !== 0 && (
          <ScrollArea.Autosize mah={200} type='auto' dir='auto'>
            <Stack gap='sm' p='xs'>
              {filteredFieldsList.map((fieldObj) => (
                <Box key={fieldObj.fieldId}>
                  <Switch
                    checked={this.state.selectedColumns.includes(fieldObj.fieldId)}
                    onChange={(event) => {
                      this.onFieldToggleChange(fieldObj.fieldId, event.currentTarget.checked)
                    }}
                    disabled={this.state.isPending}
                    label={fieldObj.label}
                    size='sm'
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
