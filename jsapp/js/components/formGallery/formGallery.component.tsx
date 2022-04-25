import React, {useEffect, useMemo, useReducer} from 'react';
import ReactSelect from 'react-select';
// @ts-ignore
import {dataInterface} from 'js/dataInterface';
import bem, {makeBem} from 'js/bem';
import {getFlatQuestionsList} from 'jsapp/js/assetUtils';
import './formGallery.component.scss';
import {initialState, reducer} from './formGallery.reducer';
import {
  selectFilterQuery,
  selectImageAttachments,
  selectShowLoadMore,
} from './formGallery.selectors';

bem.Gallery = makeBem(null, 'gallery');
bem.Gallery__wrapper = makeBem(bem.Gallery, 'wrapper');
bem.Gallery__header = makeBem(bem.Gallery, 'header');
bem.Gallery__icons = makeBem(bem.Gallery, 'icons');
bem.GalleryRow = makeBem(null, 'gallery-row');
bem.GalleryRow__select = makeBem(bem.GalleryRow, 'select');
bem.GalleryRow__dates = makeBem(bem.GalleryRow, 'dates');
bem.GalleryGrid = makeBem(null, 'gallery-grid');
bem.GalleryBottom = makeBem(null, 'gallery-bottom');

const PAGE_SIZE = 30;

interface FormGalleryProps {
  asset: AssetResponse;
}

export default function FormGallery(props: FormGalleryProps) {
  const flatQuestionsList = getFlatQuestionsList(
    props.asset.content!.survey!
  ).filter((survey) => survey.type === 'image');
  const questions = flatQuestionsList.map((survey) => ({
    value: survey.path,
    label:
      survey.parents.join(' / ') +
      (survey.parents.length ? ' / ' : '') +
      survey.label,
  }));
  const defaultOption = {value: '', label: 'All questions'};
  const questionFilterOptions = [defaultOption, ...(questions || [])];
  const [
    {submissions, next, isFullscreen, filterQuestion, startDate, endDate},
    dispatch,
  ] = useReducer(reducer, initialState);

  const attachments = useMemo(
    () => selectImageAttachments(submissions, filterQuestion),
    [submissions]
  );
  const showLoadMore = useMemo(() => selectShowLoadMore(next), [next]);
  const filterQuery = useMemo(
    () =>
      selectFilterQuery(filterQuestion, flatQuestionsList, startDate, endDate),
    [filterQuestion, startDate, endDate]
  );

  useEffect(() => {
    dispatch({type: 'getSubmissions'});
    dataInterface
      .getSubmissions(props.asset.uid, PAGE_SIZE, 0, [], [], filterQuery)
      .done((resp: PaginatedResponse<SubmissionResponse>) =>
        dispatch({type: 'getSubmissionsCompleted', resp})
      );
  }, [filterQuestion, startDate, endDate]);

  const loadMoreSubmissions = () => {
    if (next) {
      // The needed start offset is already in the next state, extract it
      const start = new URL(next).searchParams.get('start');
      if (start) {
        dispatch({type: 'loadMoreSubmissions'});

        dataInterface
          .getSubmissions(
            props.asset.uid,
            PAGE_SIZE,
            start,
            [],
            [],
            filterQuery
          )
          .done((resp: PaginatedResponse<SubmissionResponse>) =>
            dispatch({type: 'loadMoreSubmissionsCompleted', resp})
          );
      }
    }
  };

  // Hacky way to extend form view
  // Refactor as it's own component maybe?
  let formViewClass = 'form-view';
  if (isFullscreen) {
    formViewClass += ' form-view--fullscreen';
  }

  return (
    <bem.Gallery className={formViewClass}>
      <bem.Gallery__wrapper>
        <bem.Gallery__header>
          <h1>{t('Image Gallery')}</h1>
          <bem.Gallery__icons>
            {/* TODO: implement these buttons */}
            {/* <bem.Button
              m='icon'
              className='report-button__expand right-tooltip'
              data-tip={t('Download')}
            >
              <i className='k-icon k-icon-download' />
            </bem.Button>
            <bem.Button
              m='icon'
              className='report-button__expand right-tooltip'
              data-tip={t('Display options')}
            >
              <i className='k-icon k-icon-settings' />
            </bem.Button> */}
            <bem.Button
              m='icon'
              className='report-button__expand right-tooltip'
              onClick={() => dispatch({type: 'toggleFullscreen'})}
              data-tip={t('Toggle fullscreen')}
            >
              <i className='k-icon k-icon-expand' />
            </bem.Button>
          </bem.Gallery__icons>
        </bem.Gallery__header>
        <bem.GalleryRow>
          {t('From')}
          <bem.GalleryRow__select>
            <ReactSelect
              options={questionFilterOptions}
              defaultValue={defaultOption}
              onChange={(newValue) =>
                dispatch({type: 'setFilterQuestion', question: newValue!.value})
              }
            />
          </bem.GalleryRow__select>
          <bem.GalleryRow__dates>
            {t('Between')}
            <input
              type='date'
              onChange={(e) =>
                dispatch({type: 'setStartDate', value: e.target.value})
              }
            />
            {t('and')}
            <input
              type='date'
              onChange={(e) =>
                dispatch({type: 'setEndDate', value: e.target.value})
              }
            />
          </bem.GalleryRow__dates>
        </bem.GalleryRow>
        <bem.GalleryGrid>
          {attachments.map((attachment) => (
            <a
              key={attachment.id}
              href={attachment.download_url}
              target='_blank'
            >
              <img
                src={attachment.download_url}
                alt={attachment.filename}
                width='150'
                loading='lazy'
              />
            </a>
          ))}
        </bem.GalleryGrid>
        {showLoadMore && (
          <bem.GalleryBottom>
            <bem.Button onClick={() => loadMoreSubmissions()}>
              {t('Load more')}
            </bem.Button>
          </bem.GalleryBottom>
        )}
      </bem.Gallery__wrapper>
    </bem.Gallery>
  );
}
