from django.test import TestCase

from kpi.utils.query_parser.query_parser import QueryParseActions


class TestQueryParseActionsProcessValue(TestCase):
    def setUp(self):
        self.query_parse_actions = QueryParseActions([], 3)

    def test_boolean_values(self):
        # Test various boolean inputs
        test_cases = [
            ('true', True),
            ('True', True),
            (True, True),
            ('false', False),
            ('FALSE', False),
            (False, False),
        ]

        for input_value, expected in test_cases:
            with self.subTest(input_value=input_value):
                result = self.query_parse_actions.process_value('field', input_value)
                self.assertEqual(result, expected)
                self.assertIsInstance(result, bool)

    def test_numeric_values(self):
        # Test integer values
        test_cases = [
            ('42', 42),
            (42, 42),
            ('-17', -17),
            # Test float values
            ('3.14', 3.14),
            (3.14, 3.14),
            ('-2.5', -2.5),
        ]

        for input_value, expected in test_cases:
            with self.subTest(input_value=input_value):
                result = self.query_parse_actions.process_value('field', input_value)
                self.assertEqual(result, expected)
                self.assertIsInstance(result, type(expected))

    def test_string_values(self):
        # Test string values
        test_cases = [
            'hello',
            'Hello World',
            '123abc',
            'special!@#$',
        ]

        for input_value in test_cases:
            with self.subTest(input_value=input_value):
                result = self.query_parse_actions.process_value('field', input_value)
                self.assertEqual(result, input_value)
                self.assertIsInstance(result, str)

    def test_null_value(self):
        # Test null value
        result = self.query_parse_actions.process_value('field', 'null')
        self.assertIsNone(result)
