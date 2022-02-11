import React from 'react'
import bem, {makeBem} from 'js/bem'
import './koboRange.scss'

bem.KoboRange = makeBem(null, 'kobo-range')
bem.KoboRange__values = makeBem(bem.KoboRange, 'values', 'div')
bem.KoboRange__maxValue = makeBem(bem.KoboRange, 'max-value', 'span')
bem.KoboRange__currentValue = makeBem(bem.KoboRange, 'current-value', 'span')
bem.KoboRange__number = makeBem(bem.KoboRange, 'number', 'span')
bem.KoboRange__unit = makeBem(bem.KoboRange, 'unit', 'span')
bem.KoboRange__progress = makeBem(bem.KoboRange, 'progress', 'div')
bem.KoboRange__input = makeBem(bem.KoboRange, 'input', 'input')

export enum KoboRangeColors {
  'default' =  'default',
  'warning' = 'warning',
  'teal' = 'teal',
}

type KoboRangeProps = {
  max: number,
  /** `value` should be un-converted seconds if using `isTime` */
  value: number,
  /** uses time display for all required values */
  isTime?: boolean,
  isDisabled?: boolean,
  /** required for input to be enabled (disabled without)*/
  onChange?: Function,
  /** defaults to $kobo-blue */
  color?: KoboRangeColors,
  /** optional string to append to max */
  totalLabel?: string,
  /** optional string to append to value */
  currentLabel?: string,
}

/**
 * Extendable custom styled range input
 *
 */
export default class KoboRange extends React.Component<KoboRangeProps> {
  constructor(props: KoboRangeProps) {
    super(props)
  }

  /** We deal internally with un-converted seconds for easier computing. Only use
   * this if `props.isTime` and when it's time to display
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

  onChange(evt: React.ChangeEvent<HTMLInputElement> | any) {
    if (this.props.onChange) {
      const currentValue = evt.currentTarget.value
      this.props.onChange(currentValue)
    }
  }

  render() {
    let isDataLoaded = !(this.props.max === 0)

    return (
      <bem.KoboRange>
        {isDataLoaded &&
          <bem.KoboRange__values>
            <bem.KoboRange__currentValue>
              <bem.KoboRange__number>
                {!this.props.isTime && this.props.value}
                {this.props.isTime && this.convertToClock(this.props.value)}
              </bem.KoboRange__number>

              <bem.KoboRange__unit>
                {this.props.currentLabel}
              </bem.KoboRange__unit>
            </bem.KoboRange__currentValue>

            <bem.KoboRange__maxValue>
              <bem.KoboRange__number>
                {!this.props.isTime && this.props.max}
                {this.props.isTime && this.convertToClock(this.props.max)}
              </bem.KoboRange__number>

              <bem.KoboRange__unit>
                {this.props.totalLabel}
              </bem.KoboRange__unit>
            </bem.KoboRange__maxValue>
          </bem.KoboRange__values>
        }

        <bem.KoboRange__progress>
          <bem.KoboRange__input
            m={this.props?.color ? this.props.color : KoboRangeColors.default}
            type='range'
            max={this.props.max}
            value={this.props.value}
            disabled={!this.props.onChange || this.props.isDisabled}
            onChange={this.props?.onChange && this.onChange.bind(this)}
          />
        </bem.KoboRange__progress>
      </bem.KoboRange>
    )
  }
}
