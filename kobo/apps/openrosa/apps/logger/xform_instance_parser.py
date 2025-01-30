from __future__ import annotations

import re
import sys
from datetime import datetime
from typing import Optional, Union
from xml.dom import Node

import dateutil.parser
import six
from defusedxml import minidom
from django.utils.encoding import smart_str
from django.utils.translation import gettext as t

from kobo.apps.openrosa.apps.logger.exceptions import InstanceEmptyError
from kobo.apps.openrosa.libs.utils.common_tags import XFORM_ID_STRING
from kpi.utils.log import logging


def get_meta_node_from_xml(
    xml_str: str, meta_name: str
) -> Union[None, tuple[str, minidom.Document]]:
    xml = clean_and_parse_xml(xml_str)
    children = xml.childNodes
    # children ideally contains a single element
    # that is the parent of all survey elements
    if children.length == 0:
        raise ValueError(t('XML string must have a survey element.'))
    survey_node = children[0]
    meta_tags = [
        n
        for n in survey_node.childNodes
        if n.nodeType == Node.ELEMENT_NODE
        and (n.tagName.lower() == 'meta' or n.tagName.lower() == 'orx:meta')
    ]
    if len(meta_tags) == 0:
        return None

    # get the requested tag
    meta_tag = meta_tags[0]
    uuid_tags = [n for n in meta_tag.childNodes if
                 n.nodeType == Node.ELEMENT_NODE and
                 (n.tagName.lower() == meta_name.lower() or
                  n.tagName.lower() == 'orx:%s' % meta_name.lower())]
    if len(uuid_tags) == 0:
        return None

    uuid_tag = uuid_tags[0]
    return uuid_tag, xml


def get_meta_from_xml(xml_str: str, meta_name: str) -> str:
    if node_and_root := get_meta_node_from_xml(xml_str, meta_name):
        node, _ = node_and_root
        return node.firstChild.nodeValue.strip() if node.firstChild else None


def get_uuid_from_xml(xml):

    def _uuid_only(uuid):
        """
        Strips the 'uuid:' prefix from the provided identifier if it exists.
        This preserves any custom ID schemes (e.g., 'kobotoolbox.org:123456789')
        while ensuring only the 'uuid:' prefix is removed. This approach
        adheres to the OpenRosa spec, allowing custom prefixes to be stored
        intact in the database to prevent potential ID collisions.
        """
        return re.sub(r'^uuid:', '', uuid)

    uuid = get_meta_from_xml(xml, 'instanceID')
    if uuid:
        return _uuid_only(uuid)
    # check in survey_node attributes
    xml = clean_and_parse_xml(xml)
    children = xml.childNodes
    # children ideally contains a single element
    # that is the parent of all survey elements
    if children.length == 0:
        raise ValueError(t('XML string must have a survey element.'))
    survey_node = children[0]
    uuid = survey_node.getAttribute('instanceID')
    if uuid != '':
        return _uuid_only(uuid)
    return None


def get_root_uuid_from_xml(xml):
    root_uuid = get_meta_from_xml(xml, 'rootUuid')
    if root_uuid:
        return root_uuid

    # If no rootUuid, fall back to instanceID
    return get_uuid_from_xml(xml)


def get_submission_date_from_xml(xml) -> Optional[datetime]:
    # check in survey_node attributes
    xml = clean_and_parse_xml(xml)
    children = xml.childNodes
    # children ideally contains a single element
    # that is the parent of all survey elements
    if children.length == 0:
        raise ValueError(t('XML string must have a survey element.'))
    survey_node = children[0]
    submission_date = survey_node.getAttribute('submissionDate')
    if submission_date != '':
        return dateutil.parser.parse(submission_date)
    return None


def get_deprecated_uuid_from_xml(xml):
    uuid = get_meta_from_xml(xml, 'deprecatedID')
    regex = re.compile(r'uuid:(.*)')
    if uuid:
        matches = regex.match(uuid)
        if matches and len(matches.groups()) > 0:
            return matches.groups()[0]
    return None


def clean_and_parse_xml(xml_string: str) -> minidom.Document:
    clean_xml_str = xml_string.strip()
    clean_xml_str = re.sub(r'>\s+<', '><', smart_str(clean_xml_str))
    xml_obj = minidom.parseString(clean_xml_str)
    return xml_obj


def set_meta(xml_str: str, meta_name: str, new_value: str) -> str:

    if not (node_and_root := get_meta_node_from_xml(xml_str, meta_name)):
        raise ValueError(f'{meta_name} node not found')

    node, root = node_and_root

    if node.firstChild:
        node.firstChild.nodeValue = new_value

    xml_output = root.toprettyxml(indent='  ')
    xml_output = xml_output.replace('<?xml version="1.0" ?>', '').strip()
    return xml_output


def _xml_node_to_dict(node: Node, repeats: list = []) -> dict:
    assert isinstance(node, Node)
    if len(node.childNodes) == 0:
        # there's no data for this leaf node
        return None
    elif (
        len(node.childNodes) == 1
        and node.childNodes[0].nodeType == node.TEXT_NODE
    ):
        # there is data for this leaf node
        return {node.nodeName: node.childNodes[0].nodeValue}
    else:
        # this is an internal node
        value = {}
        for child in node.childNodes:

            # handle CDATA text section
            if child.nodeType == child.CDATA_SECTION_NODE:
                return {child.parentNode.nodeName: child.nodeValue}

            d = _xml_node_to_dict(child, repeats)
            if d is None:
                continue
            child_name = child.nodeName
            child_xpath = xpath_from_xml_node(child)
            assert list(d) == [child_name]
            node_type = dict
            # check if name is in list of repeats and make it a list if so
            if child_xpath in repeats:
                node_type = list

            if node_type == dict:
                if child_name not in value:
                    value[child_name] = d[child_name]
                else:
                    # Duplicate Ona solution when repeating group is not present,
                    # but some nodes are still making references to it.
                    # Ref: https://github.com/onaio/kobo.apps.open_rosa_server/commit/7d65fd30348b2f9c6ed6379c7bf79a523cc5750d
                    node_value = value[child_name]
                    # 1. check if the node values is a list
                    if not isinstance(node_value, list):
                        # if not a list, create one
                        value[child_name] = [node_value]
                    # 2. parse the node
                    d = _xml_node_to_dict(child, repeats)
                    # 3. aggregate
                    value[child_name].append(d[child_name])
            else:
                if child_name not in value:
                    value[child_name] = [d[child_name]]
                else:
                    value[child_name].append(d[child_name])
        if value == {}:
            return None
        else:
            return {node.nodeName: value}


def _flatten_dict(d, prefix):
    """
    Return a list of XPath, value pairs.
    """
    assert type(d) == dict
    assert type(prefix) == list

    for key, value in d.items():
        new_prefix = prefix + [key]
        if type(value) == dict:
            for pair in _flatten_dict(value, new_prefix):
                yield pair
        elif type(value) == list:
            for i, item in enumerate(value):
                item_prefix = list(new_prefix)  # make a copy
                # note on indexing xpaths: IE5 and later has
                # implemented that [0] should be the first node, but
                # according to the W3C standard it should have been
                # [1]. I'm adding 1 to i to start at 1.
                if i > 0:
                    # hack: removing [1] index to be consistent across
                    # surveys that have a single repitition of the
                    # loop versus mutliple.
                    item_prefix[-1] += '[%s]' % str(i + 1)
                if type(item) == dict:
                    for pair in _flatten_dict(item, item_prefix):
                        yield pair
                else:
                    yield item_prefix, item
        else:
            yield new_prefix, value


def _flatten_dict_nest_repeats(d, prefix):
    """
    Return a list of XPath, value pairs.
    """
    assert type(d) == dict
    assert type(prefix) == list

    for key, value in d.items():
        new_prefix = prefix + [key]
        if type(value) == dict:
            for pair in _flatten_dict_nest_repeats(value, new_prefix):
                yield pair
        elif type(value) == list:
            repeats = []
            for i, item in enumerate(value):
                item_prefix = list(new_prefix)  # make a copy
                if type(item) == dict:
                    repeat = {}
                    for path, value in \
                            _flatten_dict_nest_repeats(item, item_prefix):
                        # TODO: this only considers the first level of repeats
                        repeat.update({'/'.join(path[1:]): value})
                    repeats.append(repeat)
                else:
                    repeats.append({'/'.join(item_prefix[1:]): item})
            yield new_prefix, repeats
        else:
            yield new_prefix, value


def _gather_parent_node_list(node):
    node_names = []
    # also check for grand-parent node to skip document element
    if node.parentNode and node.parentNode.parentNode:
        node_names.extend(_gather_parent_node_list(node.parentNode))
    node_names.extend([node.nodeName])
    return node_names


def xpath_from_xml_node(node):
    node_names = _gather_parent_node_list(node)
    return '/'.join(node_names[1:])


def _get_all_attributes(node):
    """
    Go through an XML document returning all the attributes we see.
    """
    if hasattr(node, 'hasAttributes') and node.hasAttributes():
        for key in node.attributes.keys():
            yield key, node.getAttribute(key)
    for child in node.childNodes:
        for pair in _get_all_attributes(child):
            yield pair


class XFormInstanceParser:

    def __init__(self, xml_str, data_dictionary):
        self.dd = data_dictionary
        # The two following variables need to be initialized in the constructor, in case parsing fails.
        self._flat_dict = {}
        self._attributes = {}
        try:
            self.parse(xml_str)
        except Exception as e:
            logging.error(
                f"Failed to parse instance '{xml_str}'", exc_info=True
            )
            # `self.parse()` has been wrapped in to try/except but it makes the
            # exception silently ignored.
            # `logger_tool.py::safe_create_instance()` needs the exception
            # to return the correct HTTP code
            six.reraise(*sys.exc_info())

    def parse(self, xml_str):
        self._xml_obj = clean_and_parse_xml(xml_str)
        self._root_node = self._xml_obj.documentElement
        repeats = [
            e.get_abbreviated_xpath()
            for e in self.dd.get_survey_elements_of_type('repeat')
        ]
        self._dict = _xml_node_to_dict(self._root_node, repeats)
        if self._dict is None:
            raise InstanceEmptyError
        for path, value in _flatten_dict_nest_repeats(self._dict, []):
            self._flat_dict['/'.join(path[1:])] = value
        self._set_attributes()

    def get_root_node(self):
        return self._root_node

    def get_root_node_name(self):
        return self._root_node.nodeName

    def get(self, abbreviated_xpath):
        return self.to_flat_dict()[abbreviated_xpath]

    def to_dict(self):
        return self._dict

    def to_flat_dict(self):
        return self._flat_dict

    def get_attributes(self):
        return self._attributes

    def _set_attributes(self):
        all_attributes = list(_get_all_attributes(self._root_node))
        for key, value in all_attributes:
            # commented since enketo forms may have the template attribute in
            # multiple xml tags and I dont see the harm in overiding
            # attributes at this point
            try:
                assert key not in self._attributes
            except AssertionError:
                logging.debug(
                    f'Skipping duplicate attribute: {key} with value {value}'
                )
            else:
                self._attributes[key] = value

    def get_xform_id_string(self):
        return self._attributes.get('id')

    def get_flat_dict_with_attributes(self):
        result = self.to_flat_dict().copy()
        result[XFORM_ID_STRING] = self.get_xform_id_string()
        return result


def xform_instance_to_dict(xml_str, data_dictionary):
    parser = XFormInstanceParser(xml_str, data_dictionary)
    return parser.to_dict()


def xform_instance_to_flat_dict(xml_str, data_dictionary):
    parser = XFormInstanceParser(xml_str, data_dictionary)
    return parser.to_flat_dict()


def parse_xform_instance(xml_str, data_dictionary):
    parser = XFormInstanceParser(xml_str, data_dictionary)
    return parser.get_flat_dict_with_attributes()


def get_xform_media_question_xpaths(
    xform: 'kobo.apps.openrosa.apps.logger.models.XForm',
) -> list:
    parser = XFormInstanceParser(xform.xml, xform.data_dictionary(use_cache=True))
    all_attributes = _get_all_attributes(parser.get_root_node())
    media_field_xpaths = []
    # This code expects that the attributes from Enketo Express are **always**
    # sent in the same order.
    # For example:
    #   <upload mediatype="application/*" ref="/azx11113333/Question_Name"/>
    # `ref` attribute should always come right after `mediatype`
    for (key, value) in all_attributes:
        if key.lower() == 'mediatype':
            try:
                next_attribute = next(all_attributes)
            except StopIteration:
                logging.error(
                    f'`ref` attribute seems to be missing in {xform.xml}',
                    exc_info=True,
                )
                continue

            next_attribute_key, next_attribute_value = next_attribute
            try:
                assert next_attribute_key.lower() == 'ref'
            except AssertionError:
                logging.error(
                    f'`ref` should come after `mediatype:{value}` in {xform.xml}',
                    exc_info=True,
                )
                continue

            # We are returning XPaths, leading slash should be removed
            media_field_xpaths.append(next_attribute_value[1:])

    return media_field_xpaths
