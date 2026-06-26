import type { Meta, StoryObj } from '@storybook/react-webpack5'
import { useEffect } from 'react'
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom'
import { fn } from 'storybook/test'
import { PROJECT_SETTINGS_CONTEXTS } from '#/constants'
import assetsMock from '#/endpoints/assets.mocks'
import environmentMock from '#/endpoints/environment.mocks'
import * as legacyRouter from '#/router/legacy'
import { withMinHeightWrapper } from '#/storybookUtils'
import { STEPS } from './constants'
import { ProjectSettings } from './index'
import StepChooseTemplate from './steps/StepChooseTemplate'
import StepImportUrl from './steps/StepImportUrl'
import StepProjectDetails from './steps/StepProjectDetails'
import StepUploadFile from './steps/StepUploadFile'
import type { ProjectSettingsFields, ProjectSettingsProps } from './types'

// Mock callbacks
const onProjectDetailsChange = fn()
const onSetModalTitle = fn()

/**
 * Inner component that injects a mock router singleton for the legacy router.
 * Must be inside MemoryRouter so hooks work.
 */
function LegacyRouterInjector({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()

  // Inject router immediately during render (before children mount)
  // This prevents the "router is null" error when child components mount
  const mockRouter: any = {
    subscribe: () => () => {}, // Returns unsubscribe function
    state: {
      location,
      navigation: { state: 'idle' },
      historyAction: 'POP',
      loaderData: {},
      actionData: null,
      errors: null,
    },
    navigate,
  }

  // Inject before first render
  if (legacyRouter.router === null) {
    legacyRouter.injectRouter(mockRouter)
  }

  useEffect(() => {
    // Ensure it's injected
    legacyRouter.injectRouter(mockRouter)

    return () => {
      // Clean up: reset to null on unmount
      legacyRouter.injectRouter(null as any)
    }
  }, [navigate, location])

  return <>{children}</>
}

/**
 * Wrapper component for ProjectSettings with default props.
 * The wizard flow is interactive - click buttons to navigate between steps.
 * To show details form directly, stories use EXISTING context (component's built-in behavior).
 */
function ProjectSettingsWrapper(props: Partial<ProjectSettingsProps>) {
  return (
    <ProjectSettings
      context={PROJECT_SETTINGS_CONTEXTS.NEW}
      onProjectDetailsChange={onProjectDetailsChange}
      onSetModalTitle={onSetModalTitle}
      {...(props as any)}
    />
  )
}

const meta: Meta<typeof ProjectSettingsWrapper> = {
  title: 'Features/ProjectSettings',
  component: ProjectSettingsWrapper,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <LegacyRouterInjector>
          <Story />
        </LegacyRouterInjector>
      </MemoryRouter>
    ),
    withMinHeightWrapper(600),
  ],
  argTypes: {
    context: {
      description: 'The context determines which mode the component is in (NEW/REPLACE/EXISTING)',
      control: 'radio',
      options: Object.values(PROJECT_SETTINGS_CONTEXTS),
    },
    formAsset: {
      description: 'Mock asset data - use EXISTING context to show details form directly',
      control: 'object',
    },
  },
  args: {
    context: PROJECT_SETTINGS_CONTEXTS.NEW,
    onProjectDetailsChange,
    onSetModalTitle,
  },
  parameters: {
    layout: 'padded',
    a11y: { test: 'todo' },
    msw: {
      handlers: [environmentMock, assetsMock()],
    },
  },
}

export default meta
type Story = StoryObj<typeof ProjectSettingsWrapper>

/**
 * Step 1: Choose Form Source
 * Main screen with four big buttons to select how to create the project.
 */
export const ModalStep_ChooseSource: Story = {
  args: {
    context: PROJECT_SETTINGS_CONTEXTS.NEW,
  },
  parameters: {
    docs: {
      description: {
        story:
          'Initial step showing four options: Build from scratch, Use a template, Upload an XLSForm, Import an XLSForm via URL.',
      },
    },
  },
}

/**
 * Step 2: Build from Scratch - Project Details
 * Shows the project details form after clicking "Build from scratch".
 */
export const ModalStep_BuildFromScratch: StoryObj = {
  render: () => {
    const emptyFields: ProjectSettingsFields = {
      name: '',
      description: '',
      sector: null,
      country: null,
      operational_purpose: null,
      collects_pii: null,
      extra_metadata_fields: {},
    }

    return (
      <StepProjectDetails
        context={PROJECT_SETTINGS_CONTEXTS.NEW}
        fields={emptyFields}
        formAsset={undefined}
        isSubmitPending={false}
        hasFieldError={() => false}
        onNameChange={fn()}
        onDescriptionChange={fn()}
        onAnyFieldChange={fn()}
        onSubmit={fn()}
        onArchiveProject={fn()}
        onUnarchiveProject={fn()}
        onDeleteProject={fn()}
        isArchivable={() => false}
        isArchived={() => false}
        userCanViewDeleteButton={() => false}
        previousStep={STEPS.FORM_SOURCE}
        onBack={fn()}
        modalStyle={null}
      />
    )
  },
  parameters: {
    docs: {
      description: {
        story:
          'Project details form with empty fields. Shows all metadata fields that can be filled: name, description, sector, country, etc.',
      },
    },
  },
}

/**
 * Step 3: Choose Template
 * Shows the template selection interface.
 */
export const ModalStep_ChooseTemplate: StoryObj = {
  render: () => (
    <StepChooseTemplate
      chosenTemplateUid={null}
      onTemplateChange={fn()}
      applyTemplateButton={t('Choose')}
      isApplyTemplatePending={false}
      onApplyTemplate={fn()}
      previousStep={STEPS.FORM_SOURCE}
      onBack={fn()}
      isBackDisabled={false}
      modalStyle={null}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'Template selection screen showing available project templates to clone.',
      },
    },
  },
}

/**
 * Step 4: Upload XLSForm
 * Shows the file upload dropzone interface.
 */
export const ModalStep_UploadFile: StoryObj = {
  render: () => (
    <StepUploadFile
      isUploadFilePending={false}
      onFileDrop={fn()}
      previousStep={STEPS.FORM_SOURCE}
      onBack={fn()}
      modalStyle={null}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'File upload screen with drag-and-drop zone for XLS/XLSX files.',
      },
    },
  },
}

/**
 * Step 5: Import XLSForm via URL
 * Shows the URL import interface.
 */
export const ModalStep_ImportUrl: StoryObj = {
  render: () => (
    <StepImportUrl
      importUrl=''
      onImportUrlChange={fn()}
      importUrlButton={t('Import')}
      importUrlButtonEnabled={false}
      onImportFromURL={fn()}
      previousStep={STEPS.FORM_SOURCE}
      onBack={fn()}
      isBackDisabled={false}
      modalStyle={null}
    />
  ),
  parameters: {
    docs: {
      description: {
        story: 'URL import screen where users can paste a URL pointing to an XLSForm file.',
      },
    },
  },
}

/**
 * EXISTING Context: Edit Project Settings (Non-Modal)
 * Shows the project settings page when accessed via /settings route.
 */
export const SettingsRoute_EditProject: StoryObj = {
  render: () => {
    const projectFields: ProjectSettingsFields = {
      name: 'Community Health Survey',
      description: 'A survey for tracking community health indicators',
      sector: { value: 'Health Services / Public Health', label: 'Health Services / Public Health' },
      country: [
        { value: 'USA', label: 'United States' },
        { value: 'CAN', label: 'Canada' },
      ],
      operational_purpose: null,
      collects_pii: { value: 'yes', label: 'Yes' },
      extra_metadata_fields: {},
    }

    return (
      <StepProjectDetails
        context={PROJECT_SETTINGS_CONTEXTS.EXISTING}
        fields={projectFields}
        formAsset={
          {
            uid: 'existing-project-uid',
            name: 'Community Health Survey',
            deployment_status: 'deployed',
            deployment__submission_count: 42,
            has_deployment: true,
            deployed_version_id: 'v1',
            deployment__active: true,
          } as any
        }
        isSubmitPending={false}
        hasFieldError={() => false}
        onNameChange={fn()}
        onDescriptionChange={fn()}
        onAnyFieldChange={fn()}
        onSubmit={fn()}
        onArchiveProject={fn()}
        onUnarchiveProject={fn()}
        onDeleteProject={fn()}
        isArchivable={() => true}
        isArchived={() => false}
        userCanViewDeleteButton={() => true}
        previousStep={null}
        onBack={fn()}
        modalStyle={null}
      />
    )
  },
  parameters: {
    docs: {
      description: {
        story:
          'EXISTING context - editing settings of a deployed project outside of modal (accessed via /settings route). Shows "Save Changes" button at top, plus Archive/Delete buttons at bottom.',
      },
    },
  },
}

/**
 * REPLACE Context: Choose Source to Replace Form
 * Shows source selection when replacing an existing project form.
 */
export const ModalReplace_ChooseSource: Story = {
  args: {
    context: PROJECT_SETTINGS_CONTEXTS.REPLACE,
    formAsset: {
      uid: 'replace-project-uid',
      name: 'Project to Replace',
      has_deployment: true,
      deployment_status: 'deployed',
      deployment__submission_count: 10,
      // Content is required to avoid loading spinner (component checks if content is defined)
      content: {
        survey: [
          { type: 'text', name: 'question1', label: ['Question 1'] },
          { type: 'text', name: 'question2', label: ['Question 2'] },
        ],
        choices: [],
        settings: {},
      },
      settings: {},
    } as any,
  },
  parameters: {
    docs: {
      description: {
        story:
          'REPLACE context - replacing an existing form. Note: "Build from scratch" option is NOT shown (need form content). Template button appears at the bottom instead of second position.',
      },
    },
  },
}
