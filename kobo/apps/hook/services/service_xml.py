# coding: utf-8
from lxml import etree

from ..models.service_definition_interface import ServiceDefinitionInterface


class ServiceDefinition(ServiceDefinitionInterface):
    id = "xml"

    def _parse_data(self, submission, fields):
        if len(fields) > 0:

            # Build xml to be parsed
            xml_doc = etree.fromstring(submission)
            tree = etree.ElementTree(xml_doc)
            matched_nodes_paths = []
            root_element = tree.getroot()
            root_path = tree.getpath(root_element)

            def remove_root_path(path_):
                return path_.replace(root_path, "")

            def is_group(node_):
                """
                Checks whether `node_` has children that are also xml nodes with children.
                Not text.
                It lets us assume `node_` is a group.

                :param node_: lxml.etree._Element
                :return: bool
                """
                for nested_node_ in node_.iterchildren():
                    if nested_node_.iterchildren():
                        return True
                return False

            def process_node(node_, matched_nodes_paths_):
                """
                Removes node from XML tree if it's not included in subset of fields
                :param node_: lxml.etree._Element
                :param matched_nodes_paths_: tuple. Nodes to keep
                """
                # Calling process_node(xml, `matched_nodes_path`) will first loop through all children of the root element.
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
                    process_node(child, matched_nodes_paths_)

                node_path = remove_root_path(tree.getpath(node_))

                # if `node_path` does not match one of the occurrences previously found,
                # it must be removed.
                if not node_path.startswith(matched_nodes_paths_) and node_.get("do_not_delete") != "true":
                    node_.getparent().remove(node_)
                elif node_path != "":
                    node_.getparent().set("do_not_delete", "true")

                if node_.attrib.get("do_not_delete"):
                    del node_.attrib["do_not_delete"]

            # Keep all paths of nodes that match the subset of fields
            for field_ in fields:
                for node in tree.iter(field_):
                    matched_node_path = remove_root_path(tree.getpath(node))
                    # To make a difference between groups with same beginning of name, we need to add a trailing slash
                    # for later comparison in `process_node`.
                    # e.g `subgroup1` and `subgroup11` both start with `subgroup1` but
                    # `subgroup11/` and # `subgroup1/` don't.
                    if is_group(node):
                        matched_node_path += "/"
                    matched_nodes_paths.append(matched_node_path)

            process_node(root_element, tuple(matched_nodes_paths))

            return etree.tostring(tree, pretty_print=True)

        return submission

    def _prepare_request_kwargs(self):
        return {
            "headers": {"Content-Type": "application/xml"},
            "data": self._data
        }

