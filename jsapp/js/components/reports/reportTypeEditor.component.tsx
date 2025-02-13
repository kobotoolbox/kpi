import React from 'react';
import {CHART_STYLES} from './reportsConstants';
import type {ReportStyle, ReportStyleName} from './reportsConstants';
import styles from './reportTypeEditor.module.scss';

interface ReportTypeEditorProps {
  onChange: (newType: ReportStyleName) => void;
  /** The style that is being edited */
  style: ReportStyle;
}

export default function ReportTypeEditor(props: ReportTypeEditorProps) {
  function onStyleChange(newStyle: ReportStyleName) {
    props.onChange(newStyle);
  }

  return (
    <section className={styles.root}>
      {Object.entries(CHART_STYLES).map(([, styleDefinition], i) => (
        <div key={i} className={styles.style} data-name={styleDefinition.value}>
          <input
            className={styles.styleInput}
            type='radio'
            name='chart_type'
            value={styleDefinition.value}
            checked={props.style.report_type === styleDefinition.value}
            onChange={() => onStyleChange(styleDefinition.value)}
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
