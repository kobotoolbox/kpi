import { Anchor, Box, Flex, Group, Text, UnstyledButton } from '@mantine/core'
import { IconArrowUpRight, IconChevronDown, IconHelpCircleFilled, IconLink } from '@tabler/icons-react'
import { useAssetsExportSettingsList } from '#/api/react-query/survey-data'
import ActionIcon from '#/components/common/ActionIcon'
import KoboIcon from '#/components/common/KoboIcon'
import Menu from '#/components/common/Menu'
import SimpleTable from '#/components/common/SimpleTable'
import BooleanCell from '#/components/projectDownloads/BooleanCell'
import ExportTypeBadge from '#/components/projectDownloads/ExportTypeBadge'
import {
  EXPORTS_TABLE_COLUMN_WEIGHTS,
  EXPORTS_TABLE_MIN_WIDTH,
  EXPORT_FORMATS,
  type ExportTypeName,
} from '#/components/projectDownloads/exportsConstants'
import envStore from '#/envStore'
import { copyToClipboard, formatDate, getLangAsObject, notify } from '#/utils'

const SYNCHRONOUS_EXPORT_SUPPORT_URL = 'pulling_data_into_powerbi.html'

interface SynchronousExportsTableProps {
  assetUid: string
}

export default function SynchronousExportsTable(props: SynchronousExportsTableProps) {
  const query = useAssetsExportSettingsList(props.assetUid)

  const savedSettings =
    query.data?.status === 200 ? query.data.data.results.filter((setting) => setting.name.trim().length > 0) : []

  function renderCopyAction(url: string, fileType: 'CSV' | 'XLSX') {
    const copyLabel = fileType === 'CSV' ? t('Copy CSV sync link') : t('Copy XLSX sync link')

    return (
      <Menu.Item
        onClick={async () => {
          const isCopied = await copyToClipboard(url)
          if (isCopied) {
            notify(
              fileType === 'CSV' ? t('CSV sync link copied to clipboard') : t('XLSX sync link copied to clipboard'),
            )
          } else {
            notify(t('Failed to copy sync link to clipboard'), 'error')
          }
        }}
      >
        {copyLabel}
      </Menu.Item>
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
            size='sm'
            variant='transparent'
            tooltip={t(
              'Synchronous exports provide a link to current project data as a CSV or XLSX file that updates as new data is submitted. To generate a synchronous export, save export settings in Advanced options.',
            )}
            aria-label={t('About synchronous exports')}
          >
            <KoboIcon icon={IconHelpCircleFilled} color='var(--mantine-color-gray-2)' size='sm' />
          </ActionIcon>
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
          minWidth={EXPORTS_TABLE_MIN_WIDTH}
          head={[
            t('Type'),
            t('Export name'),
            t('Date modified'),
            t('Language'),
            <Box key='include-groups' ta='center'>
              {t('Include Groups')}
            </Box>,
            <Box key='multiple-versions' ta='center'>
              {t('Multiple Versions')}
            </Box>,
            '',
          ]}
          body={savedSettings.map((setting) => [
            <ExportTypeBadge exportType={setting.export_settings.type as ExportTypeName} />,
            setting.name,
            formatDate(setting.date_modified, true, 'LL'),
            renderLanguage(setting.export_settings.lang || ''),
            <Box key='include-groups' ta='center'>
              <BooleanCell value={setting.export_settings.hierarchy_in_labels} />
            </Box>,
            <Box key='multiple-versions' ta='center'>
              <BooleanCell value={setting.export_settings.fields_from_all_versions} />
            </Box>,
            <Flex key={setting.uid} justify='flex-end'>
              <Menu closeOnItemClick position='bottom-end' offset={2}>
                <Menu.Target>
                  <UnstyledButton aria-label={t('Copy synchronous export link')}>
                    <Group gap={4} align='center' wrap='nowrap'>
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
              </Menu>
            </Flex>,
          ])}
          columnWeights={EXPORTS_TABLE_COLUMN_WEIGHTS}
        />
      )}
    </Box>
  )
}
