import uuid
from xml.etree import ElementTree as ET
import kobo.apps.openrosa.libs.utils.logger_tools as lt
from django.test import Client
from django.core.files.uploadedfile import SimpleUploadedFile


a = Asset.objects.get(name='eh')
xform = XForm.objects.get(kpi_asset_uid=a.uid)
uuid_ = uuid.uuid4()
submission_data = {
    'a': 'option_1',
    'meta': {
        'instanceID': f'uuid:{uuid_}'
    },
    'formhub': {'uuid': xform.uuid},
    '_uuid': str(uuid_),
}
xml = ET.fromstring(lt.dict2xform(submission_data,xform.id_string))
xml.tag = a.uid
xml.attrib = {'id': a.uid, 'version': a.latest_version.uid}
kwargs = {'token': '1a369bd19fd696ae889a3aac8f58f22efcf5d5e8'}
data = {'xml_submission_file': SimpleUploadedFile('sub.xml', ET.tostring(xml))}
c = Client()
res = c.post('/key/1a369bd19fd696ae889a3aac8f58f22efcf5d5e8/submission', data)
