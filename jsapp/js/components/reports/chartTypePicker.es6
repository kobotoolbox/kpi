import React from 'react';
import autoBind from 'react-autobind';
import bem from 'js/bem';
import {REPORT_STYLES} from './reportsConstants';

/**
 * @prop {function} onChange
 * @prop {object} defaultStyle
 */
export default class ChartTypePicker extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
  }

  defaultReportStyleChange(evt) {
    this.props.onChange(
      {default: true},
      {report_type: evt.currentTarget.value || 'bar'}
    );
  }

  render() {
    let reportStylesOrdered = [
      REPORT_STYLES.vertical,
      REPORT_STYLES.donut,
      REPORT_STYLES.area,
      REPORT_STYLES.horizontal,
      REPORT_STYLES.pie,
      REPORT_STYLES.line,
    ];

    var radioButtons = reportStylesOrdered.map(function (style, i) {
      return (
        <bem.GraphSettings__radio m={style.value} key={i}>
          <input
            type='radio'
            name='chart_type'
            value={style.value}
            checked={this.props.defaultStyle.report_type === style.value}
            onChange={this.defaultReportStyleChange}
            id={'type-' + style.value}
          />
          <label htmlFor={'type-' + style.value}>{style.label}</label>
        </bem.GraphSettings__radio>
      );
    }, this);

    return (
      <bem.GraphSettings__charttype>
        {radioButtons}
      </bem.GraphSettings__charttype>
    );
  }
}
