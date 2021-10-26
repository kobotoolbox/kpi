transcriptTab:
- step begin (no transcript)
  - action: open configuration
- step configuration (choose language, choose manual or automatic)
  - action: set language
  - action: 
- step mode selector
- step pending automation
- step edit/create transcription (cancel editing/creating or save)
- step view transcription (edit or delete)
- step automatic (TBD)

transcriptTab step identification:
- begin:
  - transcript: undefined
- configure:
  - transcript.language: undefined
  - transcript.content: undefined
- mode selector:
  - transcript.language: string
  - transcript.content: undefined
- view:
  - transcript.language: string
  - transcript.content: string
- edit:
  - transcript.language: string
  - transcript.content: string

store
- transcript: undefined | object
  - transcript.language: undefined | string
  - transcript.content: undefined | string
  - transcript is loaded from endpoint on init
  - transcript is being overwritten (or has local "working" version?)
  - you can change working version or save it?
- translations: []
  - translation.language
  - translation.content
- a working version of translation

translateTab:
- step begin (no translations)
- step configuration (language selector)
- step mode selector
- step pending automation
- step editor
- step view

- step begin with list of all translations?

- left side can display a transcript or translation