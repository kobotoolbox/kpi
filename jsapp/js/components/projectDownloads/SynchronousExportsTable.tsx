import { Anchor, Flex, Text, Tooltip } from '@mantine/core'
import { IconInfoCircle } from '@tabler/icons-react'
import moment from 'moment'
import React from 'react'
import CopyToClipboard from 'react-copy-to-clipboard'
import type { AssetsExportSettingsListQueryResult, useAssetsExportSettingsList } from '#/api/react-query/survey-data'
import bem from '#/bem'
import ActionIcon from '#/components/common/ActionIcon'
import Menu from '#/components/common/Menu'
import SimpleTable from '#/components/common/SimpleTable'
import Button from '#/components/common/button'
import { EXPORT_TYPES, type ExportTypeName } from '#/components/projectDownloads/exportsConstants'
import { notify } from '#/utils'

interface SynchronousExportsTableProps {
  exportSettingsQuery: ReturnType<typeof useAssetsExportSettingsList<AssetsExportSettingsListQueryResult>>
}

export default function SynchronousExportsTable(props: SynchronousExportsTableProps) {
  const query = props.exportSettingsQuery

  if (query.isLoading) {
    return null
  }

  if (query.isError || query.data?.status !== 200) {
    return (
      <bem.FormView__cell>
        <bem.ProjectDownloads__title>{t('Synchronous exports')}</bem.ProjectDownloads__title>
        <p>{t('Failed to load synchronous exports.')}</p>
      </bem.FormView__cell>
    )
  }

  const savedSettings = query.data.data.results.filter((setting) => setting.name.trim().length > 0)

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
    <bem.FormView__cell>
      <Flex justify='space-between' align='center' mb='sm'>
        <Flex gap='xs' align='center'>
          <bem.ProjectDownloads__title>{t('Synchronous exports')}</bem.ProjectDownloads__title>
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
        </Flex>
        <Anchor href='https://support.kobotoolbox.org/pulling_data_into_powerbi.html' target='_blank' rel='noreferrer'>
          {t('Learn more about synchronous export links')} ↗
        </Anchor>
      </Flex>
      {savedSettings.length === 0 ? (
        <p>{t('Save export settings to generate a synchronous export.')}</p>
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
            moment(setting.date_modified).format('MMMM DD, YYYY'),
            <Text key='include-groups' ta='center'>
              {setting.export_settings.hierarchy_in_labels ? '✓' : '–'}
            </Text>,
            <Text key='multiple-versions' ta='center'>
              {setting.export_settings.fields_from_all_versions ? '✓' : '–'}
            </Text>,
            <Menu key={setting.uid} withinPortal={false} closeOnItemClick position='bottom-end'>
              <Menu.Target>
                <Button type='secondary' size='m' label='🔗 ▾' />
              </Menu.Target>
              <Menu.Dropdown>
                {getCopyAction(setting.data_url_csv, 'CSV')}
                {getCopyAction(setting.data_url_xlsx, 'XLSX')}
              </Menu.Dropdown>
            </Menu>,
          ])}
          minWidth={600}
        />
      )}
    </bem.FormView__cell>
  )
}
