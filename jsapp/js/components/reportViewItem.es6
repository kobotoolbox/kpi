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
      s.reportTable = [];
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
    if (!this.refs.canvas) {
      return;
    }
    if (this.props.data.show_graph) {
      var opts = this.buildChartOptions();
      var canvas = this.refs.canvas.getDOMNode();
      var itemChart = new Chart(canvas, opts);
      this.setState({itemChart: itemChart});
    }
  },
  componentWillUpdate () {
    if (this.props.data.show_graph) {
      var canvas = this.refs.canvas.getDOMNode();
      var opts = this.buildChartOptions();
      let itemChart = this.state.itemChart;
      if (itemChart !== undefined) {
        itemChart.destroy();
        itemChart = new Chart(canvas, opts);
      }
    }
  },
  buildChartOptions () {
    var chart_type = this.props.style.report_type || 'bar';

    // TODO: set as default globally in a higher level (PM)
    var colors = this.props.style.report_colors || [
      'rgba(52, 106, 200, 0.8)',
      'rgba(252, 74, 124, 0.8)',
      'rgba(250, 213, 99, 0.8)',
      'rgba(113, 230, 33, 0.8)',
      'rgba(78, 203, 255, 0.8)',
      'rgba(253, 190, 76, 0.8)',
      'rgba(77, 124, 244, 0.8)',
      'rgba(33, 231, 184, 0.8)'
    ];

    var baseColor = colors[0];
    Chart.defaults.global.elements.rectangle.backgroundColor = baseColor;
    Chart.defaults.global.elements.line.borderColor = baseColor;
    Chart.defaults.global.elements.line.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    Chart.defaults.global.elements.point.backgroundColor = baseColor;
    Chart.defaults.global.elements.point.radius = 4;
    Chart.defaults.global.elements.arc.backgroundColor = baseColor;
    Chart.defaults.global.maintainAspectRatio = false;

    if (chart_type == 'donut') {
      chart_type = 'pie';
    }

    if (chart_type == 'area') {
      chart_type = 'line';
    }

    if (chart_type == 'horizontal') {
      chart_type = 'horizontalBar';
    }

    if (chart_type == 'vertical' || chart_type == 'bar_chart') {
      chart_type = 'bar';
    }

    var max_percentage = Math.max.apply(Math, this.props.data.percentages);    
    max_percentage = max_percentage < 85 ? ((parseInt(max_percentage/10, 10)+1)*10) : 100;


    var opts = {
      type: chart_type,
      data: {
          labels: this.props.data.responses,
          datasets: [{
              data: this.props.data.percentages,
          }]
      },
      options: {
        events: [''],
        legend: {
          display: false
        },
        animation: {
          duration: 500
        },
        scales: {
          xAxes: [{
            ticks: {
              autoSkip:false,
              beginAtZero: true,
              max: max_percentage
            },
            barPercentage: 0.5,
            gridLines: {
              display: chart_type == 'horizontalBar' ? true : false
            }
          }],
          yAxes: [{
            ticks: {
              autoSkip:false,
              beginAtZero: true,
              max: max_percentage
            },
            barPercentage: 0.5,
            gridLines: {
              display: chart_type == 'horizontalBar' ? false : true
            }
          }]
        },
      }
    };

    if (chart_type == 'pie') {
      opts.options.legend.display = true;
      opts.data.datasets[0].backgroundColor = colors;
      opts.options.scales = false;

      if (this.props.style.report_type == 'donut') {
        opts.options.cutoutPercentage = 50;
      }
    }

    if (this.props.style.report_type == 'area') {
      opts.data.datasets[0].backgroundColor = colors[0];
    }

    return opts;
  },
  render () {
    let p = this.props,
      d = p.data,
      r = p.row,
      _type = r.type;
    if (!_type) {
      console.error('No type given for row: ', this.props);
      return <p className='error'>{'Error displaying row: '}<code>{p.kuid}</code></p>;
    }
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
          {this.props.data.show_graph && 
            <bem.ReportView__chart
                style={{
                  // height: this.props.style.graphHeight, 
                  width: this.props.style.graphWidth, 
                  }}>
              <canvas ref="canvas" />
            </bem.ReportView__chart>
          }
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