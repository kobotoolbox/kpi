import React, {ReactElement} from 'react'
import Button, {ButtonType, ButtonColor, ButtonSize} from 'js/components/common/button'

const buttonTypes: ButtonType[] = ['bare', 'frame', 'full']
const buttonColors: ButtonColor[] = ['blue', 'teal', 'green', 'red', 'orange', 'gray']
const buttonSizes: ButtonSize[] = ['s', 'm', 'l']

/**
 * This is a route for displaying our design system. It is meant as both
 * a developer tool and a UI testing tool for given instance/deployment.
 *
 * Some rules:
 * - don't use `t()` ever, just english strings
 */
export default class DesignSystemRoute extends React.Component<{}> {
  onAnyClick() {
    alert('Button clicked!')
  }

  renderAllButtons() {
    const buttonNodes: ReactElement[] = []

    buttonTypes.forEach((buttonType) => {
      buttonNodes.push(<h2>Type: {buttonType}</h2>)
      buttonColors.forEach((buttonColor) => {
        buttonSizes.forEach((buttonSize) => {
          buttonNodes.push((
            <Button
              type={buttonType}
              color={buttonColor}
              size={buttonSize}
              onClick={this.onAnyClick.bind(this)}
              label={`I'm ${buttonType} ${buttonColor} ${buttonSize}`}
            />
          ))
          buttonNodes.push((
            <Button
              type={buttonType}
              color={buttonColor}
              size={buttonSize}
              isDisabled={true}
              onClick={this.onAnyClick.bind(this)}
              label={`I'm ${buttonType} ${buttonColor} ${buttonSize} disabled`}
            />
          ))
          buttonNodes.push((
            <Button
              type={buttonType}
              color={buttonColor}
              size={buttonSize}
              isPending={true}
              onClick={this.onAnyClick.bind(this)}
              label={`I'm ${buttonType} ${buttonColor} ${buttonSize} pending`}
            />
          ))
          buttonNodes.push((
            <Button
              type={buttonType}
              color={buttonColor}
              size={buttonSize}
              onClick={this.onAnyClick.bind(this)}
              startIcon='trash'
            />
          ))
          buttonNodes.push((
            <Button
              type={buttonType}
              color={buttonColor}
              size={buttonSize}
              onClick={this.onAnyClick.bind(this)}
              startIcon='trash'
              label={`I'm ${buttonType} ${buttonColor} ${buttonSize} with start icon`}
            />
          ))
          buttonNodes.push((
            <Button
              type={buttonType}
              color={buttonColor}
              size={buttonSize}
              onClick={this.onAnyClick.bind(this)}
              endIcon='trash'
              label={`I'm ${buttonType} ${buttonColor} ${buttonSize} with end icon`}
            />
          ))
        })
      })
    })

    return buttonNodes
  }

  render() {
    return (
      <section className='form-view form-view--fullscreen'>
        <div className='form-view__cell form-view__cell--padding'>
          <h1><code>Button</code> component</h1>
          {this.renderAllButtons()}
        </div>
      </section>
    )
  }
}
