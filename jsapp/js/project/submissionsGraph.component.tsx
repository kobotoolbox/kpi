import React from 'react';
import styles from './submissionsGraph.module.scss';
import type {AssetResponse} from 'js/dataInterface';

const ASSET_COUNTS_ENDPOINT = '/api/v2/assets/<uid>/counts/';

interface SubmissionsGraphProps {
  asset: AssetResponse;
}

export default function SubmissionsGraph(props: SubmissionsGraphProps) {
  return (
    <section className={styles.root}>
      Hello, {props.asset.uid}!

      <nav className={styles.periodSwitcher}>
        <button className={styles.periodToggle}>
          {t('Past 7 days')}
        </button>

        <button className={styles.periodToggle}>
           {t('Past 31 days')}
        </button>
      </nav>

      <div className={styles.graphWrapper}>
        <canvas className={styles.graph} />

        <p className={styles.noChartMessage}>
          {t('No chart data available for current period.')}
        </p>
      </div>

      <div className={styles.statsWrapper}>
        <div className={styles.stats}>current</div>
        <div className={styles.stats}>prev</div>
        <div className={styles.stats}>total</div>
      </div>
    </section>
  );
}
