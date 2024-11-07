// Libraries
import React, {useState} from 'react';
import cx from 'classnames';
import clonedeep from 'lodash.clonedeep';

// Partial components
import Button from 'js/components/common/button';
import KoboModal from 'js/components/modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import ProjectsFilterEditor from './projectsFilterEditor';

// Utilities
import {removeIncorrectFilters} from './utils';

// Constants and types
import type {ProjectFieldName, ProjectsFilterDefinition} from './constants';

// Styles
import styles from './projectsFilter.module.scss';

// If there are "many" filters being displayed, we want the modal content to be
// styled a bit differently, so we define how much is "many" here:
const MANY_FILTERS_AMOUNT = 5;

interface ProjectsFilterProps {
  /** A list of existing filters (if any are defined). */
  filters: ProjectsFilterDefinition[];
  /**
   * When user clicks "apply" or "reset" button, the components will return
   * new filters.
   */
  onFiltersChange: (filters: ProjectsFilterDefinition[]) => void;
  /** A list of fields that should not be available to user. */
  excludedFields?: ProjectFieldName[];
}

/**
 * This module displays a button for opening a modal with a list of filters.
 * Each filter is being rendered and modified by a separate
 * `ProjectsFilterEditor` component.
 */
export default function ProjectsFilter(props: ProjectsFilterProps) {
  const getInitialFilters = () => {
    if (props.filters.length === 0) {
      return [{}];
    } else {
      return clonedeep(props.filters);
    }
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [filters, setFilters] = useState(getInitialFilters());

  const toggleModal = () => {
    setIsModalOpen(!isModalOpen);
    // Reset filters when closing modal.
    if (isModalOpen === false) {
      setFilters(getInitialFilters());
    }
  };

  const addFilter = () => {
    const newFilters = clonedeep(filters);
    newFilters.push({});
    setFilters(newFilters);
  };

  const applyFilters = () => {
    props.onFiltersChange(removeIncorrectFilters(filters));
    toggleModal();
  };

  const resetFilters = () => {
    // Sending empty filters
    props.onFiltersChange([]);
    toggleModal();
  };

  const onFilterEditorChange = (
    filterIndex: number,
    filter: ProjectsFilterDefinition
  ) => {
    const newFilters = clonedeep(filters);
    newFilters[filterIndex] = filter;
    setFilters(newFilters);
  };

  const onFilterEditorDelete = (filterIndex: number) => {
    const newFilters = clonedeep(filters);
    newFilters.splice(filterIndex, 1);
    setFilters(newFilters);
  };

  return (
    <div className={styles.root}>
      <Button
        type='text'
        size='s'
        onClick={toggleModal}
        startIcon='filter'
        label={(
          <span>
            {t('filter')}
            {props.filters.length >= 1 &&
              <>
                &nbsp;
                <strong>{props.filters.length}</strong>
              </>
            }
          </span>
        )}
        // With any filters active, we want to highlight the button - the same
        // color will be used for all columns that filters apply to.
        className={cx({[styles.buttonHasFilters]: props.filters.length >= 1})}
      />

      <KoboModal isOpen={isModalOpen} onRequestClose={toggleModal} size='large'>
        <KoboModalHeader
          icon='filter'
          iconColor='storm'
          onRequestCloseByX={toggleModal}
        >
          {'Table filter'}
        </KoboModalHeader>

        <section
          className={cx({
            [styles.content]: true,
            [styles.hasManyFilters]: filters.length >= MANY_FILTERS_AMOUNT,
          })}
        >
          {filters.map((filter, filterIndex) => (
            <ProjectsFilterEditor
              key={filterIndex}
              filter={filter}
              // We want the labels only for first editor.
              hideLabels={filterIndex !== 0}
              onFilterChange={(newFilter) => {
                onFilterEditorChange(filterIndex, newFilter);
              }}
              onDelete={() => {
                onFilterEditorDelete(filterIndex);
              }}
              excludedFields={props.excludedFields}
            />
          ))}

          {filters.length === 0 && (
            <p>{t('There are no filters, you can add one below')}</p>
          )}
        </section>

        <footer className={styles.footer}>
          <Button
            type='secondary'
            size='m'
            onClick={addFilter}
            startIcon='plus'
            label={t('Add filter')}
          />

          <Button
            type='secondary-danger'
            size='m'
            onClick={resetFilters}
            label={t('Reset')}
          />

          <Button
            type='primary'
            size='m'
            onClick={applyFilters}
            label={t('Apply')}
          />
        </footer>
      </KoboModal>
    </div>
  );
}
