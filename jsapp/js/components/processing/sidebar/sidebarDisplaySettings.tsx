import React, {useState} from 'react';
import singleProcessingStore, {
  SingleProcessingTabs,
  StaticDisplays,
} from 'js/components/processing/singleProcessingStore';
import KoboModal from 'js/components/modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import KoboModalContent from 'js/components/modals/koboModalContent';
import ToggleSwitch from 'js/components/common/toggleSwitch';
import Button from 'js/components/common/button';
import styles from './sidebarDisplaySettings.module.scss';
import {AsyncLanguageDisplayLabel} from 'js/components/languages/languagesUtils';
import KoboModalFooter from '../../modals/koboModalFooter';

export default function SidebarDisplaySettings() {
  const [store] = useState(() => singleProcessingStore);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const displays = store.getDisplays();
  const currentTab = store.getActiveTab();
  const transcript = store.getTranscript();

  function getStaticDisplayText(display: StaticDisplays) {
    if (display === StaticDisplays.Transcript && transcript) {
      return (
        <strong>
          {t('Original transcript')}
          <AsyncLanguageDisplayLabel code={transcript.languageCode} />
        </strong>
      );
    }
  }

  return (
    <div className={styles.root}>
      <Button
        classNames={[styles.displaySettings]}
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
        <KoboModalHeader
          iconColor='storm'
          onRequestCloseByX={() => setIsModalOpen(false)}
        >
          {t('Customize display settings')}
        </KoboModalHeader>

        <KoboModalContent>
          <p className={styles.description}>
            {t(
              'Select the information you want to display in the side menu to support your analysis.'
            )}
          </p>

          <ul>
            {Array.from(displays).map((entry) => {
              let staticDisplay: StaticDisplays;
              if (
                entry[0] === StaticDisplays.Audio ||
                entry[0] === StaticDisplays.Data ||
                entry[0] === StaticDisplays.Transcript
              ) {
                staticDisplay = entry[0];

                return (
                  <li className={styles.display}>
                    <ToggleSwitch
                      onChange={() =>
                        store.setDisplay(staticDisplay, !entry[1])
                      }
                      checked={entry[1]}
                      label={<strong>{staticDisplay}</strong>}
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
                        <strong>
                          {t('Transation')}
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

          <KoboModalFooter>
            <Button
              label='Reset'
              type='full'
              color='blue'
              size='m'
              onClick={() => {
                store.resetDisplays();
                setIsModalOpen(false);
              }}
            />
            <Button
              label='Apply'
              type='full'
              color='blue'
              size='m'
              onClick={() => {
                store.applyDisplay();
                setIsModalOpen(false);
              }}
            />
          </KoboModalFooter>
        </KoboModalContent>
      </KoboModal>
    </div>
  );
}
