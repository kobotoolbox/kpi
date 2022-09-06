import React from 'react';
import ButtonDemo from 'js/designSystem/buttonDemo';
import CheckboxDemo from 'js/designSystem/checkboxDemo';
import IconDemo from 'js/designSystem/iconDemo';
import InlineMessageDemo from 'js/designSystem/inlineMessageDemo';
import KoboDropdownDemo from 'js/designSystem/koboDropdownDemo';
import KoboRangeDemo from 'js/designSystem/koboRangeDemo';
import KoboSelectDemo from 'js/designSystem/koboSelectDemo';
import LanguageSelectorDemo from 'js/designSystem/languageSelectorDemo';
import MiniAudioPlayerDemo from 'js/designSystem/miniAudioPlayerDemo';
import RadioDemo from 'js/designSystem/radioDemo';
import RegionSelectorDemo from 'js/designSystem/regionSelectorDemo';
import TextBoxDemo from 'js/designSystem/textboxDemo';
import './demo.scss';

const designSystemComponents = [
  <ButtonDemo/>,
  <CheckboxDemo/>,
  <IconDemo/>,
  <InlineMessageDemo/>,
  <KoboDropdownDemo/>,
  <KoboRangeDemo/>,
  <KoboSelectDemo/>,
  <LanguageSelectorDemo/>,
  <MiniAudioPlayerDemo/>,
  <RadioDemo/>,
  <RegionSelectorDemo/>,
  <TextBoxDemo/>,
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
            {designSystemComponents.map((component, key) => {
              const anchorName = `anchor-${key}`;
              return (
                <li>
                  <a href={`#${anchorName}`}>{component.type.displayName.replace('Demo', '')}</a>
                </li>
              );
            })}
          </ul>
          {designSystemComponents.map((component, key) => {
            const anchorName = `anchor-${key}`;
            return (
              <React.Fragment>
                <a id={anchorName}/>
                {component}
              </React.Fragment>
            );
          })}
        </div>
      </section>
    );
  }
}
