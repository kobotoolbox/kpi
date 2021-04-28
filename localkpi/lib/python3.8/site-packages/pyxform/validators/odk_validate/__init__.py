# -*- coding: utf-8 -*-
"""
odk_validate.py
A python wrapper around ODK Validate
"""
from __future__ import print_function

import logging
import os
import re
import sys

from pyxform.validators.error_cleaner import ErrorCleaner
from pyxform.validators.util import (
    XFORM_SPEC_PATH,
    check_readable,
    decode_stream,
    run_popen_with_timeout,
)

CURRENT_DIRECTORY = os.path.dirname(os.path.realpath(__file__))
ODK_VALIDATE_PATH = os.path.join(CURRENT_DIRECTORY, "bin", "ODK_Validate.jar")


class ODKValidateError(Exception):
    """ODK Validation exception error."""

    pass


def install_exists():
    """Returns True if ODK_VALIDATE_PATH exists."""
    return os.path.exists(ODK_VALIDATE_PATH)


def _call_validator(path_to_xform, bin_file_path=ODK_VALIDATE_PATH):
    return run_popen_with_timeout(
        ["java", "-Djava.awt.headless=true", "-jar", bin_file_path, path_to_xform], 100
    )


def install_ok(bin_file_path=ODK_VALIDATE_PATH):
    """
    Check if ODK Validate functions as expected.
    """
    check_readable(file_path=XFORM_SPEC_PATH)
    return_code, _, _, _ = _call_validator(
        path_to_xform=XFORM_SPEC_PATH, bin_file_path=bin_file_path
    )
    if return_code == 1:
        return False

    return True


def check_java_version():
    """Check java version is greater than or equal to java 8.

    Raises EnvironmentError exception if java version is less than java 8.
    """
    try:
        stderr = str(
            run_popen_with_timeout(
                ["java", "-Djava.awt.headless=true", "-version"], 100
            )[3]
        )
    except OSError as os_error:
        stderr = str(os_error)
    # convert string to unicode for python2
    if sys.version_info.major < 3:
        stderr = stderr.strip().decode("utf-8")
    if "java version" not in stderr and "openjdk version" not in stderr:
        raise EnvironmentError("pyxform odk validate dependency: java not found")
    # extract version number from version string
    java_version_str = stderr.split("\n")[0]
    # version number is usually inside double-quotes.
    # Using regex to find that in the string
    java_version = re.findall(r"\"(.+?)\"", java_version_str)[0]
    major, minor, _ = java_version.split(".")
    if not ((int(major) == 1 and int(minor) >= 8) or int(major) >= 8):
        raise EnvironmentError(
            "pyxform odk validate dependency: " "java 8 or newer version not found"
        )


def check_xform(path_to_xform):
    """Run ODK Validate against the XForm in `path_to_xform`.

    Returns an array of warnings if the form is valid.
    Throws an exception if it is not
    """
    # check for available java version
    check_java_version()

    # resultcode indicates validity of the form
    # timeout indicates whether validation ran out of time to complete
    # stdout is not used because it has some warnings that always
    # appear and can be ignored.
    # stderr is treated as a warning if the form is valid or an error
    # if it is invalid.
    returncode, timeout, _stdout, stderr = _call_validator(path_to_xform=path_to_xform)
    warnings = []
    stderr = decode_stream(stderr)

    if timeout:
        return ["XForm took to long to completely validate."]
    else:
        if returncode > 0:  # Error invalid
            raise ODKValidateError(
                b"ODK Validate Errors:\n"
                + ErrorCleaner.odk_validate(stderr).encode("utf-8")
            )
        elif returncode == 0:
            if stderr:
                warnings.append("ODK Validate Warnings:\n" + stderr)
        elif returncode < 0:
            return ["Bad return code from ODK Validate."]

    return warnings


if __name__ == "__main__":
    logger = logging.getLogger(__name__)
    logger.addHandler(logging.StreamHandler())
    logger.setLevel(logging.INFO)
    logger.info(__doc__)

    check_xform(sys.argv[1])
