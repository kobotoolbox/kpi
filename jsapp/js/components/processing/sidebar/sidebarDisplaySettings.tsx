import React, {useState} from 'react';
import singleProcessingStore, {SingleProcessingTabs, StaticDisplays} from 'js/components/processing/singleProcessingStore';
import KoboModal from 'js/components/modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import KoboModalContent from 'js/components/modals/koboModalContent';
import ToggleSwitch from 'js/components/common/toggleSwitch';
import Button from 'js/components/common/button';
import style from './sidebarDisplaySettings.module.scss';
import {AsyncLanguageDisplayLabel} from 'js/components/languages/languagesUtils';
import KoboModalFooter from '../../modals/koboModalFooter';

export default function SidebarDisplaySettings() {
  const [store] = useState(() => singleProcessingStore);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const displays = store.getDisplays();
  const currentTab = store.getActiveTab();

  return (
    <div className={style.root}>
      <Button
        classNames={[style.displaySettings]}
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
          icon='spreadsheet'
          iconColor='storm'
          onRequestCloseByX={() => setIsModalOpen(false)}
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
                    <ToggleSwitch
                      onChange={() => store.setDisplay(staticDisplay, !entry[1])}
                      checked={entry[1]}
                      label={<strong>{staticDisplay}</strong>}
                    />
                  </li>
                );
              } else if (!(currentTab === SingleProcessingTabs.Translations)) {
                return (
                  <li>
                    <ToggleSwitch
                      onChange={() => store.setDisplay(entry[0], !entry[1])}
                      checked={entry[1]}
                      label={
                        <strong>
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
              onClick={() => {store.resetDisplays(); setIsModalOpen(false);}}
            />
            <Button
              label='Apply'
              type='full'
              color='blue'
              size='m'
              onClick={() => {store.applyDisplay(); setIsModalOpen(false);}}
            />
          </KoboModalFooter>

        </KoboModalContent>
      </KoboModal>
    </div>
  );
}
