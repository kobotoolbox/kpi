import React from 'react/addons';
import _ from 'underscore';
import Chart from 'chart.js';

import {t} from '../utils';

var ReportTable = React.createClass({
  render () {
    return (
        <table>
          <thead>
            <tr>
              <th>{t('Value')}</th>
              <th>{t('Frequency')}</th>
              <th>{t('Percentage')}</th>
            </tr>
          </thead>
          <tbody>
            {this.props.rows.map((row)=>{
              let [value, frequency, percentage] = row;
              return (
                  <tr>
                    <td>{value}</td>
                    <td>{frequency}</td>
                    <td>{percentage}</td>
                  </tr>
                );
            })}
          </tbody>
        </table>
      )
  },
});

var ReportViewItem = React.createClass({
  getInitialState () {
    let p = this.props,
      d = p.data,
      s = {};
    if (d.percentages && d.responses && d.frequencies) {
      s.reportTable = _.zip(
          d.responses,
          d.frequencies,
          d.percentages,
        );
    }
    return s;
  },
  componentDidMount () {
    if (this.report_type == 'bar_chart') {
      console.log('Build chart with data', this.props.data, Chart);
    }
  },
  render () {
    let d = this.props.data,
      r = this.props.row,
      _type = r.type;
    if (_type.select_one || _type.select_multiple) {
      _type = _.keys(_type)[0];
    }
    _type = JSON.stringify(_type);

    return (
      <div>
        <h2>
          {this.props.row.label}
        </h2>
        <p>
          <span>
            {
              t('#1 out of #2 respondents answered this question.')
                .replace('#1', d.provided)
                .replace('#2', d.total_count)
            }
          </span>
          <span>
            {
              t('# were without data').replace('#', d.not_provided)
            }
          </span>
          <span>
            {
              t('Question type: ') + _type
            }
          </span>
        </p>
        <code style={{fontSize:10,lineHeight:'11px'}}>
          <pre>
            {JSON.stringify(this.props, null, 4)}
          </pre>
        </code>
        { this.state.reportTable ?
          <ReportTable
            rows={this.state.reportTable}
          />
        : null}
      </div>
      );
  },
});

export default ReportViewItem;