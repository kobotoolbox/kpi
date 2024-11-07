// Libraries
import React, {useState, useEffect} from 'react';

// Partial components
import Button from 'js/components/common/button';
import MultiCheckbox from 'js/components/common/multiCheckbox';
import KoboModal from 'js/components/modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import KoboModalContent from 'js/components/modals/koboModalContent';
import KoboModalFooter from 'js/components/modals/koboModalFooter';

// Constants and types
import type {MultiCheckboxItem} from 'js/components/common/multiCheckbox';
import type {ProjectFieldName} from './constants';
import {PROJECT_FIELDS, DEFAULT_VISIBLE_FIELDS} from './constants';

// Styles
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
  /** A list of fields that should not be available to user. */
  excludedFields?: ProjectFieldName[];
}

export default function ProjectsFieldsSelector(
  props: ProjectsFieldsSelectorProps
) {
  const getInitialSelectedFields = () => {
    let outcome: ProjectFieldName[] = [];
    if (!props.selectedFields || props.selectedFields.length === 0) {
      outcome = DEFAULT_VISIBLE_FIELDS;
    } else {
      outcome = Array.from(props.selectedFields);
    }
    return outcome.filter(
      (fieldName) => !props.excludedFields?.includes(fieldName)
    );
  };

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedFields, setSelectedFields] = useState(
    getInitialSelectedFields()
  );

  useEffect(() => {
    // When opening and closing we reset fields
    setSelectedFields(getInitialSelectedFields());
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
    Object.values(PROJECT_FIELDS)
      .filter(
        (fieldDefinition) =>
          !props.excludedFields?.includes(fieldDefinition.name)
      )
      .map((field) => {
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
        type='text'
        size='s'
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
            type='secondary-danger'
            size='m'
            onClick={resetFields}
            label={t('Reset')}
          />

          <Button
            type='primary'
            size='m'
            onClick={applyFields}
            label={t('Apply')}
          />
        </KoboModalFooter>
      </KoboModal>
    </div>
  );
}
