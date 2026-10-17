import { Box, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import CopyToClipboard from 'react-copy-to-clipboard'
import AnonymousSubmission from '#/components/anonymousSubmission.component'
import ButtonNew from '#/components/common/ButtonNew'
import { COLLECTION_METHODS, CollectionMethodName } from '#/constants'
import type { AssetResponse } from '#/dataInterface'
import envStore from '#/envStore'
import CollectMethodSelector from '#/project/collectMethodSelector.component'
import { notify } from '#/utils'

interface FormLandingCollectDataProps {
  asset: AssetResponse
  anonymousSubmissionsEnabled: boolean
  canEdit: boolean
  onAnonymousSubmissionsChange: () => void
}

function getCollectMethodLink(asset: AssetResponse, method: CollectionMethodName): string | null {
  if (method === CollectionMethodName.android) {
    return null
  }
  return asset.deployment__links[method] || null
}

export default function FormLandingCollectData({
  asset,
  anonymousSubmissionsEnabled,
  canEdit,
  onAnonymousSubmissionsChange,
}: FormLandingCollectDataProps) {
  const [selectedMethod, setSelectedMethod] = useState(CollectionMethodName.offline_url)
  const selectedMethodLink = getCollectMethodLink(asset, selectedMethod)

  // KoboCollect wants just the origin, and `open_rosa_server` is a full URL - let the DOM parse it out for us.
  const openRosaServerAnchor = document.createElement('a')
  openRosaServerAnchor.href = envStore.data.open_rosa_server
  const kobocollectUrl = openRosaServerAnchor.origin

  const copiedToClipboard = () => notify(t('Copied to clipboard'))

  const renderCollectLink = () => {
    if (selectedMethod === CollectionMethodName.android) {
      return (
        <ButtonNew variant='light' size='md' onClick={() => window.open(COLLECTION_METHODS.android.url, '_blank')}>
          {t('Download KoboCollect')}
        </ButtonNew>
      )
    }

    if (selectedMethodLink === null) {
      return (
        <Text
          component='span'
          className='collect-link-missing right-tooltip'
          data-tip={t("Try reloading the page, if problem doesn't go away, contact support.")}
        >
          <i className='k-icon k-icon-alert' />
          {t('Link missing')}
        </Text>
      )
    }

    if (selectedMethod === CollectionMethodName.iframe_url) {
      return (
        <CopyToClipboard
          text={`<iframe src=${selectedMethodLink} width="800" height="600"></iframe>`}
          onCopy={copiedToClipboard}
          options={{ format: 'text/plain' }}
        >
          <ButtonNew variant='light' size='md'>
            {t('Copy')}
          </ButtonNew>
        </CopyToClipboard>
      )
    }

    return (
      <>
        <CopyToClipboard text={selectedMethodLink} onCopy={copiedToClipboard} options={{ format: 'text/plain' }}>
          <ButtonNew variant='light' size='md'>
            {t('Copy')}
          </ButtonNew>
        </CopyToClipboard>
        <ButtonNew variant='light' size='md' onClick={() => window.open(selectedMethodLink, '_blank')}>
          {t('Open')}
        </ButtonNew>
      </>
    )
  }

  return (
    <Box className='form-view__row'>
      <Box className='form-view__cell form-view__cell--label form-view__cell--first'>{t('Collect data')}</Box>
      <Box className='form-view__cell form-view__cell--box'>
        <Box className='form-view__cell form-view__cell--columns form-view__cell--padding form-view__cell--collect-header'>
          <Box className='form-view__cell'>
            <CollectMethodSelector onChange={setSelectedMethod} selectedMethod={selectedMethod} />
          </Box>
          <Box className='form-view__cell collect-header-actions'>{renderCollectLink()}</Box>
        </Box>

        <Stack pb='lg' pl='lg' pr='lg' className='collect-meta-description'>
          {selectedMethod !== CollectionMethodName.android && COLLECTION_METHODS[selectedMethod].desc}

          {selectedMethod === CollectionMethodName.iframe_url && (
            <pre>{`<iframe src="${selectedMethodLink}" width="800" height="600"></iframe>`}</pre>
          )}

          {selectedMethod === CollectionMethodName.android && (
            <ol>
              <li>
                {t('Install')}
                &nbsp;
                <a href='https://play.google.com/store/apps/details?id=org.koboc.collect.android&hl=en' target='_blank'>
                  KoboCollect
                </a>
                &nbsp;
                {t('on your Android device.')}
              </li>
              <li>{t('Select the option "Manually enter project details"')}</li>
              <li>
                {t('Enter the server URL')}&nbsp;
                <code>{kobocollectUrl}</code>&nbsp;
                {t('and your username and password')}
              </li>
              <li>{t('Select "Download form" and select this project')}</li>
              <li>{t('Select "Start New Form"')}</li>
              <li>{t('Select this project from the list of downloaded projects')}</li>
            </ol>
          )}
        </Stack>

        {canEdit && (
          <Box className='form-view__cell form-view__cell--padding form-view__cell--anonymous-submissions form-view__cell--bordertop'>
            <AnonymousSubmission
              checked={anonymousSubmissionsEnabled}
              disabled={false}
              onChange={onAnonymousSubmissionsChange}
            />
          </Box>
        )}
      </Box>
    </Box>
  )
}
