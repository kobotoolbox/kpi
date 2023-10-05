import React from 'react';
import bem from 'js/bem';
import {REPORT_STYLES} from './reportsConstants';
import type {ReportStyleName} from './reportsConstants';

interface ChartTypePickerProps {
  onChange: (
    params: {default: boolean},
    value: {report_type: ReportStyleName}
  ) => void;
  defaultStyle: {
    report_type: ReportStyleName;
  };
}

export default function ChartTypePicker(props: ChartTypePickerProps) {
  function defaultReportStyleChange(newStyle: ReportStyleName) {
    props.onChange({default: true}, {report_type: newStyle || 'bar'});
  }

  return (
    <bem.GraphSettings__charttype>
      {Object.entries(REPORT_STYLES).map(([, styleDefinition], i) => (
        <bem.GraphSettings__radio m={styleDefinition.value} key={i}>
          <input
            type='radio'
            name='chart_type'
            value={styleDefinition.value}
            checked={props.defaultStyle.report_type === styleDefinition.value}
            onChange={() => defaultReportStyleChange(styleDefinition.value)}
            id={'type-' + styleDefinition.value}
          />
          <label htmlFor={'type-' + styleDefinition.value}>
            {styleDefinition.label}
          </label>
        </bem.GraphSettings__radio>
      ))}
    </bem.GraphSettings__charttype>
  );
}
