import React from 'react';
import autoBind from 'react-autobind';
import TagsInput from 'react-tagsinput';
import {actions} from '../actions';
import {cleanupTags} from 'js/assetUtils';

class TagInput extends React.Component {
  constructor(props) {
    super(props);
    this.state = {tags: props.tags, tag: ''};
    autoBind(this);
  }

  handleChange(tags) {
    var transformed = cleanupTags(tags);
    this.setState({tags: transformed});

    var uid = this.props.uid;
    actions.resources.updateAsset(uid, {
      tag_string: transformed.join(',')
    });

  }

  handleChangeInput(tag) {
    this.setState({tag});
  }

  render() {
    var inputProps = {
      placeholder: t('Add tag(s)')
    };
    return (
      <TagsInput
        value={this.state.tags}
        onChange={this.handleChange.bind(this)}
        inputValue={this.state.tag}
        inputProps={inputProps}
        onChangeInput={this.handleChangeInput.bind(this)}
      />
    );
  }
}

export default TagInput;
