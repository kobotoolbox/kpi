import React from 'react';
import ButtonDemo from 'js/designSystem/buttonDemo'
import CheckboxDemo from 'js/designSystem/checkboxDemo'
import IconDemo from 'js/designSystem/iconDemo'
import InlineMessageDemo from 'js/designSystem/inlineMessageDemo'
import KoboDropdownDemo from 'js/designSystem/koboDropdownDemo'
import KoboModalDemo from 'js/designSystem/koboModalDemo'
import KoboPromptDemo from 'js/designSystem/koboPromptDemo'
import KoboRangeDemo from 'js/designSystem/koboRangeDemo'
import KoboSelectDemo from 'js/designSystem/koboSelectDemo'
import MiniAudioPlayerDemo from 'js/designSystem/miniAudioPlayerDemo'
import RadioDemo from 'js/designSystem/radioDemo'
import TextBoxDemo from 'js/designSystem/textboxDemo'
import './demo.scss'

import ProjectsFilter from 'js/components/projectsView/projectsFilter'; // TODO TEMP TEST DELETE ME

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
        {/*TODO TEMP TEST DELETE ME*/}
        <ProjectsFilter
          onFiltersChange={(filters) => {console.log(filters);}}
          filters={[]}
        />
        {/*END TODO TEMP TEST DELETE ME*/}

        <div className='design-system__demo-wrapper'>
          <ButtonDemo/>
          <CheckboxDemo/>
          <IconDemo/>
          <InlineMessageDemo/>
          <KoboDropdownDemo/>
          <KoboModalDemo/>
          <KoboPromptDemo/>
          <KoboRangeDemo/>
          <KoboSelectDemo/>
          <MiniAudioPlayerDemo/>
          <RadioDemo/>
          <TextBoxDemo/>
        </div>
      </section>
    )
  }
}
