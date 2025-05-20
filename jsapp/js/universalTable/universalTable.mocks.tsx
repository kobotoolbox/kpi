import { faker } from '@faker-js/faker'
import type { ColumnPinningPosition } from '@tanstack/react-table'
import Avatar from '#/components/common/avatar'
import { formatDate } from '#/utils'
import type { UniversalTableColumn } from './universalTable.component'

/**
 * This function is useful to generate a (big) test data for the table.
 *
 * Given the fact that we need reproducible mock data for visual testing. We use `index` to get consistent (but varied)
 * rows of data between runs.
 *
 * Note: if we install newer version of the package, there is a chance that given seeds would produce different results
 * than now.
 */
function createUniversalTableExampleData(index: number): UniversalTableExampleDataItem {
  const activities = ['created', 'updated', 'deleted', 'added', 'removed', 'reversed', 'rotated']
  const sources = ['MacOS', 'iOS', 'Windows 98', 'CrunchBang Linux', 'Firefox', 'Safari', 'Gossip']

  faker.seed(index)

  return {
    date_created: formatDate(faker.date.recent().toString()),
    ip: faker.internet.ipv4(),
    age: faker.number.int(100),
    your_name: faker.person.firstName(),
    pet: faker.animal.type(),
    source: sources[faker.number.int(sources.length - 1)],
    activity: activities[faker.number.int(activities.length - 1)],
    a: String(faker.number.int(100) - 100),
    b: 'Kobo'.repeat(faker.number.int(5)),
    c: String(faker.number.int() / 100000),
    d: '@'.repeat(faker.number.int(10)),
    e: String(faker.number.int()),
    f: 'uid_' + Math.floor(faker.number.int(100) * 9999999999999),
    g: String(faker.number.int(2)),
  }
}

export function createUniversalTableExampleDataColumns(
  hasColumnsPinnedLeft: 'none' | 'one' | 'multiple',
  hasColumnsPinnedRight: 'none' | 'one' | 'multiple',
  hasManyColumns: boolean,
) {
  const columns: Array<UniversalTableColumn<UniversalTableExampleDataItem>> = [
    {
      key: 'date_created',
      label: 'Date created',
      // is pinned when "one" or "multiple" selected
      isPinned: hasColumnsPinnedLeft !== 'none' ? ('left' as ColumnPinningPosition) : false,
    },
    {
      key: 'ip',
      label: 'IP Address',
      // is pinned when "multiple" selected
      isPinned: hasColumnsPinnedLeft === 'multiple' ? ('left' as ColumnPinningPosition) : false,
    },
    {
      key: 'age',
      label: 'Age',
      // is pinned when "one" or "multiple" selected
      isPinned: hasColumnsPinnedRight !== 'none' ? ('right' as ColumnPinningPosition) : false,
      size: 60,
    },
    {
      key: 'your_name',
      label: 'Your name',
      // is pinned when "multiple" selected
      isPinned: hasColumnsPinnedRight === 'multiple' ? ('right' as ColumnPinningPosition) : false,
      cellFormatter: (dataItem: UniversalTableExampleDataItem) => (
        <Avatar size='s' username={dataItem.your_name} isUsernameVisible />
      ),
    },
  ]

  if (hasManyColumns) {
    columns.push(
      { key: 'pet', label: 'Pet' },
      { key: 'source', label: 'Source' },
      { key: 'activity', label: 'Last activity' },
      { key: 'a', label: 'a' },
      { key: 'b', label: 'b' },
      { key: 'c', label: 'c', size: 400 },
      { key: 'd', label: 'd' },
      { key: 'e', label: 'e' },
      { key: 'f', label: 'f' },
      { key: 'g', label: 'g', size: 50 },
    )
  }

  return columns
}

export interface UniversalTableExampleDataItem {
  date_created: string
  ip: string
  age: number
  your_name: string
  pet: string
  source: string
  activity: string
  a: string
  b: string
  c: string
  d: string
  e: string
  f: string
  g: string
}

export const mockData = Array.from({ length: 101 }, (_, index) => createUniversalTableExampleData(index))
