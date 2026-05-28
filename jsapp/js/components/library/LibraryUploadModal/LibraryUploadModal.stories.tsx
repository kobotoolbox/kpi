import { ModalsProvider } from '@mantine/modals'
import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import ButtonNew from '#/components/common/ButtonNew'
import { MODAL_TYPES } from '#/constants'
import { KOBO_MODAL_SHARED_PROPS } from '#/theme/kobo/Modal'
import { openLibraryUploadModal } from './index'

function StoryTrigger(args: { mode: 'form' | 'uploading' }) {
  return (
    <ButtonNew
      onClick={() => {
        if (args.mode === 'uploading') {
          openLibraryUploadModal({
            type: MODAL_TYPES.UPLOADING_XLS,
            filename: 'example.xlsx',
          })
          return
        }

        openLibraryUploadModal({
          type: MODAL_TYPES.LIBRARY_UPLOAD,
        })
      }}
    >
      Open Library Upload Modal
    </ButtonNew>
  )
}

const meta: Meta<typeof StoryTrigger> = {
  title: 'Features/LibraryUploadModal',
  component: StoryTrigger,
  decorators: [
    (Story) => {
      const queryClient = new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            staleTime: 0,
            refetchOnWindowFocus: false,
          },
        },
      })

      return (
        <QueryClientProvider client={queryClient}>
          <ModalsProvider
            modalProps={{
              ...KOBO_MODAL_SHARED_PROPS,
              withinPortal: false,
              lockScroll: false,
            }}
          >
            <div style={{ minHeight: 480, padding: 24 }}>
              <Story />
            </div>
          </ModalsProvider>
        </QueryClientProvider>
      )
    },
  ],
  args: {
    mode: 'form',
  },
}

export default meta

type Story = StoryObj<typeof StoryTrigger>

export const UploadForm: Story = {
  args: {
    mode: 'form',
  },
}

export const UploadingXls: Story = {
  args: {
    mode: 'uploading',
  },
}
