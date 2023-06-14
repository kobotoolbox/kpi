import React, {useState} from 'react';
import singleProcessingStore, {
  SingleProcessingTabs,
  StaticDisplays,
} from 'js/components/processing/singleProcessingStore';
import KoboModal from 'js/components/modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import KoboModalContent from 'js/components/modals/koboModalContent';
import KoboModalFooter from 'js/components/modals/koboModalFooter';
import ToggleSwitch from 'js/components/common/toggleSwitch';
import Button from 'js/components/common/button';
import {AsyncLanguageDisplayLabel} from 'js/components/languages/languagesUtils';

import styles from './sidebarDisplaySettings.module.scss';

export default function SidebarDisplaySettings() {
  const [store] = useState(() => singleProcessingStore);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const displays = store.getDisplays();
  const currentTab = store.getActiveTab();
  const transcript = store.getTranscript();

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
            {Array.from(displays).map((entry) => {
              if (entry[0] in StaticDisplays) {
                const staticDisplay = entry[0] as StaticDisplays;

                return (
                  <li className={styles.display}>
                    <ToggleSwitch
                      onChange={() =>
                        store.setDisplay(staticDisplay, !entry[1])
                      }
                      checked={entry[1]}
                      label={getStaticDisplayText(staticDisplay)}
                    />
                  </li>
                );
              } else if (!(currentTab === SingleProcessingTabs.Translations)) {
                return (
                  <li className={styles.display}>
                    <ToggleSwitch
                      onChange={() => store.setDisplay(entry[0], !entry[1])}
                      checked={entry[1]}
                      label={
                        <strong className={styles.wrapWithParens}>
                          {t('Translation')}
                          &nbsp;
                          <AsyncLanguageDisplayLabel code={entry[0]} />
                        </strong>
                      }
                    />
                  </li>
                );
              } else {
                return null;
              }
            })}
          </ul>
        </KoboModalContent>
        <KoboModalFooter isCentered>
          <Button
            label={<strong>{t('Reset')}</strong>}
            type='frame'
            color='light-blue'
            size='m'
            onClick={() => {
              store.resetDisplays();
              setIsModalOpen(false);
            }}
          />
          <Button
            label={<strong>{t('Apply selection')}</strong>}
            type='full'
            color='light-blue'
            size='m'
            onClick={() => {
              store.applyDisplay();
              setIsModalOpen(false);
            }}
          />
        </KoboModalFooter>
      </KoboModal>
    </div>
  );
}
