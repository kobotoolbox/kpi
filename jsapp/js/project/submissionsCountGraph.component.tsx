import React, {useState, useEffect, useCallback, useRef} from 'react';
import classNames from 'classnames';
import moment from 'moment';
import Chart from 'chart.js';
import type {FailResponse} from 'js/dataInterface';
import {fetchGet} from 'js/api';
import {formatDate, handleApiFail} from 'js/utils';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import styles from './submissionsCountGraph.module.scss';

interface DailySubmissionCounts {[/** YYYY-MM-DD */ date: string]: number}

interface AssetCountsResponse {
  daily_submission_counts: DailySubmissionCounts;
  total_submission_count: number;
}

/**
 * A map of label (could be day e.g. "21 Jan", or simply month, e.g. "Dec") and
 * the count of submissions for it.
 */
type GraphData = Map<string, number>;

type StatsPeriodName = 'week' | 'month' | '3months' | '12months';
const DEFAULT_PERIOD: StatsPeriodName = 'week';
/** The amount of days that given period covers */
const StatsPeriods: {[period in StatsPeriodName]: number} = {
  week: 7,
  month: 31,
  '3months': 93,
  '12months': 366,
};

const ASSET_COUNTS_ENDPOINT = '/api/v2/assets/<uid>/counts/';

const emptyCounts = {
  /** Counts per day for given period of time */
  daily_submission_counts: {},
  /** This is the total count since the start of the project */
  total_submission_count: 0,
};

interface SubmissionsCountGraphProps {
  assetUid: string;
}

export default function SubmisCountsionsGraph(props: SubmissionsCountGraphProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [currentPeriod, setCurrentPeriod] = useState<StatsPeriodName>(DEFAULT_PERIOD);
  const [counts, setCounts] = useState<AssetCountsResponse>(emptyCounts);
  const canvasRef: React.MutableRefObject<HTMLCanvasElement | null> = useRef(null);
  let graph: Chart | undefined;

  /** Handles days in past */
  const getDateRangeLabel = useCallback(
    () => {
      // We need 1 day less than period length, because we omit today
      const daysAmount = StatsPeriods[currentPeriod] - 1;

      const daysFromLabel = formatDate(moment().subtract(daysAmount, 'days').format());
      const daysToLabel = formatDate(moment().format());

      // TODO: what if we go with `t('Today')` for `daysTolabel`?

      return (<>{daysFromLabel} &ndash; {daysToLabel}</>);
    },
    [currentPeriod]
  );

  const renderPeriodToggle = useCallback(
    (periodName: StatsPeriodName, label: string) => (
      <button
        className={classNames({
          [styles.periodToggle]: true,
          [styles.periodToggleActive]: currentPeriod === periodName,
        })}
        onClick={() => setCurrentPeriod(periodName)}
        disabled={currentPeriod === periodName}
      >
        {label}
      </button>
    ),
    [currentPeriod]
  );

  const getDaysData = useCallback(
    (
      /** For getting the counts */
      dailyCounts: DailySubmissionCounts,
      /** How many days in the past to get data for */
      total: number
    ) => {
      const output: GraphData = new Map<string, number>();
      const today = moment();
      // Get the furthest day in the past that we need. We subtract one day,
      // because we already start from today.
      let day = today.clone().startOf('days').subtract(total - 1, 'days');
      // Loop over days and add them to the list. We need all the days, not just
      // the ones with data.
      while (day <= today) {
        const date = day.format('YYYY-MM-DD');
        const count = dailyCounts[date] || 0;
        output.set(day.format('DD MMM'), count);
        day = day.clone().add(1, 'd');
      }
      return output;
    },
    []
  );

  const getMonthsData = useCallback(
    (
      /** For getting the counts */
      dailyCounts: DailySubmissionCounts,
      /** How many months in the past to get data for. Requires more than 1. */
      total: number
    ) => {
      const output: GraphData = new Map();
      const today = moment();
      // Get the furthest month in the past that we need. We subtract one month,
      // because we already start from today.
      let month = today.clone().startOf('months').subtract(total - 1, 'months');
      // Loop over months and add them to the list. We need all the months, not
      // just the ones with data.
      while (month <= today) {
        const monthNumber = month.format('MM');

        // Gather all counts from days from current month
        let count = 0;
        Object.keys(dailyCounts).forEach((item) => {
          const itemMonthNumber = item.split('-')[1];
          if (itemMonthNumber === monthNumber) {
            count += dailyCounts[item];
          }
        });

        output.set(month.format('MMM'), count);
        month = month.clone().add(1, 'M');
      }
      return output;
    },
    []
  );

  useEffect(() => {
    const getStats = async () => {
      setIsLoading(true);
      try {
        let path = ASSET_COUNTS_ENDPOINT.replace('<uid>', props.assetUid);
        const days = StatsPeriods[currentPeriod];
        path += `?days=${days}`;
        const response = await fetchGet<AssetCountsResponse>(path);
        setCounts(response);
      } catch (error) {
        const errorObj = error as FailResponse;
        // Undeployed project will have no counts returned (as 404 response)
        if (errorObj.status === 404) {
          setCounts(emptyCounts);
        } else {
          handleApiFail(errorObj);
        }
      }
      setIsLoading(false);
    };
    getStats();
  }, [currentPeriod]);

  useEffect(() => {
    if (!Chart.defaults.global.elements) {
      Chart.defaults.global.elements = {};
    }
    if (!Chart.defaults.global.elements.rectangle) {
      Chart.defaults.global.elements.rectangle = {};
    }
    Chart.defaults.global.elements.rectangle.backgroundColor = 'rgba(61, 194, 212, 0.6)';

    const opts: Chart.ChartConfiguration = {
      type: 'line',
      options: {
        maintainAspectRatio: false,
        responsive: true,
        events: [''],
        legend: {
          display: false,
        },
        scales: {
          yAxes: [{
            ticks: {
              beginAtZero: true,
              // Only show full numbers
              callback: (label: number) => {
                if (Math.floor(label) === label) {
                  return label;
                }
                return undefined;
              },
            },
          }],
        },
      },
    };

    if (!graph && canvasRef.current) {
      graph = new Chart(canvasRef.current, opts);
    }

    if (graph) {
      let graphData: GraphData = new Map<string, number>();

      switch (currentPeriod) {
        // Here we handle all the periods that display days
        case 'week':
        case 'month': {
          graphData = getDaysData(counts.daily_submission_counts, StatsPeriods[currentPeriod]);
          break;
        }
        case '3months': {
          graphData = getMonthsData(counts.daily_submission_counts, 3);
          break;
        }
        case '12months': {
          graphData = getMonthsData(counts.daily_submission_counts, 12);
          break;
        }
      }

      graph.data.labels = Array.from(graphData.keys());
      graph.data.datasets = [{data: Array.from(graphData.values())}];
      graph.update();
    }

  }, [counts]);

  const hasData = !isLoading && counts.total_submission_count > 0;

  const totalPeriodCount = Object.values(counts.daily_submission_counts).reduce((partialSum, a) => partialSum + a, 0);

  return (
    <section className={styles.root}>
      <nav className={styles.periodSwitcher}>
        {renderPeriodToggle('week', t('Past 7 days'))}
        {renderPeriodToggle('month', t('Past 31 days'))}
        {renderPeriodToggle('3months', t('Past 3 months'))}
        {renderPeriodToggle('12months', t('Past 12 months'))}
      </nav>

      <div className={classNames({
        [styles.graph]: true,
        // We need graph to be rendered all the times, we just hide from
        // the view until it is rebuilt with new data.
        [styles.graphVisible]: !isLoading && hasData,
      })}>
        {isLoading && <LoadingSpinner hideMessage />}

        <canvas ref={canvasRef}/>

        {!isLoading && !hasData && (
          <p className={styles.noChartMessage}>
            {t('No chart data available for current period.')}
          </p>
        )}
      </div>

      <div className={styles.statsWrapper}>
        <div className={styles.stats}>
          <span className={styles.statsCount}>
            {isLoading ? '-' : totalPeriodCount}
          </span>
          <time className={styles.statsDateRange}>
            {getDateRangeLabel()}
          </time>
        </div>

        <div className={styles.stats}>
          <span className={styles.statsCount}>
            {counts.total_submission_count}
          </span>

          <span className={styles.statsDateRange}>
            {t('Total')}
          </span>
        </div>
      </div>
    </section>
  );
}
