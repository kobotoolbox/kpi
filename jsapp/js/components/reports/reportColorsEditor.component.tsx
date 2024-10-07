import React from 'react';
import bem from 'js/bem';
import {CHART_COLOR_SETS} from './reportsConstants';
import type {ReportStyle, ChartColorSet} from './reportsConstants';

interface ReportColorsEditorProps {
  onChange: (newColors: string[]) => void;
  /** The style that is being edited */
  style: ReportStyle;
}

export default function ReportColorsEditor(props: ReportColorsEditorProps) {
  function onStyleChange(value: number) {
    let newColors = CHART_COLOR_SETS[0].colors;
    if (CHART_COLOR_SETS[value]?.colors) {
      newColors = CHART_COLOR_SETS[value].colors;
    }

    props.onChange(newColors);
  }

  /**
   * Checks if given set of colors is the one that is being used by the style
   * that is being edited in this component instance.
   */
  function isChecked(set: ChartColorSet) {
    return (
      JSON.stringify(props.style.report_colors) ===
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
            checked={isChecked(set)}
            onChange={() => onStyleChange(index)}
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
