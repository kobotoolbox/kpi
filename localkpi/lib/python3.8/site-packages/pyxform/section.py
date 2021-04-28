# -*- coding: utf-8 -*-
"""
Section survey element module.
"""
from pyxform.errors import PyXFormError
from pyxform.external_instance import ExternalInstance
from pyxform.question import SurveyElement
from pyxform.utils import node


class Section(SurveyElement):
    def validate(self):
        super(Section, self).validate()
        for element in self.children:
            element.validate()
        self._validate_uniqueness_of_element_names()

    # there's a stronger test of this when creating the xpath
    # dictionary for a survey.
    def _validate_uniqueness_of_element_names(self):
        element_slugs = []
        for element in self.children:
            if any(element.name.lower() == s.lower() for s in element_slugs):
                raise PyXFormError(
                    "There are more than one survey elements named '%s' "
                    "(case-insensitive) in the section named '%s'."
                    % (element.name.lower(), self.name)
                )
            element_slugs.append(element.name)

    def xml_instance(self, **kwargs):
        """
        Creates an xml representation of the section
        """
        attributes = {}
        attributes.update(kwargs)
        attributes.update(self.get("instance", {}))
        survey = self.get_root()
        # Resolve field references in attributes
        for key, value in attributes.items():
            attributes[key] = survey.insert_xpaths(value, self)
        result = node(self.name, **attributes)
        for child in self.children:
            if child.get("flat"):
                for grandchild in child.xml_instance_array():
                    result.appendChild(grandchild)
            elif isinstance(child, ExternalInstance):
                continue
            else:
                result.appendChild(child.xml_instance())
        return result

    def xml_instance_array(self):
        """
        This method is used for generating flat instances.
        """
        for child in self.children:
            if child.get("flat"):
                for grandchild in child.xml_instance_array():
                    yield grandchild
            else:
                yield child.xml_instance()

    def xml_control(self):
        """
        Ideally, we'll have groups up and rolling soon, but for now
        let's just yield controls from all the children of this section
        """
        for e in self.children:
            control = e.xml_control()
            if control is not None:
                yield control


class RepeatingSection(Section):
    def xml_control(self):
        """
        <group>
        <label>Fav Color</label>
        <repeat nodeset="fav-color">
          <select1 ref=".">
            <label ref="jr:itext('fav')" />
            <item><label ref="jr:itext('red')" /><value>red</value></item>
            <item><label ref="jr:itext('green')" /><value>green</value></item>
            <item><label ref="jr:itext('blue')" /><value>blue</value></item>
          </select1>
        </repeat>
        </group>
        """
        control_dict = self.control.copy()
        survey = self.get_root()
        # Resolve field references in attributes
        for key, value in control_dict.items():
            control_dict[key] = survey.insert_xpaths(value, self)
        repeat_node = node("repeat", nodeset=self.get_xpath(), **control_dict)

        for n in Section.xml_control(self):
            repeat_node.appendChild(n)

        label = self.xml_label()
        if label:
            return node("group", self.xml_label(), repeat_node, ref=self.get_xpath())
        return node("group", repeat_node, ref=self.get_xpath(), **self.control)

    # I'm anal about matching function signatures when overriding a function,
    # but there's no reason for kwargs to be an argument
    def xml_instance(self, **kwargs):
        kwargs = {"jr:template": ""}  # It might make more sense to add this
        #                               as a child on initialization

        return super(RepeatingSection, self).xml_instance(**kwargs)


class GroupedSection(Section):
    # I think this might be a better place for the table-list stuff, however it
    # doesn't allow for as good of validation as putting it in xls2json
    # def __init__(self, **kwargs):
    #        control = kwargs.get(u"control")
    #        if control:
    #            appearance = control.get(u"appearance")
    #            if appearance is u"table-list":
    #                print "HI"
    #                control[u"appearance"] = "field-list"
    #                kwargs["children"].insert(0, kwargs["children"][0])
    #        super(GroupedSection, self).__init__(kwargs)

    def xml_control(self):
        control_dict = self.control

        if control_dict.get("bodyless"):
            return None

        children = []
        attributes = {}
        attributes.update(self.control)

        survey = self.get_root()

        # Resolve field references in attributes
        for key, value in attributes.items():
            attributes[key] = survey.insert_xpaths(value, self)

        if not self.get("flat"):
            attributes["ref"] = self.get_xpath()

        if "label" in self and len(self["label"]) > 0:
            children.append(self.xml_label())
        for n in Section.xml_control(self):
            children.append(n)

        if "appearance" in control_dict:
            attributes["appearance"] = control_dict["appearance"]

        if "intent" in control_dict:
            survey = self.get_root()
            attributes["intent"] = survey.insert_xpaths(control_dict["intent"], self)

        return node("group", *children, **attributes)

    def to_json_dict(self):
        # This is quite hacky, might want to think about a smart way
        # to approach this problem.
        result = super(GroupedSection, self).to_json_dict()
        result["type"] = "group"
        return result
