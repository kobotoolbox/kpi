# -*- coding: utf-8 -*-
from __future__ import absolute_import

from lxml import etree
import requests

from ..models.service_definition_interface import ServiceDefinitionInterface


class ServiceDefinition(ServiceDefinitionInterface):
    id = u"xml"

    def _parse_data(self, submission, fields):
        if len(fields) > 0:

            def remove_root_path(path_):
                return path_.replace(root_path, "")

            def process_node(node_):
                """
                Removes node from XML tree if it's not included in subset of fields
                :param node_: lxml.etree._Element
                """
                # Calling remove_node(xml) will first loop through all children of the root element.
                # Then for each child, it will loop through its children if any etc...
                # When all children are processed, it checks whether the node should be removed or not.
                # Trivial case, it's removed. Otherwise, the parent of the current node is tagged as `do_not_delete`.
                # It let us know when the parent is processed, it has to be kept because one of its children matches
                # one of the occurrences of `subset_fields`
                # For example, with `subset_fields = ['question_2', 'question_3'] and this `xml`:
                # <root>
                #   <group>
                #       <question_1>Value1</question1>
                #       <question_2>Value2</question1>
                #   </group>
                #   <question3>Value3</question3>
                # </root>
                #
                #  - `<question_1>` is processed first and removed.
                #  - `<question_2>` is processed second and kept. `<group>` is tagged as `do_not_delete`
                #  - `<group>` is processed, is not part of `subset_field` but it's tagged as `do_not_delete`. It's kept
                #  - `<question_3>` is processed and kept
                #
                # Results:
                # <root>
                #   <group>
                #       <question_2>Value2</question1>
                #   </group>
                #   <question3>Value3</question3>
                # </root>

                for child in node_.getchildren():
                    process_node(child)

                node_path = remove_root_path(tree.getpath(node_))

                # if `node_path` does not match one of the occurrences previously found,
                # it must be removed.
                if not node_path.startswith(matched_nodes_paths_tuple) and node_.get("do_not_delete", False) != "true":
                    node_.getparent().remove(node_)
                elif node_path != "":
                    node_.getparent().set("do_not_delete", "true")

                if node_.attrib.get("do_not_delete"):
                    del node_.attrib["do_not_delete"]

            # Build xml to be parsed
            xml_doc = etree.fromstring(submission)
            tree = etree.ElementTree(xml_doc)
            matched_nodes_paths = []
            root_element = tree.getroot()
            root_path = tree.getpath(root_element)

            # Keep all paths of nodes that match the subset of fields
            for field_ in fields:
                for node in tree.iter(field_):
                    matched_nodes_paths.append(remove_root_path(tree.getpath(node)))

            matched_nodes_paths_tuple = tuple(matched_nodes_paths)

            process_node(root_element)

            return etree.tostring(tree, pretty_print=True)

        return submission

    def _prepare_request_kwargs(self):
        return {
            "headers": {"Content-Type": "application/xml"},
            "data": self._data
        }

