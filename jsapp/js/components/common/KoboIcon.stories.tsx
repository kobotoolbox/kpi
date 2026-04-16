import { Group, Stack, Text, ThemeIcon } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { IconCalendar, IconChevronDown, IconSearch, IconX } from '@tabler/icons-react'
import ActionIcon from '#/components/common/ActionIcon'
import ButtonNew from '#/components/common/ButtonNew'
import KoboIcon from './KoboIcon'
import { getLegacyIconsCatalog } from './KoboIconMappings'
import Icon from './icon'
import type { IconColor, IconSize } from './icon'

const iconColors: Array<IconColor | undefined> = [undefined, 'mid-red', 'storm', 'teal', 'amber', 'blue']
const iconSizes: IconSize[] = ['xxs', 'xs', 's', 'm', 'l', 'xl', 'inherit']

const legacyIconsCatalog = getLegacyIconsCatalog()

const meta: Meta<typeof KoboIcon> = {
  title: 'Design system/KoboIcon',
  component: KoboIcon,
  argTypes: {
    color: {
      options: iconColors,
      control: { type: 'select' },
    },
    size: {
      options: iconSizes,
      control: { type: 'inline-radio' },
    },
    name: {
      options: legacyIconsCatalog.map((item) => item.legacyName),
      control: { type: 'select' },
    },
  },
  parameters: {
    docs: {
      description: {
        component:
          'Kobo icon migration component. It renders SVG icons first and falls back to legacy icon font when a mapping is not available.',
      },
    },
  },
}

export default meta

type Story = StoryObj<typeof KoboIcon>

export const Primary: Story = {
  args: {
    name: 'search',
    size: 'm',
  },
}

export const LegacyCatalog: Story = {
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
            {item.icon ? <KoboIcon icon={item.icon} size='m' /> : null}
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
    return (
      <Stack gap='md'>
        <Text size='sm'>ActionIcon examples</Text>
        <Group>
          <ActionIcon icon={IconSearch} variant='light' size='lg' />
          <ActionIcon icon={IconX} variant='transparent' size='lg' />
          <ThemeIcon variant='light' size='lg'>
            <KoboIcon icon={IconCalendar} size='m' />
          </ThemeIcon>
        </Group>

        <Text size='sm'>Button example</Text>
        <Group>
          <ButtonNew leftIcon={IconSearch}>Search</ButtonNew>
          <ButtonNew rightIcon={IconChevronDown} variant='light'>
            More actions
          </ButtonNew>
        </Group>
      </Stack>
    )
  },
}
