import React, {useState} from 'react';
import clonedeep from 'lodash.clonedeep';
import bem, {makeBem} from 'js/bem';
import Button from 'js/components/common/button';
import type {MultiCheckboxItem} from 'js/components/common/multiCheckbox';
import MultiCheckbox from 'js/components/common/multiCheckbox';
import KoboModal from 'js/components/modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import KoboModalContent from 'js/components/modals/koboModalContent';
import KoboModalFooter from 'js/components/modals/koboModalFooter';
import type {ProjectFieldName} from './projectsViewConstants';
import {PROJECT_FIELDS} from './projectsViewConstants';
import './projectsFieldsSelector.scss';

bem.ProjectsFieldsSelector = makeBem(null, 'projects-fields-selector');
bem.ProjectsFieldsSelector__fieldsWrapper = makeBem(bem.ProjectsFieldsSelector, 'fields-wrapper');

interface ProjectsFieldsSelectorProps {
  /** Selected fields. Empty array means all fields. */
  fields: ProjectFieldName[];
  /**
   * When user clicks "apply" or "reset" button, the components will return
   * new fields.
   */
  onFieldsChange: (fields: ProjectFieldName[]) => void;
}

export default function ProjectsFieldsSelector(props: ProjectsFieldsSelectorProps) {
  const getInitialFields = () => {
    if (props.fields.length === 0) {
      return [];
    } else {
      return clonedeep(props.fields);
    }
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [fields, setFields] = useState(getInitialFields());

  const toggleModal = () => {
    setIsModalOpen(!isModalOpen);
    // Reset fields when closing modal.
    if (isModalOpen === false) {
      setFields(getInitialFields());
    }
  };

  const applyFields = () => {
    props.onFieldsChange(fields);
    toggleModal();
  };

  const resetFields = () => {
    // Sending empty fields
    props.onFieldsChange([]);
    toggleModal();
  };

  const onCheckboxesChange = (items: MultiCheckboxItem[]) => {
    const selectedFields = items.filter((item) => item.checked);
    // If all fields are selected, we want to sotre an empty array.
    let newFields = [];
    if (selectedFields.length !== Object.keys(PROJECT_FIELDS).length) {
      newFields = selectedFields.map((item) => item.name);
    }
    setFields(newFields);
  };

  const getCheckboxes = (): MultiCheckboxItem[] =>
    Object.values(PROJECT_FIELDS).map((field) => {
      return {
        name: field.name,
        // All fields are selected by default, and all means empty array.
        checked: fields.length === 0 || fields.includes(field.name),
        label: field.label,
      };
    });

  return (
    <bem.ProjectsFieldsSelector>
      {/* Trigger button */}
      <Button
        type='bare'
        size='s'
        color='storm'
        onClick={toggleModal}
        startIcon='spreadsheet'
        label={t('fields')}
      />

      <KoboModal
        isOpen={isModalOpen}
        onRequestClose={toggleModal}
        size='medium'
      >
        <KoboModalHeader
          icon='spreadsheet'
          iconColor='storm'
          onRequestCloseByX={toggleModal}
        >
          {'Select fields to display'}
        </KoboModalHeader>

        <KoboModalContent>
          <bem.ProjectsFieldsSelector__fieldsWrapper>
            <MultiCheckbox
              items={getCheckboxes()}
              onChange={onCheckboxesChange}
            />
          </bem.ProjectsFieldsSelector__fieldsWrapper>
        </KoboModalContent>

        <KoboModalFooter>
          <Button
            type='frame'
            color='storm'
            size='m'
            onClick={resetFields}
            label={t('Reset')}
          />

          <Button
            type='frame'
            color='blue'
            size='m'
            onClick={applyFields}
            label={t('Apply')}
          />
        </KoboModalFooter>
      </KoboModal>
    </bem.ProjectsFieldsSelector>
  );
}
