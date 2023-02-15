import React, {useState, useEffect} from 'react';
import bem from 'js/bem';
import {
  getCountryDisplayString,
  getSectorDisplayString,
  isSelfOwned,
} from 'js/assetUtils';
import type {
  AssetResponse,
  PaginatedResponse,
  SubmissionResponse,
} from 'js/dataInterface';
import {dataInterface} from 'js/dataInterface';
import {formatTime} from 'js/utils';
import AssetStatusBadge from './common/assetStatusBadge';
import Avatar from './common/avatar';

interface FormSummaryProjectInfoProps {
  asset: AssetResponse;
}

export default function FormSummaryProjectInfo(
  props: FormSummaryProjectInfoProps
) {
  // NOTE: this will only work with forms that have `end` meta question enabled
  const [latestSubmissionDate, setLatestSubmissionDate] = useState<
    string | undefined
  >();

  useEffect(() => {
    // Fetches one last submission, and only two fields for it.
    dataInterface
      .getSubmissions(
        props.asset?.uid,
        1,
        0,
        [{id: '_id', desc: true}],
        ['_id', 'end']
      )
      .done((response: PaginatedResponse<SubmissionResponse>) => {
        if (response.count) {
          setLatestSubmissionDate(response.results[0]['end']);
        }
      });
  }, []);

  const lastDeployedDate =
    props.asset.deployed_versions?.results[0].date_modified;

  return (
    <bem.FormView__row>
      <bem.FormView__cell m={['label', 'first']}>
        {t('Project information')}
      </bem.FormView__cell>

      <bem.FormView__cell m='box'>
        <bem.FormView__group m='items'>
          {/* description - takes whole row */}
          <bem.FormView__cell m='padding'>
            <bem.FormView__label>{t('Description')}</bem.FormView__label>
            {props.asset.settings.description || '-'}
          </bem.FormView__cell>
        </bem.FormView__group>

        <bem.FormView__group m='items'>
          {/* status */}
          <bem.FormView__cell m='padding'>
            <bem.FormView__label>{t('Status')}</bem.FormView__label>
            <AssetStatusBadge asset={props.asset} />
          </bem.FormView__cell>

          {/* questions count */}
          <bem.FormView__cell m='padding'>
            <bem.FormView__label>{t('Questions')}</bem.FormView__label>
            {props.asset.summary.row_count || '-'}
          </bem.FormView__cell>

          {/* owner */}
          <bem.FormView__cell m='padding'>
            <bem.FormView__label>{t('Owner')}</bem.FormView__label>
            {isSelfOwned(props.asset) && t('me')}
            {!isSelfOwned(props.asset) && (
              <Avatar username={props.asset.owner__username} />
            )}
          </bem.FormView__cell>
        </bem.FormView__group>

        <bem.FormView__group m='items'>
          {/* date modified */}
          <bem.FormView__cell m='padding'>
            <bem.FormView__label>{t('Last modified')}</bem.FormView__label>
            {formatTime(props.asset.date_modified)}
          </bem.FormView__cell>

          {/* date deployed */}
          <bem.FormView__cell m='padding'>
            <bem.FormView__label>{t('Last deployed')}</bem.FormView__label>
            {lastDeployedDate && formatTime(lastDeployedDate)}
            {!lastDeployedDate && '-'}
          </bem.FormView__cell>

          {/* date of last submission */}
          {latestSubmissionDate && (
            <bem.FormView__cell m='padding'>
              <bem.FormView__label>
                {t('Latest submission')}
              </bem.FormView__label>
              {formatTime(latestSubmissionDate)}
            </bem.FormView__cell>
          )}
        </bem.FormView__group>

        <bem.FormView__group m='items'>
          {/* sector */}
          <bem.FormView__cell m='padding'>
            <bem.FormView__label>{t('Sector')}</bem.FormView__label>
            {getSectorDisplayString(props.asset)}
          </bem.FormView__cell>

          {/* countries */}
          <bem.FormView__cell m='padding'>
            <bem.FormView__label>{t('Countries')}</bem.FormView__label>
            {getCountryDisplayString(props.asset)}
          </bem.FormView__cell>
        </bem.FormView__group>

        {/* languages */}
        {props.asset.summary?.languages &&
          props.asset.summary.languages.length > 1 && (
            <bem.FormView__group m='items'>
              <bem.FormView__cell m='padding'>
                <bem.FormView__label>{t('Languages')}</bem.FormView__label>
                {props.asset.summary.languages.map((language, index) => (
                  <bem.FormView__cell key={`lang-${index}`} data-index={index}>
                    {language}
                  </bem.FormView__cell>
                ))}
              </bem.FormView__cell>
            </bem.FormView__group>
          )}

        {/* operational purpose and PII */}
        {(props.asset.settings.operational_purpose ||
          props.asset.settings.collects_pii) && (
          <bem.FormView__group m='items'>
            {props.asset.settings.operational_purpose && (
              <bem.FormView__cell m='padding'>
                <bem.FormView__label>
                  {t('Operational purpose of data')}
                </bem.FormView__label>
                {props.asset.settings.operational_purpose.label}
              </bem.FormView__cell>
            )}
            {props.asset.settings.collects_pii && (
              <bem.FormView__cell m='padding'>
                <bem.FormView__label>
                  {t('Collects personally identifiable information')}
                </bem.FormView__label>
                {props.asset.settings.collects_pii.label}
              </bem.FormView__cell>
            )}
          </bem.FormView__group>
        )}
      </bem.FormView__cell>
    </bem.FormView__row>
  );
}
