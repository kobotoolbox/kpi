# coding: utf-8
import requests
from django.http import HttpRequest
from django.test import LiveServerTestCase
from django.core.files.base import ContentFile
from django.template import Template, RequestContext

from hub.models import ConfigurationFile

sample_svg = b'''<svg xmlns="http://www.w3.org/2000/svg"
xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 420 666">
<path style="fill:#000000" d="M 0,665.24357 C 19.10304,616.60207
43.791193,570.34321 65.172372,522.7213 78.325582,455.25301 90.425024,387.52616
100.58208,319.54476 89.506829,246.93526 70.924961,175.41726 60.263367,102.84929
c 6.448642,-33.336305 54.294763,-22.565335 53.981613,9.04173 15.51968,44.97277
29.70026,90.6276 45.65686,135.30691 11.98222,-75.58598 19.93058,-152.342415
31.05565,-228.257025 14.34156,-40.2951 62.41932,-5.99642 48.44404,27.63354
0.53151,60.349135 -2.57688,120.691845 -1.455,181.016975 30.68812,-67.31916
60.08049,-135.259515 90.46186,-202.696445 16.11166,-26.6501099
56.21852,-5.47013 45.07125,23.0502 -19.89904,70.467215 -44.30425,139.598735
-66.47907,209.378755 27.14657,7.07146 56.59732,3.3067 84.24085,9.12963
15.07856,19.60983 20.2853,46.90273 26.52522,70.99623 -4.36708,28.28218
-21.10586,56.17493 -4.52364,85.12626 13.56298,26.71219 1.53491,52.19756
-14.79059,74.23503 -12.8883,19.74086 -23.52246,42.00163 -37.69397,60.44874
-29.31395,15.42525 -60.77345,26.58542 -89.89936,42.18107 -11.99212,20.76168
-18.63422,44.06028 -27.46183,66.27218 C 162.26979,665.53547 81.093672,666.73167
0,665.24357 Z M 358.79285,484.53058 c -1.99045,-23.007 -24.35389,-51.02823
-15.26566,-71.12967 13.86466,-11.88804 41.78984,-27.2636 47.09169,-37.45776
-21.92238,-0.67214 -43.85866,-0.52585 -65.7884,-0.71726 -7.03493,-21.35839
-13.21011,-43.0338 -21.25637,-64.03392 -7.82707,21.07306 -14.14987,42.67645
-21.15813,64.03392 -22.82917,0.29115 -45.69013,-0.18133 -68.49139,1.00625
13.7288,18.47777 52.26829,28.62732 48.73797,52.12181 -4.18322,16.08485
-15.63905,38.87021 -15.74937,51.59085 22.60729,-6.84416 45.94394,-46.50398
68.43085,-25.52395 14.36384,9.84914 28.99846,22.33594 43.44881,30.10973 z"
/></svg>'''


class ConfigurationFileTestCase(LiveServerTestCase):

    def setUp(self):
        cfg_file = ConfigurationFile()
        cfg_file.slug = cfg_file.LOGO
        # FileField.save() also saves the model instance
        cfg_file.content.save("sample.svg", ContentFile(sample_svg))
        self.cfg_file = cfg_file

    def tearDown(self):
        self.cfg_file.content.delete()

    def test_configurationfile_url(self):
        self.assertTrue(self.cfg_file.url.startswith('/'))
        absolute_url = self.live_server_url + self.cfg_file.url
        response = requests.get(absolute_url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, sample_svg)

    def test_template_context_processor(self):
        context = RequestContext(HttpRequest())  # NB: empty request
        template = Template(
            '{{{{ config.{logo} }}}}'.format(logo=self.cfg_file.LOGO)
        )
        result = template.render(context)
        self.assertEqual(result, self.cfg_file.url)
