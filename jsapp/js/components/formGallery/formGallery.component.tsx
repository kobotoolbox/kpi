import './formGallery.component.scss'

import React, { useEffect, useMemo, useReducer } from 'react'

import { Center } from '@mantine/core'
import ReactSelect from 'react-select'
import { getFlatQuestionsList } from '#/assetUtils'
import DeletedAttachment from '#/attachments/deletedAttachment.component'
import bem, { makeBem } from '#/bem'
import Button from '#/components/common/button'
import type { AssetResponse, PaginatedResponse, SubmissionResponse } from '#/dataInterface'
import { dataInterface } from '#/dataInterface'
import { initialState, reducer } from './formGallery.reducer'
import { selectFilterQuery, selectImageAttachments, selectShowLoadMore } from './formGallery.selectors'

bem.Gallery = makeBem(null, 'gallery')
bem.Gallery__wrapper = makeBem(bem.Gallery, 'wrapper')
bem.Gallery__header = makeBem(bem.Gallery, 'header')
bem.Gallery__headerIcons = makeBem(bem.Gallery, 'header-icons')
bem.GalleryFilters = makeBem(bem.Gallery, 'filters')
bem.GalleryFiltersSelect = makeBem(bem.Gallery, 'filters-select')
bem.GalleryFiltersDates = makeBem(bem.Gallery, 'filters-dates')
bem.GalleryGrid = makeBem(bem.Gallery, 'grid')
bem.GalleryFooter = makeBem(bem.Gallery, 'footer')

const PAGE_SIZE = 30

interface FormGalleryProps {
  asset: AssetResponse
}

export default function FormGallery(props: FormGalleryProps) {
  const flatQuestionsList = getFlatQuestionsList(props.asset.content!.survey!).filter(
    (survey) => survey.type === 'image',
  )
  const questions = flatQuestionsList.map((survey) => {
    return {
      value: survey.path,
      label: survey.parents.join(' / ') + (survey.parents.length ? ' / ' : '') + survey.label,
    }
  })
  const defaultOption = { value: '', label: t('All questions') }
  const questionFilterOptions = [defaultOption, ...(questions || [])]
  const [{ submissions, isLoading, next, isFullscreen, filterQuestion, startDate, endDate }, dispatch] = useReducer(
    reducer,
    initialState,
  )

  const attachments = useMemo(() => selectImageAttachments(submissions, filterQuestion), [submissions])
  const showLoadMore = useMemo(() => selectShowLoadMore(next), [next])
  const filterQuery = useMemo(
    () => selectFilterQuery(filterQuestion, flatQuestionsList, startDate, endDate),
    [filterQuestion, startDate, endDate],
  )

  useEffect(() => {
    dispatch({ type: 'getSubmissions' })
    dataInterface
      .getSubmissions(props.asset.uid, PAGE_SIZE, 0, [], [], filterQuery)
      .done((resp: PaginatedResponse<SubmissionResponse>) => dispatch({ type: 'getSubmissionsCompleted', resp }))
  }, [filterQuestion, startDate, endDate])

  const loadMoreSubmissions = () => {
    if (next) {
      // The needed start offset is already in the next state, extract it
      const start = new URL(next).searchParams.get('start')
      if (start) {
        dispatch({ type: 'loadMoreSubmissions' })

        dataInterface
          .getSubmissions(props.asset.uid, PAGE_SIZE, start, [], [], filterQuery)
          .done((resp: PaginatedResponse<SubmissionResponse>) =>
            dispatch({ type: 'loadMoreSubmissionsCompleted', resp }),
          )
      }
    }
  }

  // Hacky way to extend form view
  // Refactor as it's own component maybe?
  let formViewClass = 'form-view'
  if (isFullscreen) {
    formViewClass += ' form-view--fullscreen'
  }

  return (
    <bem.Gallery className={formViewClass}>
      <bem.Gallery__wrapper>
        <bem.Gallery__header>
          <h1>{t('Image Gallery')}</h1>
          <bem.Gallery__headerIcons>
            <Button
              type='text'
              size='m'
              startIcon='expand'
              onClick={() => dispatch({ type: 'toggleFullscreen' })}
              tooltip={t('Toggle fullscreen')}
            />
          </bem.Gallery__headerIcons>
        </bem.Gallery__header>
        <bem.GalleryFilters>
          {t('From')}
          <bem.GalleryFiltersSelect>
            <ReactSelect
              options={questionFilterOptions}
              defaultValue={defaultOption}
              onChange={(newValue) => dispatch({ type: 'setFilterQuestion', question: newValue!.value })}
            />
          </bem.GalleryFiltersSelect>
          <bem.GalleryFiltersDates>
            <label>
              {t('Between')}
              <input type='date' onChange={(e) => dispatch({ type: 'setStartDate', value: e.target.value })} />
            </label>
            <label>
              {t('and')}
              <input type='date' onChange={(e) => dispatch({ type: 'setEndDate', value: e.target.value })} />
            </label>
          </bem.GalleryFiltersDates>
        </bem.GalleryFilters>
        <bem.GalleryGrid>
          {attachments.map((attachment) =>
            attachment.is_deleted ? (
              <Center key={attachment.uid} title={attachment.filename} className='gallery-grid-deleted-attachment'>
                <DeletedAttachment />
              </Center>
            ) : (
              <a key={attachment.uid} href={attachment.download_url} target='_blank'>
                <img src={attachment.download_url} alt={attachment.filename} width='150' loading='lazy' />
              </a>
            ),
          )}
        </bem.GalleryGrid>
        {showLoadMore && (
          <bem.GalleryFooter>
            <Button
              type='text'
              size='m'
              isPending={isLoading}
              label={t('Load more')}
              onClick={() => loadMoreSubmissions()}
            />
          </bem.GalleryFooter>
        )}
      </bem.Gallery__wrapper>
    </bem.Gallery>
  )
}
