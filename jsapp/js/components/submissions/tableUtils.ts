import {
  META_QUESTION_TYPES,
  SUPPLEMENTAL_DETAILS_PROP
} from 'js/constants'
import {
  SUBMISSION_ACTIONS_ID,
  VALIDATION_STATUS_ID_PROP,
} from 'js/components/submissions/tableConstants'
import {getSurveyFlatPaths} from 'js/assetUtils'

export function getColumnLabel(
  asset: AssetResponse,
  key: string,
  showGroupName: boolean,
  translationIndex: number = 0
): string {
  if (asset.content?.survey === undefined) {
    return key
  }

  var question
  var questionPath: string[] = []
  if (key.includes('/')) {
    questionPath = key.split('/')
    question = asset.content.survey.find((o) => (
      o.name === questionPath[questionPath.length - 1] ||
      o.$autoname === questionPath[questionPath.length - 1]
    ))
  } else {
    question = asset.content.survey.find((o) => o.name === key || o.$autoname === key)
  }

  if (
    question === undefined &&
    questionPath[0] === SUPPLEMENTAL_DETAILS_PROP
  ) {
    const flatPaths = getSurveyFlatPaths(asset.content?.survey)
    console.log(key)
    // Supplemental details keys are built like one of:
    // - prefix / source question name / transcript
    // - prefix / source question name / translated / language code
    const sourceQuestionLabel = getColumnLabel(
      asset,
      flatPaths[questionPath[1]],
      showGroupName,
      translationIndex
    )
    if (questionPath[2] === 'transcript') {
      return `${sourceQuestionLabel} (${questionPath[3] || t('transcript')})`
    } else if (questionPath[2] === 'translated') {
      return `${sourceQuestionLabel} (${questionPath[3]})`
    }
  }


  // NOTE: Some very old code has something to do with nonexistent/negative
  // translationIndex. No idea what is that. It does influences returned value.
  const showLabels = translationIndex > -1

  if (key === SUBMISSION_ACTIONS_ID) {
    return t('Multi-select checkboxes column')
  }
  if (key === VALIDATION_STATUS_ID_PROP) {
    return t('Validation')
  }

  var label = key

  if (key.includes('/')) {
    var splitK = key.split('/')
    label = splitK[splitK.length - 1]
  }
  if (question && question.label && showLabels && question.label[translationIndex]) {
    label = question.label[translationIndex]
  }
  // show Groups in labels, when selected
  if (showGroupName && questionPath && key.includes('/')) {
    var gLabels = questionPath.join(' / ')

    if (showLabels) {
      var gT = questionPath.map(function (g) {
        var x = asset.content?.survey?.find((o) => o.name === g || o.$autoname === g)
        if (x && x.label && x.label[translationIndex]) {
          return x.label[translationIndex]
        }

        return g
      })
      gLabels = gT.join(' / ')
    }
    return gLabels
  }

  return label
}

export function getColumnHXLTags(survey: SurveyRow[], key: string) {
  const colQuestion: SurveyRow | undefined = survey.find((question) =>
    question.$autoname === key
  )
  if (!colQuestion || !colQuestion.tags) {
    return null
  }
  const HXLTags: string[] = []
  colQuestion.tags.forEach((tag) => {
    if (tag.startsWith('hxl:')) {
      HXLTags.push(tag.replace('hxl:', ''))
    }
  })
  if (HXLTags.length === 0) {
    return null
  } else {
    return HXLTags.join('')
  }
}

/**
 * TODO: if multiple background-audio's are allowed, we should return all
 * background-audio related names
 */
export function getBackgroundAudioQuestionName(asset: AssetResponse): string | null {
  return asset?.content?.survey?.find(
    (item) => item.type === META_QUESTION_TYPES['background-audio']
  )?.name || null
}
