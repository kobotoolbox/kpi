import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import type { DataResponse } from '#/api/models/dataResponse'
import { QUESTION_TYPES } from '#/constants'
import type { AssetContent, AssetResponse, SurveyRow } from '#/dataInterface'
import { FeatureFlag } from '#/featureFlags'
import { themeKobo } from '#/theme'
import SelectQuestion from './SelectQuestion'

// jsdom has no ResizeObserver, but Mantine's dropdown ScrollArea needs one to mount.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverStub

function setNlpTextActionsEnabled(enabled: boolean) {
  sessionStorage.setItem('feature_flags', JSON.stringify({ [FeatureFlag.nlpTextActionsEnabled]: enabled }))
}

const AUDIO_ROW: SurveyRow = {
  $kuid: 'k-audio',
  type: QUESTION_TYPES.audio.id,
  name: 'audio_q',
  $xpath: 'audio_q',
  label: ['Audio question'],
}

const TEXT_ROW: SurveyRow = {
  $kuid: 'k-text',
  type: QUESTION_TYPES.text.id,
  name: 'text_q',
  $xpath: 'text_q',
  label: ['Text question'],
}

const IMAGE_ROW: SurveyRow = {
  $kuid: 'k-image',
  type: QUESTION_TYPES.image.id,
  name: 'image_q',
  $xpath: 'image_q',
  label: ['Image question'],
}

const CONTENT: AssetContent = {
  survey: [AUDIO_ROW, TEXT_ROW, IMAGE_ROW],
}

const ASSET = { uid: 'asset-1', content: CONTENT, summary: { languages: [] } } as unknown as AssetResponse

// Answered under a different (e.g. renamed-group) xpath than the row's current `$xpath`, so `SelectQuestion` only
// picks these up via the orphan-reconciliation path (`findRowByXpathOrLeafName`), not the schema filter.
const SUBMISSION = {
  audio_q: 'recording.mp3',
  text_q: 'some answer',
  image_q: 'photo.jpg',
  'renamed_group/audio_q': 'recording.mp3',
  'renamed_group/text_q': 'some answer',
} as unknown as DataResponse

function renderSelectQuestion(xpath: string) {
  return render(
    <MantineProvider theme={themeKobo}>
      <SelectQuestion
        asset={ASSET}
        submission={SUBMISSION}
        currentSubmissionUid='sub-1'
        questionLabelLanguage=''
        xpath={xpath}
        hasUnsavedWork={false}
      />
    </MantineProvider>,
  )
}

/** Opens the dropdown so Mantine mounts the (portalled) option list. */
function openDropdown() {
  fireEvent.click(screen.getByRole('textbox'))
}

describe('SelectQuestion', () => {
  afterEach(() => {
    sessionStorage.clear()
  })

  it('lists both the schema and orphan audio entries, but no text or image entries, when the flag is off', () => {
    setNlpTextActionsEnabled(false)
    renderSelectQuestion('audio_q')
    openDropdown()

    chai.expect(screen.queryAllByText('Audio question')).to.have.lengthOf(2)
    chai.expect(screen.queryAllByText('Text question')).to.have.lengthOf(0)
    chai.expect(screen.queryAllByText('Image question')).to.have.lengthOf(0)
  })

  it('also lists both the schema and orphan text entries when the flag is on', () => {
    setNlpTextActionsEnabled(true)
    renderSelectQuestion('audio_q')
    openDropdown()

    chai.expect(screen.queryAllByText('Audio question')).to.have.lengthOf(2)
    chai.expect(screen.queryAllByText('Text question')).to.have.lengthOf(2)
    chai.expect(screen.queryAllByText('Image question')).to.have.lengthOf(0)
  })
})
