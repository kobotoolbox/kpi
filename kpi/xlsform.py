# import json

# class InMemoryXlsform:
#     def __init__(self, contents=[], **settings):
#         self._rows = contents
#         self.settings = settings

#     @classmethod
#     def _parse_req(kls, req_data):
#         body = json.loads(req_data['body'])
#         settings = req_data['settings'] or {}
#         return kls(body['survey'], **settings)

#     def _req_data(self):
#         obj = { 'body': self.to_ss_json(), }
#         if self.settings:
#             obj['settings'] = json.dumps(self.settings)
#         return obj

#     def to_ss_structure(self, **options):
#         obj = { 'survey': self._rows }
#         if 'include_settings' in options and options['include_settings']:
#             obj['settings'] = self.settings
#         return obj

#     def to_ss_json(self, **options):
#         return json.dumps(self.to_ss_structure(), options)
