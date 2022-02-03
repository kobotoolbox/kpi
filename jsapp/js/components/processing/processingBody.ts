import bem, {makeBem} from 'js/bem'
import './processingBody.scss'

// These are styles for all tabs content.
bem.ProcessingBody = makeBem(null, 'processing-body')

// For both transcripts and translations.
bem.ProcessingBody__transxHeader = makeBem(bem.ProcessingBody, 'transx-header', 'header')
bem.ProcessingBody__transxHeaderLanguage = makeBem(bem.ProcessingBody, 'transx-header-language', 'label')
bem.ProcessingBody__transxHeaderLanguageWrapper = makeBem(bem.ProcessingBody, 'transx-header-language-wrapper')
bem.ProcessingBody__transxHeaderDate = makeBem(bem.ProcessingBody, 'transx-header-date', 'time')
bem.ProcessingBody__transxHeaderButtons = makeBem(bem.ProcessingBody, 'transx-header-buttons', 'nav')

bem.ProcessingBody__footer = makeBem(bem.ProcessingBody, 'footer', 'footer')
bem.ProcessingBody__footerRightButtons = makeBem(bem.ProcessingBody, 'footer-right-buttons')

bem.ProcessingBody__text = makeBem(bem.ProcessingBody, 'text', 'article')
bem.ProcessingBody__textarea = makeBem(bem.ProcessingBody, 'textarea', 'textarea')
