# -*- coding: utf-8 -*-
"""
AuditTest - test audit question type.
"""
from pyxform.tests_v1.pyxform_test_case import PyxformTestCase


class AuditTest(PyxformTestCase):
    """
    AuditTest - test audit question type.
    """

    def test_audit(self):
        self.assertPyxformXform(
            name="meta_audit",
            md="""
            | survey |        |          |       |
            |        | type   |   name   | label |
            |        | audit  |   audit  |       |
            """,
            xml__contains=[
                "<meta>",
                "<audit/>",
                "</meta>",
                '<bind nodeset="/meta_audit/meta/audit" type="binary"/>',
            ],
        )

    def test_audit_random_name(self):
        self.assertPyxformXform(
            name="meta_audit",
            md="""
            | survey |        |          |       |
            |        | type   |   name   | label |
            |        | audit  |   bobby  |       |
            """,
            errored=True,
            error__contains=["Audits must always be named 'audit.'"],
        )

    def test_audit_blank_name(self):
        self.assertPyxformXform(
            name="meta_audit",
            md="""
            | survey |        |          |       |
            |        | type   |   name   | label |
            |        | audit  |          |       |
            """,
            xml__contains=[
                "<meta>",
                "<audit/>",
                "</meta>",
                '<bind nodeset="/meta_audit/meta/audit" type="binary"/>',
            ],
        )

    def test_audit_blank_parameters(self):
        self.assertPyxformXform(
            name="meta_audit",
            md="""
            | survey |        |          |       |            |
            |        | type   |   name   | label | parameters |
            |        | audit  |          |       |            |
            """,
            xml__contains=[
                "<meta>",
                "<audit/>",
                "</meta>",
                '<bind nodeset="/meta_audit/meta/audit" type="binary"/>',
            ],
        )

    def test_audit_location_required_parameters(self):
        self.assertPyxformXform(
            name="meta_audit",
            md="""
            | survey |        |          |                                             |
            |        | type   |   name   | parameters                                  |
            |        | audit  |   audit  | location-max-age=3, location-min-interval=1 |
            """,
            errored=True,
            error__contains=[
                "'location-priority', 'location-min-interval', and 'location-max-age' are required parameters"
            ],
        )

    def test_audit_location_priority_values(self):
        self.assertPyxformXform(
            name="meta_audit",
            md="""
            | survey |        |          |                                                                    |
            |        | type   |   name   | parameters                                                         |
            |        | audit  |   audit  | location-priority=foo, location-min-interval=1, location-max-age=2 |
            """,
            errored=True,
            error__contains=[
                "location-priority must be set to no-power, low-power, balanced, or high-accuracy"
            ],
        )

    def test_audit_location_max_age_gt_min_interval(self):
        self.assertPyxformXform(
            name="meta_audit",
            md="""
            | survey |        |          |                                                                         |
            |        | type   |   name   | parameters                                                              |
            |        | audit  |   audit  | location-priority=balanced, location-min-interval=2, location-max-age=1 |
            """,
            errored=True,
            error__contains=[
                "location-max-age must be greater than or equal to location-min-interval"
            ],
        )

    def test_audit_location_min_interval_positive(self):
        self.assertPyxformXform(
            name="meta_audit",
            md="""
            | survey |        |          |                                                                          |
            |        | type   |   name   | parameters                                                               |
            |        | audit  |   audit  | location-priority=balanced, location-min-interval=-1, location-max-age=1 |
            """,
            errored=True,
            error__contains=[
                "location-min-interval must be greater than or equal to zero"
            ],
        )

    def test_audit_location(self):
        self.assertPyxformXform(
            name="meta_audit",
            md="""
            | survey |        |          |                                                                            |
            |        | type   |   name   | parameters                                                                 |
            |        | audit  |   audit  | location-priority=balanced, location-min-interval=60, location-max-age=300 |
            """,
            xml__contains=[
                "<meta>",
                "<audit/>",
                "</meta>",
                '<bind nodeset="/meta_audit/meta/audit" type="binary" odk:location-max-age="300" odk:location-min-interval="60" odk:location-priority="balanced"/>',
            ],
        )

    def test_audit_track_changes_true(self):
        self.assertPyxformXform(
            name="meta_audit",
            md="""
            | survey |        |          |                    |
            |        | type   |   name   | parameters         |
            |        | audit  |   audit  | track-changes=true |
            """,
            xml__contains=[
                "<meta>",
                "<audit/>",
                "</meta>",
                '<bind nodeset="/meta_audit/meta/audit" type="binary" odk:track-changes="true"/>',
            ],
        )

    def test_audit_track_changes_false(self):
        self.assertPyxformXform(
            name="meta_audit",
            md="""
            | survey |        |          |                     |
            |        | type   |   name   | parameters          |
            |        | audit  |   audit  | track-changes=false |
            """,
            xml__contains=[
                "<meta>",
                "<audit/>",
                "</meta>",
                '<bind nodeset="/meta_audit/meta/audit" type="binary" odk:track-changes="false"/>',
            ],
        )

    def test_audit_track_changes_foo(self):
        self.assertPyxformXform(
            name="meta_audit",
            md="""
            | survey |        |          |                   |
            |        | type   |   name   | parameters        |
            |        | audit  |   audit  | track-changes=foo |
            """,
            errored=True,
            error__contains=["track-changes must be set to true or false"],
        )

    def test_audit_location_track_changes(self):
        self.assertPyxformXform(
            name="meta_audit",
            md="""
            | survey |        |          |                                                                                                |
            |        | type   |   name   | parameters                                                                                     |
            |        | audit  |   audit  | location-priority=balanced, track-changes=true, location-min-interval=60, location-max-age=300 |
            """,
            xml__contains=[
                "<meta>",
                "<audit/>",
                "</meta>",
                '<bind nodeset="/meta_audit/meta/audit" type="binary" odk:location-max-age="300" odk:location-min-interval="60" odk:location-priority="balanced" odk:track-changes="true"/>',
            ],
        )
