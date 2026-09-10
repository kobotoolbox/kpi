import chai from 'chai'
import envStore from '#/envStore'
import type { ProjectSettingsFields } from './types'
import { getSettingsForEndpoint, validateProjectFields } from './utils'

// Mocked so the tests control both which fields are required and the choices
// that labels get looked up in.
jest.mock('#/envStore', () => ({
  data: {
    getProjectMetadataField: jest.fn(),
    extra_project_metadata_fields: [],
    sector_choices: [
      { value: 'health', label: 'Health' },
      { value: 'education', label: 'Education' },
    ],
    country_choices: [
      { value: 'us', label: 'United States' },
      { value: 'pl', label: 'Poland' },
    ],
    operational_purpose_choices: [{ value: 'research', label: 'Research' }],
  },
}))

const createValidFields = (): ProjectSettingsFields => ({
  name: 'Test Project',
  description: 'Test description',
  sector: 'health',
  country: ['us'],
  operational_purpose: 'research',
  collects_pii: 'No',
  extra_metadata_fields: {},
})

describe('validateProjectFields', () => {
  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks()
    envStore.data.extra_project_metadata_fields = []
  })

  /**
   * Helper to configure a single field's metadata in envStore
   */
  const mockFieldMetadata = (fieldName: string, metadata: { required: boolean; label: string }) => {
    ;(envStore.data.getProjectMetadataField as jest.Mock).mockImplementation((name) => {
      if (name === fieldName) {
        return metadata
      }
      return false
    })
  }

  /**
   * Helper to configure multiple fields' metadata at once
   */
  const mockMultipleFieldMetadata = (configs: Record<string, { required: boolean; label: string }>) => {
    ;(envStore.data.getProjectMetadataField as jest.Mock).mockImplementation((fieldName) => {
      return configs[fieldName] || false
    })
  }

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
      mockFieldMetadata('description', { required: true, label: 'Description' })

      const fields = createValidFields()
      fields.description = ''

      const errors = validateProjectFields(fields)

      chai.expect(errors).to.contain('description')
    })

    it('should return error if description is required and whitespace-only', () => {
      mockFieldMetadata('description', { required: true, label: 'Description' })

      const fields = createValidFields()
      fields.description = '   '

      const errors = validateProjectFields(fields)

      chai.expect(errors).to.contain('description')
    })

    it('should pass if description is not required and empty', () => {
      mockFieldMetadata('description', { required: false, label: 'Description' })

      const fields = createValidFields()
      fields.description = ''

      const errors = validateProjectFields(fields)

      chai.expect(errors).to.not.contain('description')
    })

    it('should pass if description is required and has content', () => {
      mockFieldMetadata('description', { required: true, label: 'Description' })

      const fields = createValidFields()
      fields.description = 'Valid description'

      const errors = validateProjectFields(fields)

      chai.expect(errors).to.not.contain('description')
    })
  })

  describe('sector field validation', () => {
    it('should return error if sector is required and null', () => {
      mockFieldMetadata('sector', { required: true, label: 'Sector' })

      const fields = createValidFields()
      fields.sector = null

      const errors = validateProjectFields(fields)

      chai.expect(errors).to.contain('sector')
    })

    it('should pass if sector is not required and null', () => {
      mockFieldMetadata('sector', { required: false, label: 'Sector' })

      const fields = createValidFields()
      fields.sector = null

      const errors = validateProjectFields(fields)

      chai.expect(errors).to.not.contain('sector')
    })
  })

  describe('country field validation', () => {
    it('should return error if country is required and empty array', () => {
      mockFieldMetadata('country', { required: true, label: 'Country' })

      const fields = createValidFields()
      fields.country = []

      const errors = validateProjectFields(fields)

      chai.expect(errors).to.contain('country')
    })

    it('should return error if country is required and null', () => {
      mockFieldMetadata('country', { required: true, label: 'Country' })

      const fields = createValidFields()
      fields.country = null

      const errors = validateProjectFields(fields)

      chai.expect(errors).to.contain('country')
    })

    it('should pass if country is required and has values', () => {
      mockFieldMetadata('country', { required: true, label: 'Country' })

      const fields = createValidFields()
      fields.country = ['us']

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
      mockMultipleFieldMetadata({
        description: { required: true, label: 'Description' },
        sector: { required: true, label: 'Sector' },
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
      mockMultipleFieldMetadata({
        description: { required: true, label: 'Description' },
        sector: { required: true, label: 'Sector' },
        country: { required: true, label: 'Country' },
      })

      const fields = createValidFields()

      const errors = validateProjectFields(fields)

      chai.expect(errors).deep.equal([])
    })
  })
})

describe('getSettingsForEndpoint', () => {
  it('should pair the choice values up with their labels again', () => {
    const settings = JSON.parse(getSettingsForEndpoint(createValidFields()))

    chai.expect(settings).deep.equal({
      description: 'Test description',
      sector: { value: 'health', label: 'Health' },
      country: [{ value: 'us', label: 'United States' }],
      operational_purpose: { value: 'research', label: 'Research' },
      collects_pii: { value: 'No', label: 'No' },
      extra_metadata: {},
    })
  })

  it('should handle multiple countries', () => {
    const fields = createValidFields()
    fields.country = ['us', 'pl']

    const settings = JSON.parse(getSettingsForEndpoint(fields))

    chai.expect(settings.country).deep.equal([
      { value: 'us', label: 'United States' },
      { value: 'pl', label: 'Poland' },
    ])
  })

  it('should keep the value as label for choices that are no longer offered', () => {
    const fields = createValidFields()
    fields.sector = 'no_longer_a_choice'
    fields.country = ['xx']

    const settings = JSON.parse(getSettingsForEndpoint(fields))

    chai.expect(settings.sector).deep.equal({ value: 'no_longer_a_choice', label: 'no_longer_a_choice' })
    chai.expect(settings.country).deep.equal([{ value: 'xx', label: 'xx' }])
  })

  it('should keep empty choices as null', () => {
    const fields = createValidFields()
    fields.sector = null
    fields.country = null
    fields.operational_purpose = null
    fields.collects_pii = null

    const settings = JSON.parse(getSettingsForEndpoint(fields))

    chai.expect(settings.sector).to.equal(null)
    chai.expect(settings.country).to.equal(null)
    chai.expect(settings.operational_purpose).to.equal(null)
    chai.expect(settings.collects_pii).to.equal(null)
  })

  it('should pass extra metadata fields through untouched', () => {
    const fields = createValidFields()
    fields.extra_metadata_fields = { text_field: 'Some value', multi_field: ['option1'], single_field: null }

    const settings = JSON.parse(getSettingsForEndpoint(fields))

    chai.expect(settings.extra_metadata).deep.equal({
      text_field: 'Some value',
      multi_field: ['option1'],
      single_field: null,
    })
  })
})
