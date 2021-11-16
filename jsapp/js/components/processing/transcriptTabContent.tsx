import React from 'react'
import clonedeep from 'lodash.clonedeep'
import envStore from 'js/envStore'
import bem from 'js/bem'
import {formatTime} from 'js/utils'
import {AnyRowTypeName} from 'js/constants'
import singleProcessingStore from 'js/components/processing/singleProcessingStore'
import LanguageSelector from 'js/components/languages/languageSelector'
import languageSelectorActions from 'js/components/languages/languageSelectorActions';
import Button from 'js/components/common/button'
import 'js/components/processing/processingBody'

type TranscriptTabContentProps = {
  questionType: AnyRowTypeName | undefined
}

export default class TranscriptTabContent extends React.Component<
  TranscriptTabContentProps,
  {}
> {
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
    const newDraft = clonedeep(singleProcessingStore.getTranscriptDraft()) || {}
    newDraft.languageCode = newVal
    singleProcessingStore.setTranscriptDraft(newDraft)
  }

  /** Changes the draft content, preserving the other draft properties. */
  setDraftContent(newVal: string | undefined) {
    const newDraft = clonedeep(singleProcessingStore.getTranscriptDraft()) || {}
    newDraft.content = newVal
    singleProcessingStore.setTranscriptDraft(newDraft)
  }

  onDraftContentChange(evt: React.ChangeEvent<HTMLTextAreaElement>) {
    this.setDraftContent(evt.target.value)
  }

  begin() {
    // Make an empty draft.
    singleProcessingStore.setTranscriptDraft({})
  }

  selectModeManual() {
    // Initialize draft content.
    this.setDraftContent('')
  }

  selectModeAuto() {
    // TODO: this will display an automated service selector that will
    // ultimately produce a draft content.
  }

  back() {
    const draft = singleProcessingStore.getTranscriptDraft()
    if (
      draft !== undefined &&
      draft?.languageCode === undefined &&
      draft?.content === undefined
    ) {
      this.discardDraft()
    }

    if (
      draft !== undefined &&
      draft?.languageCode !== undefined &&
      draft?.content === undefined
    ) {
      singleProcessingStore.setTranslationDraft({})
      languageSelectorActions.resetAll()
    }
  }

  discardDraft() {
    // Remove draft.
    singleProcessingStore.setTranscriptDraft(undefined)
  }

  saveDraft() {
    const existingTranscript = singleProcessingStore.getTranscript()
    const draft = singleProcessingStore.getTranscriptDraft()

    if (
      draft?.languageCode !== undefined &&
      draft?.content !== undefined
    ) {
      singleProcessingStore.setTranscript({
        languageCode: draft.languageCode,
        content: draft.content,
        dateCreated: existingTranscript?.dateCreated || Date(),
        dateModified: Date()
      })
    }
  }

  openEditor() {
    // Make new draft using existing transcript.
    singleProcessingStore.setTranscriptDraft(
      singleProcessingStore.getTranscript()
    )
  }

  deleteTranscript() {
    singleProcessingStore.setTranscript(undefined)
  }

  hasUnsavedDraftContent() {
    const draft = singleProcessingStore.getTranscriptDraft()
    return (
      draft?.content !== singleProcessingStore.getTranscript()?.content
    )
  }

  renderLanguageAndDate() {
    const storeTranscript = singleProcessingStore.getTranscript()
    const draft = singleProcessingStore.getTranscriptDraft()
    const contentLanguageCode = draft?.languageCode || storeTranscript?.languageCode
    if (contentLanguageCode === undefined) {
      return null
    }

    let dateText = ''
    if (storeTranscript) {
      if (storeTranscript.dateCreated !== storeTranscript?.dateModified) {
        dateText = t('Modified ##date##').replace('##date##', formatTime(storeTranscript.dateModified))
      } else {
        dateText = t('Created ##date##').replace('##date##', formatTime(storeTranscript.dateCreated))
      }
    }

    return (
      <React.Fragment>
        <div>
          {t('Language')}
          <bem.ProcessingBody__transHeaderLanguage>
            {envStore.getLanguageDisplayLabel(contentLanguageCode)}
          </bem.ProcessingBody__transHeaderLanguage>
        </div>

        {dateText !== '' &&
          <bem.ProcessingBody__transHeaderDate>
            {dateText}
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
    const draft = singleProcessingStore.getTranscriptDraft()

    return (
      <bem.ProcessingBody m='config'>
        <LanguageSelector
          titleOverride={this.getLanguageSelectorTitle()}
          onLanguageChange={this.onLanguageChange.bind(this)}
        />

        <bem.ProcessingBody__footer>
          <Button
            type='bare'
            color='blue'
            size='m'
            label={t('back')}
            startIcon='caret-left'
            onClick={this.back.bind(this)}
          />

          <div>
            <Button
              type='frame'
              color='blue'
              size='m'
              label={t('manual')}
              onClick={this.selectModeManual.bind(this)}
              isDisabled={draft?.languageCode === undefined}
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
          </div>
        </bem.ProcessingBody__footer>
      </bem.ProcessingBody>
    )
  }

  renderStepEditor() {
    const draft = singleProcessingStore.getTranscriptDraft()

    // The discard button will become a back button when there are no unsaved changes.
    let discardLabel = t('Back')
    if (this.hasUnsavedDraftContent()) {
      discardLabel = t('Discard')
    }

    return (
      <bem.ProcessingBody>
        <bem.ProcessingBody__transHeader>
          {this.renderLanguageAndDate()}

          <bem.ProcessingBody__transHeaderButtons>
            <Button
              type='frame'
              color='blue'
              size='s'
              label={discardLabel}
              onClick={this.discardDraft.bind(this)}
              isDisabled={singleProcessingStore.isFetchingData}
            />

            <Button
              type='full'
              color='blue'
              size='s'
              label={t('Save')}
              onClick={this.saveDraft.bind(this)}
              isPending={singleProcessingStore.isFetchingData}
              isDisabled={!this.hasUnsavedDraftContent()}
            />
          </bem.ProcessingBody__transHeaderButtons>
        </bem.ProcessingBody__transHeader>

        <bem.ProcessingBody__textarea
          value={draft?.content}
          onChange={this.onDraftContentChange.bind(this)}
          disabled={singleProcessingStore.isFetchingData}
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
              isDisabled={singleProcessingStore.isFetchingData}
            />

            <Button
              type='bare'
              color='gray'
              size='s'
              startIcon='trash'
              onClick={this.deleteTranscript.bind(this)}
              tooltip={t('Delete')}
              isPending={singleProcessingStore.isFetchingData}
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
    const draft = singleProcessingStore.getTranscriptDraft()

    // Step 1: Begin - the step where there is nothing yet.
    if (
      singleProcessingStore.getTranscript() === undefined &&
      draft === undefined
    ) {
      return this.renderStepBegin()
    }

    // Step 2: Config - for selecting the transcript language and mode.
    if (
      draft !== undefined &&
      (
        draft.languageCode === undefined ||
        draft.content === undefined
      )
    ) {
      return this.renderStepConfig()
    }

    // Step 3: Editor - display editor of draft transcript.
    if (draft !== undefined) {
      return this.renderStepEditor()
    }

    // Step 4: Viewer - display existing (on backend) transcript.
    if (
      singleProcessingStore.getTranscript() !== undefined &&
      draft === undefined
    ) {
      return this.renderStepViewer()
    }

    // Should not happen, but we need to return something.
    return null
  }
}
