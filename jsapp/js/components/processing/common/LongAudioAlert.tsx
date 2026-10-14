import React from 'react'
import Alert from '#/components/common/alert'
import type { AlertProps } from '#/components/common/alert'
import { MAX_AUTOMATIC_TRANSCRIPTION_AUDIO_MINUTES } from './constants'

interface Props extends Omit<AlertProps, 'type' | 'iconName' | 'children'> {}

/** Warning for audio too long to auto-transcribe, where transcribing manually is the way forward. */
export default function LongAudioAlert(props: Props) {
  return (
    <Alert type='warning' iconName='alert' {...props}>
      {t(
        "Audio files over ##number## minutes can't be auto-transcribed at the moment. We are working to fix this " +
          'limitation. In the meantime, you can still transcribe manually.',
      ).replace('##number##', String(MAX_AUTOMATIC_TRANSCRIPTION_AUDIO_MINUTES))}
    </Alert>
  )
}
