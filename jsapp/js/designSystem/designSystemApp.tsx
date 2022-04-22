import React from 'react';
import ButtonDemo from 'js/designSystem/buttonDemo'
import CheckboxDemo from 'js/designSystem/checkboxDemo'
import IconDemo from 'js/designSystem/iconDemo'
import KoboDropdownDemo from 'js/designSystem/koboDropdownDemo'
import KoboRangeDemo from 'js/designSystem/koboRangeDemo'
import KoboSelectDemo from 'js/designSystem/koboSelectDemo'
import RadioDemo from 'js/designSystem/radioDemo'
import TextBoxDemo from 'js/designSystem/textboxDemo'
import './demo.scss'

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
          <ButtonDemo/>
          <CheckboxDemo/>
          <IconDemo/>
          <KoboDropdownDemo/>
          <KoboRangeDemo/>
          <KoboSelectDemo/>
          <RadioDemo/>
          <TextBoxDemo/>
        </div>
      </section>
    )
  }
}
