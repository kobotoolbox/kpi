import React from 'react';

export default class ReportTable extends React.Component {
  constructor(props) {
    super(props);
  }

  formatNumber(x) {
    if (isNaN(x)) {
      return x;
    }
    return x.toFixed(2);
  }

  render() {
    let th = [''];
    let rows = [];

    if (this.props.type === 'numerical') {
      th = [t('Mean'), t('Median'), t('Mode'), t('Standard deviation')];
      if (this.props.rows) {
        th.unshift('');
      }
      if (this.props.values) {
        var v = this.props.values;
      }
      return (
        <table>
          <thead>
            <tr>
              {th.map((t, i) => {
                return <th key={i}>{t}</th>;
              })}
            </tr>
          </thead>
          {this.props.values && (
            <tbody>
              <tr>
                <td>{this.formatNumber(v.mean) || t('N/A')}</td>
                <td>{this.formatNumber(v.median) || t('N/A')}</td>
                <td>{this.formatNumber(v.mode) || t('N/A')}</td>
                <td>{this.formatNumber(v.stdev) || t('N/A')}</td>
              </tr>
            </tbody>
          )}
          {this.props.rows && (
            <tbody>
              {this.props.rows.map((r) => {
                return (
                  <tr key={r[0]}>
                    <td>{r[0]}</td>
                    <td>{this.formatNumber(r[1].mean) || t('N/A')}</td>
                    <td>{this.formatNumber(r[1].median) || t('N/A')}</td>
                    <td>{this.formatNumber(r[1].mode) || t('N/A')}</td>
                    <td>{this.formatNumber(r[1].stdev) || t('N/A')}</td>
                  </tr>
                );
              })}
            </tbody>
          )}
        </table>
      );
    }
    if (this.props.type === 'regular') {
      th = [t('Value'), t('Frequency'), t('Percentage')];
      rows = this.props.rows;
      // prepare table data for disaggregated rows
    } else if (this.props.rows.length > 0) {
      let rowsB = this.props.rows;
      if (this.props.responseLabels) {
        th = th.concat(this.props.responseLabels);
      } else if (rowsB[0] && rowsB[0][1] && rowsB[0][1].responses) {
        th = th.concat(rowsB[0][1].responses);
      }

      rowsB.map((row) => {
        var rowitem = row[2] ? [row[2]] : [row[0]];
        rowitem = rowitem.concat(row[1].percentages);
        rows.push(rowitem);
      });
    }

    if (rows.length === 0) {
      return false;
    }

    return (
      <table>
        <thead>
          <tr>
            {th.map((t, i) => {
              return <th key={i}>{t}</th>;
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            return (
              <tr key={row[0]}>
                {row.map((r, i) => {
                  return <td key={i}>{r}</td>;
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }
}
