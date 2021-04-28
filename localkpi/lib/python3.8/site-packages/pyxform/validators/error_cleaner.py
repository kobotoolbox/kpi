# -*- coding: utf-8 -*-
"""
Cleans up error messages from the validators.
"""
import re

from pyxform.utils import unicode


class ErrorCleaner(object):
    """Cleans up raw error messages from XForm validators for end users."""

    @staticmethod
    def _replace_xpath_with_tokens(match):
        strmatch = match.group()
        # eliminate e.g /html/body/select1[@ref=/id_string/elId]/item/value
        # instance('q4')/root/item[...]
        if (
            strmatch.startswith("/html/body")
            or strmatch.startswith("/root/item")
            or strmatch.startswith("/html/head/model/bind")
            or strmatch.endswith("/item/value")
        ):
            return strmatch
        line = match.group().split("/")
        return "${%s}" % line[len(line) - 1]

    @staticmethod
    def _cleanup_errors(error_message):
        pattern = r"(/[a-z0-9\-_]+(?:/[a-z0-9\-_]+)+)"
        error_message = re.sub(
            pattern, ErrorCleaner._replace_xpath_with_tokens, error_message, flags=re.I
        )
        lines = unicode(error_message).strip().splitlines()
        no_dupes = [
            line for i, line in enumerate(lines) if line != lines[i - 1] or i == 0
        ]
        return no_dupes

    @staticmethod
    def _remove_java_content(line):
        # has a java filename (with line number)
        has_java_filename = line.find(".java:") is not -1
        # starts with '    at java class path or method path'
        is_a_java_method = line.find("\tat") is not -1
        if not has_java_filename and not is_a_java_method:
            # remove java.lang.RuntimeException
            if line.startswith("java.lang.RuntimeException: "):
                line = line.replace("java.lang.RuntimeException: ", "")
            # remove org.javarosa.xpath.XPathUnhandledException
            if line.startswith("org.javarosa.xpath.XPathUnhandledException: "):
                line = line.replace("org.javarosa.xpath.XPathUnhandledException: ", "")
            # remove java.lang.NullPointerException
            if line.startswith("java.lang.NullPointerException"):
                return None
            return line

    @staticmethod
    def _join_final(error_messages):
        return "\n".join(line for line in error_messages if line is not None)

    @staticmethod
    def odk_validate(error_message):
        if "Error: Unable to access jarfile" in error_message:
            return error_message  # Avoids tokenising the file path.
        common = ErrorCleaner._cleanup_errors(error_message)
        java_clean = [ErrorCleaner._remove_java_content(i) for i in common]
        final_message = ErrorCleaner._join_final(java_clean)
        return final_message

    @staticmethod
    def enketo_validate(error_message):
        common = ErrorCleaner._cleanup_errors(error_message)
        final_message = ErrorCleaner._join_final(common)
        return final_message
