// Libraries
import React from 'react';
import {observer} from 'mobx-react';
import zip from 'lodash.zip';
import isEqual from 'lodash.isequal';
import Chart from 'chart.js/auto';
import type {
  ChartType,
  ChartDataset,
  ChartConfiguration,
} from 'chart.js/auto';
import clonedeep from 'lodash.clonedeep';
import bem from 'js/bem';

// Stores
import sessionStore from 'js/stores/session';

// Partial components
import ReportTable from './reportTable.component';
import Button from 'js/components/common/button';

// Constants
import {CHART_STYLES, CHART_COLOR_SETS} from './reportsConstants';

// Types
import type {ReportsResponse, ReportsResponseData} from './reportsConstants';

export type PreparedTable = Array<
  [string | undefined, number | undefined, number | undefined]
>;

function truncateLabel(label: string, length = 25) {
  if (label.length > length) {
    return label.substring(0, length - 3) + '…';
  }
  return label;
}

function getPreparedTable(
  data: ReportsResponseData
): PreparedTable | undefined {
  if (data.mean) {
    return undefined;
  }

  if (data.percentages && data.responses && data.frequencies) {
    return zip(
      data.responseLabels || data.responses,
      data.frequencies,
      data.percentages
    );
  }

  return [];
}

/** We expect reports response to be passed together with some other props */
interface ReportViewItemProps extends ReportsResponse {
  label: string;
  triggerQuestionSettings: (questionName: string) => void;
}

class ReportViewItem extends React.Component<ReportViewItemProps> {
  constructor(props: ReportViewItemProps) {
    super(props);
    this.canvasRef = React.createRef();
  }
  canvasRef: React.RefObject<HTMLCanvasElement>;
  itemChart?: Chart;

  componentDidMount() {
    if (this.props.data.show_graph) {
      this.loadChart();
    }
  }

  componentDidUpdate(prevProps: ReportViewItemProps) {
    if (!this.props.data.show_graph) {
      // Some items will only display a table, in such case, we make sure
      // any previously created graph is destroyed.
      this.itemChart?.destroy();
      this.itemChart = undefined;
    } else if (this.props.data.show_graph && !isEqual(prevProps, this.props)) {
      // When props are identical, we make sure to not build the graph again,
      // as it causes the animation to start again.
      this.loadChart();
    }

    // We no longer keep built PreparedTable in state, it's simply rebuilt
    // during render. We keep this to ensure that re-render happens when props
    // change.
    if (!isEqual(prevProps, this.props)) {
      this.forceUpdate();
    }
  }

  loadChart() {
    if (this.canvasRef.current === null) {
      return;
    }

    // We need to destroy existing chart, so that we can use the canvas element
    // for new one
    if (this.itemChart) {
      this.itemChart.destroy();
    }
    this.itemChart = new Chart(
      this.canvasRef.current,
      this.buildChartOptions()
    );
  }

  buildChartOptions() {
    // We need to clone the data object to not pollute it with mutations. This
    // fixes a bug when we want to truncate labels for the chart, but they
    // end up being truncated everywhere in report view.
    const data = clonedeep(this.props.data);
    const chartType = this.props.style.report_type || 'vertical';

    let maxPercentage = 100;
    let showLegend = false;

    const colors = this.buildChartColors();

    const baseColor = colors[0];
    Chart.defaults.elements.bar.backgroundColor = baseColor;
    Chart.defaults.elements.line.borderColor = baseColor;
    Chart.defaults.elements.line.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    Chart.defaults.elements.point.backgroundColor = baseColor;
    Chart.defaults.elements.point.radius = 4;
    Chart.defaults.elements.arc.backgroundColor = baseColor;
    Chart.defaults.maintainAspectRatio = false;

    // If there is some invalid data we default to bar type
    const chartJsType: ChartType = CHART_STYLES[chartType]?.chartJsType || 'bar';

    const datasets: ChartDataset[] = [];

    const isArea = this.props.style.report_type === CHART_STYLES.area.value;

    if (data.values !== undefined) {
      if (data.responseLabels) {
        data.responseLabels.forEach((r, i) => {
          if (data.responseLabels) {
            data.responseLabels[i] = truncateLabel(r);
          }
        });
      }

      let allPercentages: number[] = [];
      data.values.forEach((val, i) => {
        const choiceLabel = val[2] || val[0] || '';
        let itemPerc = [];
        // TODO: Make the backend behave consistently?
        // https://github.com/kobotoolbox/kpi/issues/2562
        if ('percentage' in val[1] && Array.isArray(val[1].percentage)) {
          itemPerc = val[1].percentage;
        }
        if ('percentages' in val[1] && Array.isArray(val[1].percentages)) {
          itemPerc = val[1].percentages;
        }
        allPercentages = [...new Set([...allPercentages, ...itemPerc])];
        datasets.push({
          label: truncateLabel(String(choiceLabel), 20),
          data: itemPerc,
          fill: isArea,
          backgroundColor: colors[i],
        });
      });

      maxPercentage = Math.max(...allPercentages);
      showLegend = true;
    } else {
      if (data.percentages) {
        maxPercentage = Math.max(...data.percentages);
        datasets.push({
          data: data.percentages,
          barPercentage: 0.5,
          fill: isArea,
          backgroundColor: colors,
        });
      }
      if (data.responseLabels) {
        data.responseLabels.forEach((r, i) => {
          if (data.responseLabels) {
            data.responseLabels[i] = truncateLabel(r);
          }
        });
      }
      if (data.responses) {
        data.responses.forEach((r, i) => {
          if (data.responses) {
            data.responses[i] = truncateLabel(r);
          }
        });
      }
    }

    maxPercentage =
      maxPercentage < 85
        ? (parseInt(String(maxPercentage / 10), 10) + 1) * 10
        : 100;

    const opts: ChartConfiguration = {
      type: chartJsType,
      data: {
        labels: data.responseLabels || data.responses,
        datasets: datasets,
      },
      options: {
        plugins: {
          legend: {
            display: showLegend,
          },
        },
        animation: {
          duration: 500,
        },
        scales: {
          x: {
            // ticks: {autoSkip: false},
            max: maxPercentage,
            beginAtZero: true,
          },
          y: {
            // ticks: {autoSkip: false},
            max: maxPercentage,
            beginAtZero: true,
          },
        },
      },
    };

    if (chartType === 'horizontal') {
      if (opts.options) {
        opts.options.indexAxis = 'y';
      }
    }

    if (chartType === 'pie') {
      if (opts.options?.plugins?.legend) {
        opts.options.plugins.legend.display = true;
      }
      opts.data.datasets[0].backgroundColor = colors;
      if (opts.options && !opts.options.scales) {
        opts.options.scales = {x: {}, y: {}};
      }
    }

    if (this.props.style.report_type === CHART_STYLES.area.value) {
      opts.data.datasets[0].backgroundColor = colors[0];
    }

    return opts;
  }

  buildChartColors() {
    let output = this.props.style.report_colors || CHART_COLOR_SETS[0].colors;

    const c1 = output.slice(0).map((c) => {
      c = c.replace('1)', '0.75)');
      return c.replace('0.8', '0.5');
    });
    output = output.concat(c1);

    const c2 = output.slice(0).map((c) => {
      c = c.replace('1)', '0.5)');
      return c.replace('0.8', '0.25');
    });
    output = output.concat(c2);

    return output;
  }

  render() {
    const reportTableData = getPreparedTable(this.props.data);

    const rowType = this.props.row.type;

    if (!rowType) {
      console.error('No type given for row: ', this.props);
      return (
        <p className='error'>
          {'Error displaying row: '}
          <code>{this.props.kuid}</code>
        </p>
      );
    }

    return (
      <div>
        <bem.ReportView__itemHeading>
          <h2 dir='auto'>{this.props.label}</h2>
          <bem.ReportView__headingMeta>
            <span className='type'>{t('Type: ') + rowType + t('. ')}</span>
            <span className='respondents'>
              {t('#1 out of #2 respondents answered this question. ')
                .replace('#1', String(this.props.data.provided))
                .replace('#2', String(this.props.data.total_count))}
            </span>
            <span>
              {t('(# were without data.)').replace(
                '#',
                String(this.props.data.not_provided)
              )}
            </span>
          </bem.ReportView__headingMeta>
          {this.props.data.show_graph && sessionStore.isLoggedIn && (
            <span className='report-button__question-settings'>
              <Button
                type='text'
                size='m'
                startIcon='more'
                onClick={() =>
                  this.props.triggerQuestionSettings(this.props.name)
                }
                tooltip={t('Override Graph Style')}
                tooltipPosition='right'
              />
            </span>
          )}
        </bem.ReportView__itemHeading>
        <bem.ReportView__itemContent>
          {this.props.data.show_graph && (
            <bem.ReportView__chart
              style={{width: this.props.style.graphWidth + 'px'}}
            >
              <canvas ref={this.canvasRef} />
            </bem.ReportView__chart>
          )}
          {reportTableData && !this.props.data.values && (
            <ReportTable rows={reportTableData} type='regular' />
          )}
          {this.props.data.values?.[0]?.[1] &&
            'percentages' in this.props.data.values[0][1] &&
            this.props.data.values[0][1].percentages && (
              <ReportTable
                rows={this.props.data.values}
                responseLabels={this.props.data.responseLabels}
                type='disaggregated'
              />
            )}
          {this.props.data.values?.[0]?.[1] &&
            'mean' in this.props.data.values[0][1] &&
            this.props.data.values[0][1].mean && (
              <ReportTable rows={this.props.data.values} type='numerical' />
            )}
          {this.props.data.mean && (
            <ReportTable values={this.props.data} type='numerical' />
          )}
        </bem.ReportView__itemContent>
      </div>
    );
  }
}

export default observer(ReportViewItem);
