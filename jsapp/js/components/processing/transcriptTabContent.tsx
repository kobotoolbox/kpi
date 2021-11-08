import React from 'react'
import clonedeep from 'lodash.clonedeep'
import envStore from 'js/envStore'
import bem from 'js/bem'
import {formatTime} from 'js/utils'
import {AnyRowTypeName} from 'js/constants'
import singleProcessingStore from 'js/components/processing/singleProcessingStore'
import LanguageSelector from 'js/components/languages/languageSelector'
import Button from 'js/components/common/button'
import 'js/components/processing/processingBody'

interface TranscriptDraft {
  content?: string
  languageCode?: string
}

type TranscriptTabContentProps = {
  questionType: AnyRowTypeName | undefined
}

type TranscriptTabContentState = {
  transcriptDraft?: TranscriptDraft
}

export default class TranscriptTabContent extends React.Component<
  TranscriptTabContentProps,
  TranscriptTabContentState
> {
  constructor(props: TranscriptTabContentProps) {
    super(props)
    this.state = {}
  }

  private unlisteners: Function[] = []

  componentDidMount() {
    this.unlisteners.push(
      singleProcessingStore.listen(this.onSingleProcessingStoreChange, this)
    )
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb()})
  }

  /**
  * Don't want to store a duplicate of store data here just for the sake of
  * comparison, so we need to make the component re-render itself when the
  * store changes :shrug:.
  */
  onSingleProcessingStoreChange() {
    this.forceUpdate()
  }

  /** Changes the draft language, preserving the other draft properties. */
  onLanguageChange(newVal: string | undefined) {
    const newDraft = clonedeep(this.state.transcriptDraft) || {}
    newDraft.languageCode = newVal
    this.setState({transcriptDraft: newDraft})
  }

  /** Changes the draft content, preserving the other draft properties. */
  setDraftContent(newVal: string | undefined) {
    const newDraft = clonedeep(this.state.transcriptDraft) || {}
    newDraft.content = newVal
    this.setState({transcriptDraft: newDraft})
  }

  onDraftContentChange(evt: React.ChangeEvent<HTMLTextAreaElement>) {
    this.setDraftContent(evt.target.value)
  }

  begin() {
    // Make an empty draft.
    this.setState({transcriptDraft: {}})
  }

  selectModeManual() {
    // Initialize draft content.
    this.setDraftContent('')
  }

  selectModeAuto() {
    // TODO: this will display an automated service selector that will
    // ultimately produce a `transcriptDraft.content`.
  }

  discardDraft() {
    // Remove draft.
    this.setState({transcriptDraft: undefined})
  }

  saveDraft() {
    if (
      this.state.transcriptDraft?.languageCode !== undefined &&
      this.state.transcriptDraft?.content !== undefined
    ) {
      singleProcessingStore.setTranscript({
        languageCode: this.state.transcriptDraft.languageCode,
        content: this.state.transcriptDraft.content,
        dateCreated: Date()
      })
    }
  }

  openEditor() {
    // Make new draft using existing transcript.
    this.setState({transcriptDraft: singleProcessingStore.getTranscript()})
  }

  deleteTranscript() {
    singleProcessingStore.setTranscript(undefined)
  }

  hasUnsavedDraftContent() {
    return (
      this.state.transcriptDraft?.content !== singleProcessingStore.getTranscript()?.content
    )
  }

  renderLanguageAndDate() {
    const storeTranscript = singleProcessingStore.getTranscript()
    const contentLanguageCode = this.state.transcriptDraft?.languageCode || storeTranscript?.languageCode
    if (contentLanguageCode === undefined) {
      return null
    }

    // If the draft/transcript language is custom (i.e. not known to envStore),
    // we just display the given value.
    const knownLanguage = envStore.getLanguage(contentLanguageCode)
    const languageLabel = knownLanguage?.label || contentLanguageCode

    return (
      <React.Fragment>
        <div>
          {t('Language')}
          <bem.ProcessingBody__transHeaderLanguage>
            {languageLabel}
          </bem.ProcessingBody__transHeaderLanguage>
        </div>

        {storeTranscript?.dateCreated &&
          <bem.ProcessingBody__transHeaderDate>
            {t('Created ##date##').replace('##date##', formatTime(storeTranscript.dateCreated))}
          </bem.ProcessingBody__transHeaderDate>
        }
      </React.Fragment>
    )
  }

  getLanguageSelectorTitle() {
    let typeLabel = this.props.questionType || t('source file')
    return t('Please selet the original language of the ##type##').replace('##type##', typeLabel)
  }

  renderStepBegin() {
    let typeLabel = this.props.questionType || t('source file')
    return (
      <bem.ProcessingBody m='begin'>
        <p>{t('This ##type## does not have a transcript yet').replace('##type##', typeLabel)}</p>

        <Button
          type='full'
          color='blue'
          size='l'
          label={t('begin')}
          onClick={this.begin.bind(this)}
        />
      </bem.ProcessingBody>
    )
  }

  renderStepConfig() {
    return (
      <bem.ProcessingBody m='config'>
        <LanguageSelector
          titleOverride={this.getLanguageSelectorTitle()}
          onLanguageChange={this.onLanguageChange.bind(this)}
        />

        <Button
          type='frame'
          color='blue'
          size='m'
          label={t('manual')}
          onClick={this.selectModeManual.bind(this)}
          isDisabled={this.state.transcriptDraft?.languageCode === undefined}
        />

        <Button
          type='full'
          color='blue'
          size='m'
          label={t('automatic')}
          onClick={this.selectModeAuto.bind(this)}
          // TODO: This is disabled until we actually work on automated services integration.
          isDisabled
        />
      </bem.ProcessingBody>
    )
  }

  renderStepEditor() {
    return (
      <bem.ProcessingBody>
        <bem.ProcessingBody__transHeader>
          {this.renderLanguageAndDate()}

          <bem.ProcessingBody__transHeaderButtons>
            <Button
              type='frame'
              color='blue'
              size='s'
              label={t('Discard')}
              onClick={this.discardDraft.bind(this)}
              isDisabled={!this.hasUnsavedDraftContent() || singleProcessingStore.isPending}
            />

            <Button
              type='full'
              color='blue'
              size='s'
              label={t('Save')}
              onClick={this.saveDraft.bind(this)}
              isPending={singleProcessingStore.isPending}
              isDisabled={!this.hasUnsavedDraftContent()}
            />
          </bem.ProcessingBody__transHeaderButtons>
        </bem.ProcessingBody__transHeader>

        <bem.ProcessingBody__textarea
          value={this.state.transcriptDraft?.content}
          onChange={this.onDraftContentChange.bind(this)}
          disabled={singleProcessingStore.isPending}
        />
      </bem.ProcessingBody>
    )
  }

  renderStepViewer() {
    return (
      <bem.ProcessingBody>
        <bem.ProcessingBody__transHeader>
          {this.renderLanguageAndDate()}

          <bem.ProcessingBody__transHeaderButtons>
            <Button
              type='bare'
              color='gray'
              size='s'
              startIcon='edit'
              onClick={this.openEditor.bind(this)}
              tooltip={t('Edit')}
              isDisabled={singleProcessingStore.isPending}
            />

            <Button
              type='bare'
              color='gray'
              size='s'
              startIcon='trash'
              onClick={this.deleteTranscript.bind(this)}
              tooltip={t('Delete')}
              isPending={singleProcessingStore.isPending}
            />
          </bem.ProcessingBody__transHeaderButtons>
        </bem.ProcessingBody__transHeader>

        <bem.ProcessingBody__text>
          {singleProcessingStore.getTranscript()?.content}
        </bem.ProcessingBody__text>
      </bem.ProcessingBody>
    )
  }

  /** Identifies what step should be displayed based on the data itself. */
  render() {
    // Step 1: Begin - the step where there is nothing yet.
    if (
      singleProcessingStore.getTranscript() === undefined &&
      this.state.transcriptDraft === undefined
    ) {
      return this.renderStepBegin()
    }

    // Step 2: Config - for selecting the transcript language and mode.
    if (
      this.state.transcriptDraft !== undefined &&
      (
        this.state.transcriptDraft.languageCode === undefined ||
        this.state.transcriptDraft.content === undefined
      )
    ) {
      return this.renderStepConfig()
    }

    // Step 3: Editor - display editor of draft transcript.
    if (this.state.transcriptDraft !== undefined) {
      return this.renderStepEditor()
    }

    // Step 4: Viewer - display existing (on backend) transcript.
    if (
      singleProcessingStore.getTranscript() !== undefined &&
      this.state.transcriptDraft === undefined
    ) {
      return this.renderStepViewer()
    }

    // Should not happen, but we need to return something.
    return null
  }
}
