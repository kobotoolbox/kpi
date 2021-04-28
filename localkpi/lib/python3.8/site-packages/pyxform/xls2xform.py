# -*- coding: utf-8 -*-
"""
xls2xform converts properly formatted Excel documents into XForms for
use with ODK Collect.
"""
from __future__ import print_function

import argparse
import json
import logging
import os
from os.path import splitext

from pyxform import builder, xls2json
from pyxform.utils import has_external_choices, sheet_to_csv

logger = logging.getLogger(__name__)
logger.addHandler(logging.StreamHandler())
logger.setLevel(logging.INFO)


def get_xml_path(path):
    """
    Returns the xform file path

    Generates an output path for the xform file from the given
    xlsx input file path.
    """
    return splitext(path)[0] + ".xml"


def xls2xform_convert(
    xlsform_path, xform_path, validate=True, pretty_print=True, enketo=False
):
    warnings = []

    json_survey = xls2json.parse_file_to_json(xlsform_path, warnings=warnings)
    survey = builder.create_survey_element_from_dict(json_survey)
    # Setting validate to false will cause the form not to be processed by
    # ODK Validate.
    # This may be desirable since ODK Validate requires launching a subprocess
    # that runs some java code.
    survey.print_xform_to_file(
        xform_path,
        validate=validate,
        pretty_print=pretty_print,
        warnings=warnings,
        enketo=enketo,
    )
    output_dir = os.path.split(xform_path)[0]
    if has_external_choices(json_survey):
        itemsets_csv = os.path.join(output_dir, "itemsets.csv")
        choices_exported = sheet_to_csv(xlsform_path, itemsets_csv, "external_choices")
        if not choices_exported:
            warnings.append(
                "Could not export itemsets.csv, perhaps the "
                "external choices sheet is missing."
            )
        else:
            logger.info("External choices csv is located at: %s", itemsets_csv)
    return warnings


def _create_parser():
    """
    Parse command line arguments.
    """
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "path_to_XLSForm",
        help="Path to the Excel XSLX file with the XLSForm definition.",
    )
    parser.add_argument("output_path", help="Path to save the output to.", nargs="?")
    parser.add_argument(
        "--json",
        action="store_true",
        help="Capture everything and report in JSON format.",
    )
    parser.add_argument(
        "--skip_validate",
        action="store_false",
        default=True,
        help="Do not run any external validators on the output XForm XML. "
        "Without this flag, ODK Validate is run by default for backwards "
        "compatibility. Internal pyxform checks cannot be skipped.",
    )
    parser.add_argument(
        "--odk_validate",
        action="store_true",
        default=False,
        help="Run the ODK Validate XForm external validator.",
    )
    parser.add_argument(
        "--enketo_validate",
        action="store_true",
        default=False,
        help="Run the Enketo Validate XForm external validator.",
    )
    parser.add_argument(
        "--pretty_print",
        action="store_true",
        default=False,
        help="Print XML forms with collapsed whitespace instead of pretty-printed.",
    )
    return parser


def _validator_args_logic(args):
    """
    Implements logic for how validator arguments work in combination.

    As per: https://github.com/XLSForm/pyxform/pull/167#issuecomment-353382008

    **backwards-compatible**
    `xls2xform.py myform --skip_validate`: no validators
    `xls2xform.py myform`: ODK only

    **new**
    `xls2xform.py myform --enketo_validate`: Enketo only
    `xls2xform.py myform --odk_validate`: ODK only
    `xls2xform.py myform --enketo_validate --odk_validate`: both
    `xls2xform.py myform --enketo_validate --odk_validate --skip_validate`: no validators
    """
    if not args.skip_validate:
        args.odk_validate = False
        args.enketo_validate = False
    elif args.skip_validate and not (args.odk_validate or args.enketo_validate):
        args.odk_validate = True
        args.enketo_validate = False
    return args


def main_cli():
    parser = _create_parser()
    raw_args = parser.parse_args()
    args = _validator_args_logic(args=raw_args)

    # auto generate an output path if one was not given
    if args.output_path is None:
        args.output_path = get_xml_path(args.path_to_XLSForm)

    if args.json:
        # Store everything in a list just in case the user wants to output
        # as a JSON encoded string.
        response = {"code": None, "message": None, "warnings": []}

        try:
            response["warnings"] = xls2xform_convert(
                xlsform_path=args.path_to_XLSForm,
                xform_path=args.output_path,
                validate=args.odk_validate,
                pretty_print=args.pretty_print,
                enketo=args.enketo_validate,
            )

            response["code"] = 100
            response["message"] = "Ok!"

            if response["warnings"]:
                response["code"] = 101
                response["message"] = "Ok with warnings."

        except Exception as e:
            # Catch the exception by default.
            response["code"] = 999
            response["message"] = str(e)

        logger.info(json.dumps(response))
    else:
        warnings = xls2xform_convert(
            xlsform_path=args.path_to_XLSForm,
            xform_path=args.output_path,
            validate=args.odk_validate,
            pretty_print=args.pretty_print,
            enketo=args.enketo_validate,
        )
        if len(warnings) > 0:
            logger.warning("Warnings:")
        for w in warnings:
            logger.warning(w)
        logger.info("Conversion complete!")


if __name__ == "__main__":
    main_cli()
