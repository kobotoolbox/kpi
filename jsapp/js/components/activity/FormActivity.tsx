import '../../../scss/components/_kobo.form-view.scss'

import { useState } from 'react'

import { keepPreviousData, useQuery } from '@tanstack/react-query'
import cx from 'classnames'
import { useParams } from 'react-router-dom'
import UniversalTable, { DEFAULT_PAGE_SIZE, type UniversalTableColumn } from '#/UniversalTable'
import { QueryKeys } from '#/query/queryKeys'
import { formatTime } from '#/utils'
import type { KoboSelectOption } from '../common/koboSelect'
import KoboSelect from '../common/koboSelect'
import ExportToEmailButton from '../exportToEmailButton/exportToEmailButton.component'
import KoboModal from '../modals/koboModal'
import KoboModalHeader from '../modals/koboModalHeader'
import styles from './FormActivity.module.scss'
import type { ActivityLogsItem } from './activity.constants'
import { getActivityLogs, useActivityLogsFilterOptionsQuery, useExportActivityLogs } from './activityLogs.query'
import { ActivityMessage } from './activityMessage.component'

/**
 * A component used at Project > Settings > Activity route. Displays a table
 * of actions that users did on the project.
 */
export default function FormActivity() {
  const [selectedFilterOption, setSelectedFilterOption] = useState<KoboSelectOption | null>(null)

  const exportData = useExportActivityLogs()

  // You can't get to this route without having a project uid in the URL.
  const { uid } = useParams()
  const assetUid = uid as string

  const { data: filterOptions } = useActivityLogsFilterOptionsQuery(assetUid)

  const handleFilterChange = (value: string | null) => {
    setSelectedFilterOption(filterOptions?.find((option) => option.value === value) || null)
  }

  // Modal is being displayed when data for it is set. To close modal, simply
  // set data to `null`.
  const [detailsModalData, setDetailsModalData] = useState<ActivityLogsItem | null>(null)

  const [pagination, setPagination] = useState({
    limit: DEFAULT_PAGE_SIZE,
    start: 0,
  })
  const queryResult = useQuery({
    queryKey: [QueryKeys.activityLogs, assetUid, selectedFilterOption?.value || '', pagination],
    queryFn: () =>
      getActivityLogs({
        assetUid: assetUid,
        actionFilter: selectedFilterOption?.value || '',
        limit: pagination.limit,
        start: pagination.start,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: (query) => {
      // Poll only when there are ongoing bulk processing items
      const data = query.state.data?.status === 200 ? query.state.data.data : null
      if (!data?.results) {
        return false
      }

      // Check if there are any ongoing bulk processing activities
      const hasOngoingBulkProcessing = data.results.some((item) => {
        if (item.action !== 'bulk-processing') {
          return false
        }
        const bulkAction = item.metadata.bulk_action
        return bulkAction?.status === 'in_progress' || bulkAction?.status === 'pending'
      })

      // If no ongoing items, stop polling
      if (!hasOngoingBulkProcessing) {
        return false
      }

      // Poll every 10 seconds when there are ongoing items
      // This is a reasonable interval that balances responsiveness with server load
      return 10000
    },
    // Only poll while the tab is foregrounded
    refetchIntervalInBackground: false,
  })

  const columns: Array<UniversalTableColumn<ActivityLogsItem>> = [
    {
      key: 'description',
      label: t('Event description'),
      cellFormatter: (data: ActivityLogsItem) => (
        <ActivityMessage data={data} assetUid={assetUid} onShowDetails={() => setDetailsModalData(data)} />
      ),
    },
    {
      key: 'date',
      label: t('Date'),
      size: 100,
      cellFormatter: (data: ActivityLogsItem) => formatTime(data.date_created),
    },
  ]

  return (
    <div className={cx('form-view', styles.mainContainer)}>
      <div className={styles.header}>
        <h1>{t('Recent project activity')}</h1>
        <div className={styles.headerActions}>
          <KoboSelect
            isClearable
            className={styles.filterSelect}
            selectedOption={selectedFilterOption?.value || ''}
            onChange={handleFilterChange}
            type='outline'
            name='filter'
            size='m'
            placeholder={t('Filter by')}
            options={filterOptions || []}
          />

          <ExportToEmailButton label={t('Export all data')} exportFunction={() => exportData(assetUid)} />
        </div>
      </div>
      <div className={styles.tableContainer}>
        {detailsModalData && (
          <KoboModal isOpen size='medium' onRequestClose={() => setDetailsModalData(null)}>
            <KoboModalHeader onRequestCloseByX={() => setDetailsModalData(null)}>
              <ActivityMessage data={detailsModalData} assetUid={assetUid} />
            </KoboModalHeader>

            <section className={styles.detailsModalContent}>
              <pre>{JSON.stringify(detailsModalData, null, '  ')}</pre>
            </section>
          </KoboModal>
        )}

        <UniversalTable<ActivityLogsItem>
          pagination={pagination}
          setPagination={setPagination}
          columns={columns}
          queryResult={queryResult}
        />
      </div>
    </div>
  )
}
