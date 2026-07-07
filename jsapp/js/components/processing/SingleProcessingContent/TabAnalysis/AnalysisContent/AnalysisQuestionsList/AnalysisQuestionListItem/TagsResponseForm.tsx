import React from 'react'

import { Radio } from '@mantine/core'
import { getAssetsQualQuestionsTagsListQueryKey, useAssetsQualQuestionsTagsList } from '#/api/react-query/survey-data'
import TagsInput from '#/components/common/TagsInput'
import type { QualVersionItem } from '#/components/processing/common/types'
import styles from '../../../common/styles.module.scss'

interface Props {
  qaAnswer?: QualVersionItem
  disabled: boolean
  onSave: (values: string[]) => Promise<unknown>
  assetUid?: string
  qaQuestionUid?: string
}

export default function SelectMultipleResponseForm({ qaAnswer, onSave, disabled, assetUid, qaQuestionUid }: Props) {
  const assetUidParam = assetUid ?? ''
  const qaQuestionUidParam = qaQuestionUid ?? ''
  const { data: suggestedTagsData, isLoading } = useAssetsQualQuestionsTagsList(assetUidParam, qaQuestionUidParam, {
    query: {
      queryKey: getAssetsQualQuestionsTagsListQueryKey(assetUidParam, qaQuestionUidParam),
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    },
  })
  const suggestedTagsResponses = suggestedTagsData?.status === 200 ? suggestedTagsData.data : []
  // Extract the values into an array of strings for the tag input
  const suggestedTags = suggestedTagsResponses.map((tagResponse) => tagResponse.value)
  const selectedValues = (qaAnswer?._data as any)?.value ?? []

  return (
    <Radio.Group>
      <TagsInput
        data={suggestedTags}
        value={selectedValues}
        onChange={onSave}
        acceptValueOnBlur
        disabled={disabled || isLoading}
        classNames={{
          input: styles.responseBorderDefault,
        }}
        comboboxProps={{
          resetSelectionOnOptionHover: true,
          position: 'bottom',
          middlewares: { flip: false, shift: false },
        }}
      />
    </Radio.Group>
  )
}
