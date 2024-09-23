import React from 'react';
import bem from 'js/bem';
import {CHART_COLOR_SETS} from './reportsConstants';
import type {ReportStyle, ChartColorSet} from './reportsConstants';

interface ChartColorsPickerProps {
  onChange: (params: {default: boolean}, value: {report_colors: string[]}) => void;
  defaultStyle: ReportStyle;
}

export default function ChartColorsPicker(props: ChartColorsPickerProps) {
  function defaultReportColorsChange(value: number) {
    let newColors = CHART_COLOR_SETS[0].colors;
    if (CHART_COLOR_SETS[value]?.colors) {
      newColors = CHART_COLOR_SETS[value].colors;
    }

    props.onChange({default: true}, {report_colors: newColors});
  }

  // Not sure why this is called "is default", and not simply "is active". This
  // needs some more investigation.
  function isDefaultValue(set: ChartColorSet, index: number) {
    if (props.defaultStyle.report_colors === undefined && index === 0) {
      return true;
    }

    return (
      JSON.stringify(props.defaultStyle.report_colors) ===
      JSON.stringify(set.colors)
    );
  }

  return (
    <bem.GraphSettings__colors>
      {CHART_COLOR_SETS.map((set, index) => (
        <bem.GraphSettings__radio key={index}>
          <input
            type='radio'
            name='chart_colors'
            value={index}
            checked={isDefaultValue(set, index)}
            onChange={() => defaultReportColorsChange(index)}
            id={'type-' + set.label}
          />

          <label htmlFor={'type-' + set.label}>
            {CHART_COLOR_SETS[index].colors.map((color, i) => (
              <div style={{backgroundColor: color}} key={i} />
            ))}
          </label>
        </bem.GraphSettings__radio>
      ))}
    </bem.GraphSettings__colors>
  );
}
