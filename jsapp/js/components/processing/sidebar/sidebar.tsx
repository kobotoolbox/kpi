import React, {useState} from 'react';
import singleProcessingStore, {StaticDisplays} from 'js/components/processing/singleProcessingStore';
import SingleProcessingTranslation from 'js/components/processing/singleProcessingTranslation';
import SidebarDisplaySettings from 'js/components/processing/sidebar/sidebarDisplaySettings';
import type {AssetResponse} from 'jsapp/js/dataInterface';
import style from './sidebar.module.scss';
import SingleProcessingSubmissionData from 'js/components/processing/sidebar/sidebarSubmissionData';
import SingleProcessingSubmissionMedia from 'js/components/processing/sidebar/sidebarSubmissionMedia';

interface SidebarProps {
  asset: AssetResponse;
}

export default function Sidebar(props: SidebarProps) {
  const [store] = useState(() => singleProcessingStore);

  const displays = store.getActiveDisplays();
  const translations = store.getTranslations();
  const transcription = store.getTranscript();

  return (
    <div className={style.root}>
      <SidebarDisplaySettings />

      {Array.from(translations).map((translation) => {
        if (
          displays.has(translation.languageCode)
        ) {
          return <SingleProcessingTranslation translation={translation} />;
        }

        return null;
      })}

      {displays.has(StaticDisplays.Transcript) && transcription && (
        <SingleProcessingTranslation translation={transcription} />
      )}

      {displays.has(StaticDisplays.Audio) && (
        <SingleProcessingSubmissionMedia asset={props.asset.content} />
      )}

      {displays.has(StaticDisplays.Data) && (
        <SingleProcessingSubmissionData asset={props.asset.content} />
      )}
    </div>
  );
}
