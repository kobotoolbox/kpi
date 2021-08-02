# coding: utf-8
from pygments.lexers.html import XmlLexer
from pygments.formatters.html import HtmlFormatter
from pygments import highlight


class XFormFormatter(HtmlFormatter):
    def _wrap_full(self, inner, outfile):
        yield 0, ''
        yield 0, ''
        for t, line in inner:
            yield t, line
        yield 0, ''
        yield 0, ''


def highlight_xform(xml, **options):
    formatter = XFormFormatter(style='friendly', **options)
    return highlight(xml, XmlLexer(), formatter)
