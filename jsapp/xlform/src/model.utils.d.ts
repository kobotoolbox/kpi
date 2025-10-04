interface SluggifyOptions {
  descriptor?: string | 'slug'
  lrstrip?: boolean
  lstrip?: boolean
  rstrip?: boolean
  lowerCase?: boolean
  replaceNonWordCharacters?: boolean
  nonWordCharsExceptions?: boolean
  preventDuplicateUnderscores?: boolean
  validXmlTag?: boolean
  underscores?: boolean
  characterLimit?: number
  preventDuplicates?: string[] | boolean
  incrementorPadding?: boolean
}

export const sluggify = (str: string, opts: SluggifyOptions) => string
