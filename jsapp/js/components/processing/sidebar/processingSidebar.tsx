import React, {useState} from 'react';
import singleProcessingStore, {
  StaticDisplays,
} from 'js/components/processing/singleProcessingStore';
import TransxDisplay from './transxDisplay';
import SidebarDisplaySettings from 'js/components/processing/sidebar/sidebarDisplaySettings';
import type {AssetResponse} from 'jsapp/js/dataInterface';
import SidebarSubmissionData from 'js/components/processing/sidebar/sidebarSubmissionData';
import SidebarSubmissionMedia from 'js/components/processing/sidebar/sidebarSubmissionMedia';
import {getActiveTab} from 'js/components/processing/routes.utils';
import styles from './processingSidebar.module.scss';

interface ProcessingSidebarProps {
  asset: AssetResponse;
}

export default function ProcessingSidebar(props: ProcessingSidebarProps) {
  const [store] = useState(() => singleProcessingStore);

  const displays = store.getDisplays(getActiveTab());
  const translations = store.getTranslations();
  const transcript = store.getTranscript();

  return (
    <div className={styles.root}>
      <SidebarDisplaySettings />

      <div className={styles.displays}>
        {Array.from(translations).map((translation) => {
          if (displays.includes(translation.languageCode)) {
            return (
              <TransxDisplay
                transx={translation}
                key={translation.languageCode}
              />
            );
          }

          return null;
        })}

        {displays.includes(StaticDisplays.Transcript) && transcript && (
          <TransxDisplay transx={transcript} />
        )}

        {displays.includes(StaticDisplays.Audio) && (
          <SidebarSubmissionMedia assetContent={props.asset.content} />
        )}

        {displays.includes(StaticDisplays.Data) && (
          <SidebarSubmissionData asset={props.asset} />
        )}

        {displays.length === 0 && (
          <div className={styles.emptyMessage}>
            {t(
              'Use the button above to select the information to be displayed in this area'
            )}
          </div>
        )}
      </div>
    </div>
  );
}
