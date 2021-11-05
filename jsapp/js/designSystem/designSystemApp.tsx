import React from 'react';
import IconDemo from 'js/designSystem/iconDemo'
import ButtonDemo from 'js/designSystem/buttonDemo'
import KoboDropdownDemo from 'js/designSystem/koboDropdownDemo'
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
          <IconDemo/>
          <ButtonDemo/>
          <KoboDropdownDemo/>
        </div>
      </section>
    )
  }
}
