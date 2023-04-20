import React, {useState} from 'react';
import singleProcessingStore, {SingleProcessingTabs, StaticDisplays} from 'js/components/processing/singleProcessingStore';
import SingleProcessingPreview from './singleProcessingPreview';
import SingleProcessingTranslation from 'js/components/processing/singleProcessingTranslation';
import SingleProcessingDisplaySettings from 'js/components/processing/singleProcessingDisplaySettings';
import SingleProcessingSubmissionDetails from 'js/components/processing/singleProcessingSubmissionDetails';
import {AssetResponse} from 'jsapp/js/dataInterface';
import style from './singleProcessingSidebar.module.scss';
import SingleProcessingSubmissionData from 'js/components/processing/singleProcessingSubmissionData';
import SingleProcessingSubmissionMedia from 'js/components/processing/singleProcessingSubmissionMedia';

interface SingleProcessingSidebarProps {
  asset: AssetResponse;
}

export default function SingleProcessingSidebar(props: SingleProcessingSidebarProps) {
  const [store] = useState(() => singleProcessingStore);

  const displays = store.getDisplays();

  // TODO: [x] Make a better barebones transition.value preview
  //       Figure out when to actually update the map of available/active translations
  //       - After submitting a new translation the getDisplays is not updated
  //       - Display the correct # of translations per question
  //         - Right now, if there is a question with no translation it will show the last
  //           translation in the modal(bad), but clicking the toggle shows nothing (good)
  //       [x] Make the translations unavailable for the translation tab
  //       Get the default displays defined somewhere
  
  const translations = store.getTranslations();
  const transcription = store.getTranscript();
  const currentTab = store.getActiveTab();

  return (
    <div className={style.root}>
      <SingleProcessingDisplaySettings />

      <SingleProcessingPreview />

      {Array.from(translations).map((translation) => {
        if (
          displays.get(translation.languageCode) &&
          !(currentTab === SingleProcessingTabs.Translations)
        ) {
          return <SingleProcessingTranslation singleTransx={translation} />;
        }

        return null;
      })}

      {displays.get(StaticDisplays.Transcript) && transcription && (
        <SingleProcessingTranslation singleTransx={transcription} />
      )}

      {displays.get(StaticDisplays.Audio) && (
        <SingleProcessingSubmissionMedia asset={props.asset.content} />
      )}

      {displays.get(StaticDisplays.Data) && (
        <SingleProcessingSubmissionData asset={props.asset.content} />
      )}
    </div>
  );
}
