from drf_spectacular.utils import OpenApiExample


def get_json_submission_openapi_example():
    return OpenApiExample(
        'JSON submission',
        value={
            'id': 'transportation_2011_07_25',
            'submission': {
                'transport': {
                    'item': 'bicycle',
                    'quantity': 1,
                },
                'meta': {
                    'instanceID': 'uuid:f3d8dc65-91a6-4d0f-9e97-802128083390',
                },
            },
        },
        request_only=True,
        media_type='application/json',
    )


def get_json_response_openapi_example():
    return OpenApiExample(
        'JSON response',
        value={
            'message': 'Successful submission.',
            'formid': 'transportation_2011_07_25',
            'encrypted': False,
            'instanceID': 'uuid:f3d8dc65-91a6-4d0f-9e97-802128083390',
            'submissionDate': '2023-05-24T10:00:00Z',
            'markedAsCompleteDate': '2023-05-24T10:00:01Z',
        },
        response_only=True,
    )


def get_xml_response_openapi_example():
    return OpenApiExample(
        'XML response',
        value="""
<OpenRosaResponse xmlns="http://openrosa.org/http/response">
    <message>Successful submission.</message>
    <submissionMetadata 
        xmlns="http://www.opendatakit.org/xforms" 
        id="transportation_2011_07_25" 
        instanceID="uuid:f3d8dc65-91a6-4d0f-9e97-802128083390" 
        submissionDate="2023-05-24T10:00:00Z" 
        isComplete="true" 
        markedAsCompleteDate="2023-05-24T10:00:01Z"
    /> 
</OpenRosaResponse>
""".strip(),
        response_only=True,
    )
