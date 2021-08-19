import React from 'react';
import autoBind from 'react-autobind';
import bem from 'js/bem';
import {REPORT_COLOR_SETS} from './reportsConstants';

/**
 * @prop {function} onChange
 * @prop {object} defaultStyle
 */
export default class ChartColorsPicker extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
  }

  defaultReportColorsChange(evt) {
    let newColors = REPORT_COLOR_SETS[0].colors;
    if (
      REPORT_COLOR_SETS[evt.currentTarget.value] &&
      REPORT_COLOR_SETS[evt.currentTarget.value].colors
    ) {
      newColors = REPORT_COLOR_SETS[evt.currentTarget.value].colors;
    }

    this.props.onChange({default: true}, {report_colors: newColors});
  }

  defaultValue(set, index) {
    if (this.props.defaultStyle.report_colors === undefined && index === 0) {
      return true;
    }

    return (
      JSON.stringify(this.props.defaultStyle.report_colors) ===
      JSON.stringify(set.colors)
    );
  }

  render() {
    var radioButtons = REPORT_COLOR_SETS.map(function (set, index) {
      return (
        <bem.GraphSettings__radio key={index}>
          <input
            type='radio'
            name='chart_colors'
            value={index}
            checked={this.defaultValue(set, index)}
            onChange={this.defaultReportColorsChange}
            id={'type-' + set.label}
          />
          <label htmlFor={'type-' + set.label}>
            {REPORT_COLOR_SETS[index].colors.map(function (color, i) {
              return <div style={{backgroundColor: color}} key={i} />;
            }, this)}
          </label>
        </bem.GraphSettings__radio>
      );
    }, this);

    return (
      <bem.GraphSettings__colors>{radioButtons}</bem.GraphSettings__colors>
    );
  }
}
