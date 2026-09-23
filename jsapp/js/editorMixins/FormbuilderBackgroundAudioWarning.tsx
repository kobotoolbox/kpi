import { Text } from '@mantine/core'
import Markdown from 'react-markdown'
import Alert from '#/components/common/alert'
import envStore from '#/envStore'

const RECORDING_SUPPORT_URL = 'recording-interviews.html#recording-interviews-with-background-audio-recordings'

interface FormbuilderBackgroundAudioWarningProps {
  onDismiss: () => void
}

export default function FormbuilderBackgroundAudioWarning(props: FormbuilderBackgroundAudioWarningProps) {
  let bannerText = t(
    'This form will automatically [record audio in the background](##SUPPORT_LINK##). Consider adding with a meaningful consent question to inform respondents or data collectors that they will be recorded while completing this survey.',
  )

  if (envStore.isReady && envStore.data.support_url) {
    bannerText = bannerText.replace('##SUPPORT_LINK##', envStore.data.support_url + RECORDING_SUPPORT_URL)
  } else {
    // Replaces the link for the text only if link is not available
    bannerText = bannerText.replace(/\[(.+)]\(##SUPPORT_LINK##\)/, '$1')
  }

  return (
    <Alert
      type='info'
      iconName='information'
      p='sm'
      maw={1024}
      mb='sm'
      m='auto'
      closeButtonLabel={t('Dismiss')}
      onClose={props.onDismiss}
      withCloseButton
    >
      <Markdown
        components={{
          // Custom link component to open link on target _blank
          a: (props) => (
            <a href={props.href} target='_blank'>
              {props.children}
            </a>
          ),
          // Custom paragraph component to use mantine Text instead of <p>
          p: (props) => (
            <Text c='blue.4' mr='lg'>
              {props.children}
            </Text>
          ),
        }}
      >
        {bannerText}
      </Markdown>
    </Alert>
  )
}
