import React, {useState, useEffect, useCallback} from 'react';
import classNames from 'classnames';
import styles from './submissionsGraph.module.scss';
import type {FailResponse} from 'js/dataInterface';
import {fetchGet} from 'js/api';
import {formatDate, handleApiFail} from 'js/utils';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import moment from 'moment';

interface AssetCountsResponse {
  daily_submission_counts: {[/** YYYY-MM-DD */ date: string]: number};
  total_submission_count: number;
}

type StatsPeriodName = 'week' | 'month' | '3months' | '12months';
const DEFAULT_PERIOD: StatsPeriodName = 'week';
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

interface SubmissionsGraphProps {
  assetUid: string;
}

export default function SubmissionsGraph(props: SubmissionsGraphProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [currentPeriod, setCurrentPeriod] = useState<StatsPeriodName>(DEFAULT_PERIOD);
  const [counts, setCounts] = useState<AssetCountsResponse>(emptyCounts);

  /** Handles days in past */
  const getDateRangeLabel = useCallback(
    (periodName: StatsPeriodName) => {
      // We need 1 day less than period length, because we omit today
      const daysAmount = StatsPeriods[periodName] - 1;

      const daysFromLabel = formatDate(moment().subtract(daysAmount, 'days').format());
      const daysToLabel = formatDate(moment().format());

      return (<>{daysFromLabel} &ndash; {daysToLabel}</>);
    },
    []
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

  useEffect(() => {
    const getStats = async () => {
      setIsLoading(true);
      try {
        let path = ASSET_COUNTS_ENDPOINT.replace('<uid>', props.assetUid);
        const days = StatsPeriods[currentPeriod];
        path += `?days=${days}`;

        const response = await fetchGet<AssetCountsResponse>(path);
        console.log('response', response);
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

  const hasData = !isLoading && counts.total_submission_count > 0;

  return (
    <section className={styles.root}>
      <nav className={styles.periodSwitcher}>
        {renderPeriodToggle('week', t('Past 7 days'))}
        {renderPeriodToggle('month', t('Past 31 days'))}
        {renderPeriodToggle('3months', t('Past 3 months'))}
        {renderPeriodToggle('12months', t('Past 12 months'))}
      </nav>

      <div className={styles.graphWrapper}>
        {isLoading && <LoadingSpinner hideMessage />}
        {!isLoading && hasData && <canvas className={styles.graph} />}
        {!isLoading && !hasData && (
          <p className={styles.noChartMessage}>
            {t('No chart data available for current period.')}
          </p>
        )}
      </div>

      <div className={styles.statsWrapper}>
        <div className={styles.stats}>
          <span className={styles.statsCount}>0</span>
          <time className={styles.statsDateRange}>
            {getDateRangeLabel(currentPeriod)}
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
