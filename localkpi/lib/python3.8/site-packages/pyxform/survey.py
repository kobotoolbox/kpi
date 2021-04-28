# -*- coding: utf-8 -*-
"""
Survey module with XForm Survey objects and utility functions.
"""
from __future__ import print_function

import codecs
import os
import re
import tempfile
import xml.etree.ElementTree as ETree
from collections import defaultdict
from datetime import datetime

from pyxform import constants
from pyxform.errors import PyXFormError, ValidationError
from pyxform.external_instance import ExternalInstance
from pyxform.instance import SurveyInstance
from pyxform.instance_info import InstanceInfo
from pyxform.question import Question
from pyxform.section import Section
from pyxform.survey_element import SurveyElement
from pyxform.utils import (
    NSMAP,
    PatchedText,
    basestring,
    get_languages_with_bad_tags,
    node,
    unicode,
)
from pyxform.validators import enketo_validate, odk_validate

try:
    from functools import lru_cache
except ImportError:
    from functools32 import lru_cache


def register_nsmap():
    """Function to register NSMAP namespaces with ETree"""
    for prefix, uri in NSMAP.items():
        prefix_no_xmlns = prefix.replace("xmlns", "").replace(":", "")
        ETree.register_namespace(prefix_no_xmlns, uri)


register_nsmap()


@lru_cache(maxsize=None)
def is_parent_a_repeat(survey, xpath):
    """
    Returns the XPATH of the first repeat of the given xpath in the survey,
    otherwise False will be returned.
    """
    parent_xpath = "/".join(xpath.split("/")[:-1])
    if not parent_xpath:
        return False

    if survey.any_repeat(parent_xpath):
        return parent_xpath

    return is_parent_a_repeat(survey, parent_xpath)


@lru_cache(maxsize=None)
def share_same_repeat_parent(survey, xpath, context_xpath):
    """
    Returns a tuple of the number of steps from the context xpath to the shared
    repeat parent and the xpath to the target xpath from the shared repeat
    parent.

    For example,
        xpath = /data/repeat_a/group_a/name
        context_xpath = /data/repeat_a/group_b/age

        returns (2, '/group_a/name')'
    """
    context_parent = is_parent_a_repeat(survey, context_xpath)
    xpath_parent = is_parent_a_repeat(survey, xpath)
    if context_parent and xpath_parent and xpath_parent in context_parent:
        context_parts = context_xpath[len(xpath_parent) + 1 :].split("/")
        parts = []
        steps = 1
        remainder_xpath = xpath[len(xpath_parent) :]
        xpath_parts = xpath[len(xpath_parent) + 1 :].split("/")
        for index, item in enumerate(context_parts[:-1]):
            try:
                if xpath[len(context_parent) + 1 :].split("/")[index] != item:
                    steps = len(context_parts[index:])
                    parts = xpath_parts[index:]
                    break
                else:
                    parts = remainder_xpath.split("/")[index + 2 :]
            except IndexError:
                steps = len(context_parts[index - 1 :])
                parts = xpath_parts[index - 1 :]
                break

        return (steps, "/" + "/".join(parts) if parts else remainder_xpath)

    return (None, None)


class Survey(Section):
    """
    Survey class - represents the full XForm XML.
    """

    FIELDS = Section.FIELDS.copy()
    FIELDS.update(
        {
            "_xpath": dict,
            "_created": datetime.now,  # This can't be dumped to json
            "title": unicode,
            "id_string": unicode,
            "sms_keyword": unicode,
            "sms_separator": unicode,
            "sms_allow_media": bool,
            "sms_date_format": unicode,
            "sms_datetime_format": unicode,
            "sms_response": unicode,
            constants.COMPACT_PREFIX: unicode,
            constants.COMPACT_DELIMITER: unicode,
            "file_name": unicode,
            "default_language": unicode,
            "_translations": dict,
            "submission_url": unicode,
            "auto_send": unicode,
            "auto_delete": unicode,
            "public_key": unicode,
            "instance_xmlns": unicode,
            "version": unicode,
            "choices": dict,
            "style": unicode,
            "attribute": dict,
            "namespaces": unicode,
        }
    )  # yapf: disable

    def validate(self):
        if self.id_string in [None, "None"]:
            raise PyXFormError("Survey cannot have an empty id_string")
        super(Survey, self).validate()
        self._validate_uniqueness_of_section_names()

    def _validate_uniqueness_of_section_names(self):
        section_names = []
        for element in self.iter_descendants():
            if isinstance(element, Section):
                if element.name in section_names:
                    raise PyXFormError(
                        "There are two sections with the name %s." % element.name
                    )
                section_names.append(element.name)

    def get_nsmap(self):
        """Add additional namespaces"""
        namespaces = getattr(self, constants.NAMESPACES, None)

        if namespaces and isinstance(namespaces, basestring):
            nslist = [
                ns.split("=")
                for ns in namespaces.split()
                if len(ns.split("=")) == 2 and ns.split("=")[0] != ""
            ]
            xmlns = "xmlns:"
            nsmap = NSMAP.copy()
            nsmap.update(
                dict(
                    [
                        (xmlns + k, v.replace('"', "").replace("'", ""))
                        for k, v in nslist
                        if xmlns + k not in nsmap
                    ]
                )
            )
            return nsmap

        return NSMAP

    def xml(self):
        """
        calls necessary preparation methods, then returns the xml.
        """
        self.validate()
        self._setup_xpath_dictionary()
        body_kwargs = {}
        if hasattr(self, constants.STYLE) and getattr(self, constants.STYLE):
            body_kwargs["class"] = getattr(self, constants.STYLE)
        nsmap = self.get_nsmap()

        return node(
            "h:html",
            node("h:head", node("h:title", self.title), self.xml_model()),
            node("h:body", *self.xml_control(), **body_kwargs),
            **nsmap
        )

    @staticmethod
    def _generate_static_instances(list_name, choice_list):
        """
        Generates <instance> elements for static data
        (e.g. choices for select type questions)

        Note that per commit message 0578242 and in xls2json.py R539, an
        instance is only output for select items defined in the choices sheet
        when the item has a choice_filter, and it is that way for backwards
        compatibility.
        """
        instance_element_list = []
        for idx, choice in enumerate(choice_list):
            choice_element_list = []
            # Add a unique id to the choice element in case there is itext
            # it references
            itext_id = "-".join(["static_instance", list_name, str(idx)])
            choice_element_list.append(node("itextId", itext_id))

            for name, value in choice.items():
                if isinstance(value, basestring) and name != "label":
                    choice_element_list.append(node(name, unicode(value)))

            instance_element_list.append(node("item", *choice_element_list))

        return InstanceInfo(
            type="choice",
            context="survey",
            name=list_name,
            src=None,
            instance=node(
                "instance", node("root", *instance_element_list), id=list_name
            ),
        )

    @staticmethod
    def _get_dummy_instance():
        """Instance content required by ODK Validate for select inputs."""
        return node("root", node("item", node("name", "_"), node("label", "_")))

    @staticmethod
    def _generate_external_instances(element):
        if isinstance(element, ExternalInstance):
            name = element["name"]
            src = "jr://file/{}.xml".format(name)
            return InstanceInfo(
                type="external",
                context="[type: {t}, name: {n}]".format(
                    t=element["parent"]["type"], n=element["parent"]["name"]
                ),
                name=name,
                src=src,
                instance=node(
                    "instance", Survey._get_dummy_instance(), id=name, src=src
                ),
            )

        return None

    @staticmethod
    def _validate_external_instances(instances):
        """
        Must have unique names.

        - Duplications could come from across groups; this checks the form.
        - Errors are pooled together into a (hopefully) helpful message.
        """
        seen = {}
        for i in instances:
            element = i.name
            if seen.get(element) is None:
                seen[element] = [i]
            else:
                seen[element].append(i)
        errors = []
        for element, copies in seen.items():
            if len(copies) > 1:
                contexts = ", ".join(x.context for x in copies)
                errors.append(
                    "Instance names must be unique within a form. "
                    "The name '{i}' was found {c} time(s), "
                    "under these contexts: {contexts}".format(
                        i=element, c=len(copies), contexts=contexts
                    )
                )
        if errors:
            raise ValidationError("\n".join(errors))

    @staticmethod
    def _generate_pulldata_instances(element):
        def get_pulldata_functions(element):
            """
            Returns a list of different pulldata(... function strings if
            pulldata function is defined at least once for any of:
            calculate, constraint, readonly, required, relevant

            :param: element (pyxform.survey.Survey):
            """
            functions_present = []
            for formula_name in constants.EXTERNAL_INSTANCES:
                if unicode(element["bind"].get(formula_name)).startswith("pulldata("):
                    functions_present.append(element["bind"][formula_name])
            return functions_present

        formulas = get_pulldata_functions(element)
        if len(formulas) > 0:
            formula_instances = []
            for formula in formulas:
                pieces = formula.split('"') if '"' in formula else formula.split("'")
                if len(pieces) > 1 and pieces[1]:
                    file_id = pieces[1]
                    uri = "jr://file-csv/{}.csv".format(file_id)
                    formula_instances.append(
                        InstanceInfo(
                            type=u"pulldata",
                            context="[type: {t}, name: {n}]".format(
                                t=element[u"parent"][u"type"],
                                n=element[u"parent"][u"name"],
                            ),
                            name=file_id,
                            src=uri,
                            instance=node(
                                "instance",
                                Survey._get_dummy_instance(),
                                id=file_id,
                                src=uri,
                            ),
                        )
                    )
            return formula_instances
        return None

    @staticmethod
    def _generate_from_file_instances(element):
        itemset = element.get("itemset")
        if itemset and (itemset.endswith(".csv") or itemset.endswith(".xml")):
            file_id, ext = os.path.splitext(itemset)
            uri = "jr://%s/%s" % (
                "file" if ext == ".xml" else "file-%s" % ext[1:],
                itemset,
            )
            return InstanceInfo(
                type="file",
                context="[type: {t}, name: {n}]".format(
                    t=element["parent"]["type"], n=element["parent"]["name"]
                ),
                name=file_id,
                src=uri,
                instance=node(
                    "instance", Survey._get_dummy_instance(), id=file_id, src=uri
                ),
            )

        return None

    def _generate_instances(self):
        """
        Get instances from all the different ways that they may be generated.

        An opportunity to validate instances before output to the XML model.

        Instance names used for the id attribute are generated as follows:

        - xml-external: item name value (for type==xml-external)
        - pulldata: first arg to calculation->pulldata()
        - select from file: file name arg to type->itemset
        - choices: list_name (for type==select_*)

        Validation and business rules for output of instances:

        - xml-external item name must be unique across the XForm and the form
          is considered invalid if there is a duplicate name. This differs from
          other item types which allow duplicates if not in the same group.
        - for all instance sources, if the same instance name is encountered,
          the following rules are used to allow re-using instances but prevent
          overwriting conflicting instances:
          - same id, same src URI: skip adding the second (duplicate) instance
          - same id, different src URI: raise an error
          - otherwise: output the instance

        There are two other things currently supported by pyxform that involve
        external files and are not explicitly handled here, but may be relevant
        to future efforts to harmonise / simplify external data workflows:

        - `search` appearance/function: works a lot like pulldata but the csv
          isn't made explicit in the form.
        - `select_one_external`: implicitly relies on a `itemsets.csv` file and
          uses XPath-like expressions for querying.
        """
        instances = []
        for i in self.iter_descendants():
            i_ext = self._generate_external_instances(element=i)
            i_pull = self._generate_pulldata_instances(element=i)
            i_file = self._generate_from_file_instances(element=i)
            for x in [i_ext, i_pull, i_file]:
                if x is not None:
                    instances += x if isinstance(x, list) else [x]

        # Append last so the choice instance is excluded on a name clash.
        for name, value in self.choices.items():
            instances += [
                self._generate_static_instances(list_name=name, choice_list=value)
            ]

        # Check that external instances have unique names.
        if instances:
            ext_only = [x for x in instances if x.type == "external"]
            self._validate_external_instances(instances=ext_only)

        seen = {}
        for i in instances:
            if i.name in seen.keys() and seen[i.name].src != i.src:
                # Instance id exists with different src URI -> error.
                msg = (
                    "The same instance id will be generated for different "
                    "external instance source URIs. Please check the form."
                    " Instance name: '{i}', Existing type: '{e}', "
                    "Existing URI: '{iu}', Duplicate type: '{d}', "
                    "Duplicate URI: '{du}', Duplicate context: '{c}'.".format(
                        i=i.name,
                        iu=seen[i.name].src,
                        e=seen[i.name].type,
                        d=i.type,
                        du=i.src,
                        c=i.context,
                    )
                )
                raise PyXFormError(msg)
            elif i.name in seen.keys() and seen[i.name].src == i.src:
                # Instance id exists with same src URI -> ok, don't duplicate.
                continue
            else:
                # Instance doesn't exist yet -> add it.
                yield i.instance
            seen[i.name] = i

    def xml_model(self):
        """
        Generate the xform <model> element
        """
        self._setup_translations()
        self._setup_media()
        self._add_empty_translations()

        model_children = []
        if self._translations:
            model_children.append(self.itext())
        model_children += [node("instance", self.xml_instance())]
        model_children += list(self._generate_instances())
        model_children += self.xml_bindings()
        model_children += self.xml_actions()

        if self.submission_url or self.public_key or self.auto_send or self.auto_delete:
            submission_attrs = dict()
            if self.submission_url:
                submission_attrs["action"] = self.submission_url
                submission_attrs["method"] = "post"
            if self.public_key:
                submission_attrs["base64RsaPublicKey"] = self.public_key
            if self.auto_send:
                submission_attrs["orx:auto-send"] = self.auto_send
            if self.auto_delete:
                submission_attrs["orx:auto-delete"] = self.auto_delete
            submission_node = node("submission", **submission_attrs)
            model_children.insert(0, submission_node)

        return node("model", *model_children)

    def xml_instance(self, **kwargs):
        result = Section.xml_instance(self, **kwargs)

        # set these first to prevent overwriting id and version
        for key, value in self.attribute.items():
            result.setAttribute(unicode(key), value)

        result.setAttribute("id", self.id_string)

        # add instance xmlns attribute to the instance node
        if self.instance_xmlns:
            result.setAttribute("xmlns", self.instance_xmlns)

        if self.version:
            result.setAttribute("version", self.version)

        if self.prefix:
            result.setAttribute("odk:prefix", self.prefix)

        if self.delimiter:
            result.setAttribute("odk:delimiter", self.delimiter)

        return result

    def _add_to_nested_dict(self, dicty, path, value):
        if len(path) == 1:
            dicty[path[0]] = value
            return
        if path[0] not in dicty:
            dicty[path[0]] = {}
        self._add_to_nested_dict(dicty[path[0]], path[1:], value)

    def _setup_translations(self):
        """
        set up the self._translations dict which will be referenced in the
        setup media and itext functions
        """

        def _setup_choice_translations(name, choice_value, itext_id):
            for media_type_or_language, value in choice_value.items():  # noqa
                if isinstance(value, dict):
                    for language, val in value.items():
                        self._add_to_nested_dict(
                            self._translations,
                            [language, itext_id, media_type_or_language],
                            val,
                        )
                else:
                    if name == "media":
                        self._add_to_nested_dict(
                            self._translations,
                            [self.default_language, itext_id, media_type_or_language],
                            value,
                        )
                    else:
                        self._add_to_nested_dict(
                            self._translations,
                            [media_type_or_language, itext_id, "long"],
                            value,
                        )

        self._translations = defaultdict(dict)  # pylint: disable=W0201
        for element in self.iter_descendants():
            for d in element.get_translations(self.default_language):
                if "guidance_hint" in d["path"]:
                    hint_path = d["path"].replace("guidance_hint", "hint")
                    self._translations[d["lang"]][hint_path] = self._translations[
                        d["lang"]
                    ].get(hint_path, {})
                    self._translations[d["lang"]][hint_path].update(
                        {"guidance": d["text"]}
                    )
                else:
                    self._translations[d["lang"]][d["path"]] = self._translations[
                        d["lang"]
                    ].get(d["path"], {})
                    self._translations[d["lang"]][d["path"]].update({"long": d["text"]})

        # This code sets up translations for choices in filtered selects.
        for list_name, choice_list in self.choices.items():
            for idx, choice in zip(range(len(choice_list)), choice_list):
                for name, choice_value in choice.items():
                    itext_id = "-".join(["static_instance", list_name, str(idx)])
                    if isinstance(choice_value, dict):
                        _setup_choice_translations(name, choice_value, itext_id)
                    elif name == "label":
                        self._add_to_nested_dict(
                            self._translations,
                            [self.default_language, itext_id, "long"],
                            choice_value,
                        )

    def _add_empty_translations(self):
        """
        Adds translations so that every itext element has the same elements \
        accross every language.
        When translations are not provided "-" will be used.
        This disables any of the default_language fallback functionality.
        """
        paths = {}
        for lang, translation in self._translations.items():
            for path, content in translation.items():
                paths[path] = paths.get(path, set()).union(content.keys())

        for lang, translation in self._translations.items():
            for path, content_types in paths.items():
                if path not in self._translations[lang]:
                    self._translations[lang][path] = {}
                for content_type in content_types:
                    if content_type not in self._translations[lang][path]:
                        self._translations[lang][path][content_type] = "-"

    def _setup_media(self):
        """
        Traverse the survey, find all the media, and put in into the \
        _translations data structure which looks like this:
        {language : {element_xpath : {media_type : media}}}
        It matches the xform nesting order.
        """
        if not self._translations:
            self._translations = defaultdict(dict)  # pylint: disable=W0201

        for survey_element in self.iter_descendants():

            translation_key = survey_element.get_xpath() + ":label"
            media_dict = survey_element.get("media")

            # This is probably papering over a real problem, but anyway,
            # in py3, sometimes if an item is on an xform with multiple
            # languages and the item only has media defined in # "default"
            # (e.g. no "image" vs. "image::lang"), the media dict will be
            # nested inside of a dict with key "default", e.g.
            # {"default": {"image": "my_image.jpg"}}
            media_dict_default = media_dict.get("default", None)
            if isinstance(media_dict_default, dict):
                media_dict = media_dict_default

            for media_type, possibly_localized_media in media_dict.items():

                if media_type not in SurveyElement.SUPPORTED_MEDIA:
                    raise PyXFormError("Media type: " + media_type + " not supported")

                if isinstance(possibly_localized_media, dict):
                    # media is localized
                    localized_media = possibly_localized_media
                else:
                    # media is not localized so create a localized version
                    # using the default language
                    localized_media = {self.default_language: possibly_localized_media}

                for language, media in localized_media.items():

                    # Create the required dictionaries in _translations,
                    # then add media as a leaf value:

                    if language not in self._translations:
                        self._translations[language] = {}

                    translations_language = self._translations[language]

                    if translation_key not in translations_language:
                        translations_language[translation_key] = {}

                    translations_trans_key = translations_language[translation_key]

                    if media_type not in translations_trans_key:
                        translations_trans_key[media_type] = {}

                    translations_trans_key[media_type] = media

    def itext(self):
        """
        This function creates the survey's itext nodes from _translations
        @see _setup_media _setup_translations
        itext nodes are localized images/audio/video/text
        @see http://code.google.com/p/opendatakit/wiki/XFormDesignGuidelines
        """
        result = []
        for lang, translation in self._translations.items():
            if lang == self.default_language:
                result.append(node("translation", lang=lang, default="true()"))
            else:
                result.append(node("translation", lang=lang))

            for label_name, content in translation.items():
                itext_nodes = []
                label_type = label_name.partition(":")[-1]

                if not isinstance(content, dict):
                    raise Exception()

                for media_type, media_value in content.items():
                    # There is a odk/jr bug where hints can't have a value
                    # for the "form" attribute.
                    # This is my workaround.
                    if label_type == "hint":
                        value, output_inserted = self.insert_output_values(media_value)

                        if media_type == "guidance":
                            itext_nodes.append(
                                node(
                                    "value",
                                    value,
                                    form="guidance",
                                    toParseString=output_inserted,
                                )
                            )
                        else:
                            itext_nodes.append(
                                node("value", value, toParseString=output_inserted)
                            )
                        continue

                    if media_type == "long":
                        value, output_inserted = self.insert_output_values(media_value)
                        # I'm ignoring long types for now because I don't know
                        # how they are supposed to work.
                        itext_nodes.append(
                            node("value", value, toParseString=output_inserted)
                        )
                    elif media_type == "image":
                        value, output_inserted = self.insert_output_values(media_value)
                        if value != "-":
                            itext_nodes.append(
                                node(
                                    "value",
                                    "jr://images/" + value,
                                    form=media_type,
                                    toParseString=output_inserted,
                                )
                            )
                    else:
                        value, output_inserted = self.insert_output_values(media_value)
                        if value != "-":
                            itext_nodes.append(
                                node(
                                    "value",
                                    "jr://" + media_type + "/" + value,
                                    form=media_type,
                                    toParseString=output_inserted,
                                )
                            )

                result[-1].appendChild(node("text", *itext_nodes, id=label_name))

        return node("itext", *result)

    def date_stamp(self):
        """Returns a date string with the format of %Y_%m_%d."""
        return self._created.strftime("%Y_%m_%d")

    def _to_ugly_xml(self):
        return '<?xml version="1.0"?>' + self.xml().toxml()

    def _to_pretty_xml(self):
        """
        I want the to_xml method to by default validate the xml we are
        producing.
        """
        # Hacky way of pretty printing xml without adding extra white
        # space to text
        # TODO: check out pyxml
        # http://ronrothman.com/public/leftbraned/xml-dom-minidom-toprettyxml-and-silly-whitespace/
        xml_with_linebreaks = self.xml().toprettyxml(indent="  ")
        text_re = re.compile(r"(>)\n\s*(\s[^<>\s].*?)\n\s*(\s</)", re.DOTALL)
        output_re = re.compile(r"\n.*(<output.*>)\n(\s\s)*")
        pretty_xml = text_re.sub(
            lambda m: "".join(m.group(1, 2, 3)), xml_with_linebreaks
        )
        inline_output = output_re.sub(r"\g<1>", pretty_xml)
        return '<?xml version="1.0"?>\n' + inline_output

    def __repr__(self):
        return self.__unicode__()

    def __unicode__(self):
        return "<pyxform.survey.Survey instance at %s>" % hex(id(self))

    def _setup_xpath_dictionary(self):
        self._xpath = {}  # pylint: disable=attribute-defined-outside-init
        for element in self.iter_descendants():
            if isinstance(element, (Question, Section)):
                if element.name in self._xpath:
                    self._xpath[element.name] = None
                else:
                    self._xpath[element.name] = element.get_xpath()

    def _var_repl_function(self, matchobj, context, use_current=False):
        """
        Given a dictionary of xpaths, return a function we can use to
        replace ${varname} with the xpath to varname.
        """
        name = matchobj.group(1)
        intro = (
            "There has been a problem trying to replace ${%s} with the "
            "XPath to the survey element named '%s'." % (name, name)
        )
        if name not in self._xpath:
            raise PyXFormError(intro + " There is no survey element with this name.")
        if self._xpath[name] is None:
            raise PyXFormError(
                intro + " There are multiple survey elements" " with this name."
            )
        if context and not (
            context["type"] == "calculate"
            and "indexed-repeat" in context["bind"]["calculate"]
        ):
            xpath, context_xpath = self._xpath[name], context.get_xpath()
            # share same root i.e repeat_a from /data/repeat_a/...
            if xpath.split("/")[2] == context_xpath.split("/")[2]:
                # if context xpath and target xpath fall under the same
                # repeat use relative xpath referencing.
                steps, ref_path = share_same_repeat_parent(self, xpath, context_xpath)
                if steps:
                    ref_path = ref_path if ref_path.endswith(name) else "/%s" % name
                    prefix = " current()/" if use_current else " "

                    return prefix + "/".join([".."] * steps) + ref_path + " "

        return " " + self._xpath[name] + " "

    def insert_xpaths(self, text, context, use_current=False):
        """
        Replace all instances of ${var} with the xpath to var.
        """

        def _var_repl_function(matchobj):
            return self._var_repl_function(matchobj, context, use_current)

        bracketed_tag = r"\$\{(.*?)\}"

        return re.sub(bracketed_tag, _var_repl_function, unicode(text))

    def _var_repl_output_function(self, matchobj, context):
        """
        A regex substitution function that will replace
        ${varname} with an output element that has the xpath to varname.
        """
        return '<output value="' + self._var_repl_function(matchobj, context) + '" />'

    def insert_output_values(self, text, context=None):
        """
        Replace all the ${variables} in text with xpaths.
        Returns that and a boolean indicating if there were any ${variables}
        present.
        """

        def _var_repl_output_function(matchobj):
            return self._var_repl_output_function(matchobj, context)

        # There was a bug where escaping is completely turned off in labels
        # where variable replacement is used.
        # For exampke, `${name} < 3` causes an error but `< 3` does not.
        # This is my hacky fix for it, which does string escaping prior to
        # variable replacement:
        text_node = PatchedText()
        text_node.data = text
        xml_text = text_node.toxml()

        bracketed_tag = r"\$\{(.*?)\}"
        # need to make sure we have reason to replace
        # since at this point < is &lt,
        # the net effect &lt gets translated again to &amp;lt;
        if unicode(xml_text).find("{") != -1:
            result = re.sub(bracketed_tag, _var_repl_output_function, unicode(xml_text))
            return result, not result == xml_text
        return text, False

    # pylint: disable=too-many-arguments
    def print_xform_to_file(
        self, path=None, validate=True, pretty_print=True, warnings=None, enketo=False
    ):
        """
        Print the xForm to a file and optionally validate it as well by
        throwing exceptions and adding warnings to the warnings array.
        """
        if warnings is None:
            warnings = []
        if not path:
            path = self._print_name + ".xml"
        try:
            with codecs.open(path, mode="w", encoding="utf-8") as file_obj:
                if pretty_print:
                    file_obj.write(self._to_pretty_xml())
                else:
                    file_obj.write(self._to_ugly_xml())
        except Exception as error:
            if os.path.exists(path):
                os.unlink(path)
            raise error
        if validate:
            warnings.extend(odk_validate.check_xform(path))
        if enketo:
            warnings.extend(enketo_validate.check_xform(path))

        # Warn if one or more translation is missing a valid IANA subtag
        translations = self._translations.keys()
        if translations:
            bad_languages = get_languages_with_bad_tags(translations)
            if bad_languages:
                warnings.append(
                    "\tThe following language declarations do not contain "
                    "valid machine-readable codes: "
                    + ", ".join(bad_languages)
                    + ". "
                    + "Learn more: http://xlsform.org#multiple-language-support"
                )

    def to_xml(self, validate=True, pretty_print=True, warnings=None, enketo=False):
        """
        Generates the XForm XML.
        validate is True by default - pass the XForm XML through ODK Validator.
        pretty_print is True by default - formats the XML for readability.
        warnings - if a list is passed it stores all warnings generated
        enketo - pass the XForm XML though Enketo Validator.

        Return XForm XML string.
        """
        # On Windows, NamedTemporaryFile must be opened exclusively.
        # So it must be explicitly created, opened, closed, and removed.
        tmp = tempfile.NamedTemporaryFile(delete=False)
        tmp.close()
        try:
            # this will throw an exception if the xml is not valid
            self.print_xform_to_file(
                path=tmp.name,
                validate=validate,
                pretty_print=pretty_print,
                warnings=warnings,
                enketo=enketo,
            )
        finally:
            if os.path.exists(tmp.name):
                os.remove(tmp.name)
        if pretty_print:
            return self._to_pretty_xml()

        return self._to_ugly_xml()

    def instantiate(self):
        """
        Instantiate as in return a instance of SurveyInstance for collected
        data.
        """
        return SurveyInstance(self)
