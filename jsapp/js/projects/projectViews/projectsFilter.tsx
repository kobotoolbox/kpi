import React, {useState} from 'react';
import classNames from 'classnames';
import clonedeep from 'lodash.clonedeep';
import Button from 'js/components/common/button';
import KoboModal from 'js/components/modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import type {ProjectsFilterDefinition} from './constants';
import ProjectsFilterEditor from './projectsFilterEditor';
import {removeIncorrectFilters} from './utils';
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
}

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

  const onFilterEditorChange = (filterIndex: number, filter: ProjectsFilterDefinition) => {
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
      {/* Trigger button */}
      {props.filters.length === 0 &&
        <Button
          type='bare'
          size='s'
          color='storm'
          onClick={toggleModal}
          startIcon='filter'
          label={t('filter')}
        />
      }
      {/* With any filters active, we want to highlight the button - the same
      color will be used for all columns that filters apply to. */}
      {props.filters.length >= 1 &&
        <Button
          type='full'
          size='s'
          color='light-blue'
          onClick={toggleModal}
          startIcon='filter'
          label={<span>{t('filter')} <strong>{props.filters.length}</strong></span>}
        />
      }

      <KoboModal
        isOpen={isModalOpen}
        onRequestClose={toggleModal}
        size='medium'
      >
        <KoboModalHeader
          icon='filter'
          iconColor='storm'
          onRequestCloseByX={toggleModal}
        >
          {'Table filter'}
        </KoboModalHeader>

        <section className={classNames({
          [styles.content]: true,
          [styles['has-many-filters']]: filters.length >= MANY_FILTERS_AMOUNT,
        })}>
          {filters.map((filter, filterIndex) => (
            <ProjectsFilterEditor
              key={filterIndex}
              filter={filter}
              // We want the labels only for first editor.
              hideLabels={filterIndex !== 0}
              onFilterChange={(newFilter) => {onFilterEditorChange(filterIndex, newFilter);}}
              onDelete={() => {onFilterEditorDelete(filterIndex);}}
            />
          ))}

          {filters.length === 0 &&
            <p>{t('There are no filters, you can add one below')}</p>
          }
        </section>

        <footer className={styles.footer}>
          <Button
            type='bare'
            color='blue'
            size='m'
            onClick={addFilter}
            startIcon='plus'
            label={t('Add filter')}
          />

          <Button
            type='frame'
            color='storm'
            size='m'
            onClick={resetFilters}
            label={t('Reset')}
          />

          <Button
            type='frame'
            color='blue'
            size='m'
            onClick={applyFilters}
            label={t('Apply')}
          />
        </footer>
      </KoboModal>
    </div>
  );
}
