import React from 'react/addons';
import Reflux from 'reflux';

import newFormMixin from '../editorMixins/newForm';
import editableFormMixin from '../editorMixins/editableForm';
import existingFormMixin from '../editorMixins/existingForm';

import {Navigation} from 'react-router';

let newFormMixins = [
    Navigation,
    Reflux.ListenerMixin,
    editableFormMixin,
    newFormMixin,
];

export var NewForm = React.createClass({
  mixins: newFormMixins,
  listRoute: 'forms',
});

export var AddToLibrary = React.createClass({
  mixins: newFormMixins,
  listRoute: 'library',
});

let existingFormMixins = [
    Navigation,
    Reflux.ListenerMixin,
    editableFormMixin,
    existingFormMixin,
];

export var FormPage = React.createClass({
  mixins: existingFormMixins,
  listRoute: 'forms',
});

export var LibraryPage = React.createClass({
  mixins: existingFormMixins,
  listRoute: 'library',
});
