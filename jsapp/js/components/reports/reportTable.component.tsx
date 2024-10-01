import React from 'react';
import clonedeep from 'lodash.clonedeep';
import type {
  ReportsResponseData,
  ReportsResponseDataValues,
} from './reportsConstants';
import type {PreparedTable} from './reportViewItem.component';

interface ReportTableProps {
  type: 'regular' | 'numerical' | 'disaggregated';
  rows?: PreparedTable | ReportsResponseDataValues;
  responseLabels?: string[];
  values?: ReportsResponseData;
}

function formatNumber(x: number | '*' | undefined) {
  if (typeof x === 'number') {
    return x.toFixed(2);
  }
  return x;
}

export default class ReportTable extends React.Component<ReportTableProps> {
  render() {
    let th = [''];
    let rows: PreparedTable | ReportsResponseDataValues = [];

    if (this.props.type === 'numerical') {
      th = [t('Mean'), t('Median'), t('Mode'), t('Standard deviation')];
      if (this.props.rows) {
        th.unshift('');
      }

      return (
        <table>
          <thead>
            <tr>
              {th.map((t, i) => (
                <th key={i}>{t}</th>
              ))}
            </tr>
          </thead>
          {this.props.values && (
            <tbody>
              <tr>
                <td>{formatNumber(this.props.values.mean) || t('N/A')}</td>
                <td>{formatNumber(this.props.values.median) || t('N/A')}</td>
                <td>{formatNumber(this.props.values.mode) || t('N/A')}</td>
                <td>{formatNumber(this.props.values.stdev) || t('N/A')}</td>
              </tr>
            </tbody>
          )}
          {this.props.rows && (
            <tbody>
              {this.props.rows.map((rowItem) => {
                if (typeof rowItem[1] === 'object' && 'mean' in rowItem[1]) {
                  return (
                    <tr key={rowItem[0]}>
                      <td>{rowItem[0]}</td>
                      <td>{formatNumber(rowItem[1]?.mean) || t('N/A')}</td>
                      <td>{formatNumber(rowItem[1]?.median) || t('N/A')}</td>
                      <td>{formatNumber(rowItem[1]?.mode) || t('N/A')}</td>
                      <td>{formatNumber(rowItem[1]?.stdev) || t('N/A')}</td>
                    </tr>
                  );
                }

                return null;
              })}
            </tbody>
          )}
        </table>
      );
    }

    if (this.props.type === 'regular') {
      th = [t('Value'), t('Frequency'), t('Percentage')];
      if (this.props.rows) {
        rows = this.props.rows;
      }
    }

    if (
      this.props.type === 'disaggregated' &&
      this.props.rows &&
      this.props.rows.length > 0
    ) {
      const rowsB = clonedeep(this.props.rows) || [];
      if (this.props.responseLabels) {
        th = th.concat(this.props.responseLabels);
      } else if (
        typeof rowsB?.[0]?.[1] === 'object' &&
        'responses' in rowsB?.[0]?.[1] &&
        rowsB?.[0]?.[1]?.responses
      ) {
        th = th.concat(rowsB[0][1].responses);
      }

      rowsB.map((row) => {
        let rowitem = row[2] ? [row[2]] : [row[0]];
        if (row[1] && typeof row[1] === 'object' && 'percentages' in row[1]) {
          rowitem = rowitem.concat(row[1].percentages);
        }
        // TODO: this whole component is hard to read and is doing multiple
        // things at once. Some TypeScript juggling was possible, but here
        // pushing that new `rowitem` into `rows` is definitely a bad code, one
        // that TypeScript can't wrap its head around. For now we get away with
        // using dirty workaround. I imagine a fix would mean rewriting this
        // component from scratch.
        rows.push(rowitem as any);
      });
    }

    if (rows.length === 0) {
      return false;
    }

    return (
      <table>
        <thead>
          <tr>
            {th.map((t, i) => (
              <th key={i}>{t}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[0]}>
              {row.map((r, i: number) => (
                // Note: See TODO above. ReportTableProps probably deserves a
                // second look, and TypeScript is trying to tell us something
                // about the value of 'r' here.
                <td key={i} dir='auto'>{r as React.ReactNode}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
}
