import './formGallery.component.scss'

import { Box, Center, Flex, Image, Modal } from '@mantine/core'
import React, { useEffect, useMemo, useReducer } from 'react'
import ReactSelect from 'react-select'
import { getFlatQuestionsList } from '#/assetUtils'
import DeletedAttachment from '#/attachments/deletedAttachment.component'
import bem, { makeBem } from '#/bem'
import ActionIcon from '#/components/common/ActionIcon'
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

const PAGE_SIZE = 20

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

  const [
    {
      submissions,
      isLoading,
      next,
      isFullscreen,
      filterQuestion,
      startDate,
      endDate,
      isModalOpen,
      currentModalImageIndex,
    },
    dispatch,
  ] = useReducer(reducer, initialState)

  const attachments = useMemo(() => selectImageAttachments(submissions, filterQuestion), [submissions, filterQuestion])
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

  const loadMoreSubmissions = (isModalLoad = false) => {
    if (next) {
      const start = new URL(next).searchParams.get('start')
      if (start) {
        dispatch({ type: 'loadMoreSubmissions' })

        // Store the current length before loading new data.
        const previousLength = attachments.length

        // Let;s try using
        // /api/v2/assets/{uid_asset}/data.json?query={"_attachments":{"$elemMatch":{"mimetype": {"$regex":"^image/"}}}}

        dataInterface
          .getSubmissions(props.asset.uid, PAGE_SIZE, start, [], [], filterQuery)
          .done((resp: PaginatedResponse<SubmissionResponse>) => {
            dispatch({ type: 'loadMoreSubmissionsCompleted', resp })

            // If triggered from the modal, jump to the first new item
            if (isModalLoad && resp.results.length > 0) {
              dispatch({ type: 'setModalImageIndex', index: previousLength })
            }
          })
      }
    }
  }

  const handleImageClick = (index: number) => {
    dispatch({ type: 'openModal', index })
  }

  const closeModal = () => {
    dispatch({ type: 'closeModal' })
  }

  const navigateImage = (direction: 'next' | 'prev') => {
    const totalAttachments = attachments.length

    if (direction === 'prev') {
      const newIndex = (currentModalImageIndex - 1 + totalAttachments) % totalAttachments
      dispatch({ type: 'setModalImageIndex', index: newIndex })
    }

    if (direction === 'next') {
      const isLastImage = currentModalImageIndex === totalAttachments - 1

      if (isLastImage && showLoadMore && !isLoading) {
        // Condition: On last image AND 'Load More' is visible AND not already loading
        // 1. Trigger the load, passing a flag to handle post-load navigation
        loadMoreSubmissions(true)
      } else if (!isLastImage) {
        // Standard navigation
        const newIndex = (currentModalImageIndex + 1) % totalAttachments
        dispatch({ type: 'setModalImageIndex', index: newIndex })
      }
      // If it's the last image and showLoadMore is false (no more pages), do nothing.
    }
  }

  const currentAttachment = attachments[currentModalImageIndex]
  const isLastImage = currentModalImageIndex === attachments.length - 1
  const isNextButtonLoading = isLastImage && showLoadMore && isLoading

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
          {attachments.map((attachment, index) =>
            attachment.is_deleted ? (
              <Center key={attachment.uid} title={attachment.filename} className='gallery-grid-deleted-attachment'>
                <DeletedAttachment />
              </Center>
            ) : (
              <Box key={attachment.uid} onClick={() => handleImageClick(index)} style={{ cursor: 'pointer' }}>
                <Image
                  src={attachment.download_small_url}
                  alt={attachment.filename}
                  w={150}
                  loading='lazy'
                  fit='cover'
                />
              </Box>
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
      {currentAttachment && (
        <Modal
          opened={isModalOpen}
          onClose={closeModal}
          title={`Image ${currentModalImageIndex + 1} of ${attachments.length}`}
          size='lg'
          centered
          overlayProps={{ backgroundOpacity: 0.55, blur: 3 }}
        >
          <Flex align='center' gap='md' p='sm'>
            {/* Previous button */}
            <ActionIcon
              variant='transparent'
              color='gray'
              size='md'
              aria-label='Previous image'
              onClick={() => navigateImage('prev')}
              disabled={isLoading}
              iconName='angle-left'
            />

            {/* Current image */}
            <Box style={{ flexGrow: 1, minWidth: 0 }}>
              <Image
                src={currentAttachment.download_url}
                alt={currentAttachment.filename}
                fit='contain'
                style={{ maxHeight: '70vh', width: '100%' }}
                loading='lazy'
              />
            </Box>

            {/* Next button with loading state */}
            <ActionIcon
              variant='transparent'
              color='gray'
              size='md'
              aria-label={isNextButtonLoading ? t('Loading next page') : t('Next image')}
              onClick={() => navigateImage('next')}
              disabled={!showLoadMore && isLastImage}
              iconName='angle-right'
              loading={isNextButtonLoading}
            />
          </Flex>
        </Modal>
      )}
    </bem.Gallery>
  )
}
