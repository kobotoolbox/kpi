import { Anchor, Box, Flex, Group, Text, Tooltip } from '@mantine/core'
import { IconArrowUpRight, IconCheck, IconChevronDown, IconInfoCircle, IconLink } from '@tabler/icons-react'
import React from 'react'
import CopyToClipboard from 'react-copy-to-clipboard'
import type { AssetsExportSettingsListQueryResult, useAssetsExportSettingsList } from '#/api/react-query/survey-data'
import ActionIcon from '#/components/common/ActionIcon'
import KoboIcon from '#/components/common/KoboIcon'
import Menu from '#/components/common/Menu'
import SimpleTable from '#/components/common/SimpleTable'
import { EXPORT_TYPES, type ExportTypeName } from '#/components/projectDownloads/exportsConstants'
import envStore from '#/envStore'
import { formatDate, notify } from '#/utils'

const SYNCHRONOUS_EXPORT_SUPPORT_URL = 'pulling_data_into_powerbi.html'

interface SynchronousExportsTableProps {
  exportSettingsQuery: ReturnType<typeof useAssetsExportSettingsList<AssetsExportSettingsListQueryResult>>
}

export default function SynchronousExportsTable(props: SynchronousExportsTableProps) {
  const query = props.exportSettingsQuery

  const savedSettings =
    query.data?.status === 200 ? query.data.data.results.filter((setting) => setting.name.trim().length > 0) : []

  function getCopyAction(url: string, fileType: 'CSV' | 'XLSX') {
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

  return (
    <Box mt={30} mb={15}>
      <Flex justify='space-between' align='center' mb={15}>
        <Group gap='xs' align='center'>
          <Text fz={18} fw={500}>
            {t('Synchronous exports')}
          </Text>
          <Tooltip
            label={t(
              'Synchronous exports provide a link to current project data as a CSV or XLSX file that updates as new data is submitted. To generate a synchronous export, save export settings in Advanced options.',
            )}
          >
            <ActionIcon
              icon={IconInfoCircle}
              size='sm'
              variant='transparent'
              aria-label={t('About synchronous exports')}
            />
          </Tooltip>
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
      {query.isLoading ? null : query.isError || query.data?.status !== 200 ? (
        <Text>{t('Failed to load synchronous exports.')}</Text>
      ) : savedSettings.length === 0 ? (
        <Text>{t('Save export settings to generate a synchronous export.')}</Text>
      ) : (
        <SimpleTable
          head={[
            t('Type'),
            t('Export name'),
            t('Date modified'),
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
                <Group
                  component='button'
                  gap={4}
                  p={0}
                  bg='transparent'
                  bd={0}
                  style={{ cursor: 'pointer' }}
                  aria-label={t('Copy synchronous export link')}
                >
                  <ActionIcon
                    component='span'
                    icon={IconLink}
                    size='md'
                    variant='light'
                    color='blue.4'
                    aria-hidden
                    tabIndex={-1}
                  />
                  <IconChevronDown size={14} color='var(--mantine-color-blue-4)' aria-hidden />
                </Group>
              </Menu.Target>
              <Menu.Dropdown>
                {getCopyAction(setting.data_url_csv, 'CSV')}
                {getCopyAction(setting.data_url_xlsx, 'XLSX')}
              </Menu.Dropdown>
            </Menu>,
          ])}
        />
      )}
    </Box>
  )
}
