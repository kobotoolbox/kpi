import React, {useState} from 'react';
import singleProcessingStore, {
  StaticDisplays,
} from 'js/components/processing/singleProcessingStore';
import TransxDisplay from './transxDisplay';
import SidebarDisplaySettings from 'js/components/processing/sidebar/sidebarDisplaySettings';
import type {AssetResponse} from 'jsapp/js/dataInterface';
import SidebarSubmissionData from 'js/components/processing/sidebar/sidebarSubmissionData';
import SidebarSubmissionMedia from 'js/components/processing/sidebar/sidebarSubmissionMedia';

import styles from './processingSidebar.module.scss';

interface ProcessingSidebarProps {
  asset: AssetResponse;
}

export default function ProcessingSidebar(props: ProcessingSidebarProps) {
  const [store] = useState(() => singleProcessingStore);

  const displays = store.getActiveDisplays();
  const translations = store.getTranslations();
  const transcription = store.getTranscript();

  return (
    <div className={styles.root}>
      <SidebarDisplaySettings />

      <div className={styles.displays}>
        {Array.from(translations).map((translation) => {
          if (displays.has(translation.languageCode)) {
            return <TransxDisplay transx={translation} />;
          }

          return null;
        })}

        {displays.has(StaticDisplays.Transcript) && transcription && (
          <TransxDisplay transx={transcription} />
        )}

        {displays.has(StaticDisplays.Audio) && (
          <SidebarSubmissionMedia asset={props.asset.content} />
        )}

        {displays.has(StaticDisplays.Data) && (
          <SidebarSubmissionData asset={props.asset.content} />
        )}
      </div>
    </div>
  );
}
