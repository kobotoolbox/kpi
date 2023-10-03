import React, {useEffect, useState} from 'react';
import classNames from 'classnames';
import {AssetUsage, getPerAssetUsage} from './usage.api';
import {AssetResponse} from '../dataInterface';
import Button from '../components/common/button';

interface PerAssetUsageState {
  isLoaded: boolean;
  results: AssetUsage[] | null;
  totalAssets: number;
}

export default function PerAssetUsage() {
  const [perAsset, setPerAsset] = useState<PerAssetUsageState>({
    isLoaded: false,
    results: null,
    totalAssets: 0,
  });

  useEffect(() => {
    getPerAssetUsage().then((data) => {
      if (!data) {
        return;
      }

      setPerAsset({
        isLoaded: true,
        results: data.results,
        totalAssets: data.results.length,
      });
    });
  }, [perAsset.isLoaded]);

  function renderHeader() {
    return (
      <header>
        <div>
          {t('##TOTAL_ASSETS## Projects').replace(
            '##TOTAL_ASSETS##',
            perAsset.totalAssets.toString()
          )}
        </div>
        <div>{t('Submissions total')}</div>
        <div>
          {t('Submissions ##CURRENT_MONTH##').replace(
            '##CURRENT_MONTH##',
            new Date().toLocaleString('default', {month: 'short'})
          )}
        </div>
        <div>{t('Data storage')}</div>
        <div>{t('Transcript minutes')}</div>
        <div>{t('Translation characters')}</div>
        <div>{t('Status')}</div>
      </header>
    );
  }

  function renderList() {
    return (
      <ul>
        {perAsset.results?.map((assetUsage: AssetUsage) => (
            <li>
              <ul>
                {/*TODO: href is the api endpoint for the asset. Replace with the UI link*/}
                <li><a href={assetUsage.asset}>{assetUsage.asset__name}</a></li>
                <li>{assetUsage.submission_count_all_time}</li>
                <li>{assetUsage.submission_count_current_month}</li>
                {/*TODO:bytes to gigabytes is divided by 1073741824. Display this nicely. Logic already exists in  usage.component*/}
                <li>{assetUsage.storage_bytes}</li>
                {/*TODO: change this to minutes*/}
                <li>{assetUsage.nlp_usage_all_time.total_nlp_asr_seconds}</li>
                <li>{assetUsage.nlp_usage_all_time.total_nlp_mt_characters}</li>
                {/*TODO: add status once we get it*/}
              </ul>
            </li>
          )
        )}
      </ul>
    );
  }

  function renderFooter() {
    return (
      <footer>
        <Button
          type='bare'
          size='m'
          color='blue'
          startIcon='arrow-left'
          onClick={() => console.log('left')}
        />

        <div>
          {t('Displaying ##CURRENT_PAGINATION## / ##TOTAL## projects')
            .replace('##CURRENT_PAGINATION##', perAsset.totalAssets.toString())
            .replace('##TOTAL##', '200')}
        </div>

        <Button
          type='bare'
          size='m'
          color='blue'
          startIcon='arrow-right'
          onClick={() => console.log('right')}
        />
      </footer>
    );
  }

  console.log(perAsset);

  return (
    <section>
      {renderHeader()}

      {renderList()}

      {renderFooter()}
    </section>
  );
}
