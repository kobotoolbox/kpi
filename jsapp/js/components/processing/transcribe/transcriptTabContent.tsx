import React from 'react'
import clonedeep from 'lodash.clonedeep';
import bem, {makeBem} from 'js/bem'
import envStore from 'js/envStore'
import singleProcessingStore from 'js/components/processing/singleProcessingStore'
import LanguageSelector from 'js/components/languages/languageSelector'
import Icon from 'js/components/common/icon'

interface TranscriptDraft {
  content?: string
  languageCode?: string
}

type TranscriptTabContentProps = {}

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

  onSingleProcessingStoreChange() {
    /**
     * Don't want to store a duplicate of store data here just for the sake of
     * comparison, so we need to make the component re-render itself when the
     * store changes :shrug:.
     */
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

  onBegin() {
    // Make an empty draft.
    this.setState({transcriptDraft: {}})
  }

  onManualModeSelected() {
    // Initialize draft content.
    this.setDraftContent('')
  }

  onAutomaticModeSelected() {
    // TODO: this will display an automated service selector that will
    // ultimately produce a `transcriptDraft.content`.
  }

  onDiscardDraft() {
    // Remove draft.
    this.setState({transcriptDraft: undefined})
  }

  onSaveDraft() {
    if (
      this.state.transcriptDraft?.languageCode !== undefined &&
      this.state.transcriptDraft?.content !== undefined
    ) {
      singleProcessingStore.setTranscript({
        languageCode: this.state.transcriptDraft.languageCode,
        content: this.state.transcriptDraft.content
      })
    }
  }

  hasUnsavedDraftContent() {
    return (
      this.state.transcriptDraft?.content !== singleProcessingStore.getTranscript()?.content
    )
  }

  renderStepBegin() {
    return (
      <div style={{padding: '40px'}}>
        <bem.KoboButton
          m='blue'
          onClick={this.onBegin.bind(this)}
        >
          {t('begin')}
        </bem.KoboButton>
      </div>
    )
  }

  renderStepConfig() {
    return (
      <div style={{padding: '40px'}}>
        <LanguageSelector onLanguageChange={this.onLanguageChange.bind(this)}/>

        <bem.KoboButton
          m='whitegray'
          onClick={this.onManualModeSelected.bind(this)}
          disabled={this.state.transcriptDraft?.languageCode === undefined}
        >
          {t('manual')}
        </bem.KoboButton>

        <bem.KoboButton
          m='blue'
          onClick={this.onAutomaticModeSelected.bind(this)}
          // TODO: This is disabled until we actually work on automated services integration.
          disabled
        >
          {t('automatic')}
        </bem.KoboButton>
      </div>
    )
  }

  renderStepEditor() {
    if (
      this.state.transcriptDraft?.languageCode === undefined ||
      this.state.transcriptDraft?.content === undefined
    ) {
      // This scenario wouldn't happen, but needs to be here for TypeScript.
      return null
    }

    // If the draft language is custom (i.e. not known to envStore), we just
    // display the given value.
    const knownLanguage = envStore.getLanguage(this.state.transcriptDraft.languageCode)
    const languageLabel = knownLanguage?.label || this.state.transcriptDraft.languageCode

    return (
      <div style={{padding: '40px'}}>
        <div>
          {t('Language')} {languageLabel}

          <bem.KoboLightButton
            onClick={this.onDiscardDraft.bind(this)}
            disabled={!this.hasUnsavedDraftContent()}
          >
            {t('Discard')}
          </bem.KoboLightButton>

          <bem.KoboLightButton
            m={{
              blue: true,
              pending: singleProcessingStore.isPending
            }}
            onClick={this.onSaveDraft.bind(this)}
            disabled={!this.hasUnsavedDraftContent()}
          >
            {t('Save')}
            {singleProcessingStore.isPending &&
              <Icon name='spinner' size='s' classNames={['k-spin']}/>
            }
          </bem.KoboLightButton>
        </div>

        <textarea
          value={this.state.transcriptDraft.content}
          onChange={this.onDraftContentChange.bind(this)}
        />
      </div>
    )
  }

  /** Identifies what step should be displayed based on data itself. */
  render() {
    /** Step 1: Begin - the step where there is nothing yet. */
    if (
      singleProcessingStore.getTranscript() === undefined &&
      this.state.transcriptDraft === undefined
    ) {
      return this.renderStepBegin()
    }

    /** Step 2: Config - for selecting the transcript language and mode. */
    if (
      this.state.transcriptDraft !== undefined &&
      (
        this.state.transcriptDraft.languageCode === undefined ||
        this.state.transcriptDraft.content === undefined
      )
    ) {
      return this.renderStepConfig()
    }

    /** Step 3: Editor */
    if (this.state.transcriptDraft !== undefined) {
      return this.renderStepEditor()
    }

    return (
      <div style={{padding: '40px'}}>
        todo
      </div>
    )
  }
}
