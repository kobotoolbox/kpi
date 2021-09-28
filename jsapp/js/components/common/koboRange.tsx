import React from 'react'
import bem, {makeBem} from 'js/bem'
import 'js/components/common/audioPlayer.scss'

bem.KoboRange = makeBem(null, 'kobo-range')
bem.KoboRange__values = makeBem(bem.KoboRange, 'values', 'div')
bem.KoboRange__maxValue = makeBem(bem.KoboRange, 'max-value', 'span')
bem.KoboRange__currentValue = makeBem(bem.KoboRange, 'current-value', 'span')
bem.KoboRange__progress = makeBem(bem.KoboRange, 'progress', 'div')
bem.KoboRange__input = makeBem(bem.KoboRange, 'input', 'input')

export enum KoboRangeColours {
  'default' =  'default',
  'warning' = 'warning',
}

type KoboRangeProps = {
  max: number,
  value: number,
  /** uses time display for all required values */
  isTime: boolean,
  /** string displayed next to minimum value */
  minString?: string,
  /** string displayed next to maximum value */
  maxString?: string,
  onChange: Function,
  /** defaults to $kobo-teal */
  color?: string,
}

type KoboRangeState = {
  currentValue: number,
}

/**
 * Extendable custom styled range input
 *
 */
export default class KoboRange extends React.Component<KoboRangeProps, KoboRangeState> {

  constructor(props: KoboRangeProps) {
    super(props)

    this.state = {
      currentValue: props.value,
    }
  }

  /* We deal internally with un-converted time for easier computing. Only use
   * this if `props.isTime` and when it's time to display
   *
   * @param {float} time - HTMLElementAudio.duration returns a float in seconds
   */

  convertToClock(time: number) {
    let minutes = Math.floor(time / 60)
    // The duration is given in decimal seconds, so we have to do ceiling here
    let seconds = Math.ceil(time - minutes * 60)

    let finalSeconds: string;
    if (seconds < 10) {
      finalSeconds = '0' + seconds
    } else {
      finalSeconds = String(seconds)
    }

    return minutes + ':' + finalSeconds
  }

  render() {

    return (
      <bem.KoboRange>
        <bem.KoboRange__values>
          <bem.KoboRange__currentValue>
            {!this.props.isTime && this.state.currentValue}
            {this.props.isTime && this.convertToClock(this.state.currentValue)}
          </bem.KoboRange__currentValue>

          <bem.KoboRange__maxValue>
            {!this.props.isTime && this.props.max}
            {this.props.isTime && this.convertToClock(this.props.max)}
          </bem.KoboRange__maxValue>
        </bem.KoboRange__values>

        <bem.KoboRange__progress>
          <bem.KoboRange__input
            m={this.props?.color}
            type='range'
            max={this.props.max}
            value={this.state.currentValue}
            onChange={this.props.onChange()}
          />
        </bem.KoboRange__progress>
      </bem.KoboRange>
    )
  }
}

export default KoboRange
