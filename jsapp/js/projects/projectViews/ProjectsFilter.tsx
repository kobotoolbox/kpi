import React, { useState } from 'react'
import Button from '#/components/common/ButtonNew'
import ModalNew from '#/components/common/ModalNew'
import ProjectsFilterForm from './ProjectsFilterForm'
import type { ProjectFieldName, ProjectsFilterDefinition } from './constants'

interface ProjectsFilterProps {
  /** A list of existing filters (if any are defined). */
  filters: ProjectsFilterDefinition[]
  /**
   * When user clicks "apply" or "reset" button, the components will return
   * new filters.
   */
  onFiltersChange: (filters: ProjectsFilterDefinition[]) => void
  /** A list of fields that should not be available to user. */
  excludedFields?: ProjectFieldName[]
}

/** Button that opens a modal for editing table filters (see `ProjectsFilterForm`). */
export default function ProjectsFilter(props: ProjectsFilterProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  const closeModal = () => setIsModalOpen(false)

  const changeFilters = (filters: ProjectsFilterDefinition[]) => {
    props.onFiltersChange(filters)
    closeModal()
  }

  const hasFilters = props.filters.length >= 1

  return (
    <>
      <Button
        // Highlighted while filters are active, so it's clear why some projects are missing.
        variant={hasFilters ? 'light' : 'transparent'}
        size='sm'
        leftIcon='filter'
        onClick={() => setIsModalOpen(true)}
      >
        {t('filter')}
        {hasFilters && (
          <>
            &nbsp;
            <strong>{props.filters.length}</strong>
          </>
        )}
      </Button>

      <ModalNew opened={isModalOpen} onClose={closeModal} title={t('Table filter')} size={940}>
        {/* Modal unmounts its content when closed, so unapplied edits are dropped. */}
        <ProjectsFilterForm
          filters={props.filters}
          onApply={changeFilters}
          onReset={() => changeFilters([])}
          excludedFields={props.excludedFields}
        />
      </ModalNew>
    </>
  )
}
