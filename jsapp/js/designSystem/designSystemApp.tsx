import React from 'react';
import KoboPromptDemo from 'js/designSystem/koboPromptDemo';
import KoboRangeDemo from 'js/designSystem/koboRangeDemo';
import KoboSelectDemo from 'js/designSystem/koboSelectDemo';
import LanguageSelectorDemo from 'js/designSystem/languageSelectorDemo';
import MiniAudioPlayerDemo from 'js/designSystem/miniAudioPlayerDemo';
import MultiCheckboxDemo from 'js/designSystem/multiCheckboxDemo';
import RadioDemo from 'js/designSystem/radioDemo';
import RegionSelectorDemo from 'js/designSystem/regionSelectorDemo';
import TextBoxDemo from 'js/designSystem/textboxDemo';
import './demo.scss';

const designSystemComponents = [
  ['KoboPrompt', <KoboPromptDemo/>],
  ['KoboRange', <KoboRangeDemo/>],
  ['KoboSelect', <KoboSelectDemo/>],
  ['LanguageSelector', <LanguageSelectorDemo/>],
  ['MiniAudioPlayer', <MiniAudioPlayerDemo/>],
  ['MultiCheckboxDemo', <MultiCheckboxDemo/>],
  ['Radio', <RadioDemo/>],
  ['RegionSelector', <RegionSelectorDemo/>],
  ['TextBox', <TextBoxDemo/>],
];

/**
 * This is an app for displaying our design system. It is meant as both
 * a developer tool and a UI testing tool for given instance/deployment.
 *
 * Some rules:
 * - never use `t()`, just english strings - to not cause unnecessary work
 *   for translators
 */
export default class DesignSystemApp extends React.Component {
  render() {
    return (
      <section className='design-system'>
        <div className='design-system__demo-wrapper'>
          <ul>
            {designSystemComponents.map((componentArray, key) => {
              const anchorName = `anchor-${key}`;
              return (
                <li>
                  <a href={`#${anchorName}`}>{componentArray[0]}</a>
                </li>
              );
            })}
          </ul>
          {designSystemComponents.map((componentArray, key) => {
            const anchorName = `anchor-${key}`;
            return (
              <React.Fragment>
                <a id={anchorName}/>
                {componentArray[1]}
              </React.Fragment>
            );
          })}
        </div>
      </section>
    );
  }
}
