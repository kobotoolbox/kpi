import React from 'react';
import ReactDOM from 'react-dom';
import _ from 'underscore';
import Chart from 'chart.js';
import bem from '../bem';
import $ from 'jquery';

import {t, assign} from '../utils';

var ReportTable = React.createClass({
  render () {
    let th = [''], rows = [];
    if (this.props.type === 'numerical') {
      th = [t('Mean'), t('Median'), t('Mode'), t('Standard deviation')];
      return (
        <table>
          <thead>
            <tr>
              {th.map((t,i)=>{
                return (<th key={i}>{t}</th>);
              })}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{this.props.rows.mean || t('N/A')}</td>
              <td>{this.props.rows.median || t('N/A')}</td>
              <td>{this.props.rows.mode || t('N/A')}</td>
              <td>{this.props.rows.stdev || t('N/A')}</td>
            </tr>
          </tbody>
        </table>
      );
    }
    if (this.props.type === 'regular') {
      th = [t('Value'), t('Frequency'), t('Percentage')];
      rows = this.props.rows;
    } else {
      th = th.concat(this.props.rows[0][1].responses);
      this.props.rows.map((row, i)=> {
        var rowitem = [row[0]];
        rowitem = rowitem.concat(row[1].percentages);
        rows.push(rowitem);
      });
    }
    return (
        <table>
          <thead>
            <tr>
              {th.map((t,i)=>{
                return (<th key={i}>{t}</th>);
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map((row)=>{
              return (
                  <tr key={row[0]}>
                    {row.map((r,i)=>{
                      return (<td key={i}>{r}</td>);
                    })}
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

    var d = this.props.data, reportTable = [];
    if (d.percentages && d.responses && d.frequencies) {
      reportTable = _.zip(
          d.responses,
          d.frequencies,
          d.percentages,
        );
    }

    if (d.mean)
      reportTable = false;

    return {
      ...this.props,
      reportTable: reportTable
    };
  },
  componentDidMount () {
    if (!this.refs.canvas) {
      return;
    }
    if (this.state.data.show_graph) {
      var opts = this.buildChartOptions();

      var canvas = ReactDOM.findDOMNode(this.refs.canvas);
      var itemChart = new Chart(canvas, opts);
      this.setState({itemChart: itemChart});
    }
  },
  componentWillUpdate (newProps) {
    if (this.state.style != newProps.style) {
      this.setState({style: newProps.style});
    }
    if (this.state.data != newProps.data) {
      this.setState({data: newProps.data});
    }
    if (this.state.data.show_graph) {
      var canvas = ReactDOM.findDOMNode(this.refs.canvas);
      var opts = this.buildChartOptions();
      let itemChart = this.state.itemChart;
      if (itemChart !== undefined) {
        itemChart.destroy();
        itemChart = new Chart(canvas, opts);
      }
    }
  },
  buildChartOptions () {
    var data = this.state.data;
    var chartType = this.state.style.report_type || 'bar';
    var maxPercentage = 100;
    var barPercentage = 0.5;
    var showLegend = false;

    // TODO: set as default globally in a higher level (PM)
    var colors = this.buildChartColors(); 

    var baseColor = colors[0];
    Chart.defaults.global.elements.rectangle.backgroundColor = baseColor;
    Chart.defaults.global.elements.line.borderColor = baseColor;
    Chart.defaults.global.elements.line.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    Chart.defaults.global.elements.point.backgroundColor = baseColor;
    Chart.defaults.global.elements.point.radius = 4;
    Chart.defaults.global.elements.arc.backgroundColor = baseColor;
    Chart.defaults.global.maintainAspectRatio = false;

    if (chartType === 'donut') {
      chartType = 'pie';
    }

    if (chartType === 'area') {
      chartType = 'line';
    }

    if (chartType === 'horizontal') {
      chartType = 'horizontalBar';
    }

    if (chartType === 'vertical' || chartType === 'bar_chart') {
      chartType = 'bar';
    }

    var datasets = [];
    if (data.values != undefined) {
      data.responses = data.values[0][1].responses;
      data.graphLabels = [];
      data.responses.forEach(function(r, i){
        data.graphLabels[i] = r.length > 20 ? r.substring(0,17) + '...' : r;
      });
      var allPercentages = [];
      data.values.forEach(function(val, i){
        var item = {};
        item.label = val[0].length > 20 ? val[0].substring(0,17) + '...' : val[0];
        item.data = val[1].percentages;
        allPercentages = [...new Set([...allPercentages ,...val[1].percentages])];
        item.backgroundColor = colors[i];
        datasets.push(item);
      });

      maxPercentage = Math.max.apply(Math, allPercentages);
      barPercentage = 0.9;
      showLegend = true;
    } else {
      maxPercentage = Math.max.apply(Math, data.percentages);
      datasets.push({data: data.percentages});
    }

    maxPercentage = maxPercentage < 85 ? ((parseInt(maxPercentage/10, 10)+1)*10) : 100;

    var opts = {
      type: chartType,
      data: {
          labels: data.graphLabels || data.responses,
          datasets: datasets
      },
      options: {
        events: [''],
        legend: {
          display: showLegend
        },
        animation: {
          duration: 500
        },
        scales: {
          xAxes: [{
            ticks: {
              autoSkip:false,
              beginAtZero: true,
              max: maxPercentage
            },
            barPercentage: barPercentage,
            // gridLines: {
            //   display: chartType == 'horizontalBar' ? true : false
            // }
          }],
          yAxes: [{
            ticks: {
              autoSkip:false,
              beginAtZero: true,
              max: maxPercentage
            },
            barPercentage: barPercentage,
            // gridLines: {
            //   display: chartType == 'horizontalBar' ? false : true
            // }
          }]
        },
      }
    };

    if (chartType === 'pie') {
      opts.options.legend.display = true;
      opts.data.datasets[0].backgroundColor = colors;
      opts.options.scales.xAxes = [];
      opts.options.scales.yAxes = [];

      if (this.state.style.report_type === 'donut') {
        opts.options.cutoutPercentage = 50;
      }
    }

    if (this.state.style.report_type === 'area') {
      opts.data.datasets[0].backgroundColor = colors[0];
    }

    return opts;
  },
  buildChartColors () {
    var colors = this.state.style.report_colors || [
      'rgba(52, 106, 200, 0.8)',
      'rgba(252, 74, 124, 0.8)',
      'rgba(250, 213, 99, 0.8)',
      'rgba(113, 230, 33, 0.8)',
      'rgba(78, 203, 255, 0.8)',
      'rgba(253, 190, 76, 0.8)',
      'rgba(77, 124, 244, 0.8)',
      'rgba(33, 231, 184, 0.8)'
    ];

    var c1 = colors.slice(0).map((c,i)=>{
      c = c.replace("1)", "0.75)");
      return c.replace("0.8", "0.5");
    });
    colors = colors.concat(c1);

    var c2 = colors.slice(0).map((c,i)=>{
      c = c.replace("1)", "0.5)");
      return c.replace("0.8", "0.25");
    });
    colors = colors.concat(c2);

    return colors;
  },
  render () {
    let p = this.state,
      d = p.data,
      r = p.row,
      _type = r.type;

    if (!_type) {
      console.error('No type given for row: ', this.state);
      return <p className='error'>{'Error displaying row: '}<code>{p.kuid}</code></p>;
    }
    if (_type.select_one || _type.select_multiple) {
      _type = _.keys(_type)[0];
    }
    _type = JSON.stringify(_type);

    var questionLabel = r.label;
    if (this.props.translations) {
      questionLabel = r.label[this.props.translationIndex];
    }
    return (
      <div>
        <bem.ReportView__itemHeading>
          <h2>
            {questionLabel}
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
          {d.show_graph && 
            <bem.ReportView__chart
                style={{width: this.state.style.graphWidth + 'px'}}>
              <canvas ref="canvas" />
            </bem.ReportView__chart>
          }
          {d.values &&
            <ReportTable rows={d.values} type='disaggregated' />
          }
          {p.reportTable &&
            <ReportTable rows={p.reportTable} type='regular'/>
          }
          {d.mean &&
            <ReportTable rows={d} type='numerical'/>
          }
        </bem.ReportView__itemContent>
      </div>
      );
  },
});

export default ReportViewItem;
