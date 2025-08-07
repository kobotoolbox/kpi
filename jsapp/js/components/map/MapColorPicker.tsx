import React from 'react'
import bem from '../../../js/bem'
import type { AssetMapStyles, ColorSetName } from '../../../js/dataInterface'

/** see `kobo.map.marker-colors.scss` for styling details of each set */
const COLOR_SETS: ColorSetName[] = ['a', 'b', 'c', 'd', 'e']

interface MapColorPickerProps {
  mapSettings: AssetMapStyles
  onChange: (colorSet: ColorSetName) => void
}

interface MapColorPickerState {
  selected: ColorSetName
}

export default class MapColorPicker extends React.Component<MapColorPickerProps, MapColorPickerState> {
  constructor(props: MapColorPickerProps) {
    super(props)

    this.state = {
      selected: props.mapSettings.colorSet ? props.mapSettings.colorSet : 'a',
    }
  }

  onChange(newSelectedSet: ColorSetName) {
    this.props.onChange(newSelectedSet)
    this.setState({ selected: newSelectedSet })
  }

  defaultValue(set: ColorSetName) {
    return this.state.selected === set
  }

  colorRows(set: ColorSetName, length = 10) {
    const colorRows = []
    for (let i = 1; i < length; i++) {
      colorRows.push(<span key={i} className={`map-marker map-marker-${set}${i}`} />)
    }
    return colorRows
  }

  render() {
    var radioButtons = COLOR_SETS.map((set, index) => {
      let length = 10
      let label: string | undefined
      if (set === 'a') {
        length = 16
      }
      if (set === 'a') {
        label = t('Best for qualitative data')
      }
      if (set === 'b') {
        label = t('Best for sequential data')
      }
      if (set === 'd') {
        label = t('Best for diverging data')
      }
      return (
        <bem.FormModal__item m='map-color-item' key={index}>
          {label && <label>{label}</label>}
          <bem.GraphSettings__radio>
            <input
              type='radio'
              name='chart_colors'
              value={set}
              checked={this.defaultValue(set)}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                this.onChange(e.currentTarget.value as ColorSetName)
              }}
              id={'c-' + index}
            />
            <label htmlFor={'c-' + index}>{this.colorRows(set, length)}</label>
          </bem.GraphSettings__radio>
        </bem.FormModal__item>
      )
    })

    return <bem.GraphSettings__colors>{radioButtons}</bem.GraphSettings__colors>
  }
}
