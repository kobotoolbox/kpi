# -*- coding: utf-8 -*-
"""
xform2json module - Transform an XForm to a JSON dictionary.
"""
from __future__ import print_function

import codecs
import copy
import json
import logging
import re
import xml.etree.ElementTree as ETree
from operator import itemgetter

from pyxform import builder
from pyxform.utils import NSMAP, basestring

logger = logging.getLogger(__name__)
logger.addHandler(logging.NullHandler)


# {{{ http://code.activestate.com/recipes/573463/ (r7)
class XmlDictObject(dict):
    """
    Adds object like functionality to the standard dictionary.
    """

    def __init__(self, initdict=None):
        if initdict is None:
            initdict = {}
        dict.__init__(self, initdict)

    def __getattr__(self, item):
        return self.__getitem__(item)

    def __setattr__(self, item, value):
        self.__setitem__(item, value)

    def __str__(self):
        if "_text" in self:
            return self.__getitem__("_text")
        else:
            return ""

    @staticmethod
    def wrap(x):
        """
        Static method to wrap a dictionary recursively as an XmlDictObject
        """

        if isinstance(x, dict):
            return XmlDictObject(
                (k, XmlDictObject.Wrap(v)) for (k, v) in iter(x.items())
            )
        elif isinstance(x, list):
            return [XmlDictObject.Wrap(v) for v in x]
        else:
            return x

    @staticmethod
    def _un_wrap(x):
        if isinstance(x, dict):
            return dict((k, XmlDictObject._un_wrap(v)) for (k, v) in iter(x.items()))
        elif isinstance(x, list):
            return [XmlDictObject._un_wrap(v) for v in x]
        else:
            return x

    def un_wrap(self):
        """
        Recursively converts an XmlDictObject to a standard dictionary
        and returns the result.
        """

        return XmlDictObject._un_wrap(self)


def _convert_dict_to_xml_recurse(parent, dictitem):
    assert not isinstance(dictitem, list)

    if isinstance(dictitem, dict):
        for (tag, child) in iter(dictitem.items()):
            if str(tag) == "_text":
                parent.text = str(child)
            elif isinstance(child, list):
                # iterate through the array and convert
                for listchild in child:
                    elem = ETree.Element(tag)
                    parent.append(elem)
                    _convert_dict_to_xml_recurse(elem, listchild)
            else:
                elem = ETree.Element(tag)
                parent.append(elem)
                _convert_dict_to_xml_recurse(elem, child)
    else:
        parent.text = str(dictitem)


def convert_dict_to_xml(xmldict):
    """
    Converts a dictionary to an XML ElementTree Element
    """

    roottag = xmldict.keys()[0]
    root = ETree.Element(roottag)
    _convert_dict_to_xml_recurse(root, xmldict[roottag])
    return root


def _convert_xml_to_dict_recurse(node, dictclass):
    nodedict = dictclass()

    if len(node.items()) > 0:
        # if we have attributes, set them
        nodedict.update(dict(node.items()))

    for child in node:
        # recursively add the element's children
        newitem = _convert_xml_to_dict_recurse(child, dictclass)
        # if tag in between text node, capture the tail end
        if child.tail is not None and child.tail.strip() != "":
            newitem["tail"] = child.tail
        if child.tag in nodedict:
            # found duplicate tag, force a list
            if isinstance(nodedict[child.tag], list):
                # append to existing list
                nodedict[child.tag].append(newitem)
            else:
                # convert to list
                nodedict[child.tag] = [nodedict[child.tag], newitem]
        else:
            # only one, directly set the dictionary
            nodedict[child.tag] = newitem

    if node.text is None:
        text = ""
    else:
        text = node.text.strip()

    if len(nodedict) > 0:
        # if we have a dictionary
        # add the text as a dictionary value (if there is any)
        if len(text) > 0:
            nodedict["_text"] = text
    else:
        # if we don't have child nodes or attributes, just set the text
        nodedict = text

    return nodedict


def convert_xml_to_dict(root, dictclass=XmlDictObject):
    """
    Converts an XML file or ElementTree Element to a dictionary
    """
    # If a string is passed in, try to open it as a file
    if isinstance(root, basestring):
        root = _try_parse(root)
    elif not isinstance(root, ETree.Element):
        raise TypeError("Expected ElementTree.Element or file path string")

    return dictclass({root.tag: _convert_xml_to_dict_recurse(root, dictclass)})


# end of http://code.activestate.com/recipes/573463/ }}}


def _try_parse(root, parser=None):
    """
    Try to parse the root from a string or a file/file-like object.
    """
    root = root.encode("UTF-8")
    try:
        parsed_root = ETree.fromstring(root, parser)
    except ETree.ParseError:
        parsed_root = ETree.parse(root, parser=parser).getroot()
    return parsed_root


class XFormToDict:
    def __init__(self, root):
        if isinstance(root, basestring):
            parser = ETree.XMLParser(encoding="UTF-8")
            self._root = _try_parse(root, parser)
            self._dict = XmlDictObject(
                {
                    self._root.tag: _convert_xml_to_dict_recurse(
                        self._root, XmlDictObject
                    )
                }
            )
        elif not isinstance(root, ETree.Element):
            raise TypeError("Expected ElementTree.Element or file path string")

    def get_dict(self):
        json_str = json.dumps(self._dict)
        for uri in NSMAP.values():
            json_str = json_str.replace("{%s}" % uri, "")
        return json.loads(json_str)


def create_survey_element_from_xml(xml_file):
    sb = XFormToDictBuilder(xml_file)
    return sb.survey()


class XFormToDictBuilder:
    """Experimental XFORM xml to XFORM JSON"""

    QUESTION_TYPES = {
        "select": "select all that apply",
        "select1": "select one",
        "int": "integer",
        "dateTime": "datetime",
        "string": "text",
    }

    def __init__(self, xml_file):
        doc_as_dict = XFormToDict(xml_file).get_dict()
        self._xmldict = doc_as_dict

        assert "html" in doc_as_dict
        assert "body" in doc_as_dict["html"]
        assert "head" in doc_as_dict["html"]
        assert "model" in doc_as_dict["html"]["head"]
        assert "title" in doc_as_dict["html"]["head"]
        assert "bind" in doc_as_dict["html"]["head"]["model"]

        self.body = doc_as_dict["html"]["body"]
        self.model = doc_as_dict["html"]["head"]["model"]
        self.bindings = copy.deepcopy(self.model["bind"])
        self._bind_list = copy.deepcopy(self.model["bind"])
        self.title = doc_as_dict["html"]["head"]["title"]
        self.new_doc = {
            "type": "survey",
            "title": self.title,
            "children": [],
            "id_string": self.title,
            "sms_keyword": self.title,
            "default_language": "default",
        }
        self._set_submission_info()
        self._set_survey_name()
        self.children = []
        self.ordered_binding_refs = []
        self._set_binding_order()

        # set self.translations
        self._set_translations()

        for key, obj in iter(self.body.items()):
            if isinstance(obj, dict):
                self.children.append(self._get_question_from_object(obj, type=key))
            elif isinstance(obj, list):
                for item in obj:
                    self.children.append(self._get_question_from_object(item, type=key))
        self._cleanup_bind_list()
        self._cleanup_children()
        self.new_doc["children"] = self.children

    def _set_binding_order(self):
        self.ordered_binding_refs = []
        for bind in self.bindings:
            self.ordered_binding_refs.append(bind["nodeset"])

    def _set_survey_name(self):
        obj = self.bindings[0]
        name = obj["nodeset"].split("/")[1]
        self.new_doc["name"] = name
        self.new_doc["id_string"] = self.model["instance"][name]["id"]

    def _set_submission_info(self):
        if "submission" in self.model:
            submission = self.model["submission"]
            if "action" in submission:
                self.new_doc["submission_url"] = submission["action"]
            if "base64RsaPublicKey" in submission:
                self.new_doc["public_key"] = submission["base64RsaPublicKey"]
            if "auto-send" in submission:
                self.new_doc["auto_send"] = submission["auto-send"]
            if "auto-delete" in submission:
                self.new_doc["auto_delete"] = submission["auto-delete"]

    def _cleanup_children(self):
        def remove_refs(children):
            for child in children:
                if isinstance(child, dict):
                    if "nodeset" in child:
                        del child["nodeset"]
                    if "ref" in child:
                        del child["ref"]
                    if "__order" in child:
                        del child["__order"]
                    if "children" in child:
                        remove_refs(child["children"])

        # do some ordering, order is specified by bindings
        def order_children(children):
            if isinstance(children, list):
                try:
                    children.sort(key=itemgetter("__order"))
                except KeyError:
                    pass
                for child in children:
                    if isinstance(child, dict) and "children" in child:
                        order_children(child["children"])

        order_children(self.children)
        remove_refs(self.children)

    def _cleanup_bind_list(self):
        for item in self._bind_list:
            ref = item["nodeset"]
            name = self._get_name_from_ref(ref)
            parent_ref = ref[: ref.find("/%s" % name)]
            question = self._get_question_params_from_bindings(ref)
            question["name"] = name
            question["__order"] = self._get_question_order(ref)
            if "calculate" in item:
                question["type"] = "calculate"
            if ref.split("/").__len__() == 3:
                # just append on root node, has no group
                question["ref"] = ref
                self.children.append(question)
                continue
            for child in self.children:
                if child["ref"] == parent_ref:
                    question["ref"] = ref
                    updated = False
                    for c in child["children"]:
                        if isinstance(c, dict) and "ref" in c and c["ref"] == ref:
                            c.update(question)
                            updated = True
                    if not updated:
                        child["children"].append(question)
            if "ref" not in question:
                new_ref = "/".join(ref.split("/")[2:])
                root_ref = "/".join(ref.split("/")[:2])
                q = self._get_item_func(root_ref, new_ref, item)
                if "type" not in q and "type" in question:
                    q.update(question)
                if q["type"] == "group" and q["name"] == "meta":
                    q["control"] = {"bodyless": True}
                    q["__order"] = self._get_question_order(ref)
                self.children.append(q)
                self._bind_list.append(item)
                break
        if self._bind_list:
            self._cleanup_bind_list()

    def _get_item_func(self, ref, name, item):
        rs = {}
        name_splits = name.split("/")
        rs["name"] = name_splits[0]
        ref = "%s/%s" % (ref, rs["name"])
        rs["ref"] = ref
        if name_splits.__len__() > 1:
            rs["type"] = "group"
            rs["children"] = [self._get_item_func(ref, "/".join(name_splits[1:]), item)]
        return rs

    def survey(self):
        new_doc = json.dumps(self.new_doc)
        _survey = builder.create_survey_element_from_json(new_doc)
        return _survey

    def _get_question_order(self, ref):
        try:
            return self.ordered_binding_refs.index(ref)
        except ValueError:
            # likely a group
            for i in self.ordered_binding_refs:
                if i.startswith(ref):
                    return self.ordered_binding_refs.index(i) + 1
            return self.ordered_binding_refs.__len__() + 1

    def _get_question_from_object(self, obj, type=None):
        try:
            ref = obj["ref"]
        except KeyError:
            try:
                ref = obj["nodeset"]
            except KeyError:
                raise TypeError(
                    'cannot find "ref" or "nodeset" in {}'.format(repr(obj))
                )
        question = {
            "ref": ref,
            "__order": self._get_question_order(ref),
            "name": self._get_name_from_ref(ref),
        }
        if "hint" in obj:
            k, v = self._get_label(obj["hint"], "hint")
            question[k] = v
        if "label" in obj:
            k, v = self._get_label(obj["label"])
            if isinstance(v, dict) and "label" in v.keys() and "media" in v.keys():
                for _k, _v in iter(v.items()):
                    question[_k] = _v
            else:
                question[k] = v
        if "autoplay" in obj or "appearance" in obj or "count" in obj or "rows" in obj:
            question["control"] = {}
        if "appearance" in obj:
            question["control"].update({"appearance": obj["appearance"]})
        if "rows" in obj:
            question["control"].update({"rows": obj["rows"]})
        if "autoplay" in obj:
            question["control"].update({"autoplay": obj["autoplay"]})
        question_params = self._get_question_params_from_bindings(ref)
        if isinstance(question_params, dict):
            for k, v in iter(question_params.items()):
                question[k] = v
        # has to come after the above block
        if "mediatype" in obj:
            question["type"] = obj["mediatype"].replace("/*", "")
        if "item" in obj:
            children = []
            for i in obj["item"]:
                if isinstance(i, dict) and "label" in i.keys() and "value" in i.keys():
                    k, v = self._get_label(i["label"])
                    children.append({"name": i["value"], k: v})
            question["children"] = children
        question_type = question["type"] if "type" in question else type
        if (
            question_type == "text"
            and "bind" in question
            and "readonly" in question["bind"]
        ):
            question_type = question["type"] = "note"
            del question["bind"]["readonly"]
            if len(question["bind"].keys()) == 0:
                del question["bind"]
        if question_type in ["group", "repeat"]:
            if question_type == "group" and "repeat" in obj:
                question["children"] = self._get_children_questions(obj["repeat"])
                question_type = "repeat"
                if "count" in obj["repeat"]:
                    if "control" not in question:
                        question["control"] = {}
                    question["control"].update(
                        {
                            "jr:count": self._shorten_xpaths_in_string(
                                obj["repeat"]["count"].strip()
                            )
                        }
                    )
            else:
                question["children"] = self._get_children_questions(obj)
            question["type"] = question_type
        if type == "trigger":
            question["type"] = "acknowledge"
        if question_type == "geopoint" and "hint" in question:
            del question["hint"]
        if "type" not in question and type:
            question["type"] = question_type
        return question

    def _get_children_questions(self, obj):
        children = []
        for k, v in iter(obj.items()):
            if k in ["ref", "label", "nodeset"]:
                continue
            if isinstance(v, dict):
                child = self._get_question_from_object(v, type=k)
                children.append(child)
            elif isinstance(v, list):
                for i in v:
                    child = self._get_question_from_object(i, type=k)
                    children.append(child)
        return children

    def _get_question_params_from_bindings(self, ref):
        for item in self.bindings:
            if item["nodeset"] == ref:
                try:
                    self._bind_list.remove(item)
                except ValueError:
                    pass
                rs = {}
                for k, v in iter(item.items()):
                    if k == "nodeset":
                        continue
                    if k == "type":
                        v = self._get_question_type(v)
                    if k in [
                        "relevant",
                        "required",
                        "constraint",
                        "constraintMsg",
                        "readonly",
                        "calculate",
                        "noAppErrorString",
                        "requiredMsg",
                    ]:
                        if k == "noAppErrorString":
                            k = "jr:noAppErrorString"
                        if k == "requiredMsg":
                            k = "jr:requiredMsg"
                        if k == "constraintMsg":
                            k = "jr:constraintMsg"
                            v = self._get_constraint_msg(v)
                        if k == "required":
                            if v == "true()":
                                v = "yes"
                            elif v == "false()":
                                v = "no"
                        if k in ["constraint", "relevant", "calculate"]:
                            v = self._shorten_xpaths_in_string(v)
                        if "bind" not in rs:
                            rs["bind"] = {}
                        rs["bind"][k] = v
                        continue
                    if k == "preload" and v == "uid":
                        if "bind" not in rs:
                            rs["bind"] = {}
                        rs["bind"]["jr:preload"] = v
                    rs[k] = v
                if "preloadParams" in rs and "preload" in rs:
                    rs["type"] = rs["preloadParams"]
                    del rs["preloadParams"]
                    del rs["preload"]
                return rs
        return None

    def _get_question_type(self, type):
        if type in self.QUESTION_TYPES.keys():
            return self.QUESTION_TYPES[type]
        return type

    def _set_translations(self):
        if "itext" not in self.model:
            self.translations = []
            return
        assert "translation" in self.model["itext"]
        self.translations = self.model["itext"]["translation"]
        if isinstance(self.translations, dict):
            self.translations = [self.translations]
        assert "text" in self.translations[0]
        assert "lang" in self.translations[0]

    def _get_label(self, label_obj, key="label"):
        if isinstance(label_obj, dict):
            try:
                ref = label_obj["ref"].replace("jr:itext('", "").replace("')", "")
            except KeyError:
                return key, self._get_output_text(label_obj)
            else:
                return self._get_text_from_translation(ref, key)
        return key, label_obj

    def _get_output_text(self, value):
        if "output" in value and "_text" in value:
            v = [value["_text"], self._get_bracketed_name(value["output"]["value"])]
            text = " ".join(v)
            if "tail" in value["output"]:
                text = "".join([text, value["output"]["tail"]])
        elif "output" in value and "_text" not in value:
            text = self._get_bracketed_name(value["output"]["value"])
        else:
            return value
        return text

    def _get_text_from_translation(self, ref, key="label"):
        label = {}
        for translation in self.translations:
            lang = translation["lang"]
            label_list = translation["text"]
            for l in label_list:
                if "value" not in l or l["value"] == "-":  # skip blank label
                    continue
                if l["id"] == ref:
                    text = value = l["value"]
                    if isinstance(value, dict):
                        if "output" in value:
                            text = self._get_output_text(value)
                        if "form" in value and "_text" in value:
                            key = "media"
                            v = value["_text"]
                            if value["form"] == "image":
                                v = v.replace("jr://images/", "")
                            else:
                                v = v.replace("jr://%s/" % value["form"], "")
                            if v == "-":  # skip blank
                                continue
                            text = {value["form"]: v}
                    if isinstance(value, list):
                        for item in value:
                            if "form" in item and "_text" in item:
                                k = "media"
                                m_type = item["form"]
                                v = item["_text"]
                                if m_type == "image":
                                    v = v.replace("jr://images/", "")
                                else:
                                    v = v.replace("jr://%s/" % m_type, "")
                                if v == "-":
                                    continue
                                if k not in label:
                                    label[k] = {}
                                if m_type not in label[k]:
                                    label[k][m_type] = {}
                                label[k][m_type][lang] = v
                                continue
                            if isinstance(item, basestring):
                                if item == "-":
                                    continue
                            if "label" not in label:
                                label["label"] = {}
                            label["label"][lang] = item
                        continue

                    label[lang] = text
                    break
        if key == "media" and label.keys() == ["default"]:
            label = label["default"]
        return key, label

    def _get_bracketed_name(self, ref):
        name = self._get_name_from_ref(ref)
        return "".join(["${", name.strip(), "}"])

    def _get_constraint_msg(self, constraint_msg):
        if isinstance(constraint_msg, basestring):
            if constraint_msg.find(":jr:constraintMsg") != -1:
                ref = constraint_msg.replace("jr:itext('", "").replace("')", "")
                k, constraint_msg = self._get_text_from_translation(ref)
        return constraint_msg

    def _get_name_from_ref(self, ref):
        """given /xlsform_spec_test/launch,
        return the string after the last occurance of the character '/'
        """
        pos = ref.rfind("/")
        if pos == -1:
            return ref
        else:
            return ref[pos + 1 :].strip()

    def _expand_child(self, obj_list):
        return obj_list

    def _shorten_xpaths_in_string(self, text):
        def get_last_item(xpath_str):
            last_item = xpath_str.split("/")
            return last_item[len(last_item) - 1].strip()

        def replace_function(match):
            return "${%s}" % get_last_item(match.group())

        # moving re flags into compile for python 2.6 compat
        pattern = "( /[a-z0-9-_]+(?:/[a-z0-9-_]+)+ )"
        text = re.compile(pattern, flags=re.I).sub(replace_function, text)
        pattern = "(/[a-z0-9-_]+(?:/[a-z0-9-_]+)+)"
        text = re.compile(pattern, flags=re.I).sub(replace_function, text)
        return text


def write_object_to_file(filename, obj):
    """Writes to a JSON filename the dictionary obj."""
    with codecs.open(filename, "w", encoding="utf-8") as output_file:
        output_file.write(json.dumps(obj, indent=2))
    logger.info("object written to file: %s", filename)
