import React, {useState, useEffect} from 'react';
import clonedeep from 'lodash.clonedeep';
import Button from 'js/components/common/button';
import type {MultiCheckboxItem} from 'js/components/common/multiCheckbox';
import MultiCheckbox from 'js/components/common/multiCheckbox';
import KoboModal from 'js/components/modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import KoboModalContent from 'js/components/modals/koboModalContent';
import KoboModalFooter from 'js/components/modals/koboModalFooter';
import type {ProjectFieldName} from './constants';
import {PROJECT_FIELDS, DEFAULT_PROJECT_FIELDS} from './constants';
import styles from './projectsFieldsSelector.module.scss';

interface ProjectsFieldsSelectorProps {
  /** Selected fields. If the settings don't exist yet, we accept undefined. */
  selectedFields: ProjectFieldName[] | undefined;
  /**
   * When user clicks "apply" or "reset" button, the components will return
   * new selected fields. The component parent needs to store them and pass
   * again through props.
   */
  onFieldsChange: (fields: ProjectFieldName[] | undefined) => void;
}

export default function ProjectsFieldsSelector(
  props: ProjectsFieldsSelectorProps
) {
  const getInitialSelectedFields = () => {
    if (!props.selectedFields || props.selectedFields.length === 0) {
      return DEFAULT_PROJECT_FIELDS;
    } else {
      return clonedeep(props.selectedFields);
    }
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFields, setSelectedFields] = useState(
    getInitialSelectedFields()
  );

  useEffect(() => {
    if (!isModalOpen) {
      // Reset fields when closing modal.
      if (isModalOpen === false) {
        setSelectedFields(getInitialSelectedFields());
      }
    }
  }, [isModalOpen]);

  const toggleModal = () => {
    setIsModalOpen(!isModalOpen);
  };

  const applyFields = () => {
    props.onFieldsChange(selectedFields);
    toggleModal();
  };

  const resetFields = () => {
    // Sending undefined to delete settings.
    props.onFieldsChange(undefined);
    toggleModal();
  };

  const onCheckboxesChange = (items: MultiCheckboxItem[]) => {
    const newFields = items
      .filter((item) => item.checked)
      .map((item) => item.name);
    setSelectedFields(newFields);
  };

  const getCheckboxes = (): MultiCheckboxItem[] =>
    Object.values(PROJECT_FIELDS).map((field) => {
      return {
        name: field.name,
        label: field.label,
        // We ensure "name" field is always selected
        checked: selectedFields.includes(field.name) || field.name === 'name',
        disabled: field.name === 'name',
      };
    });

  return (
    <div className={styles.root}>
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
          <div className={styles.fields}>
            <MultiCheckbox
              type='bare'
              items={getCheckboxes()}
              onChange={onCheckboxesChange}
            />
          </div>
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
    </div>
  );
}
