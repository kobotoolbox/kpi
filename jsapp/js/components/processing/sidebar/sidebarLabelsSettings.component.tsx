import React, {useState} from 'react';
import Button from 'js/components/common/button';
import KoboModal from 'js/components/modals/koboModal';
import KoboModalHeader from 'js/components/modals/koboModalHeader';
import KoboModalFooter from 'js/components/modals/koboModalFooter';
import KoboSelect from 'js/components/common/koboSelect';
import singleProcessingStore from 'js/components/processing/singleProcessingStore';
import styles from './sidebarLabelsSettings.module.scss';
import type {LanguageCode} from 'js/components/languages/languagesStore';

export default function SidebarLabelsSettings() {
  const [store] = useState(() => singleProcessingStore);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  const [labelLanguage, setLabelLanguage] = useState<LanguageCode | string>(
    store.getCurrentlyDisplayedLanguage()
  );

  const displayedLanguageList = store.getDisplayedLanguagesList();

  return (
    <div className={styles.root}>
      <Button
        size='m'
        type='bare'
        label={t('Change question language')}
        color='storm'
        startIcon='globe-alt'
        onClick={() => setIsModalOpen(true)}
      />
      <KoboModal
        isOpen={isModalOpen}
        onRequestClose={() => {
          setLabelLanguage(store.getCurrentlyDisplayedLanguage());
          setIsModalOpen(false);
        }}
        size='medium'
      >
        <KoboModalHeader
          onRequestCloseByX={() => {
            setLabelLanguage(store.getCurrentlyDisplayedLanguage());
            setIsModalOpen(false);
          }}
        >
          {t('Change label language')}
        </KoboModalHeader>
        <div className={styles.selectWrapper}>
          <KoboSelect
            label={t('Select displayed language')}
            name='displayedLanguage'
            type='outline'
            size='s'
            options={displayedLanguageList}
            selectedOption={labelLanguage}
            onChange={(languageCode) => {
              if (languageCode) {
                setLabelLanguage(languageCode);
              }
            }}
          />
        </div>
        <KoboModalFooter>
          <Button
            label={<strong>{t('Apply')}</strong>}
            type='frame'
            color='light-blue'
            size='m'
            onClick={() => {
              store.setCurrentlyDisplayedLanguage(labelLanguage);
              setIsModalOpen(false);
            }}
          />
        </KoboModalFooter>
      </KoboModal>
    </div>
  );
}
