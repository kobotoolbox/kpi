import React, {useState, useEffect} from 'react';
import bem from 'js/bem';
import {
  getCountryDisplayString,
  getSectorDisplayString,
} from 'js/assetUtils';
import type {AssetResponse, PaginatedResponse, SubmissionResponse} from 'js/dataInterface';
import {dataInterface} from 'js/dataInterface';
import {formatTime} from 'js/utils';

interface FormSummaryProjectInfoProps {
  asset: AssetResponse;
}

export default function FormSummaryProjectInfo(
  props: FormSummaryProjectInfoProps
) {
  const [latestSubmissionDate, setLatestSubmissionDate] = useState<string | undefined>();

  useEffect(() => {
    dataInterface.getSubmissions(props.asset.uid, 1, 0, [{id: '_id', desc: true}], ['_id', 'end']).done((response: PaginatedResponse<SubmissionResponse>) => {
      if (response.count) {
        setLatestSubmissionDate(response.results[0]['end']);
      }
    });
  }, [props.asset.uid]);

  const hasCountry = (
    props.asset.settings?.country &&
    (
      !Array.isArray(props.asset.settings?.country) ||
      !!props.asset.settings?.country.length
    )
  );
  const hasSector = Boolean(props.asset.settings?.sector?.value);
  const hasProjectInfo = (
    props.asset.settings &&
    (
      props.asset.settings.description ||
      hasCountry ||
      hasSector ||
      props.asset.settings.operational_purpose ||
      props.asset.settings.collects_pii
    )
  );

  if (!hasProjectInfo) {
    return null;
  }

  return (
    <bem.FormView__row m='summary-description'>
      <bem.FormView__cell m={['label', 'first']}>
        {t('Project information')}
      </bem.FormView__cell>
      <bem.FormView__cell m='box'>
        {(hasCountry || hasSector) &&
          <bem.FormView__group m={['items']}>
            {hasCountry &&
              <bem.FormView__cell m='padding'>
                <bem.FormView__label m='country'>{t('Country')}</bem.FormView__label>
                {getCountryDisplayString(props.asset)}
              </bem.FormView__cell>
            }
            {hasSector &&
              <bem.FormView__cell m='padding'>
                <bem.FormView__label m='sector'>{t('Sector')}</bem.FormView__label>
                {getSectorDisplayString(props.asset)}
              </bem.FormView__cell>
            }
          </bem.FormView__group>
        }
        {(props.asset.settings.operational_purpose || props.asset.settings.collects_pii) &&
          <bem.FormView__group m={['items']}>
            {props.asset.settings.operational_purpose &&
              <bem.FormView__cell m='padding'>
                <bem.FormView__label m='operational-purpose'>{t('Operational purpose of data')}</bem.FormView__label>
                {props.asset.settings.operational_purpose.label}
              </bem.FormView__cell>
            }
            {props.asset.settings.collects_pii &&
              <bem.FormView__cell m='padding'>
                <bem.FormView__label m='collects-pii'>{t('Collects personally identifiable information')}</bem.FormView__label>
                {props.asset.settings.collects_pii.label}
              </bem.FormView__cell>
            }
          </bem.FormView__group>
        }
        {props.asset.settings.description &&
          <bem.FormView__group m='items'>
            <bem.FormView__cell m={['padding', 'description']}>
              <bem.FormView__label m='description'>{t('Description')}</bem.FormView__label>
              <p>{props.asset.settings.description}</p>
            </bem.FormView__cell>
          </bem.FormView__group>
        }
        <bem.FormView__group m='summary-details-cols'>
          <bem.FormView__cell>
            <bem.FormView__label>{t('Last modified')}</bem.FormView__label>
            {formatTime(props.asset.date_modified)}
          </bem.FormView__cell>
          {latestSubmissionDate &&
            <bem.FormView__cell>
              <bem.FormView__label>{t('Latest submission')}</bem.FormView__label>
              {formatTime(latestSubmissionDate)}
            </bem.FormView__cell>
          }
          {props.asset.summary &&
            <bem.FormView__cell>
              <bem.FormView__label>{t('Questions')}</bem.FormView__label>
              {props.asset.summary.row_count}
            </bem.FormView__cell>
          }

          {props.asset.summary?.languages && props.asset.summary.languages.length > 1 &&
            <bem.FormView__cell>
              <bem.FormView__label>{t('Languages')}</bem.FormView__label>
              {props.asset.summary.languages.map((l, i) => (
                  <bem.FormView__cell key={`lang-${i}`} data-index={i}>
                    {l}
                  </bem.FormView__cell>
                ))}
            </bem.FormView__cell>
          }
        </bem.FormView__group>
      </bem.FormView__cell>
    </bem.FormView__row>
  );
}
