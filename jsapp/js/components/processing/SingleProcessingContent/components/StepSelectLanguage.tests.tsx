import { MantineProvider } from '@mantine/core'
import { fireEvent, render, screen } from '@testing-library/react'
import { UsageLimitTypes } from '#/account/stripe.types'
import type { LanguageCode } from '#/components/languages/languagesStore'
import { themeKobo } from '#/theme'
import StepSelectLanguage from './StepSelectLanguage'

// The children fetch languages and usage; these tests only cover this step's own logic.
const mockAutomaticButton = jest.fn()
jest.mock('./transxAutomaticButton', () => ({
  __esModule: true,
  default: (props: unknown) => {
    mockAutomaticButton(props)
    return null
  },
}))
jest.mock('#/components/languages/LanguageSelector', () => ({
  __esModule: true,
  default: (props: { titleOverride: string; value: string | null }) => (
    <output aria-label={props.titleOverride}>{props.value ?? ''}</output>
  ),
}))
jest.mock('#/account/usage/useOrganizationsServiceUsageSummary', () => ({
  useOrganizationsServiceUsageSummary: () => ({ data: undefined }),
}))

const TARGET_TITLE = 'Please select the language you want to translate to'
const SOURCE_TITLE = 'Please select the language of the text response'

function renderStep({
  languageCode = null,
  sourceLanguage,
}: {
  languageCode?: LanguageCode | null
  sourceLanguage?: LanguageCode | null
}) {
  // `undefined` is a transcript, which isn't asked for a source language
  const handlers = {
    onBack: jest.fn(),
    setLanguageCode: jest.fn(),
    onSourceLanguageChange: jest.fn(),
  }
  const textSource =
    sourceLanguage === undefined
      ? undefined
      : { languageCode: sourceLanguage, onChange: handlers.onSourceLanguageChange }
  render(
    <MantineProvider theme={themeKobo}>
      <StepSelectLanguage
        onBack={handlers.onBack}
        onNext={jest.fn()}
        onLimitExceeded={jest.fn()}
        usageType={UsageLimitTypes.TRANSLATION}
        automaticServiceType='translation'
        languageCode={languageCode}
        setLanguageCode={handlers.setLanguageCode}
        suggestedLanguages={[]}
        titleOverride={TARGET_TITLE}
        singleManualButtonLabel='translate'
        disableAutomatic={false}
        textSource={textSource}
      />
    </MantineProvider>,
  )
  return handlers
}

const getManualButton = () => screen.getByRole('button', { name: 'translate' })
const getLastAutomaticButtonProps = () => mockAutomaticButton.mock.lastCall?.[0]

beforeEach(() => {
  mockAutomaticButton.mockClear()
})

const isManualButtonDisabled = () => (getManualButton() as HTMLButtonElement).disabled

describe('StepSelectLanguage', () => {
  describe('for a transcript', () => {
    it('asks only for the target language', () => {
      renderStep({ languageCode: 'fr' })
      chai.expect(screen.queryByLabelText(TARGET_TITLE)).to.not.equal(null)
      chai.expect(screen.queryByLabelText(SOURCE_TITLE)).to.equal(null)
    })

    it('enables the buttons once the target language is picked', () => {
      renderStep({ languageCode: 'fr' })
      chai.expect(isManualButtonDisabled()).to.equal(false)
      chai.expect(getLastAutomaticButtonProps()).to.include({
        selectedLanguage: 'fr',
        sourceLanguage: null,
        type: 'translation',
        disabled: false,
      })
    })
  })

  describe('for a text response', () => {
    it('asks for the source language along with the target language', () => {
      renderStep({ sourceLanguage: 'es' })
      chai.expect(screen.getByLabelText(SOURCE_TITLE).textContent).to.equal('es')
      chai.expect(screen.queryByLabelText(TARGET_TITLE)).to.not.equal(null)
    })

    it('keeps both buttons disabled while the source language is missing', () => {
      renderStep({ languageCode: 'fr', sourceLanguage: null })
      chai.expect(isManualButtonDisabled()).to.equal(true)
      chai.expect(getLastAutomaticButtonProps()).to.include({ disabled: true })
    })

    it('keeps the manual button disabled while the target language is missing', () => {
      renderStep({ sourceLanguage: 'es' })
      chai.expect(isManualButtonDisabled()).to.equal(true)
    })

    it('enables the buttons once both languages are picked, checking the source for the automatic one', () => {
      renderStep({ languageCode: 'fr', sourceLanguage: 'es' })
      chai.expect(isManualButtonDisabled()).to.equal(false)
      chai.expect(getLastAutomaticButtonProps()).to.include({
        selectedLanguage: 'fr',
        sourceLanguage: 'es',
        disabled: false,
      })
    })

    it('clears only the target language on "back", keeping the source language', () => {
      const handlers = renderStep({ languageCode: 'fr', sourceLanguage: 'es' })
      fireEvent.click(screen.getByRole('button', { name: 'back' }))
      chai.expect(handlers.setLanguageCode.mock.calls).to.deep.equal([[null]])
      chai.expect(handlers.onSourceLanguageChange.mock.calls).to.have.lengthOf(0)
      chai.expect(handlers.onBack.mock.calls).to.have.lengthOf(0)
    })

    it('goes back when no target language is picked, even with a source language', () => {
      const handlers = renderStep({ sourceLanguage: 'es' })
      fireEvent.click(screen.getByRole('button', { name: 'back' }))
      chai.expect(handlers.onBack.mock.calls).to.have.lengthOf(1)
      chai.expect(handlers.setLanguageCode.mock.calls).to.have.lengthOf(0)
      chai.expect(handlers.onSourceLanguageChange.mock.calls).to.have.lengthOf(0)
    })
  })
})
