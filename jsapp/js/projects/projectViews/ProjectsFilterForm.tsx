import { Group, Stack, Text } from '@mantine/core'
import React, { useState } from 'react'
import Button from '#/components/common/ButtonNew'
import ProjectsFilterEditor from './ProjectsFilterEditor'
import type { ProjectFieldName, ProjectsFilterDefinition } from './constants'
import { removeIncorrectFilters } from './utils'

interface ProjectsFilterFormProps {
  /** Saved filters to start editing from. */
  filters: ProjectsFilterDefinition[]
  /** Called with the edited filters, minus incomplete ones. */
  onApply: (filters: ProjectsFilterDefinition[]) => void
  onReset: () => void
  /** A list of fields that should not be available to user. */
  excludedFields?: ProjectFieldName[]
}

/** Filter rows and actions shown in the `ProjectsFilter` modal. Edits stay local until applied. */
export default function ProjectsFilterForm(props: ProjectsFilterFormProps) {
  // Start with one empty row, so there is something to fill in.
  const [filters, setFilters] = useState<ProjectsFilterDefinition[]>(props.filters.length === 0 ? [{}] : props.filters)

  const addFilter = () => setFilters([...filters, {}])

  const onFilterEditorChange = (filterIndex: number, filter: ProjectsFilterDefinition) => {
    setFilters(filters.map((item, index) => (index === filterIndex ? filter : item)))
  }

  const onFilterEditorDelete = (filterIndex: number) => {
    setFilters(filters.filter((_item, index) => index !== filterIndex))
  }

  return (
    <Stack gap='lg'>
      <Stack gap='xxs'>
        {filters.map((filter, filterIndex) => (
          <ProjectsFilterEditor
            key={filterIndex}
            filter={filter}
            // Only the first row shows column labels.
            hideLabels={filterIndex !== 0}
            onFilterChange={(newFilter) => {
              onFilterEditorChange(filterIndex, newFilter)
            }}
            onDelete={() => {
              onFilterEditorDelete(filterIndex)
            }}
            excludedFields={props.excludedFields}
          />
        ))}

        {filters.length === 0 && <Text>{t('There are no filters, you can add one below')}</Text>}
      </Stack>

      <Group justify='space-between'>
        <Button variant='light' leftIcon='plus' onClick={addFilter}>
          {t('Add filter')}
        </Button>

        <Group gap='xs'>
          <Button variant='danger-secondary' onClick={props.onReset}>
            {t('Reset')}
          </Button>

          <Button onClick={() => props.onApply(removeIncorrectFilters(filters))}>{t('Apply')}</Button>
        </Group>
      </Group>
    </Stack>
  )
}
