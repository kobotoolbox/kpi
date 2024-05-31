import React, {useState, useEffect} from 'react';
import singleProcessingStore, {
  StaticDisplays,
} from 'js/components/processing/singleProcessingStore';
import type {DisplaysList} from 'js/components/processing/singleProcessingStore';
import KoboModal from 'js/components/modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import KoboModalContent from 'js/components/modals/koboModalContent';
import KoboModalFooter from 'js/components/modals/koboModalFooter';
import ToggleSwitch from 'js/components/common/toggleSwitch';
import Button from 'js/components/common/button';
import {AsyncLanguageDisplayLabel} from 'js/components/languages/languagesUtils';
import type {LanguageCode} from 'js/components/languages/languagesStore';
import type {AssetContent} from 'js/dataInterface';
import {getActiveTab} from 'js/components/processing/routes.utils';
import styles from './sidebarDisplaySettings.module.scss';
import MultiCheckbox from 'js/components/common/multiCheckbox';
import type {MultiCheckboxItem} from 'js/components/common/multiCheckbox';
import cx from 'classnames';
import KoboSelect from 'js/components/common/koboSelect';

interface SidebarDisplaySettingsProps {
  assetContent: AssetContent | undefined;
}

export default function SidebarDisplaySettings(
  props: SidebarDisplaySettingsProps
) {
  const [store] = useState(() => singleProcessingStore);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const activeTab = getActiveTab();

  if (activeTab === undefined) {
    return null;
  }

  const [selectedDisplays, setSelectedDisplays] = useState<DisplaysList>(
    store.getDisplays(activeTab)
  );

  function getInitialFields() {
    if (!props.assetContent?.survey) {
      return [];
    }

    const allQuestions = store.getAllSidebarQuestions();
    const hiddenFields = store.getHiddenSidebarQuestions();

    // Remove the fields hidden in the store so it persists when
    // across navigating submissions.
    const questionsList = allQuestions.filter(
      (question) => !hiddenFields.includes(question.name)
    );
    return questionsList;
  }

  const [selectedFields, setSelectedFields] = useState(getInitialFields());

  // Every time user changes the tab, we need to load the stored displays list
  // for that tab.
  useEffect(() => {
    setSelectedDisplays(store.getDisplays(activeTab));
  }, [activeTab]);

  const transcript = store.getTranscript();
  const availableDisplays = store.getAvailableDisplays(activeTab);
  const displayedLanguageList = store.getDisplayedLanguagesList();

  function getStaticDisplayText(display: StaticDisplays) {
    if (display === StaticDisplays.Transcript) {
      if (transcript) {
        return (
          <strong className={styles.wrapWithParens}>
            {t('Original transcript')}
            &nbsp;
            <AsyncLanguageDisplayLabel code={transcript.languageCode} />
          </strong>
        );
      }
      return null;
    } else if (display === StaticDisplays.Data) {
      return <strong>{t('Submission data')}</strong>;
    } else {
      return <strong>{t('Original file (Audio)')}</strong>;
    }
  }

  function enableDisplay(displayName: LanguageCode | StaticDisplays) {
    setSelectedDisplays(
      Array.from(new Set([...selectedDisplays, displayName]))
    );
  }

  function disableDisplay(displayName: LanguageCode | StaticDisplays) {
    setSelectedDisplays(
      selectedDisplays.filter(
        (selectedDisplayName) => selectedDisplayName !== displayName
      )
    );
  }

  function isFieldChecked(questionName: string) {
    return selectedFields.some((field) => field.name === questionName);
  }

  function getCheckboxes() {
    if (!props.assetContent?.survey) {
      return [];
    }

    const checkboxes = store.getAllSidebarQuestions().map((question) => {
      return {
        label: question.label,
        checked: isFieldChecked(question.name),
        name: question.name,
        disabled: !selectedDisplays.includes(StaticDisplays.Data),
      };
    });

    return checkboxes;
  }

  // To make the code a little simpler later on, we need an inverse array here
  // to send to the the display, and a normal array to keep track of the
  // checkboxes in this modal.
  function onCheckboxesChange(list: MultiCheckboxItem[]) {
    const newList = list
      .filter((question) => question.checked)
      .map((question) => {
        return {name: question.name, label: question.label};
      });

    setSelectedFields(newList);
  }

  function applyFieldsSelection() {
    const hiddenList = getCheckboxes()
      .filter((question) => !question.checked)
      .map((question) => question.name) || [];

    store.setHiddenSidebarQuestions(hiddenList);
  }

  function resetFieldsSelection() {
    // Since we check the store for hidden fields and use that to get our
    // checkboxes, using `applyFieldsSelection` here would never actually
    // reset the checkboxes visually so we explicitly set it to empty here.
    store.setHiddenSidebarQuestions([]);
    setSelectedFields(getInitialFields());
  }

  return (
    <div className={styles.root}>
      <div className={styles.selectWrapper}>
      <KoboSelect
        label={t('Select displayed language')}
        name='displayedLanguage'
        type='outline'
        size='s'
        options={displayedLanguageList}
        selectedOption={store.getCurrentlyDisplayedLanguage()}
        onChange={(languageCode) => {
          if (languageCode) {
            store.setCurrentlyDisplayedLanguage(languageCode);
          }
        }}
      />
      </div>
      <Button
        size='m'
        type='bare'
        label={t('Display settings')}
        color='storm'
        startIcon='settings'
        onClick={() => setIsModalOpen(true)}
      />
      <KoboModal
        isOpen={isModalOpen}
        onRequestClose={() => {
          // Reset modals and checkboxes if user closed modal without applying
          setSelectedDisplays(store.getDisplays(activeTab));
          setSelectedFields(getInitialFields());
          setIsModalOpen(false);
        }}
        size='medium'
      >
        <KoboModalHeader>{t('Customize display settings')}</KoboModalHeader>

        <KoboModalContent>
          <p className={styles.description}>
            {t(
              'Select the information you want to display in the side menu to support your analysis.'
            )}
          </p>

          <ul className={styles.options}>
            {availableDisplays.map((entry) => {
              const isEnabled = selectedDisplays.includes(entry);

              if (entry in StaticDisplays) {
                const staticDisplay = entry as StaticDisplays;
                const isSubmissionData = staticDisplay === StaticDisplays.Data;

                return (
                  <>
                    <li className={cx(styles.display)} key={entry}>
                      <ToggleSwitch
                        onChange={(isChecked) => {
                          if (isChecked) {
                            enableDisplay(entry);
                          } else {
                            disableDisplay(entry);
                          }
                        }}
                        checked={isEnabled}
                        label={getStaticDisplayText(staticDisplay)}
                      />

                      {isSubmissionData && props.assetContent?.survey && (
                        <div className={styles.questionList}>
                          {t('Select the submission data to display.')}
                          <div className={styles.checkbox}>
                            <MultiCheckbox
                              type='bare'
                              items={getCheckboxes()}
                              onChange={onCheckboxesChange}
                            />
                          </div>
                        </div>
                      )}
                    </li>
                  </>
                );
              } else {
                return (
                  <li className={styles.display} key={entry}>
                    <ToggleSwitch
                      onChange={(isChecked) => {
                        if (isChecked) {
                          enableDisplay(entry);
                        } else {
                          disableDisplay(entry);
                        }
                      }}
                      checked={isEnabled}
                      label={
                        <strong className={styles.wrapWithParens}>
                          {t('Translation')}
                          &nbsp;
                          <AsyncLanguageDisplayLabel code={entry} />
                        </strong>
                      }
                    />
                  </li>
                );
              }
            })}
          </ul>
        </KoboModalContent>

        <KoboModalFooter alignment='center'>
          {/* This button resets the displays for current tab. */}
          <Button
            label={<strong>{t('Reset')}</strong>}
            type='frame'
            color='light-blue'
            size='m'
            onClick={() => {
              store.resetDisplays(activeTab);
              // Apply reset to local state of selected displays. This is needed
              // because the modal component (and its state) is kept alive even
              // when the modal is closed.
              resetFieldsSelection();
              setSelectedDisplays(store.getDisplays(activeTab));
              setIsModalOpen(false);
            }}
          />

          {/* Applies current selection of displays to the sidebar. */}
          <Button
            label={<strong>{t('Apply selection')}</strong>}
            type='full'
            color='light-blue'
            size='m'
            onClick={() => {
              applyFieldsSelection();
              store.setDisplays(activeTab, selectedDisplays);
              setIsModalOpen(false);
            }}
          />
        </KoboModalFooter>
      </KoboModal>
    </div>
  );
}
