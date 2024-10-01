import React from 'react';
import autoBind from 'react-autobind';
import TagsInput from 'react-tagsinput';
import {cleanupTags} from 'js/assetUtils';
import './koboTagsInput.scss';

const DEFAULT_PLACEHOLDER = t('Type and confirm with ENTER');
const TAGS_SEPARATOR = ',';

interface KoboTagsInputProps {
  /** tags a comma-separated list of tags (the asset keeps it that way) */
  tags: string;
  /** returns stringified comma-separated new tags string */
  onChange: (tags: string) => void;
  /** optional title */
  label?: string;
  /** optional as default is provided */
  placeholder?: string;
  'data-cy'?: string;
}

interface InnerInputProps {
  placeholder: string;
  'data-cy'?: string;
  id?: string;
  dir: string;
}

/**
 * This component is a wrapper around 3rd party react-tagsinput to allow for
 * common settings to be reused in a better way.
 *
 */
class KoboTagsInput extends React.Component<KoboTagsInputProps> {
  constructor(props: KoboTagsInputProps) {
    super(props);
    autoBind(this);
  }

  onChange(tags: string[]) {
    // make sure to split all multiple tags added (i.e. when users types in few
    // tags at once separated by TAGS_SEPARATOR)
    let cleanTags = tags.join(TAGS_SEPARATOR).split(TAGS_SEPARATOR);
    // we then make sure the list contains only unique values and cleaned up
    cleanTags = Array.from(new Set(cleanupTags(cleanTags)));
    this.props.onChange(cleanTags.join(TAGS_SEPARATOR));
  }

  // splits pasted text by TAGS_SEPARATOR and trims all white space
  pasteSplit(data: string) {
    return data.split(TAGS_SEPARATOR).map((tag) => tag.trim());
  }

  render() {
    const inputProps: InnerInputProps = {
      placeholder: this.props.placeholder || DEFAULT_PLACEHOLDER,
      'data-cy': this.props['data-cy'],
      dir: 'auto',
    };

    if (this.props.label) {
      // generate a unique id for the input
      inputProps.id = String(encodeURI(this.props.label) + '_' + Date.now()).toLowerCase();
    }

    let tagsArray: string[] = [];
    if (typeof this.props.tags === 'string' && this.props.tags.length >= 1) {
      tagsArray = this.props.tags.split(TAGS_SEPARATOR);
    }

    return (
      <div>
        {this.props.label &&
          <label htmlFor={inputProps.id}>
            {this.props.label}
          </label>
        }

        <TagsInput
          value={tagsArray}
          onChange={this.onChange}
          inputProps={inputProps}
          onlyUnique
          addOnBlur
          addOnPaste
          pasteSplit={this.pasteSplit}
        />
      </div>
    );
  }
}

export default KoboTagsInput;
