import React from 'react';
import {REPORT_STYLES} from './reportsConstants';
import type {ReportStyleName} from './reportsConstants';
import styles from './chartTypePicker.module.scss';

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
    <section className={styles.root}>
      {Object.entries(REPORT_STYLES).map(([, styleDefinition], i) => (
        <div key={i} className={styles.style} data-name={styleDefinition.value}>
          <input
            className={styles.styleInput}
            type='radio'
            name='chart_type'
            value={styleDefinition.value}
            checked={props.defaultStyle.report_type === styleDefinition.value}
            onChange={() => defaultReportStyleChange(styleDefinition.value)}
            id={'type-' + styleDefinition.value}
          />

          <label
            className={styles.styleLabel}
            htmlFor={'type-' + styleDefinition.value}
          >
            {styleDefinition.label}
          </label>
        </div>
      ))}
    </section>
  );
}
