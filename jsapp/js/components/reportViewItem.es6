import React from 'react';
import autoBind from 'react-autobind';
import ReactDOM from 'react-dom';
import _ from 'underscore';
import Chart from 'chart.js';
import {bem} from '../bem';
import {REPORT_STYLES} from 'js/constants';

class ReportTable extends React.Component {
  constructor(props) {
    super(props);
  }
  formatNumber(x) {
    if (isNaN(x))
      return x;
    return x.toFixed(2);
  }
  render () {
    let th = [''], rows = [];
    if (this.props.type === 'numerical') {
      th = [t('Mean'), t('Median'), t('Mode'), t('Standard deviation')];
      if (this.props.rows)
        th.unshift('');
      if (this.props.values)
        var v = this.props.values
      return (
        <table>
          <thead>
            <tr>
              {th.map((t,i)=>{
                return (<th key={i}>{t}</th>);
              })}
            </tr>
          </thead>
          {this.props.values &&
            <tbody>
              <tr>
                <td>{this.formatNumber(v.mean) || t('N/A')}</td>
                <td>{this.formatNumber(v.median) || t('N/A')}</td>
                <td>{this.formatNumber(v.mode) || t('N/A')}</td>
                <td>{this.formatNumber(v.stdev) || t('N/A')}</td>
              </tr>
            </tbody>
          }
          {this.props.rows &&
            <tbody>
              {this.props.rows.map((r)=>{
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
          }
        </table>
      );
    }
    if (this.props.type === 'regular') {
      th = [t('Value'), t('Frequency'), t('Percentage')];
      rows = this.props.rows;
    } else {
      // prepare table data for disaggregated rows
      if (this.props.rows.length > 0) {
        let rowsB = this.props.rows;
        if (this.props.responseLabels) {
          th = th.concat(this.props.responseLabels);
        } else {
          if (rowsB[0] && rowsB[0][1] && rowsB[0][1].responses)
            th = th.concat(rowsB[0][1].responses);
        }
        rowsB.map((row, i)=> {
          var rowitem = row[2] ? [row[2]] : [row[0]];
          rowitem = rowitem.concat(row[1].percentages);
          rows.push(rowitem);
        });
      }
    }

    if (rows.length === 0) {
      return false;
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
  }
};

class ReportViewItem extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      reportTable: false
    };
    this.itemChart = false;
    autoBind(this);
  }
  componentDidMount () {
    this.prepareTable(this.props.data);
    if (this.props.data.show_graph) {
      this.loadChart();
    }
  }
  componentWillReceiveProps(nextProps) {
    this.prepareTable(nextProps.data);
  }
  componentDidUpdate (prevProps) {
    // refreshes a chart right after render()
    // TODO: ideally this shouldn't refresh a chart if it hasn't changed
    if (this.props.data.show_graph) {
      this.loadChart();
    }
  }
  loadChart() {
    var canvas = ReactDOM.findDOMNode(this.refs.canvas);
    var opts = this.buildChartOptions();

    if (this.itemChart) {
      this.itemChart.destroy();
      this.itemChart = new Chart(canvas, opts);
    } else {
      this.itemChart = new Chart(canvas, opts);
    }
  }
  prepareTable(d) {
    var reportTable = [];
    if (d.percentages && d.responses && d.frequencies) {
      reportTable = _.zip(
          d.responseLabels || d.responses,
          d.frequencies,
          d.percentages,
        );
    }

    if (d.mean)
      reportTable = false;

    this.setState({reportTable: reportTable});
  }
  truncateLabel(label, length = 25) {
    return label.length > length ? label.substring(0,length - 3) + '...' : label;
  }
  buildChartOptions () {
    var data = this.props.data;
    var chartType = this.props.style.report_type || 'bar';
    let _this = this;

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

    // if report styles are invalid we default to vertical
    if (Object.keys(REPORT_STYLES).includes(chartType) !== true) {
      chartType = REPORT_STYLES.vertical.value;
    }

    if (chartType === REPORT_STYLES.donut.value) {
      chartType = 'pie';
    }

    if (chartType === REPORT_STYLES.area.value) {
      chartType = 'line';
    }

    if (chartType === REPORT_STYLES.horizontal.value) {
      chartType = 'horizontalBar';
    }

    if (chartType === REPORT_STYLES.vertical.value || chartType === 'bar_chart') {
      chartType = 'bar';
    }

    var datasets = [];

    if (data.values != undefined) {

      if (data.responseLabels) {
        data.responseLabels.forEach(function(r, i){
          data.responseLabels[i] = _this.truncateLabel(r);
        });
      }
      var allPercentages = [];
      data.values.forEach(function(val, i){
        var item = {};
        var choiceLabel = val[2] || val[0];
        item.label = _this.truncateLabel(choiceLabel, 20);
        let itemPerc = [];
        // TODO: Make the backend behave consistently?
        // https://github.com/kobotoolbox/kpi/issues/2562
        if (Array.isArray(val[1].percentage)) {
          itemPerc = val[1].percentage;
        }
        if (Array.isArray(val[1].percentages)) {
          itemPerc = val[1].percentages;
        }

        item.data = itemPerc;
        allPercentages = [...new Set([...allPercentages, ...itemPerc])];
        item.backgroundColor = colors[i];
        datasets.push(item);
      });

      maxPercentage = Math.max.apply(Math, allPercentages);
      barPercentage = 0.9;
      showLegend = true;
    } else {
      maxPercentage = Math.max.apply(Math, data.percentages);
      datasets.push({data: data.percentages});
      if (data.responseLabels) {
        data.responseLabels.forEach(function(r, i){
          data.responseLabels[i] = _this.truncateLabel(r);
        });
      }
      if (data.responses) {
        data.responses.forEach(function(r, i){
          data.responses[i] = _this.truncateLabel(r);
        });
      }
    }

    maxPercentage = maxPercentage < 85 ? ((parseInt(maxPercentage/10, 10)+1)*10) : 100;
    var opts = {
      type: chartType,
      data: {
          labels: data.responseLabels || data.responses,
          datasets: datasets
      },
      options: {
        // events: [''],
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

      if (this.props.style.report_type === REPORT_STYLES.donut.value) {
        opts.options.cutoutPercentage = 50;
      }
    }

    if (this.props.style.report_type === REPORT_STYLES.area.value) {
      opts.data.datasets[0].backgroundColor = colors[0];
    }

    return opts;
  }
  buildChartColors () {
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

    var c1 = colors.slice(0).map((c,i)=>{
      c = c.replace('1)', '0.75)');
      return c.replace('0.8', '0.5');
    });
    colors = colors.concat(c1);

    var c2 = colors.slice(0).map((c,i)=>{
      c = c.replace('1)', '0.5)');
      return c.replace('0.8', '0.25');
    });
    colors = colors.concat(c2);

    return colors;
  }
  render () {
    let p = this.props,
      d = p.data,
      r = p.row,
      _type = r.type,
      name = p.name;

    if (!_type) {
      console.error('No type given for row: ', p);
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
            {p.label}
          </h2>
          <bem.ReportView__headingMeta>
            <span className='type'>
              {
                t('Type: ') + _type + t('. ')
              }
            </span>
            <span className='respondents'>
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
          {d.show_graph &&
            <bem.Button m='icon' className='report-button__question-settings'
                  onClick={this.props.triggerQuestionSettings}
                  data-question={name}
                  data-tip={t('Override Graph Style')}>
              <i className='k-icon-more' data-question={name} />
            </bem.Button>
          }
        </bem.ReportView__itemHeading>
        <bem.ReportView__itemContent>
          {d.show_graph &&
            <bem.ReportView__chart
                style={{width: this.props.style.graphWidth + 'px'}}>
              <canvas ref='canvas' />
            </bem.ReportView__chart>
          }
          {this.state.reportTable && ! d.values &&
            <ReportTable rows={this.state.reportTable} type='regular'/>
          }
          {d.values && d.values[0] && d.values[0][1] && d.values[0][1].percentages &&
            <ReportTable rows={d.values} responseLabels={d.responseLabels} type='disaggregated' />
          }
          {d.values && d.values[0] && d.values[0][1] && d.values[0][1].mean &&
            <ReportTable rows={d.values} type='numerical' />
          }
          {d.mean &&
            <ReportTable values={d} type='numerical'/>
          }
        </bem.ReportView__itemContent>
      </div>
      );
  }
};

export default ReportViewItem;
