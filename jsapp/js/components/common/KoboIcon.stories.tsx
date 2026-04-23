import { Group, Stack, Table, type TableData, Text } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import * as TablerIcons from '@tabler/icons-react'
import type { TablerIcon } from '@tabler/icons-react'
import ActionIcon from '#/components/common/ActionIcon'
import ButtonNew from '#/components/common/ButtonNew'
import IconLegacySupport from './IconLegacySupport'
import { resolveLegacySvgIconByName } from './IconLegacySvgMappings'
import KoboIcon from './KoboIcon'
import type { KoboIconProps } from './KoboIcon'
import { getLegacyIconsCatalog } from './KoboIconMappings'
import Icon from './icon'
import type { IconColor } from './icon'

const iconColors: Array<IconColor | undefined> = [undefined, 'mid-red', 'storm', 'teal', 'amber', 'blue']
const iconSizes = ['xs', 'sm', 'md', 'lg', 'xl'] satisfies Array<Exclude<NonNullable<KoboIconProps['size']>, number>>
const noneControlOption = '(none)'
const iconColorTokens = iconColors.filter((item): item is IconColor => item !== undefined)

const legacyIconsCatalog = getLegacyIconsCatalog()

const tablerIconEntries = Object.entries(TablerIcons).filter(
  (entry): entry is [string, TablerIcon] =>
    entry[0].startsWith('Icon') &&
    (typeof entry[1] === 'function' || (typeof entry[1] === 'object' && entry[1] !== null)),
)
const tablerIconOptions = tablerIconEntries.map(([tablerIconName]) => tablerIconName).sort((a, b) => a.localeCompare(b))
const tablerIconMapping = {
  [noneControlOption]: undefined,
  ...Object.fromEntries(tablerIconEntries),
}

const meta: Meta<typeof KoboIcon> = {
  title: 'Design system/KoboIcon',
  component: KoboIcon,
  argTypes: {
    color: {
      control: { type: 'text' },
      description: `Supports semantic tokens (${iconColorTokens.join(', ')}) and any CSS color string (e.g. #ff6600, rgb(255, 102, 0), var(--mantine-color-blue-5)).`,
    },
    size: {
      options: iconSizes,
      control: { type: 'inline-radio' },
    },
    icon: {
      options: [noneControlOption, ...tablerIconOptions],
      mapping: tablerIconMapping,
      control: { type: 'select' },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          'Kobo icon component for new UI. It renders only explicit SVG icon components. For legacy icon names, use `Icon` and refer to the legacy-to-tabler catalog below during migration.',
      },
    },
    a11y: { test: 'todo' },
  },
}

export default meta

type Story = StoryObj<typeof KoboIcon>

export const Primary: Story = {
  args: {
    icon: TablerIcons.IconSearch,
    size: 'md',
  },
}

export const LegacyMigrationCatalog: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: '10px' }}>
      <div
        key='header'
        style={{
          alignItems: 'center',
          display: 'grid',
          gap: '10px',
          gridTemplateColumns: '25% 40px 40px 25%',
          minHeight: '50px',
          padding: '10px',
        }}
      >
        <strong>old icon</strong>
        <div />
        <div />
        <strong>tabler icon</strong>
      </div>
      {legacyIconsCatalog.map((item) => (
        <div
          key={item.legacyName}
          style={{
            alignItems: 'center',
            border: '1px solid var(--mantine-color-gray-6)',
            borderRadius: '6px',
            display: 'grid',
            gap: '10px',
            gridTemplateColumns: '25% 40px 40px 25%',
            minHeight: '50px',
            padding: '10px',
          }}
        >
          <code>{item.legacyName}</code>
          <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'center' }}>
            <Icon name={item.legacyName} size='m' />
          </div>

          <div style={{ alignItems: 'center', display: 'flex', justifyContent: 'center' }}>
            {item.icon ? <KoboIcon icon={item.icon} size='md' /> : null}
          </div>
          <code style={{ color: item.tablerIconName ? 'inherit' : 'var(--mantine-color-red-6)' }}>
            {item.tablerIconName ?? 'undefined'}
          </code>
        </div>
      ))}
    </div>
  ),
}

export const MantineIntegrationExamples: Story = {
  render: () => {
    const migrationExamplesTableData: TableData = {
      head: ['What?', 'Rendered icon', 'Rendered code'],
      body: [
        ['Legacy component (font icon)', <Icon name='document' />, <code>{"<Icon name='document' />"}</code>],
        [
          'Transitional component with legacy name',
          <IconLegacySupport icon='document' />,
          <code>{"<IconLegacySupport icon='document' />"}</code>,
        ],
        [
          'Transitional component with Tabler icon',
          <IconLegacySupport icon={TablerIcons.IconFileDescriptionFilled} />,
          <code>{'<IconLegacySupport icon={TablerIcons.IconFileDescriptionFilled} />'}</code>,
        ],
        [
          'New component with legacy SVG icon',
          <KoboIcon icon={resolveLegacySvgIconByName('document')} />,
          <code>{"<KoboIcon icon={resolveLegacySvgIconByName('document')} />"}</code>,
        ],
        [
          'New component with Figma exported SVG icon',
          <KoboIcon icon={resolveLegacySvgIconByName('figma-data-sync')} />,
          <code>{"<KoboIcon icon={resolveLegacySvgIconByName('figma-data-sync')} />"}</code>,
        ],
        [
          'New component with Tabler icon',
          <KoboIcon icon={TablerIcons.IconFileDescriptionFilled} />,
          <code>{'<KoboIcon icon={TablerIcons.IconFileDescriptionFilled} />'}</code>,
        ],
      ],
    }
    return (
      <Stack gap='md'>
        <Text size='lg'>Icon component migration examples</Text>
        <Table data={migrationExamplesTableData} />

        <Text size='lg'>
          <code>&lt;ActionIcon&gt;</code> integration examples
        </Text>
        <Group>
          <ActionIcon iconName='document' variant='light' size='lg' tooltip='legacy icon (as icon font)' />
          <ActionIcon
            icon={resolveLegacySvgIconByName('lock-alt')}
            variant='outline'
            size='lg'
            tooltip='legacy icon (as svg)'
          />
          <ActionIcon
            icon={resolveLegacySvgIconByName('figma-unsubscribe')}
            variant='danger'
            size='lg'
            tooltip='svg custom icon (Figma exported)'
          />
          <ActionIcon icon={TablerIcons.IconSearch} variant='danger-secondary' size='lg' tooltip='new tabler icon' />
        </Group>

        <Text size='lg'>
          <code>&lt;ButtonNew&gt;</code> integration examples
        </Text>
        <Group>
          <ButtonNew leftIcon='lock-alt' variant='light'>
            legacy icon (as icon font)
          </ButtonNew>
          <ButtonNew leftIcon={resolveLegacySvgIconByName('lock-alt')} variant='danger'>
            legacy icon (as svg)
          </ButtonNew>
          <ButtonNew leftIcon={TablerIcons.IconLockFilled} variant='outline'>
            new tabler icon
          </ButtonNew>
          <ButtonNew leftIcon={TablerIcons.IconChevronLeftPipe}>new tabler icon</ButtonNew>
        </Group>
      </Stack>
    )
  },
}
