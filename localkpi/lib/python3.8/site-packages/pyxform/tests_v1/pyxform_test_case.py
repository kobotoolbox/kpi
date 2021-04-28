# -*- coding: utf-8 -*-
"""
PyxformTestCase base class using markdown to define the XLSForm.
"""
from __future__ import print_function, unicode_literals

import codecs
import logging
import os
import re
import tempfile
import xml.etree.ElementTree as ETree
from unittest import TestCase

from pyxform.builder import create_survey_element_from_dict
from pyxform.errors import PyXFormError
from pyxform.tests_v1.test_utils.md_table import md_table_to_ss_structure
from pyxform.utils import NSMAP, unicode
from pyxform.validators.odk_validate import ODKValidateError, check_xform
from pyxform.xls2json import workbook_to_json

logger = logging.getLogger(__name__)
logger.addHandler(logging.StreamHandler())
logger.setLevel(logging.DEBUG)


class PyxformTestError(Exception):
    pass


class PyxformMarkdown(object):
    """Transform markdown formatted xlsform to a pyxform survey object"""

    def md_to_pyxform_survey(self, md_raw, kwargs=None, autoname=True):
        if kwargs is None:
            kwargs = {}
        if autoname:
            kwargs = self._autoname_inputs(kwargs)
        _md = []
        for line in md_raw.split("\n"):
            if re.match(r"^\s+#", line):
                # ignore lines which start with pound sign
                continue
            elif re.match(r"^(.*)(#[^|]+)$", line):
                # keep everything before the # outside of the last occurrence
                # of |
                _md.append(re.match(r"^(.*)(#[^|]+)$", line).groups()[0].strip())
            else:
                _md.append(line.strip())
        md = "\n".join(_md)

        if kwargs.get("debug"):
            logger.debug(md)

        def list_to_dicts(arr):
            headers = arr[0]

            def _row_to_dict(row):
                out_dict = {}
                for i in range(0, len(row)):
                    col = row[i]
                    if col not in [None, ""]:
                        out_dict[headers[i]] = col
                return out_dict

            return [_row_to_dict(r) for r in arr[1:]]

        sheets = {}
        for sheet, contents in md_table_to_ss_structure(md):
            sheets[sheet] = list_to_dicts(contents)

        return self._ss_structure_to_pyxform_survey(sheets, kwargs)

    @staticmethod
    def _ss_structure_to_pyxform_survey(ss_structure, kwargs):
        # using existing methods from the builder
        imported_survey_json = workbook_to_json(ss_structure)
        # ideally, when all these tests are working, this would be
        # refactored as well
        survey = create_survey_element_from_dict(imported_survey_json)
        survey.name = kwargs.get("name")
        survey.title = kwargs.get("title")
        survey.id_string = kwargs.get("id_string")

        return survey

    @staticmethod
    def _run_odk_validate(xml):
        # On Windows, NamedTemporaryFile must be opened exclusively.
        # So it must be explicitly created, opened, closed, and removed
        tmp = tempfile.NamedTemporaryFile(suffix=".xml", delete=False)
        tmp.close()
        try:
            with codecs.open(tmp.name, mode="w", encoding="utf-8") as fp:
                fp.write(xml)
                fp.close()
            check_xform(tmp.name)
        finally:
            # Clean up the temporary file
            os.remove(tmp.name)
            assert not os.path.isfile(tmp.name)

    @staticmethod
    def _autoname_inputs(kwargs):
        """
        title and name are necessary for surveys, but not always convenient to
        include in test cases, so this will pull a default value
        from the stack trace.
        """
        test_name_root = "pyxform"
        if "name" not in kwargs.keys():
            kwargs["name"] = test_name_root + "_autotestname"
        if "title" not in kwargs.keys():
            kwargs["title"] = test_name_root + "_autotesttitle"
        if "id_string" not in kwargs.keys():
            kwargs["id_string"] = test_name_root + "_autotest_id_string"

        return kwargs


class PyxformTestCase(PyxformMarkdown, TestCase):
    def assertPyxformXform(self, **kwargs):
        """
        PyxformTestCase.assertPyxformXform() named arguments:
        -----------------------------------------------------

        one of these possible survey input types
          * md: (str) a markdown formatted xlsform (easy to read in code)
                [consider a plugin to help with formatting md tables,
                 e.g. https://github.com/vkocubinsky/SublimeTableEditor]
          * ss_structure: (dict) a python dictionary with sheets and their
                contents. best used in cases where testing whitespace and
                cells' type is important
          * survey: (pyxform.survey.Survey) easy for reuse within a test
          # Note: XLS is not implemented at this time. You can use builder to
          create a pyxform Survey object

        one or many of these string "matchers":
          * xml__contains: an array of strings which exist in the
                resulting xml. [xml|model|instance|itext]_excludes are also supported.
          * error__contains: a list of strings which should exist in
                the error
          * odk_validate_error__contains: list of strings; run_odk_validate
                must be set
          * xml__excludes: an array of strings which should not exist in the resulting
               xml. [xml|model|instance|itext]_excludes are also supported.

        optional other parameters passed to pyxform:
          * errored: (bool) if the xlsform is not supposed to compile,
                this must be True
          * name: (str) a valid xml tag to be used as the form name
          * id_string: (str)
          * title: (str)
          * run_odk_validate: (bool) when True, runs ODK Validate process
                Default value = False because it slows down tests
        """
        debug = kwargs.get("debug", False)
        expecting_invalid_survey = kwargs.get("errored", False)
        errors = []
        xml_nodes = {}

        run_odk_validate = kwargs.get("run_odk_validate", False)
        odk_validate_error__contains = kwargs.get("odk_validate_error__contains", [])

        try:
            if "md" in kwargs.keys():
                kwargs = self._autoname_inputs(kwargs)
                survey = self.md_to_pyxform_survey(kwargs.get("md"), kwargs)
            elif "ss_structure" in kwargs.keys():
                kwargs = self._autoname_inputs(kwargs)
                survey = self._ss_structure_to_pyxform_survey(
                    kwargs.get("ss_structure"), kwargs
                )
            else:
                survey = kwargs.get("survey")

            xml = survey._to_pretty_xml()
            root = ETree.fromstring(xml.encode("utf-8"))

            # Ensure all namespaces are present, even if unused
            final_nsmap = NSMAP.copy()
            final_nsmap.update(survey.get_nsmap())
            root.attrib.update(final_nsmap)

            xml_nodes["xml"] = root

            def _pull_xml_node_from_root(element_selector):
                _r = root.findall(
                    ".//n:%s" % element_selector,
                    namespaces={"n": "http://www.w3.org/2002/xforms"},
                )
                if _r:
                    return _r[0]

                return False

            for _n in ["model", "instance", "itext"]:
                xml_nodes[_n] = _pull_xml_node_from_root(_n)
            if debug:
                logger.debug(xml)
            if run_odk_validate:
                self._run_odk_validate(xml=xml)
                if odk_validate_error__contains:
                    raise PyxformTestError("ODKValidateError was not raised")

        except PyXFormError as e:
            survey = False
            errors = [unicode(e)]
            if debug:
                logger.debug("<xml unavailable />")
                logger.debug("ERROR: '%s'", errors[0])
        except ODKValidateError as e:
            if not odk_validate_error__contains:
                raise PyxformTestError(
                    "ODK Validate error was thrown but "
                    + "'odk_validate_error__contains'"
                    + " was empty:"
                    + unicode(e)
                )
            for v_err in odk_validate_error__contains:
                self.assertContains(
                    e.args[0].decode("utf-8"),
                    v_err,
                    msg_prefix="odk_validate_error__contains",
                )
        else:
            survey = True

        if survey:

            def _check(keyword, verb):
                verb_str = "%s__%s" % (keyword, verb)

                bad_kwarg = "%s_%s" % (code, verb)
                if bad_kwarg in kwargs:
                    good_kwarg = "%s__%s" % (code, verb)
                    raise SyntaxError(
                        (
                            "'%s' is not a valid parameter. "
                            "Use double underscores: '%s'"
                        )
                        % (bad_kwarg, good_kwarg)
                    )

                def check_content(content):
                    text_arr = kwargs[verb_str]
                    for i in text_arr:
                        if verb == "contains":
                            self.assertContains(content, i, msg_prefix=keyword)
                        else:
                            self.assertNotContains(content, i, msg_prefix=keyword)

                return verb_str, check_content

            if "body_contains" in kwargs or "body__contains" in kwargs:
                raise SyntaxError(
                    "Invalid parameter: 'body__contains'." "Use 'xml__contains' instead"
                )

            for code in ["xml", "instance", "model", "itext"]:
                for verb in ["contains", "excludes"]:
                    (code__str, checker) = _check(code, verb)
                    if kwargs.get(code__str):
                        checker(
                            ETree.tostring(xml_nodes[code], encoding="utf-8").decode(
                                "utf-8"
                            )
                        )

        if survey is False and expecting_invalid_survey is False:
            raise PyxformTestError(
                "Expected valid survey but compilation failed. "
                "Try correcting the error with 'debug=True', "
                "setting 'errored=True', "
                "and or optionally 'error__contains=[...]'"
                "\nError(s): " + "\n".join(errors)
            )
        elif survey and expecting_invalid_survey:
            raise PyxformTestError("Expected survey to be invalid.")

        if "error__contains" in kwargs:
            joined_error = "\n".join(errors)
            for text in kwargs["error__contains"]:
                self.assertContains(joined_error, text, msg_prefix="error__contains")

    @staticmethod
    def _assert_contains(content, text, msg_prefix):
        if msg_prefix:
            msg_prefix += ": "

        # Account for space in self-closing tags
        text_repr = repr(text)
        content = content.replace(" />", "/>")
        real_count = content.count(text)

        return text_repr, real_count, msg_prefix

    def assertContains(self, content, text, count=None, msg_prefix=""):
        """
        FROM: django source- testcases.py

        Asserts that ``text`` occurs ``count`` times in the content string.
        If ``count`` is None, the count doesn't matter - the assertion is
        true if the text occurs at least once in the content.
        """
        text_repr, real_count, msg_prefix = self._assert_contains(
            content, text, msg_prefix
        )

        if count is not None:
            self.assertEqual(
                real_count,
                count,
                msg_prefix + "Found %d instances of %s in content"
                " (expected %d)" % (real_count, text_repr, count),
            )
        else:
            self.assertTrue(
                real_count != 0, msg_prefix + "Couldn't find %s in content" % text_repr
            )

    def assertNotContains(self, content, text, msg_prefix=""):
        """
        Asserts that a content indicates that some content was retrieved
        successfully, (i.e., the HTTP status code was as expected), and that
        ``text`` doesn't occurs in the content of the content.
        """
        text_repr, real_count, msg_prefix = self._assert_contains(
            content, text, msg_prefix
        )

        self.assertEqual(
            real_count, 0, msg_prefix + "Response should not contain %s" % text_repr
        )
