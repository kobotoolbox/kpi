# -*- coding: utf-8 -*-
from __future__ import (unicode_literals, print_function,
                        absolute_import, division)

from django.db.models import Q

# todo: use the real one
DEFAULT_FIELD_NAME = str('PLACEHOLDER_FIELD')

TEST_QUERY = '(a:a OR b:b AND c:c) AND d:d OR (snakes:� AND NOT alphabet:�soup)'

import grammar
class Actions(object):

  def __init__(self, model):
    self.model = model
  def process_value(self, field, value): #thx
    return value
    #return self.model._meta.get_field(field).to_python(value)

  def query(self, text, a, b, elements):
    exp = elements[1]
    if hasattr(exp, 'text') and exp.text == '':
      # HANDLE THE EMPTY QUERY CASE
      return 'EMPTY'
    else:
      #fallthrough
      return exp
  def orexp(self, text, a, b, elements):
    # fallthrough if singular
    if elements[1].text == '':
      return elements[0]
    # else, combine full sequence of ORs into flattened expression
    else:
      # Start with the first Q object
      orgroup = elements[0]
      # Loop through the repeated clauses and OR the subexpressions.
      for clause in elements[1].elements:
        orgroup |= clause.expr
      return orgroup
  def andexp(self, text, a, b, elements):
    # fallthrough if singular
    if elements[1].text == '':  # gotta make sure this is working
      return elements[0]
    # else, combine full sequence of ANDs into flattened expression
    else:
      # Start with the first Q object
      andgroup = elements[0]
      # Loop through the repeated clauses and AND the subexpressions.
      for clause in elements[1].elements:
        andgroup &= clause.expr
      return andgroup
  def parenexp(self, text, a, b, elements):
    # fallthrough to subexpression
    exp = elements[2]
    return exp
  def notexp(self, text, a, b, elements):
    # negate subexpression (Q object)
    exp = elements[2]
    return ~exp
  def term(self, text, a, b, elements):
    if elements[0].text == '':
      # A search term by itself without a specified field
      field = DEFAULT_FIELD_NAME
      value = elements[1]
      # Make the value the right type, based on the model's default field
      value = self.process_value(field, value)
      return Q(**{field: value})
    else:
      # A field+colon, and a value [[field,':'],value]
      field = elements[0].elements[0]
      value = elements[1]
      # Make the value the right type, based on the model
      value = self.process_value(field, value)
      return Q(**{field: value})
  def word(self, text, a, b, elements):
    return text[a:b]
  def string(self, text, a, b, elements):
    return text[a+1:b-1]
  def name(self, text, a, b, elements):
    return text[a:b]  

result = grammar.parse(TEST_QUERY, actions=Actions(None))
print(result)
