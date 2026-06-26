import chai from 'chai'
import envStore from '#/envStore'
import type { ProjectSettingsFields } from './types'
import { validateProjectFields } from './utils'

// Mock envStore to control metadata field configuration
jest.mock('#/envStore', () => ({
  data: {
    getProjectMetadataField: jest.fn(),
    extra_project_metadata_fields: [],
  },
}))

describe('validateProjectFields', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks()
    envStore.data.extra_project_metadata_fields = []
  })

  const createValidFields = (): ProjectSettingsFields => ({
    name: 'Test Project',
    description: 'Test description',
    sector: { value: 'health', label: 'Health' },
    country: [{ value: 'us', label: 'United States' }],
    operational_purpose: { value: 'research', label: 'Research' },
    collects_pii: { value: 'No', label: 'No' },
    extra_metadata_fields: {},
  })

  describe('name field validation', () => {
    it('should return error for empty name', () => {
      const fields = createValidFields()
      fields.name = ''

      const errors = validateProjectFields(fields)

      chai.expect(errors).to.contain('name')
    })

    it('should return error for whitespace-only name', () => {
      const fields = createValidFields()
      fields.name = '   '

      const errors = validateProjectFields(fields)

      chai.expect(errors).to.contain('name')
    })

    it('should pass for valid name', () => {
      const fields = createValidFields()
      fields.name = 'Valid Project Name'

      const errors = validateProjectFields(fields)

      chai.expect(errors).to.not.contain('name')
    })
  })

  describe('description field validation', () => {
    it('should return error if description is required and empty', () => {
      ;(envStore.data.getProjectMetadataField as jest.Mock).mockReturnValue({
        required: true,
        label: 'Description',
      })

      const fields = createValidFields()
      fields.description = ''

      const errors = validateProjectFields(fields)

      chai.expect(errors).to.contain('description')
    })

    it('should return error if description is required and whitespace-only', () => {
      ;(envStore.data.getProjectMetadataField as jest.Mock).mockReturnValue({
        required: true,
        label: 'Description',
      })

      const fields = createValidFields()
      fields.description = '   '

      const errors = validateProjectFields(fields)

      chai.expect(errors).to.contain('description')
    })

    it('should pass if description is not required and empty', () => {
      ;(envStore.data.getProjectMetadataField as jest.Mock).mockReturnValue({
        required: false,
        label: 'Description',
      })

      const fields = createValidFields()
      fields.description = ''

      const errors = validateProjectFields(fields)

      chai.expect(errors).to.not.contain('description')
    })

    it('should pass if description is required and has content', () => {
      ;(envStore.data.getProjectMetadataField as jest.Mock).mockReturnValue({
        required: true,
        label: 'Description',
      })

      const fields = createValidFields()
      fields.description = 'Valid description'

      const errors = validateProjectFields(fields)

      chai.expect(errors).to.not.contain('description')
    })
  })

  describe('sector field validation', () => {
    it('should return error if sector is required and null', () => {
      ;(envStore.data.getProjectMetadataField as jest.Mock).mockImplementation((fieldName) => {
        if (fieldName === 'sector') {
          return { required: true, label: 'Sector' }
        }
        return false
      })

      const fields = createValidFields()
      fields.sector = null

      const errors = validateProjectFields(fields)

      chai.expect(errors).to.contain('sector')
    })

    it('should pass if sector is not required and null', () => {
      ;(envStore.data.getProjectMetadataField as jest.Mock).mockImplementation((fieldName) => {
        if (fieldName === 'sector') {
          return { required: false, label: 'Sector' }
        }
        return false
      })

      const fields = createValidFields()
      fields.sector = null

      const errors = validateProjectFields(fields)

      chai.expect(errors).to.not.contain('sector')
    })
  })

  describe('country field validation', () => {
    it('should return error if country is required and empty array', () => {
      ;(envStore.data.getProjectMetadataField as jest.Mock).mockImplementation((fieldName) => {
        if (fieldName === 'country') {
          return { required: true, label: 'Country' }
        }
        return false
      })

      const fields = createValidFields()
      fields.country = []

      const errors = validateProjectFields(fields)

      chai.expect(errors).to.contain('country')
    })

    it('should return error if country is required and null', () => {
      ;(envStore.data.getProjectMetadataField as jest.Mock).mockImplementation((fieldName) => {
        if (fieldName === 'country') {
          return { required: true, label: 'Country' }
        }
        return false
      })

      const fields = createValidFields()
      fields.country = null

      const errors = validateProjectFields(fields)

      chai.expect(errors).to.contain('country')
    })

    it('should pass if country is required and has values', () => {
      ;(envStore.data.getProjectMetadataField as jest.Mock).mockImplementation((fieldName) => {
        if (fieldName === 'country') {
          return { required: true, label: 'Country' }
        }
        return false
      })

      const fields = createValidFields()
      fields.country = [{ value: 'us', label: 'United States' }]

      const errors = validateProjectFields(fields)

      chai.expect(errors).to.not.contain('country')
    })
  })

  describe('extra metadata fields validation', () => {
    it('should return error for required text field with empty value', () => {
      ;(envStore.data.getProjectMetadataField as jest.Mock).mockReturnValue(false)
      envStore.data.extra_project_metadata_fields = [
        {
          name: 'custom_field',
          label: { default: 'Custom Field' },
          required: true,
          type: 'text' as const,
        },
      ]

      const fields = createValidFields()
      fields.extra_metadata_fields = { custom_field: '' }

      const errors = validateProjectFields(fields)

      chai.expect(errors).to.contain('custom_field')
    })

    it('should return error for required multi-select field with empty array', () => {
      ;(envStore.data.getProjectMetadataField as jest.Mock).mockReturnValue(false)
      envStore.data.extra_project_metadata_fields = [
        {
          name: 'tags',
          label: { default: 'Tags' },
          required: true,
          type: 'multi_select' as const,
          options: [],
        },
      ]

      const fields = createValidFields()
      fields.extra_metadata_fields = { tags: [] }

      const errors = validateProjectFields(fields)

      chai.expect(errors).to.contain('tags')
    })

    it('should return error for required single-select field with null value', () => {
      ;(envStore.data.getProjectMetadataField as jest.Mock).mockReturnValue(false)
      envStore.data.extra_project_metadata_fields = [
        {
          name: 'status',
          label: { default: 'Status' },
          required: true,
          type: 'single_select' as const,
          options: [],
        },
      ]

      const fields = createValidFields()
      fields.extra_metadata_fields = { status: null }

      const errors = validateProjectFields(fields)

      chai.expect(errors).to.contain('status')
    })

    it('should pass for optional fields with empty values', () => {
      ;(envStore.data.getProjectMetadataField as jest.Mock).mockReturnValue(false)
      envStore.data.extra_project_metadata_fields = [
        {
          name: 'optional_field',
          label: { default: 'Optional' },
          required: false,
          type: 'text' as const,
        },
      ]

      const fields = createValidFields()
      fields.extra_metadata_fields = { optional_field: '' }

      const errors = validateProjectFields(fields)

      chai.expect(errors).to.not.contain('optional_field')
    })

    it('should pass for required fields with valid values', () => {
      ;(envStore.data.getProjectMetadataField as jest.Mock).mockReturnValue(false)
      envStore.data.extra_project_metadata_fields = [
        {
          name: 'text_field',
          label: { default: 'Text' },
          required: true,
          type: 'text' as const,
        },
        {
          name: 'multi_field',
          label: { default: 'Multi' },
          required: true,
          type: 'multi_select' as const,
          options: [],
        },
        {
          name: 'single_field',
          label: { default: 'Single' },
          required: true,
          type: 'single_select' as const,
          options: [],
        },
      ]

      const fields = createValidFields()
      fields.extra_metadata_fields = {
        text_field: 'Some value',
        multi_field: ['option1'],
        single_field: 'option1',
      }

      const errors = validateProjectFields(fields)

      chai.expect(errors).to.not.contain('text_field')
      chai.expect(errors).to.not.contain('multi_field')
      chai.expect(errors).to.not.contain('single_field')
    })
  })

  describe('comprehensive validation', () => {
    it('should return multiple errors when multiple fields are invalid', () => {
      ;(envStore.data.getProjectMetadataField as jest.Mock).mockImplementation((fieldName) => {
        if (fieldName === 'description') {
          return { required: true, label: 'Description' }
        }
        if (fieldName === 'sector') {
          return { required: true, label: 'Sector' }
        }
        return false
      })

      const fields = createValidFields()
      fields.name = ''
      fields.description = ''
      fields.sector = null

      const errors = validateProjectFields(fields)

      chai.expect(errors).to.contain('name')
      chai.expect(errors).to.contain('description')
      chai.expect(errors).to.contain('sector')
      chai.expect(errors.length).equal(3)
    })

    it('should return empty array when all required fields are valid', () => {
      ;(envStore.data.getProjectMetadataField as jest.Mock).mockImplementation((fieldName) => {
        if (fieldName === 'description') {
          return { required: true, label: 'Description' }
        }
        if (fieldName === 'sector') {
          return { required: true, label: 'Sector' }
        }
        if (fieldName === 'country') {
          return { required: true, label: 'Country' }
        }
        return false
      })

      const fields = createValidFields()

      const errors = validateProjectFields(fields)

      chai.expect(errors).deep.equal([])
    })
  })
})
