import type { Meta, StoryObj } from '@storybook/react-webpack5'
import React, { useState } from 'react'
import ButtonNew from '../common/ButtonNew'
import BulkProcessingBanner from './BulkProcessingBanner'

function clearBulkBannerDismissalFromSessionStorage(assetUid: string) {
  const keyPrefix = `kpiBulkProcessingBanner-${assetUid}-`

  for (let i = sessionStorage.length - 1; i >= 0; i--) {
    const key = sessionStorage.key(i)
    if (key?.startsWith(keyPrefix)) {
      sessionStorage.removeItem(key)
    }
  }
}

function BannerStoryWithReset(args: React.ComponentProps<typeof BulkProcessingBanner>) {
  const [renderKey, setRenderKey] = useState(0)

  function handleResetDismissal() {
    clearBulkBannerDismissalFromSessionStorage(args.assetUid)
    // Force remount so the component reads the updated sessionStorage value.
    setRenderKey((value) => value + 1)
  }

  return (
    <div>
      <BulkProcessingBanner key={renderKey} {...args} />
      <ButtonNew variant='danger-secondary' size='s' onClick={handleResetDismissal} mt={20}>
        Reset dismissal
      </ButtonNew>
    </div>
  )
}

const meta: Meta<typeof BulkProcessingBanner> = {
  title: 'Components/BulkProcessingBanner',
  component: BulkProcessingBanner,
  render: (args) => <BannerStoryWithReset {...args} />,
  args: {
    assetUid: 'asset-uid-story',
    hasActiveBulkActionsCreatedByAnotherUser: true,
    activeBulkActionsCount: 1,
  },
  parameters: {
    a11y: { test: 'todo' },
  },
}

export default meta

type Story = StoryObj<typeof BulkProcessingBanner>

export const SingleJob: Story = {
  args: {
    hasActiveBulkActionsCreatedByAnotherUser: true,
    activeBulkActionsCount: 1,
  },
}

export const MultipleJobs: Story = {
  args: {
    hasActiveBulkActionsCreatedByAnotherUser: true,
    activeBulkActionsCount: 3,
  },
}

export const Hidden: Story = {
  args: {
    hasActiveBulkActionsCreatedByAnotherUser: false,
    activeBulkActionsCount: 2,
  },
}
