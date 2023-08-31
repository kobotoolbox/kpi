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
import styles from './sidebarDisplaySettings.module.scss';

export default function SidebarDisplaySettings() {
  const [store] = useState(() => singleProcessingStore);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const activeTab = store.getActiveTab();
  const [selectedDisplays, setSelectedDisplays] = useState<DisplaysList>(
    store.getDisplays(activeTab)
  );

  // Every time user changes the tab, we need to load the stored displays list
  // for that tab.
  useEffect(() => {
    setSelectedDisplays(store.getDisplays(activeTab));
  }, [activeTab]);

  const transcript = store.getTranscript();
  const availableDisplays = store.getAvailableDisplays(activeTab);

  function getStaticDisplayText(display: StaticDisplays) {
    if (display === StaticDisplays.Transcript && transcript) {
      return (
        <strong className={styles.wrapWithParens}>
          {t('Original transcript')}
          &nbsp;
          <AsyncLanguageDisplayLabel code={transcript.languageCode} />
        </strong>
      );
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

  return (
    <div className={styles.root}>
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
        onRequestClose={() => setIsModalOpen(false)}
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
                      label={getStaticDisplayText(staticDisplay)}
                    />
                  </li>
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
              store.setDisplays(activeTab, selectedDisplays);
              setIsModalOpen(false);
            }}
          />
        </KoboModalFooter>
      </KoboModal>
    </div>
  );
}
