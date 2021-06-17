import React from 'react';
import autoBind from 'react-autobind';
import TagsInput from 'react-tagsinput';
import {cleanupTags} from 'js/assetUtils';

const DEFAULT_PLACEHOLDER = t('Type and confirm with ENTER');
const TAGS_SEPARATOR = ',';

/**
 * This component is a wrapper around 3rd party react-tagsinput to allow for
 * common settings to be reused in a better way.
 *
 * @prop {string} tags a comma-separated list of tags (the asset keeps it that way)
 * @prop {callback} onChange - returns stringified comma-separated new tags string
 * @prop {string} [label] optional title
 * @prop {string} [placeholder] optional as default is provided
 */
class KoboTagsInput extends React.Component {
  constructor(props) {
    super(props);
    autoBind(this);
  }

  onChange(tags) {
    // make sure to split all multiple tags added (i.e. when users types in few
    // tags at once separated by TAGS_SEPARATOR)
    let cleanTags = tags.join(TAGS_SEPARATOR).split(TAGS_SEPARATOR);
    // we then make sure the list contains only unique values and cleaned up
    cleanTags = Array.from(new Set(cleanupTags(cleanTags)));
    this.props.onChange(cleanTags.join(TAGS_SEPARATOR));
  }

  // splits pasted text by TAGS_SEPARATOR and trims all white space
  pasteSplit(data) {
    return data.split(TAGS_SEPARATOR).map((tag) => {return tag.trim();});
  }

  render() {
    const inputProps = {
      placeholder: this.props.placeholder || DEFAULT_PLACEHOLDER,
    };

    if (this.props.label) {
      // generate a unique id for the input
      inputProps.id = String(encodeURI(this.props.label) + '_' + Date.now()).toLowerCase();
    }

    let tagsArray = [];
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
