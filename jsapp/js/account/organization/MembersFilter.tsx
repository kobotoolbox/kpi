import React, { useState } from 'react'

import cx from 'classnames'
import clonedeep from 'lodash.clonedeep'
import ActionIcon from '#/components/common/ActionIcon'
import Button from '#/components/common/button'
import ButtonNew from '#/components/common/ButtonNew'
import KoboSelect from '#/components/common/koboSelect'
import KoboModal from '#/components/modals/koboModal'
import KoboModalHeader from '#/components/modals/koboModalHeader'
import styles from './membersFilter.module.scss'

export type MemberFilterField = 'status' | 'role' | 'twofa'
export type MemberFilterCondition = 'is' | 'isNot'

export interface MemberFilterDefinition {
  field?: MemberFilterField
  condition?: MemberFilterCondition
  value?: string
}

function getFieldOptions() {
  return [
    { value: 'status', label: t('Status') },
    { value: 'role', label: t('Role') },
    { value: 'twofa', label: t('2FA') },
  ]
}

function getConditionOptions() {
  return [
    { value: 'is', label: t('is') },
    { value: 'isNot', label: t('is not') },
  ]
}

function getValueOptions(field?: MemberFilterField) {
  if (field === 'status') {
    return [
      { value: 'active', label: t('Active') },
      { value: 'invited', label: t('Invited') },
    ]
  }
  if (field === 'role') {
    return [
      { value: 'owner', label: t('Owner') },
      { value: 'admin', label: t('Admin') },
      { value: 'member', label: t('Member') },
    ]
  }
  if (field === 'twofa') {
    return [
      { value: 'enabled', label: t('Enabled') },
      { value: 'disabled', label: t('Disabled') },
    ]
  }
  return []
}

interface MembersFilterProps {
  filters: MemberFilterDefinition[]
  onFiltersChange: (filters: MemberFilterDefinition[]) => void
}

export default function MembersFilter(props: MembersFilterProps) {
  const getInitialFilters = () => {
    if (props.filters.length === 0) {
      return [{}]
    }
    return clonedeep(props.filters)
  }

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [filters, setFilters] = useState<MemberFilterDefinition[]>(getInitialFilters)

  const toggleModal = () => {
    setIsModalOpen((prev) => !prev)
    if (!isModalOpen) {
      setFilters(getInitialFilters())
    }
  }

  const addFilter = () => {
    setFilters((prev) => [...prev, {}])
  }

  const applyFilters = () => {
    // Only keep filters that have all three fields set
    const complete = filters.filter((f) => f.field && f.condition && f.value !== undefined)
    props.onFiltersChange(complete)
    setIsModalOpen(false)
  }

  const resetFilters = () => {
    props.onFiltersChange([])
    setIsModalOpen(false)
  }

  const updateFilter = (index: number, patch: Partial<MemberFilterDefinition>) => {
    setFilters((prev) => {
      const next = clonedeep(prev)
      next[index] = { ...next[index], ...patch }
      // Clear value when field changes
      if (patch.field !== undefined && patch.field !== prev[index].field) {
        next[index].value = undefined
      }
      return next
    })
  }

  const deleteFilter = (index: number) => {
    setFilters((prev) => prev.filter((_, i) => i !== index))
  }

  const hasActiveFilters = props.filters.length > 0

  return (
    <div className={styles.root}>
      <ButtonNew
        variant='outline'
        size='md'
        leftIcon='filter'
        onClick={toggleModal}
        className={cx({ [styles.buttonHasFilters]: hasActiveFilters })}
      >
        {t('Filters')}
        {hasActiveFilters && <strong>&nbsp;{props.filters.length}</strong>}
      </ButtonNew>

      <KoboModal isOpen={isModalOpen} onRequestClose={toggleModal} size='large'>
        <KoboModalHeader icon='filter' iconColor='storm' onRequestCloseByX={toggleModal}>
          {t('Member filters')}
        </KoboModalHeader>

        <section className={styles.content}>
          {filters.length === 0 && (
            <p className={styles.emptyNote}>{t('There are no filters, you can add one below.')}</p>
          )}

          {filters.map((filter, index) => (
            <div key={index} className={styles.filterRow}>
              <div className={styles.filterField}>
                {index === 0 && <label className={styles.rowLabel}>{t('Field')}</label>}
                <KoboSelect
                  name={`member-filter-field-${index}`}
                  type='outline'
                  size='m'
                  isClearable
                  options={getFieldOptions()}
                  selectedOption={filter.field ?? null}
                  onChange={(val) => updateFilter(index, { field: (val as MemberFilterField) ?? undefined })}
                  placeholder={t('Select field…')}
                />
              </div>

              <div className={styles.filterCondition}>
                {index === 0 && <label className={styles.rowLabel}>{t('Condition')}</label>}
                <KoboSelect
                  name={`member-filter-condition-${index}`}
                  type='outline'
                  size='m'
                  isClearable
                  options={getConditionOptions()}
                  selectedOption={filter.condition ?? null}
                  onChange={(val) =>
                    updateFilter(index, { condition: (val as MemberFilterCondition) ?? undefined })
                  }
                  placeholder={t('Select…')}
                />
              </div>

              <div className={styles.filterValue}>
                {index === 0 && <label className={styles.rowLabel}>{t('Value')}</label>}
                <KoboSelect
                  name={`member-filter-value-${index}`}
                  type='outline'
                  size='m'
                  isClearable
                  options={getValueOptions(filter.field)}
                  selectedOption={filter.value ?? null}
                  onChange={(val) => updateFilter(index, { value: val ?? undefined })}
                  placeholder={t('Select value…')}
                />
              </div>

              <div className={cx(styles.filterDelete, { [styles.filterDeleteOffset]: index === 0 })}>
                <ActionIcon
                  iconName='trash'
                  size='md'
                  variant='transparent'
                  onClick={() => deleteFilter(index)}
                />
              </div>
            </div>
          ))}
        </section>

        <footer className={styles.footer}>
          <Button type='secondary' size='m' onClick={addFilter} startIcon='plus' label={t('Add filter')} />
          <Button type='secondary-danger' size='m' onClick={resetFilters} label={t('Reset')} />
          <Button type='primary' size='m' onClick={applyFilters} label={t('Apply')} />
        </footer>
      </KoboModal>
    </div>
  )
}