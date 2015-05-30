/**
 * Originally from https://github.com/paramaggarwal/react-dropzone/
 * Except:
 *   - use your own css (minimal )
 *   - optionally include file select input
 *   - 
 */
var React = require('react');
var classNames = require('classnames');

var Dropzone = React.createClass({
  getInitialState: function() {
    return {
      isDragActive: false
    }
  },

  propTypes: {
    onDropFiles: React.PropTypes.func.isRequired
  },

  getDefaultProps: function () {
    return {
      className: 'dropzone',
      activeClassName: 'dropzone--active'
    }
  },

  onDragLeave: function(e) {
    this.setState({
      isDragActive: false
    });
  },

  onDragOver: function(e) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "copy";
    }

    this.setState({
      isDragActive: true
    });
  },

  onDrop: function(e) {
    e.preventDefault();

    this.setState({
      isDragActive: false
    });

    var files;
    if (e.dataTransfer) {
      files = e.dataTransfer.files;
    } else if (e.target) {
      files = e.target.files;
    }

    for (var i = 0; i < files.length; i++) {
      files[i].preview = URL.createObjectURL(files[i]);
    }

    files = Array.prototype.slice.call(files);
    this.props.onDropFiles(files);
  },
  onClick: function () {
    if (this.props.fileInput) {
      this.refs.fileInput.getDOMNode().click();
    }
  },
  render: function() {
    var kls = classNames(this.props.className, this.state.isDragActive ? this.props.activeClassName : '');
    var fileInp;
    if (this.props.fileInput) {
      fileInp = React.createElement("input", {
        style: { display: 'none' },
        type: "file",
        multiple: true,
        ref: "fileInput",
        onChange: this.onDrop
      });
    }
    return (
      React.createElement("div", {
          className: kls,
          onClick: this.onClick,
          onDragLeave: this.onDragLeave,
          onDragOver: this.onDragOver,
          onDrop: this.onDrop
        },
        fileInp,
        this.props.children
      )
    );
  }

});

module.exports = Dropzone;
