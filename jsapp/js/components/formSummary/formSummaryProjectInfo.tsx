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
import {handleApiFail} from 'js/api';
import {formatTime} from 'js/utils';
import AssetStatusBadge from 'js/components/common/assetStatusBadge';
import Avatar from 'js/components/common/avatar';
import envStore from 'js/envStore';

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
    // The call below will fail with 400 if asset doesn't have submissions,
    // plus there is no point trying to get last submission data in such case
    if (!props.asset?.deployment__submission_count) {
      return;
    }

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
      })
      .fail(handleApiFail);
  }, []);

  const lastDeployedDate =
    props.asset.deployed_versions?.results?.[0]?.date_modified;

  // Support custom labels for project metadata, if defined
  const metadata = envStore.data.getProjectMetadataFieldsAsSimpleDict();

  return (
    <bem.FormView__row>
      <bem.FormView__cell m={['label', 'first']}>
        {t('Project information')}
      </bem.FormView__cell>

      <bem.FormView__cell m='box'>
        {metadata.description && (
          <bem.FormView__group m='items'>
            {/* description - takes whole row */}
            <bem.FormView__cell m={['padding', 'full-width']}>
              <bem.FormView__label>
                {metadata.description?.label ?? t('Description')}
              </bem.FormView__label>
              <div dir='auto'>
                {props.asset.settings.description || '-'}
              </div>
            </bem.FormView__cell>
          </bem.FormView__group>
        )}

        <bem.FormView__group m='items'>
          {/* status */}
          <bem.FormView__cell m='padding'>
            <bem.FormView__label>{t('Status')}</bem.FormView__label>
            <AssetStatusBadge deploymentStatus={props.asset.deployment_status}/>
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
              <Avatar
                username={props.asset.owner_label}
                size='s'
                isUsernameVisible
              />
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

        {(metadata.sector || metadata.country) && (
          <bem.FormView__group m='items'>
            {/* sector */}
            {metadata.sector && (
              <bem.FormView__cell m='padding'>
                <bem.FormView__label>
                  {metadata.sector?.label ?? t('Sector')}
                </bem.FormView__label>
                {getSectorDisplayString(props.asset)}
              </bem.FormView__cell>
            )}

            {/* countries */}
            {metadata.country && (
              <bem.FormView__cell m='padding'>
                <bem.FormView__label>
                  {metadata.country?.label ?? t('Countries')}
                </bem.FormView__label>
                {getCountryDisplayString(props.asset)}
              </bem.FormView__cell>
            )}
          </bem.FormView__group>
        )}

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
        {(metadata.operational_purpose || metadata.collects_pii) && (
          <bem.FormView__group m='items'>
            {metadata.operational_purpose && (
              <bem.FormView__cell m='padding'>
                <bem.FormView__label>
                  {metadata.operational_purpose?.label ??
                    t('Operational purpose of data')}
                </bem.FormView__label>
                {props.asset.settings.operational_purpose?.label ?? '-'}
              </bem.FormView__cell>
            )}
            {metadata.collects_pii && (
              <bem.FormView__cell m='padding'>
                <bem.FormView__label>
                  {metadata.collects_pii?.label ??
                    t('Collects personally identifiable information')}
                </bem.FormView__label>
                {props.asset.settings.collects_pii?.label ?? '-'}
              </bem.FormView__cell>
            )}
          </bem.FormView__group>
        )}
      </bem.FormView__cell>
    </bem.FormView__row>
  );
}
