import os
import re
from xml.dom import Node

from django.db import models
from django.utils.encoding import smart_str
from pyxform import SurveyElementBuilder
from pyxform.builder import create_survey_from_xls
from pyxform.question import Question
from pyxform.section import RepeatingSection
from pyxform.xform2json import create_survey_element_from_xml

from kobo.apps.openrosa.apps.logger.models.xform import XForm
from kobo.apps.openrosa.apps.logger.xform_instance_parser import clean_and_parse_xml
from kobo.apps.openrosa.libs.utils.common_tags import UUID, SUBMISSION_TIME, TAGS, NOTES
from kobo.apps.openrosa.libs.utils.export_tools import (
    question_types_to_exclude,
    DictOrganizer,
)
from kobo.apps.openrosa.libs.utils.model_tools import queryset_iterator, set_uuid
from kpi.constants import DEFAULT_SURVEY_NAME
from kpi.utils.mongo_helper import MongoHelper
from kpi.utils.pyxform_compatibility import NamedBytesIO


class ColumnRename(models.Model):
    xpath = models.CharField(max_length=255, unique=True)
    column_name = models.CharField(max_length=32)

    class Meta:
        app_label = "viewer"

    @classmethod
    def get_dict(cls):
        return dict([(cr.xpath, cr.column_name) for cr in cls.objects.all()])


def upload_to(instance, filename, username=None):
    if instance:
        username = instance.xform.user.username
    return os.path.join(
        username,
        'xls',
        os.path.split(filename)[1]
    )


class DataDictionary(XForm):

    GEODATA_SUFFIXES = [
        'latitude',
        'longitude',
        'altitude',
        'precision'
    ]

    PREFIX_NAME_REGEX = re.compile(r'(?P<prefix>.+/)(?P<name>[^/]+)$')

    class Meta:
        app_label = "viewer"
        proxy = True

    def __init__(self, *args, **kwargs):
        self.instances_for_export = lambda d: d.instances.all()
        super().__init__(*args, **kwargs)

    def set_uuid_in_xml(self):
        """
        Add bind to automatically set UUID node in XML.
        """
        root_node = self.xform_root_node_name

        doc = clean_and_parse_xml(self.xml)
        model_nodes = doc.getElementsByTagName("model")
        if len(model_nodes) != 1:
            for node in model_nodes:
                if hasattr(node, 'parentNode') and node.parentNode.tagName == 'h:head':
                    model_node = node
                    break
        else:
            model_node = model_nodes[0]
        instance_nodes = [node for node in model_node.childNodes if
                          node.nodeType == Node.ELEMENT_NODE and
                          node.tagName.lower() == "instance" and
                          not node.hasAttribute("id")]

        if len(instance_nodes) != 1:
            raise Exception("Multiple instance nodes without the id "
                            "attribute, can't tell which is the main one")

        instance_node = instance_nodes[0]

        # get the first child whose id attribute matches our id_string
        survey_nodes = [
            node
            for node in instance_node.childNodes
            if node.nodeType == Node.ELEMENT_NODE
            and node.tagName == root_node
        ]
        if len(survey_nodes) != 1:
            raise Exception(f'Multiple survey nodes `{root_node}`')

        survey_node = survey_nodes[0]
        formhub_nodes = [
            n
            for n in survey_node.childNodes
            if n.nodeType == Node.ELEMENT_NODE and n.tagName == 'formhub'
        ]

        if len(formhub_nodes) > 1:
            raise Exception(
                "Multiple formhub nodes within main instance node")
        elif len(formhub_nodes) == 1:
            formhub_node = formhub_nodes[0]
        else:
            formhub_node = survey_node.insertBefore(
                doc.createElement("formhub"), survey_node.firstChild)

        uuid_nodes = [node for node in formhub_node.childNodes if
                      node.nodeType == Node.ELEMENT_NODE and
                      node.tagName == "uuid"]

        if len(uuid_nodes) == 0:
            formhub_node.appendChild(doc.createElement("uuid"))
        if len(formhub_nodes) == 0:
            # append the calculate bind node
            calculate_node = doc.createElement("bind")
            calculate_node.setAttribute('nodeset', f'/{root_node}/formhub/uuid')
            calculate_node.setAttribute('type', 'string')
            calculate_node.setAttribute('calculate', f"'{self.uuid}'")
            model_node.appendChild(calculate_node)

        self.xml = smart_str(doc.toprettyxml(indent="  ", encoding='utf-8'))
        # hack
        # http://ronrothman.com/public/leftbraned/xml-dom-minidom-toprettyxml-\
        # and-silly-whitespace/
        text_re = re.compile(r'>\n\s+([^<>\s].*?)\n\s+</', re.DOTALL)
        output_re = re.compile(r'\n.*(<output.*>)\n(  )*')
        pretty_xml = text_re.sub(r'>\g<1></', smart_str(self.xml))
        inline_output = output_re.sub(r'\g<1>', pretty_xml)
        inline_output = re.compile(r'<label>\s*\n*\s*\n*\s*</label>').sub(
            '<label></label>', inline_output)
        self.xml = inline_output

    def add_instances(self):
        if not hasattr(self, "_dict_organizer"):
            _dict_organizer = DictOrganizer()
        obs = []
        for d in self.get_list_of_parsed_instances(flat=False):
            obs.append(_dict_organizer.get_observation_from_dict(d))
        return obs

    def save(self, *args, **kwargs):
        if self.xls:
            xls_io = NamedBytesIO.fromfieldfile(self.xls)
            survey = create_survey_from_xls(
                xls_io, default_name=DEFAULT_SURVEY_NAME
            )
            if survey.name == DEFAULT_SURVEY_NAME:
                survey.name = survey.id_string
            self.json = survey.to_json()
            self.xml = survey.to_xml()
            self.mark_start_time_boolean()
            set_uuid(self)
            self.set_uuid_in_xml()
        super().save(*args, **kwargs)

    def file_name(self):
        return os.path.split(self.xls.name)[-1]

    def get_survey(self):
        if not hasattr(self, "_survey"):
            try:
                builder = SurveyElementBuilder()
                self._survey = \
                    builder.create_survey_element_from_json(self.json)
            except ValueError:
                self._survey = create_survey_element_from_xml(self.xml)
        return self._survey

    survey = property(get_survey)

    def get_survey_elements(self):
        return self.survey.iter_descendants()

    def get_survey_element(self, name_or_xpath):
        element = self.get_element(name_or_xpath)
        name = (element and element['name']) or name_or_xpath

        for field in self.get_survey_elements():
            if field.name == name:
                return field

        return None

    def get_choice_label(self, field, choice_value, lang='English'):
        for choice in field.children:
            if choice.name == choice_value:
                label = choice.label

                if isinstance(label, dict):
                    label = label.get(lang, list(choice.label.values())[0])

                return label

        return choice_value

    def get_mongo_field_names_dict(self):
        """
        Return a dictionary of fieldnames as saved in mongodb with
        corresponding xform field names e.g {"Q1Lg==1": "Q1.1"}
        """
        names = {}
        for elem in self.get_survey_elements():
            names[MongoHelper.encode(str(elem.get_abbreviated_xpath()))] = \
                elem.get_abbreviated_xpath()
        return names

    survey_elements = property(get_survey_elements)

    def geopoint_xpaths(self):
        geo_xpaths = []

        for e in self.get_survey_elements():
            if e.bind.get('type') == 'geopoint':
                geo_xpaths.append(e.get_abbreviated_xpath())

        return geo_xpaths

    def xpath_of_first_geopoint(self):
        geo_xpaths = self.geopoint_xpaths()

        return len(geo_xpaths) > 0 and geo_xpaths[0]

    def has_instances_with_geopoints(self):
        return self.geocoded_submission_count() > 0

    def xpaths(self, prefix='', survey_element=None, result=None,
               repeat_iterations=4):
        """
        Return a list of XPaths for this survey that will be used as
        headers for the csv export.
        """
        if survey_element is None:
            survey_element = self.survey
        elif question_types_to_exclude(survey_element.type):
            return []
        if result is None:
            result = []
        path = '/'.join([prefix, str(survey_element.name)])
        if survey_element.children is not None:
            # add xpaths to result for each child
            indices = [''] if type(survey_element) != RepeatingSection else \
                ['[%d]' % (i + 1) for i in range(repeat_iterations)]
            for i in indices:
                for e in survey_element.children:
                    self.xpaths(path + i, e, result, repeat_iterations)
        if isinstance(survey_element, Question):
            result.append(path)

        # replace the single question column with a column for each
        # item in a select all that apply question.
        if survey_element.bind.get('type') == 'select':
            result.pop()
            for child in survey_element.children:
                result.append('/'.join([path, child.name]))
        elif survey_element.bind.get('type') == 'geopoint':
            result += self.get_additional_geopoint_xpaths(path)

        return result

    @classmethod
    def get_additional_geopoint_xpaths(cls, xpath):
        """
        This will return a list of the additional fields that are
        added per geopoint.  For example, given a field 'group/gps' it will
        return 'group/_gps_(suffix)' for suffix in
        DataDictionary.GEODATA_SUFFIXES
        """
        match = cls.PREFIX_NAME_REGEX.match(xpath)
        prefix = ''
        name = ''
        if match:
            prefix = match.groupdict()['prefix']
            name = match.groupdict()['name']
        else:
            name = xpath
        # NOTE: these must be concatenated and not joined
        return [prefix + '_' + name + '_' + suffix
                for suffix in cls.GEODATA_SUFFIXES]

    def _additional_headers(self):
        return ['_xform_id_string', '_percentage_complete', '_status',
                '_id', '_attachments', '_potential_duplicates']

    def get_headers(self, include_additional_headers=False):
        """
        Return a list of headers for a csv file.
        """
        def shorten(xpath):
            l = xpath.split('/')
            return '/'.join(l[2:])

        header_list = [shorten(xpath) for xpath in self.xpaths()]
        header_list += [UUID, SUBMISSION_TIME, TAGS, NOTES]
        if include_additional_headers:
            header_list += self._additional_headers()
        return header_list

    def get_keys(self):
        def remove_first_index(xpath):
            return re.sub(r'\[1\]', '', xpath)

        return [remove_first_index(header) for header in self.get_headers()]

    def get_element(self, abbreviated_xpath):
        if not hasattr(self, "_survey_elements"):
            self._survey_elements = {}
            for e in self.get_survey_elements():
                self._survey_elements[e.get_abbreviated_xpath()] = e

        def remove_all_indices(xpath):
            return re.sub(r"\[\d+\]", "", xpath)

        clean_xpath = remove_all_indices(abbreviated_xpath)
        return self._survey_elements.get(clean_xpath)

    def get_label(self, abbreviated_xpath):
        e = self.get_element(abbreviated_xpath)
        # TODO: think about multiple language support
        if e:
            return e.label

    def get_xpath_cmp(self):
        if not hasattr(self, "_xpaths"):
            self._xpaths = [e.get_abbreviated_xpath()
                            for e in self.survey_elements]

        def xpath_cmp(x, y):
            # For the moment, we aren't going to worry about repeating
            # nodes.
            new_x = re.sub(r"\[\d+\]", "", x)
            new_y = re.sub(r"\[\d+\]", "", y)
            if new_x == new_y:
                return cmp(x, y)
            if new_x not in self._xpaths and new_y not in self._xpaths:
                return 0
            elif new_x not in self._xpaths:
                return 1
            elif new_y not in self._xpaths:
                return -1
            return cmp(self._xpaths.index(new_x), self._xpaths.index(new_y))

        return xpath_cmp

    def get_variable_name(self, abbreviated_xpath):
        """
        If the abbreviated_xpath has been renamed in
        self.variable_names_json return that new name, otherwise
        return the original abbreviated_xpath.
        """
        if not hasattr(self, "_keys"):
            self._keys = self.get_keys()
        if not hasattr(self, "_headers"):
            self._headers = self.get_headers()

        assert abbreviated_xpath in self._keys, abbreviated_xpath
        i = self._keys.index(abbreviated_xpath)
        header = self._headers[i]

        if not hasattr(self, "_variable_names"):
            self._variable_names = ColumnRename.get_dict()
            assert type(self._variable_names) == dict

        if header in self._variable_names and self._variable_names[header]:
            return self._variable_names[header]
        return header

    def get_list_of_parsed_instances(self, flat=True):
        for i in queryset_iterator(self.instances_for_export(self)):
            # TODO: there is information we want to add in parsed xforms.
            yield i.get_dict(flat=flat)

    def _rename_key(self, d, old_key, new_key):
        assert new_key not in d, d
        d[new_key] = d[old_key]
        del d[old_key]

    def _expand_select_all_that_apply(self, d, key, e):
        if e and e.bind.get("type") == "select":
            options_selected = d[key].split()
            for i, child in enumerate(e.children):
                new_key = child.get_abbreviated_xpath()
                if child.name in options_selected:
                    d[new_key] = True
                else:
                    d[new_key] = False
            del d[key]

    def _expand_geocodes(self, d, key, e):
        if e and e.bind.get("type") == "geopoint":
            geodata = d[key].split()
            for i in range(len(geodata)):
                new_key = "%s_%s" % (key, self.geodata_suffixes[i])
                d[new_key] = geodata[i]

    def get_data_for_excel(self):
        for d in self.get_list_of_parsed_instances():
            for key in d.keys():
                e = self.get_element(key)
                self._expand_select_all_that_apply(d, key, e)
                self._expand_geocodes(d, key, e)
            yield d

    def mark_start_time_boolean(self):
        starttime_substring = 'jr:preloadParams="start"'
        if self.xml.find(starttime_substring) != -1:
            self.has_start_time = True
        else:
            self.has_start_time = False

    def get_survey_elements_of_type(self, element_type):
        return [e for e in self.get_survey_elements()
                if e.type == element_type]
