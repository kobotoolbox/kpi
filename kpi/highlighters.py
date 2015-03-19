from pygments.lexers.html import XmlLexer
from pygments.formatters.html import HtmlFormatter, CSSFILE_TEMPLATE
from pygments import highlight

HTML_HEADER = '''\
<!doctype html>
<html>
<head>
  <title>%(title)s</title>
  <meta http-equiv="content-type" content="text/html; charset=utf-8">
  <style type="text/css">''' + CSSFILE_TEMPLATE + '''</style>
</head>
<body>
'''

class XFormFormatter(HtmlFormatter):
    def _wrap_full(self, inner, outfile):
        yield 0, (HTML_HEADER %
                  dict(title= self.options.get('title', ''),
                       styledefs= self.get_style_defs('body'),))
        yield 0, self.options.get('header', '')
        for t, line in inner:
            yield t, line
        yield 0, self.options.get('footer', '')
        yield 0, '''
        </body></html>
        '''

def highlight_xform(xml, **options):
    formatter = XFormFormatter(style='friendly', **options)
    return highlight(xml, XmlLexer(), formatter)
