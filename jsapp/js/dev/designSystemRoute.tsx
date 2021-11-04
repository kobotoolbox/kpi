import React from 'react'
import ButtonDemo from 'js/dev/buttonDemo'

/**
 * This is a route for displaying our design system. It is meant as both
 * a developer tool and a UI testing tool for given instance/deployment.
 *
 * Some rules:
 * - don't use `t()` ever, just english strings
 */
export default class DesignSystemRoute extends React.Component<{}> {
  render() {
    return (
      <section className='form-view form-view--fullscreen'>
        <div className='form-view__cell form-view__cell--padding'>
          <ButtonDemo/>
        </div>
      </section>
    )
  }
}
