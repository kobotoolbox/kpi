# coding: utf-8

from __future__ import (unicode_literals, print_function,
                        absolute_import, division)
import re

from django.test import TestCase

from kpi.utils.sluggify import sluggify, sluggify_label
from kpi.utils.autoname import autoname_fields


class UtilsTestCase(TestCase):
    def test_sluggify(self):
        inp_exps = [
            ['A B C', 'a_b_c'],
            # add examples here...
        ]
        for strs in inp_exps:
            if len(strs) > 2:
                opts = strs[3]
            else:
                opts = {}
            _converted = sluggify(strs[0], opts)
            self.assertEqual(strs[1], _converted)

    def test_sluggify_label(self):
        inp_exps = [
            [["asdf jkl"],              "asdf_jkl"],
            [["asdf", ["asdf"]],        "asdf_001"],
            [["2. asdf"],               "_2_asdf"],
            [["2. asdf", ["_2_asdf"]],  "_2_asdf_001"],
            [["asdf#123"],              "asdf_123"],
            [[" hello "],               "hello"],
            # FIX THIS when we come up with a better way to summarize
            # arabic and cyrillic text
            [["أين السوق؟", ["_", "__001"]],  "__002"]
        ]
        for (inps, expected) in inp_exps:
            inp = inps[0]
            if len(inps) > 1:
                other_names = inps[1]
            else:
                other_names = []
            _converted = sluggify_label(inp, other_names=other_names)
            self.assertEqual(expected, _converted)

    def _assertAutonames(self, names, expected):
        # provide an easy way to check inputs and outputs of autonamer
        arr = []
        for name in names:
            if isinstance(name, dict):
                row = name
            else:
                row = {'type': 'text', 'label': 'ABC {}'.format(len(arr) + 1)}
            if isinstance(name, basestring):
                row['name'] = name
            arr.append(row)
        _named = autoname_fields({'survey': arr})
        self.assertEqual(expected, [r['name'] for r in _named])

    def test_autonamer(self):
        self._assertAutonames(
            names=[
                'abc',
                'def',
                None,
                'jwef',
            ], expected=[
                'abc',
                'def',
                'ABC_3',
                'jwef',
            ])
        self._assertAutonames(
            names=[
                'abc',
                'abc',
                'abc',
            ], expected=[
                'abc',
                'abc_001',
                'abc_002',
            ])
        self._assertAutonames(
            names=[
                'abc',
                'abc_002',
                'abc',
                'abc',
            ], expected=[
                'abc',
                'abc_002',
                'abc_001',
                'abc_003',
            ])
        self._assertAutonames(
            names=[
                'abc',
                {'label': 'abc', 'type': 'text'},
                'abc',
            ], expected=[
                'abc',
                'abc_002',
                'abc_001',
            ])
