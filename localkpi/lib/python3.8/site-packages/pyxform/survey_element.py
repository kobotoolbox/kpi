# -*- coding: utf-8 -*-
"""
Survey Element base class for all survey elements.
"""
import json
import re

from pyxform import constants
from pyxform.errors import PyXFormError
from pyxform.question_type_dictionary import QUESTION_TYPE_DICT
from pyxform.utils import INVALID_XFORM_TAG_REGEXP, is_valid_xml_tag, node, unicode
from pyxform.xls2json import print_pyobj_to_json

try:
    from functools import lru_cache
except ImportError:
    from functools32 import lru_cache


def _overlay(over, under):
    if type(under) == dict:
        result = under.copy()
        result.update(over)
        return result
    return over if over else under


class SurveyElement(dict):
    """
    SurveyElement is the base class we'll looks for the following keys
    in kwargs: name, label, hint, type, bind, control, parent,
    children, and question_type_dictionary.
    """

    # the following are important keys for the underlying dict that
    # describes this survey element
    FIELDS = {
        "name": unicode,
        constants.COMPACT_TAG: unicode,  # used for compact (sms) representation
        "sms_field": unicode,
        "sms_option": unicode,
        "label": unicode,
        "hint": unicode,
        "guidance_hint": unicode,
        "default": unicode,
        "type": unicode,
        "appearance": unicode,
        "parameters": unicode,
        "intent": unicode,
        "jr:count": unicode,
        "bind": dict,
        "instance": dict,
        "control": dict,
        "media": dict,
        # this node will also have a parent and children, like a tree!
        "parent": lambda: None,
        "children": list,
        "itemset": unicode,
        "choice_filter": unicode,
        "query": unicode,
        "autoplay": unicode,
        "flat": lambda: False,
        "action": unicode,
    }

    def _default(self):
        # TODO: need way to override question type dictionary
        defaults = QUESTION_TYPE_DICT
        return defaults.get(self.get("type"), {})

    def __getattr__(self, key):
        """
        Get attributes from FIELDS rather than the class.
        """
        if key in self.FIELDS:
            question_type_dict = self._default()
            under = question_type_dict.get(key, None)
            over = self.get(key)
            if not under:
                return over
            return _overlay(over, under)
        raise AttributeError(key)

    def __hash__(self):
        return hash(id(self))

    @property
    def __name__(self):
        return "SurveyElement"

    def __setattr__(self, key, value):
        self[key] = value

    def __init__(self, **kwargs):
        for key, default in self.FIELDS.items():
            self[key] = kwargs.get(key, default())
        self._link_children()

        # Create a space label for unlabeled elements with the label
        # appearance tag. # This is because such elements are used to label the
        # options for selects in a field-list and might want blank labels for
        # themselves.
        if self.control.get("appearance") == "label" and not self.label:
            self["label"] = " "

    def _link_children(self):
        for child in self.children:
            child.parent = self

    def add_child(self, child):
        self.children.append(child)
        child.parent = self

    def add_children(self, children):
        if type(children) == list:
            for child in children:
                self.add_child(child)
        else:
            self.add_child(children)

    binding_conversions = {
        "yes": "true()",
        "Yes": "true()",
        "YES": "true()",
        "true": "true()",
        "True": "true()",
        "TRUE": "true()",
        "no": "false()",
        "No": "false()",
        "NO": "false()",
        "false": "false()",
        "False": "false()",
        "FALSE": "false()",
    }

    CONVERTIBLE_BIND_ATTRIBUTES = [
        "readonly",
        "required",
        "relevant",
        "constraint",
        "calculate",
    ]

    # Supported media types for attaching to questions
    SUPPORTED_MEDIA = ["image", "audio", "video"]

    def validate(self):
        if not is_valid_xml_tag(self.name):
            invalid_char = re.search(INVALID_XFORM_TAG_REGEXP, self.name)
            msg = (
                "The name '{}' is an invalid XML tag, it contains an "
                "invalid character '{}'. Names must begin with a letter, "
                "colon, or underscore, subsequent characters can include "
                "numbers, dashes, and periods".format(self.name, invalid_char.group(0))
            )
            raise PyXFormError(msg)

    # TODO: Make sure renaming this doesn't cause any problems
    def iter_descendants(self):
        """
        A survey_element is a dictionary of survey_elements
        This method does a preorder traversal over them.
        For the time being this survery_element is included among its
        descendants
        """
        # it really seems like this method should not yield self
        yield self
        for e in self.children:
            for f in e.iter_descendants():
                yield f

    @lru_cache(maxsize=None)
    def any_repeat(self, parent_xpath):
        """Return True if there ia any repeat in `parent_xpath`."""
        for item in self.iter_descendants():
            if item.get_xpath() == parent_xpath and item.type == constants.REPEAT:
                return True

        return False

    def get_lineage(self):
        """
        Return a the list [root, ..., self._parent, self]
        """
        result = [self]
        current_element = self
        while current_element.parent:
            current_element = current_element.parent
            result = [current_element] + result
        # For some reason the root element has a True flat property...
        output = [result[0]]
        for item in result[1:]:
            if not item.get("flat"):
                output.append(item)
        return output

    def get_root(self):
        return self.get_lineage()[0]

    def get_xpath(self):
        """
        Return the xpath of this survey element.
        """
        return "/".join([""] + [n.name for n in self.get_lineage()])

    def get_abbreviated_xpath(self):
        lineage = self.get_lineage()
        if len(lineage) >= 2:
            return "/".join([unicode(n.name) for n in lineage[1:]])
        else:
            return lineage[0].name

    def to_json_dict(self):
        """
        Create a dict copy of this survey element by removing inappropriate
        attributes and converting its children to dicts
        """
        self.validate()
        result = self.copy()
        to_delete = ["parent", "question_type_dictionary", "_created"]
        for key in to_delete:
            if key in result:
                del result[key]
        children = result.pop("children")
        result["children"] = []
        for child in children:
            result["children"].append(child.to_json_dict())
        # remove any keys with empty values
        for k, v in list(result.items()):
            if not v:
                del result[k]

        return result

    def to_json(self):
        return json.dumps(self.to_json_dict())

    def json_dump(self, path=""):
        if not path:
            path = self.name + ".json"
        print_pyobj_to_json(self.to_json_dict(), path)

    def __eq__(self, y):
        return (
            hasattr(y, "to_json_dict")
            and callable(y.to_json_dict)
            and self.to_json_dict() == y.to_json_dict()
        )

    def _translation_path(self, display_element):
        return self.get_xpath() + ":" + display_element

    def get_translations(self, default_language):
        """
        Returns translations used by this element so they can be included in
        the <itext> block. @see survey._setup_translations
        """
        bind_dict = self.get("bind")
        if bind_dict and type(bind_dict) is dict:
            constraint_msg = bind_dict.get("jr:constraintMsg")
            if type(constraint_msg) is dict:
                for lang, text in constraint_msg.items():
                    yield {
                        "path": self._translation_path("jr:constraintMsg"),
                        "lang": lang,
                        "text": text,
                    }
            required_msg = bind_dict.get("jr:requiredMsg")
            if type(required_msg) is dict:
                for lang, text in required_msg.items():
                    yield {
                        "path": self._translation_path("jr:requiredMsg"),
                        "lang": lang,
                        "text": text,
                    }
            no_app_error_string = bind_dict.get("jr:noAppErrorString")
            if type(no_app_error_string) is dict:
                for lang, text in no_app_error_string.items():
                    yield {
                        "path": self._translation_path("jr:noAppErrorString"),
                        "lang": lang,
                        "text": text,
                    }

        for display_element in ["label", "hint", "guidance_hint"]:
            label_or_hint = self[display_element]

            if (
                display_element == "label"
                and self.needs_itext_ref()
                and type(label_or_hint) is not dict
                and label_or_hint
            ):
                label_or_hint = {default_language: label_or_hint}

            # always use itext for guidance hints because that's
            # how they're defined - https://opendatakit.github.io/xforms-spec/#languages
            if (
                display_element == "guidance_hint"
                and not (isinstance(label_or_hint, dict))
                and len(label_or_hint) > 0
            ):
                label_or_hint = {default_language: label_or_hint}

            # always use itext for hint if there's a guidance hint
            if (
                display_element == "hint"
                and not (isinstance(label_or_hint, dict))
                and len(label_or_hint) > 0
                and "guidance_hint" in self.keys()
                and len(self["guidance_hint"]) > 0
            ):
                label_or_hint = {default_language: label_or_hint}

            if type(label_or_hint) is dict:
                for lang, text in label_or_hint.items():
                    yield {
                        "display_element": display_element,  # Not used
                        "path": self._translation_path(display_element),
                        "element": self,  # Not used
                        "lang": lang,
                        "text": text,
                    }

    def get_media_keys(self):
        """
        @deprected
        I'm leaving this in just in case it has outside references.
        """
        return {"media": "%s:media" % self.get_xpath()}

    def needs_itext_ref(self):
        return type(self.label) is dict or (
            type(self.media) is dict and len(self.media) > 0
        )

    # XML generating functions, these probably need to be moved around.
    def xml_label(self):
        if self.needs_itext_ref():
            # If there is a dictionary label, or non-empty media dict,
            # then we need to make a label with an itext ref
            ref = "jr:itext('%s')" % self._translation_path("label")
            return node("label", ref=ref)
        else:
            survey = self.get_root()
            label, output_inserted = survey.insert_output_values(self.label, self)
            return node("label", label, toParseString=output_inserted)

    def xml_hint(self):
        if isinstance(self.hint, dict) or self.guidance_hint:
            path = self._translation_path("hint")
            return node("hint", ref="jr:itext('%s')" % path)
        else:
            hint, output_inserted = self.get_root().insert_output_values(
                self.hint, self
            )
            return node("hint", hint, toParseString=output_inserted)

    def xml_label_and_hint(self):
        """
        Return a list containing one node for the label and if there
        is a hint one node for the hint.
        """
        result = []
        if self.label or self.media:
            result.append(self.xml_label())
        if self.hint or self.guidance_hint:
            result.append(self.xml_hint())

        if len(result) == 0 or self.guidance_hint and len(result) == 1:
            msg = "The survey element named '%s' " "has no label or hint." % self.name
            raise PyXFormError(msg)

        return result

    def xml_binding(self):
        """
        Return the binding for this survey element.
        """
        survey = self.get_root()
        bind_dict = self.bind.copy()
        if self.get("flat"):
            # Don't generate bind element for flat groups.
            return None
        if bind_dict:
            for k, v in bind_dict.items():
                # I think all the binding conversions should be happening on
                # the xls2json side.
                if (
                    hashable(v)
                    and v in self.binding_conversions
                    and k in self.CONVERTIBLE_BIND_ATTRIBUTES
                ):
                    v = self.binding_conversions[v]
                if k == "jr:constraintMsg" and type(v) is dict:
                    v = "jr:itext('%s')" % self._translation_path("jr:constraintMsg")
                if k == "jr:requiredMsg" and type(v) is dict:
                    v = "jr:itext('%s')" % self._translation_path("jr:requiredMsg")
                if k == "jr:noAppErrorString" and type(v) is dict:
                    v = "jr:itext('%s')" % self._translation_path("jr:noAppErrorString")
                bind_dict[k] = survey.insert_xpaths(v, context=self)
            return node("bind", nodeset=self.get_xpath(), **bind_dict)
        return None

    def xml_bindings(self):
        """
        Return a list of bindings for this node and all its descendants.
        """
        result = []
        for e in self.iter_descendants():
            xml_binding = e.xml_binding()
            if xml_binding is not None:
                result.append(xml_binding)
        return result

    def xml_control(self):
        """
        The control depends on what type of question we're asking, it
        doesn't make sense to implement here in the base class.
        """
        raise NotImplementedError("Control not implemented")

    def xml_action(self):
        """
        Return the action for this survey element.
        """
        if self.action:
            action_dict = self.action.copy()
            if action_dict:
                name = action_dict["name"]
                del action_dict["name"]
                return node(name, ref=self.get_xpath(), **action_dict)

        return None

    def xml_actions(self):
        """
        Return a list of actions for this node and all its descendants.
        """
        result = []
        for e in self.iter_descendants():
            xml_action = e.xml_action()
            if xml_action is not None:
                result.append(xml_action)
        return result


def hashable(v):
    """Determine whether `v` can be hashed."""
    try:
        hash(v)
    except TypeError:
        return False
    return True
