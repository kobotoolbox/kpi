# -*- coding: utf-8 -*-
"""
Test randomize itemsets.
"""
from pyxform.tests_v1.pyxform_test_case import PyxformTestCase


class RandomizeItemsetsTest(PyxformTestCase):
    def test_randomized_select_one(self):
        self.assertPyxformXform(
            name="data",
            md="""
            | survey |                    |         |       |                |
            |        | type               | name    | label | parameters     |
            |        | select_one choices | select  | Select| randomize=true |
            | choices|                    |         |       |                |
            |        | list_name          | name    | label |                |
            |        | choices            | a       | opt_a |                |
            |        | choices            | b       | opt_b |                |

            """,
            xml__contains=[
                "<itemset nodeset=\"randomize(instance('choices')/root/item)\">"
            ],
        )

    def test_randomized_seeded_select_one(self):
        self.assertPyxformXform(
            name="data",
            md="""
            | survey |                    |         |       |                         |
            |        | type               | name    | label | parameters              |
            |        | select_one choices | select  | Select| randomize=true, seed=42 |
            | choices|                    |         |       |                         |
            |        | list_name          | name    | label |                         |
            |        | choices            | a       | opt_a |                         |
            |        | choices            | b       | opt_b |                         |

            """,
            xml__contains=[
                "<itemset nodeset=\"randomize(instance('choices')/root/item, 42)\">"
            ],
        )

    def test_randomized_seeded_select_one_nameset_seed(self):
        self.assertPyxformXform(
            name="data",
            md="""
            | survey |                    |         |       |                              |                                |
            |        | type               | name    | label | parameters                   | calculation                    |
            |        | calculate          | seed    |       |                              | once(decimal-date-time(now())) |
            |        | select_one choices | select  | Select| randomize=true,seed=${seed}  |                                |
            | choices|                    |         |       |                              |                                |
            |        | list_name          | name    | label |                              |                                |
            |        | choices            | a       | opt_a |                              |                                |
            |        | choices            | b       | opt_b |                              |                                |

            """,
            xml__contains=[
                "<itemset nodeset=\"randomize(instance('choices')/root/item, /data/seed)\">"
            ],
        )

    def test_randomized_seeded_filtered_select_one(self):
        self.assertPyxformXform(
            name="data",
            md="""
            | survey |                    |         |       |                         |               |
            |        | type               | name    | label | parameters              | choice_filter |
            |        | select_one choices | select  | Select| randomize=true, seed=42 | name='a'      |
            | choices|                    |         |       |                         |               |
            |        | list_name          | name    | label |                         |               |
            |        | choices            | a       | opt_a |                         |               |
            |        | choices            | b       | opt_b |                         |               |

            """,
            xml__contains=[
                "<itemset nodeset=\"randomize(instance('choices')/root/item[name='a'], 42)\">"
            ],
        )

    def test_randomized_select_multiple(self):
        self.assertPyxformXform(
            name="data",
            md="""
            | survey |                         |         |       |                |
            |        | type                    | name    | label | parameters     |
            |        | select_multiple choices | select  | Select| randomize=true |
            | choices|                         |         |       |                |
            |        | list_name               | name    | label |                |
            |        | choices                 | a       | opt_a |                |
            |        | choices                 | b       | opt_b |                |

            """,
            xml__contains=[
                "<itemset nodeset=\"randomize(instance('choices')/root/item)\">"
            ],
        )

    def test_randomized_seeded_select_multiple(self):
        self.assertPyxformXform(
            name="data",
            md="""
            | survey |                         |         |       |                         |
            |        | type                    | name    | label | parameters              |
            |        | select_multiple choices | select  | Select| randomize=true, seed=42 |
            | choices|                         |         |       |                         |
            |        | list_name               | name    | label |                         |
            |        | choices                 | a       | opt_a |                         |
            |        | choices                 | b       | opt_b |                         |

            """,
            xml__contains=[
                "<itemset nodeset=\"randomize(instance('choices')/root/item, 42)\">"
            ],
        )

    def test_randomized_external_xml_instance(self):
        self.assertPyxformXform(
            name="ecsv",
            md="""
            | survey |                                              |                |                |                |
            |        | type                                         | name           | label          | parameters     |
            |        | select_one_from_file cities.xml              | city           | City           | randomize=true |

            """,
            xml__contains=[
                "<itemset nodeset=\"randomize(instance('cities')/root/item)\">"
            ],
        )

    def test_randomized_select_one_bad_param(self):
        self.assertPyxformXform(
            name="data",
            errored="true",
            md="""
            | survey |                    |         |       |                |
            |        | type               | name    | label | parameters     |
            |        | select_one choices | select  | Select| step=10        |
            | choices|                    |         |       |                |
            |        | list_name          | name    | label |                |
            |        | choices            | a       | opt_a |                |
            |        | choices            | b       | opt_b |                |

            """,
            error__contains=[
                "Accepted parameters are 'randomize, seed': 'step' is an invalid parameter."
            ],
        )

    def test_randomized_select_one_bad_randomize(self):
        self.assertPyxformXform(
            name="data",
            errored="true",
            md="""
            | survey |                    |         |       |                  |
            |        | type               | name    | label | parameters       |
            |        | select_one choices | select  | Select| randomize=ukanga |
            | choices|                    |         |       |                  |
            |        | list_name          | name    | label |                  |
            |        | choices            | a       | opt_a |                  |
            |        | choices            | b       | opt_b |                  |

            """,
            error__contains=[
                "randomize must be set to true or false: 'ukanga' is an invalid value"
            ],
        )

    def test_randomized_select_one_bad_seed(self):
        self.assertPyxformXform(
            name="data",
            errored="true",
            md="""
            | survey |                    |         |       |                             |
            |        | type               | name    | label | parameters                  |
            |        | select_one choices | select  | Select| randomize=true, seed=ukanga |
            | choices|                    |         |       |                             |
            |        | list_name          | name    | label |                             |
            |        | choices            | a       | opt_a |                             |
            |        | choices            | b       | opt_b |                             |

            """,
            error__contains=[
                "seed value must be a number or a reference to another field."
            ],
        )

    def test_randomized_select_one_seed_without_randomize(self):
        self.assertPyxformXform(
            name="data",
            errored="true",
            md="""
            | survey |                    |         |       |                  |
            |        | type               | name    | label | parameters       |
            |        | select_one choices | select  | Select| seed=42          |
            | choices|                    |         |       |                  |
            |        | list_name          | name    | label |                  |
            |        | choices            | a       | opt_a |                  |
            |        | choices            | b       | opt_b |                  |

            """,
            error__contains=["Parameters must include randomize=true to use a seed."],
        )
