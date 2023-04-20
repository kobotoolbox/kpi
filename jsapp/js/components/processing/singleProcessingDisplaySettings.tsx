import React, {useEffect, useState} from 'react';
import singleProcessingStore, {SingleProcessingTabs, StaticDisplays} from 'js/components/processing/singleProcessingStore';
import KoboModal from '../modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import KoboModalContent from 'js/components/modals/koboModalContent';
import ToggleSwitch from '../common/toggleSwitch';
import Button from 'js/components/common/button';
import style from './singleProcessingDisplaySettings.module.scss';
import languagesStore from '../languages/languagesStore';
import {AsyncLanguageDisplayLabel} from '../languages/languagesUtils';

interface SingleProcessingDisplaySettingsState {
  isModalOpen: boolean;
}

export default function SingleProcessingDisplaySettings() {
  const [store] = useState(() => singleProcessingStore);

  const [modal, setModal] = useState<SingleProcessingDisplaySettingsState>({
    isModalOpen: false,
  });

  const displays = store.getDisplays();
  const currentTab = store.getActiveTab();

  function toggleModal() {
    setModal({
      ...modal,
      isModalOpen: !modal.isModalOpen,
    });
  }

  return (
    <div className={style.root}>
      <Button
        classNames={[style.displaySettings]}
        size='m'
        type='bare'
        label={t('Display settings')}
        color='storm'
        startIcon='settings'
        onClick={toggleModal}
      />
      <KoboModal
        isOpen={modal.isModalOpen}
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
                  <li>
                    <strong>{staticDisplay}</strong>
                    <ToggleSwitch
                      onChange={() => store.setStaticDisplay(staticDisplay)}
                      checked={entry[1]}
                    />
                  </li>
                );
              } else if (!(currentTab === SingleProcessingTabs.Translations)) {
                return (
                  <li>
                    <strong>
                      <AsyncLanguageDisplayLabel code={entry[0]} />
                    </strong>
                    <ToggleSwitch
                      onChange={() => store.setTranslationDisplay(entry[0])}
                      checked={entry[1]}
                    />
                  </li>
                );
              } else {
                return null;
              }
            })}
          </ul>
        </KoboModalContent>
      </KoboModal>
    </div>
  );
}
