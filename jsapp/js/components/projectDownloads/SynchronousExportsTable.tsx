import { Anchor, Box, Flex, Group, Text, UnstyledButton } from '@mantine/core'
import { IconArrowUpRight, IconCheck, IconChevronDown, IconInfoCircle, IconLink } from '@tabler/icons-react'
import { useInfiniteQuery } from '@tanstack/react-query'
import React from 'react'
import CopyToClipboard from 'react-copy-to-clipboard'
import { INFINITE_QUERY_KEY_MARKER } from '#/api/mutation-defaults/common'
import { assetsExportSettingsList, getAssetsExportSettingsListQueryKey } from '#/api/react-query/survey-data'
import ActionIcon from '#/components/common/ActionIcon'
import InfiniteScrollTrigger from '#/components/common/InfiniteScrollTrigger'
import KoboIcon from '#/components/common/KoboIcon'
import Menu from '#/components/common/Menu'
import SimpleTable from '#/components/common/SimpleTable'
import { EXPORT_FORMATS, EXPORT_TYPES, type ExportTypeName } from '#/components/projectDownloads/exportsConstants'
import envStore from '#/envStore'
import { formatDate, getLangAsObject, notify } from '#/utils'

const SYNCHRONOUS_EXPORT_SUPPORT_URL = 'pulling_data_into_powerbi.html'
const SETTINGS_PER_PAGE = 100

interface SynchronousExportsTableProps {
  assetUid: string
}

export default function SynchronousExportsTable(props: SynchronousExportsTableProps) {
  const query = useInfiniteQuery({
    queryKey: [...getAssetsExportSettingsListQueryKey(props.assetUid), INFINITE_QUERY_KEY_MARKER],
    queryFn: ({ pageParam, signal }) =>
      assetsExportSettingsList(props.assetUid, { limit: SETTINGS_PER_PAGE, start: pageParam }, { signal }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.status === 200 && lastPage.data.next) {
        return allPages.length * SETTINGS_PER_PAGE
      }
      return undefined
    },
  })

  const savedSettings =
    query.data?.pages.flatMap((page) =>
      page.status === 200 ? page.data.results.filter((setting) => setting.name.trim().length > 0) : [],
    ) || []

  function renderCopyAction(url: string, fileType: 'CSV' | 'XLSX') {
    const copyLabel = fileType === 'CSV' ? t('Copy CSV sync link') : t('Copy XLSX sync link')

    return (
      <CopyToClipboard
        text={url}
        onCopy={(_text, isCopied) => {
          if (isCopied) {
            notify(
              fileType === 'CSV' ? t('CSV sync link copied to clipboard') : t('XLSX sync link copied to clipboard'),
            )
          } else {
            notify(t('Failed to copy sync link to clipboard'), 'error')
          }
        }}
      >
        <Menu.Item>{copyLabel}</Menu.Item>
      </CopyToClipboard>
    )
  }

  function renderLanguage(language: string) {
    const formatName = language as keyof typeof EXPORT_FORMATS
    if (EXPORT_FORMATS[formatName]) {
      return EXPORT_FORMATS[formatName].label
    }

    const languageObject = getLangAsObject(language)
    if (languageObject) {
      return `${languageObject.name} (${languageObject.code.toLowerCase()})`
    }

    return language
  }

  return (
    <Box mt={30} mb={15}>
      <Flex justify='space-between' align='center' mb={15}>
        <Group gap='xs' align='center'>
          <Text fz={18} fw={500}>
            {t('Synchronous exports')}
          </Text>
          <ActionIcon
            icon={IconInfoCircle}
            size='sm'
            variant='transparent'
            tooltip={t(
              'Synchronous exports provide a link to current project data as a CSV or XLSX file that updates as new data is submitted. To generate a synchronous export, save export settings in Advanced options.',
            )}
            aria-label={t('About synchronous exports')}
          />
        </Group>
        {envStore.isReady && envStore.data.support_url && (
          <Anchor
            href={envStore.data.support_url + SYNCHRONOUS_EXPORT_SUPPORT_URL}
            target='_blank'
            rel='noreferrer'
            underline='hover'
          >
            <Group component='span' gap={4}>
              {t('Learn more about synchronous export links')}
              <KoboIcon icon={IconArrowUpRight} size='xs' aria-hidden />
            </Group>
          </Anchor>
        )}
      </Flex>
      {query.isLoading ? null : (query.isError && !query.data) || query.data?.pages[0]?.status !== 200 ? (
        <Text>{t('Failed to load synchronous exports.')}</Text>
      ) : savedSettings.length === 0 ? (
        <Text>{t('Save export settings to generate a synchronous export.')}</Text>
      ) : (
        <SimpleTable
          minWidth={700}
          head={[
            t('Type'),
            t('Export name'),
            t('Date modified'),
            t('Language'),
            <Text key='include-groups' ta='center'>
              {t('Include Groups')}
            </Text>,
            <Text key='multiple-versions' ta='center'>
              {t('Multiple Versions')}
            </Text>,
            '',
          ]}
          body={savedSettings.map((setting) => [
            EXPORT_TYPES[setting.export_settings.type as ExportTypeName]?.label || t('Unknown format'),
            setting.name,
            formatDate(setting.date_modified, true, 'LL'),
            renderLanguage(setting.export_settings.lang || ''),
            <Text key='include-groups' ta='center'>
              {setting.export_settings.hierarchy_in_labels ? (
                <KoboIcon icon={IconCheck} color='teal' size='sm' aria-label={t('Yes')} />
              ) : (
                '–'
              )}
            </Text>,
            <Text key='multiple-versions' ta='center'>
              {setting.export_settings.fields_from_all_versions ? (
                <KoboIcon icon={IconCheck} color='teal' size='sm' aria-label={t('Yes')} />
              ) : (
                '–'
              )}
            </Text>,
            <Menu key={setting.uid} withinPortal={false} closeOnItemClick position='bottom-end' offset={2}>
              <Menu.Target>
                <UnstyledButton aria-label={t('Copy synchronous export link')}>
                  <Group gap={4} align='center'>
                    <ActionIcon
                      component='span'
                      icon={IconLink}
                      size='md'
                      variant='light'
                      color='blue.4'
                      aria-hidden
                      tabIndex={-1}
                    />
                    <KoboIcon icon={IconChevronDown} size='xs' color='var(--mantine-color-blue-4)' aria-hidden />
                  </Group>
                </UnstyledButton>
              </Menu.Target>
              <Menu.Dropdown>
                {renderCopyAction(setting.data_url_csv, 'CSV')}
                {renderCopyAction(setting.data_url_xlsx, 'XLSX')}
              </Menu.Dropdown>
            </Menu>,
          ])}
        />
      )}
      <InfiniteScrollTrigger
        hasNextPage={query.hasNextPage}
        isFetchingNextPage={query.isFetchingNextPage}
        isError={query.isFetchNextPageError}
        onRetry={query.fetchNextPage}
        onRequestFetchNextPage={query.fetchNextPage}
        showEndMessage={false}
      />
    </Box>
  )
}
