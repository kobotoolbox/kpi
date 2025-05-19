import type { Meta, StoryObj } from '@storybook/react-webpack5'
import UniversalTable, { type UniversalTableColumn } from './universalTable.component'
import { type MockDataItem, getMockDataColumns, mockData } from './universalTable.mocks'

interface CustomArgs {
  hasColumnsPinnedLeft: 'none' | 'one' | 'multiple'
  hasColumnsPinnedRight: 'none' | 'one' | 'multiple'
  howManyColumns: 'few' | 'lots'
}
type UniversalTablePropsAndCustomArgs = React.ComponentProps<typeof UniversalTable> & CustomArgs

const PAGE_SIZES = [10, 30, 50, 100]

const meta: Meta<UniversalTablePropsAndCustomArgs> = {
  title: 'Components/UniversalTable',
  component: UniversalTable,
  argTypes: {
    hasColumnsPinnedLeft: {
      options: ['none', 'one', 'multiple'],
      control: { type: 'radio' },
      description:
        '_CUSTOM STORY CONTROL_\n\nPins some of the columns to the left. \n\n Note that column pinning happens at the level of column definition, and we use conditionally predefined mock columns in this story.',
    },
    hasColumnsPinnedRight: {
      options: ['none', 'one', 'multiple'],
      control: { type: 'radio' },
      description: '_CUSTOM STORY CONTROL_\n\nPins some of the columns to the right.',
    },
    howManyColumns: {
      options: ['few', 'lots'],
      control: { type: 'radio' },
      description:
        '_CUSTOM STORY CONTROL_\n\nControls how many columns the table has. Useful for conditionally testing horizontal scroll.',
    },
    pageSize: {
      options: PAGE_SIZES,
      control: 'radio',
    },
  },
  args: {
    hasColumnsPinnedLeft: 'none',
    hasColumnsPinnedRight: 'none',
    howManyColumns: 'lots',
  },
  render: ({ hasColumnsPinnedLeft, hasColumnsPinnedRight, howManyColumns, ...args }) => {
    const columns: Array<UniversalTableColumn<MockDataItem>> = getMockDataColumns(
      hasColumnsPinnedLeft,
      hasColumnsPinnedRight,
      howManyColumns === 'lots'
    )
    const dataLimited = mockData.slice(0, args.pageSize)
    return <UniversalTable {...args} columns={columns} data={dataLimited} />
  },
}

export default meta

type Story = StoryObj<typeof UniversalTable>

export const Primary: Story = {
  args: {
    isSpinnerVisible: false,
    pageIndex: 3,
    pageCount: 11,
    pageSize: PAGE_SIZES[0],
    pageSizeOptions: PAGE_SIZES,
    onRequestPaginationChange: (newPageInfo, oldPageInfo) => {
      alert(`
        Pagination change requested:\n
        new info: ${JSON.stringify(newPageInfo)}\n
        old info: ${JSON.stringify(oldPageInfo)}`)
    },
  },
}
