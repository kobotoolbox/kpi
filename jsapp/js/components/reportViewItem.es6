import React from 'react/addons';
import _ from 'underscore';
import Chart from 'chart.js';
import bem from '../bem';
import $ from 'jquery';

import {t} from '../utils';

var ReportTable = React.createClass({
  render () {
    return (
        <table>
          <thead>
            <tr>
              <th>{t('Value')}</th>
              <th className="right-align">{t('Frequency')}</th>
              <th className="right-align">{t('Percentage')}</th>
            </tr>
          </thead>
          <tbody>
            {this.props.rows.map((row)=>{
              let [value, frequency, percentage] = row;
              return (
                  <tr key={value}>
                    <td>{value}</td>
                    <td className="right-align">{frequency}</td>
                    <td className="right-align">{percentage}</td>
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
      s.reportTable = {};
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
    this.rebuildChart();
  },
  componentDidUpdate () {
    this.rebuildChart();
  },
  rebuildChart () {
    var opts = {
      type: this.props.style.report_type,
      data: {
          labels: this.props.data.responses,
          datasets: [{
              data: this.props.data.frequencies,
              backgroundColor: [
                'rgba(52, 106, 200, 1)',
                'rgba(252, 74, 124, 1)',
                'rgba(250, 213, 99, 1)',
                'rgba(113, 230, 33, 1)',
                'rgba(78, 203, 255, 1)',
                'rgba(253, 190, 76, 1)',
                'rgba(77, 124, 244, 1)',
                'rgba(33, 231, 184, 1)'
              ]
          }]
      },
      options: {
        events: [''],
        cutoutPercentage: 50,
        animation: {
          duration: 0
        },
      }
    };

    if (this.props.style.report_type!='pie') {
      opts.options.legend = false;
    }

    var canvas = this.refs.canvas.getDOMNode();
    var myChart = false;
    myChart = new Chart(canvas, opts);

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
        <bem.ReportView__itemHeading>
          <h2>
            {this.props.row.label}
          </h2>
          <bem.ReportView__headingMeta>
            <span className="type">
              {
                t('Type: ') + _type + t('. ')
              }
            </span>
            <span className="respondents">
              {
                t('#1 out of #2 respondents answered this question. ')
                  .replace('#1', d.provided)
                  .replace('#2', d.total_count)
              }
            </span>
            <span>
              {
                t('(# were without data.)').replace('#', d.not_provided)
              }
            </span>
          </bem.ReportView__headingMeta>
        </bem.ReportView__itemHeading>
        <bem.ReportView__itemContent>
          <bem.ReportView__chart>
            <canvas ref="canvas"></canvas>
          </bem.ReportView__chart>

          <code className="is-edge" style={{fontSize:10,lineHeight:'11px'}}>
            <pre>
              {JSON.stringify(this.props, null, 4)}
            </pre>
          </code>

          <ReportTable
            rows={this.state.reportTable}
          />
        </bem.ReportView__itemContent>

      </div>
      );
  },
});

export default ReportViewItem;