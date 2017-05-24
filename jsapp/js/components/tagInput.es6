import React from 'react';
import autoBind from 'react-autobind';
import TagsInput from 'react-tagsinput';
import stores from '../stores';
import actions from '../actions';
import {t} from '../utils';

class TagInput extends React.Component {
  constructor(props) {
    super(props)
    this.state = {tags: props.tags, tag: ''}
    autoBind(this);
  }

  handleChange(tags) {
    var transformed = tags.map(function(tag) {
      // Behavior should match KpiTaggableManager.add()
      return tag.trim().replace(/ /g, '-');
    });
    this.setState({tags: transformed});

    var uid = this.props.uid;
    actions.resources.updateAsset(uid, {
      tag_string: transformed.join(',')
    });

  }

  handleChangeInput(tag) {
    this.setState({tag})
  }

  render() {
  	var inputProps = {
  		placeholder: t('#tags +')
  	};
    return (
      <TagsInput
        value={this.state.tags}
        onChange={this.handleChange.bind(this)}
        inputValue={this.state.tag}
        inputProps={inputProps}
        onChangeInput={this.handleChangeInput.bind(this)}
      />
    )
  }
}

export default TagInput;