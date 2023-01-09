import React from 'react';
import LanguageSelectorDemo from 'js/designSystem/languageSelectorDemo';
import './demo.scss';

const designSystemComponents = [
  // Contains reflux, cannot easily port to Storybook
  ['LanguageSelector', <LanguageSelectorDemo/>],
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
