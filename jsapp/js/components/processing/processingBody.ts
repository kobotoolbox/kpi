import bem, {makeBem} from 'js/bem'
import './processingBody.scss'

// These are styles for all tabs content.
bem.ProcessingBody = makeBem(null, 'processing-body')

// For both transcripts and translations.
bem.ProcessingBody__transHeader = makeBem(bem.ProcessingBody, 'trans-header', 'header')
bem.ProcessingBody__transHeaderLanguage = makeBem(bem.ProcessingBody, 'trans-header-language', 'label')
bem.ProcessingBody__transHeaderLanguageWrapper = makeBem(bem.ProcessingBody, 'trans-header-language-wrapper')
bem.ProcessingBody__transHeaderDate = makeBem(bem.ProcessingBody, 'trans-header-date', 'time')
bem.ProcessingBody__transHeaderButtons = makeBem(bem.ProcessingBody, 'trans-header-buttons', 'nav')

bem.ProcessingBody__text = makeBem(bem.ProcessingBody, 'text', 'article')
bem.ProcessingBody__textarea = makeBem(bem.ProcessingBody, 'textarea', 'textarea')
