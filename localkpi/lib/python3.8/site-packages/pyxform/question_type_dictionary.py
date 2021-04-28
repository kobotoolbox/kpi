# -*- coding: utf-8 -*-
"""
XForm survey question type mapping dictionary module.
"""
from pyxform.xls2json import QuestionTypesReader, print_pyobj_to_json


def generate_new_dict():
    """
    This is just here incase there is ever any need to generate the question
    type dictionary from all.xls again.
    It shouldn't be called as part of any application.
    """
    path_to_question_types = (
        "/home/nathan/aptana-workspace/pyxform" "/pyxform/question_types/all.xls"
    )
    json_dict = QuestionTypesReader(path_to_question_types).to_json_dict()
    print_pyobj_to_json(json_dict, "new_quesiton_type_dict.json")


QUESTION_TYPE_DICT = {
    "q picture": {
        "control": {"tag": "upload", "mediatype": "image/*"},
        "bind": {"type": "binary"},
    },
    "photo": {
        "control": {"tag": "upload", "mediatype": "image/*"},
        "bind": {"type": "binary"},
    },
    "add date time prompt": {"control": {"tag": "input"}, "bind": {"type": "dateTime"}},
    "add audio prompt": {
        "control": {"tag": "upload", "mediatype": "audio/*"},
        "bind": {"type": "binary"},
    },
    "q date time": {"control": {"tag": "input"}, "bind": {"type": "dateTime"}},
    "phonenumber": {
        "bind": {
            "jr:preload": "property",
            "type": "string",
            "jr:preloadParams": "phonenumber",
        }
    },
    "get start time": {
        "bind": {
            "jr:preload": "timestamp",
            "type": "dateTime",
            "jr:preloadParams": "start",
        }
    },
    "add select multiple prompt using": {
        "control": {"tag": "select"},
        "bind": {"type": "select"},
    },
    "add note prompt": {
        "control": {"tag": "input"},
        "bind": {"readonly": "true()", "type": "string"},
    },
    "calculate": {"bind": {"type": "string"}},
    "acknowledge": {"control": {"tag": "trigger"}, "bind": {"type": "string"}},
    "location": {"control": {"tag": "input"}, "bind": {"type": "geopoint"}},
    "text": {"control": {"tag": "input"}, "bind": {"type": "string"}},
    "select all that apply from": {
        "control": {"tag": "select"},
        "bind": {"type": "select"},
    },
    "simserial": {
        "bind": {
            "jr:preload": "property",
            "type": "string",
            "jr:preloadParams": "simserial",
        }
    },
    "string": {"control": {"tag": "input"}, "bind": {"type": "string"}},
    "q string": {"control": {"tag": "input"}, "bind": {"type": "string"}},
    "imei": {
        "bind": {
            "jr:preload": "property",
            "type": "string",
            "jr:preloadParams": "deviceid",
        }
    },
    "integer": {"control": {"tag": "input"}, "bind": {"type": "int"}},
    "datetime": {"control": {"tag": "input"}, "bind": {"type": "dateTime"}},
    "q note": {
        "control": {"tag": "input"},
        "bind": {"readonly": "true()", "type": "string"},
    },
    "subscriber id": {
        "bind": {
            "jr:preload": "property",
            "type": "string",
            "jr:preloadParams": "subscriberid",
        }
    },
    "decimal": {"control": {"tag": "input"}, "bind": {"type": "decimal"}},
    "dateTime": {"control": {"tag": "input"}, "bind": {"type": "dateTime"}},
    "q audio": {
        "control": {"tag": "upload", "mediatype": "audio/*"},
        "bind": {"type": "binary"},
    },
    "q geopoint": {"control": {"tag": "input"}, "bind": {"type": "geopoint"}},
    "q geoshape": {"control": {"tag": "input"}, "bind": {"type": "geoshape"}},
    "q geotrace": {"control": {"tag": "input"}, "bind": {"type": "geotrace"}},
    "q image": {
        "control": {"tag": "upload", "mediatype": "image/*"},
        "bind": {"type": "binary"},
    },
    "get today": {
        "bind": {"jr:preload": "date", "type": "date", "jr:preloadParams": "today"}
    },
    "video": {
        "control": {"tag": "upload", "mediatype": "video/*"},
        "bind": {"type": "binary"},
    },
    "q acknowledge": {"control": {"tag": "trigger"}, "bind": {"type": "string"}},
    "add video prompt": {
        "control": {"tag": "upload", "mediatype": "video/*"},
        "bind": {"type": "binary"},
    },
    "number of days in last month": {
        "control": {"tag": "input"},
        "bind": {"type": "int", "constraint": "0 <= . and . <= 31"},
        "hint": "Enter a number 0-31.",
    },
    "get sim id": {
        "bind": {
            "jr:preload": "property",
            "type": "string",
            "jr:preloadParams": "simserial",
        }
    },
    "q location": {"control": {"tag": "input"}, "bind": {"type": "geopoint"}},
    "select one": {"control": {"tag": "select1"}, "bind": {"type": "select1"}},
    "select one external": {"control": {"tag": "input"}, "bind": {"type": "string"}},
    "add image prompt": {
        "control": {"tag": "upload", "mediatype": "image/*"},
        "bind": {"type": "binary"},
    },
    "select all that apply": {"control": {"tag": "select"}, "bind": {"type": "select"}},
    "get end time": {
        "bind": {
            "jr:preload": "timestamp",
            "type": "dateTime",
            "jr:preloadParams": "end",
        }
    },
    "barcode": {"control": {"tag": "input"}, "bind": {"type": "barcode"}},
    "q video": {
        "control": {"tag": "upload", "mediatype": "video/*"},
        "bind": {"type": "binary"},
    },
    "geopoint": {"control": {"tag": "input"}, "bind": {"type": "geopoint"}},
    "geoshape": {"control": {"tag": "input"}, "bind": {"type": "geoshape"}},
    "geotrace": {"control": {"tag": "input"}, "bind": {"type": "geotrace"}},
    "select multiple from": {"control": {"tag": "select"}, "bind": {"type": "select"}},
    "end time": {
        "bind": {
            "jr:preload": "timestamp",
            "type": "dateTime",
            "jr:preloadParams": "end",
        }
    },
    "device id": {
        "bind": {
            "jr:preload": "property",
            "type": "string",
            "jr:preloadParams": "deviceid",
        }
    },
    "subscriberid": {
        "bind": {
            "jr:preload": "property",
            "type": "string",
            "jr:preloadParams": "subscriberid",
        }
    },
    "q barcode": {"control": {"tag": "input"}, "bind": {"type": "barcode"}},
    "q select": {"control": {"tag": "select"}, "bind": {"type": "select"}},
    "select one using": {"control": {"tag": "select1"}, "bind": {"type": "select1"}},
    "rank": {"control": {"tag": "odk:rank"}, "bind": {"type": "odk:rank"}},
    "image": {
        "control": {"tag": "upload", "mediatype": "image/*"},
        "bind": {"type": "binary"},
    },
    "q int": {"control": {"tag": "input"}, "bind": {"type": "int"}},
    "add text prompt": {"control": {"tag": "input"}, "bind": {"type": "string"}},
    "add date prompt": {"control": {"tag": "input"}, "bind": {"type": "date"}},
    "q calculate": {"bind": {"type": "string"}},
    "start": {
        "bind": {
            "jr:preload": "timestamp",
            "type": "dateTime",
            "jr:preloadParams": "start",
        }
    },
    "trigger": {"control": {"tag": "trigger"}},
    "add acknowledge prompt": {
        "control": {"tag": "trigger"},
        "bind": {"type": "string"},
    },
    "percentage": {
        "control": {"tag": "input"},
        "bind": {"type": "int", "constraint": "0 <= . and . <= 100"},
    },
    "get phone number": {
        "bind": {
            "jr:preload": "property",
            "type": "string",
            "jr:preloadParams": "phonenumber",
        }
    },
    "today": {
        "bind": {"jr:preload": "date", "type": "date", "jr:preloadParams": "today"}
    },
    "gps": {"control": {"tag": "input"}, "bind": {"type": "geopoint"}},
    "q date": {"control": {"tag": "input"}, "bind": {"type": "date"}},
    "sim id": {
        "bind": {
            "jr:preload": "property",
            "type": "string",
            "jr:preloadParams": "simserial",
        }
    },
    "add decimal prompt": {"control": {"tag": "input"}, "bind": {"type": "decimal"}},
    "number of days in last six months": {
        "control": {"tag": "input"},
        "bind": {"type": "int", "constraint": "0 <= . and . <= 183"},
        "hint": "Enter a number 0-183.",
    },
    "deviceid": {
        "bind": {
            "jr:preload": "property",
            "type": "string",
            "jr:preloadParams": "deviceid",
        }
    },
    "int": {"control": {"tag": "input"}, "bind": {"type": "int"}},
    "add barcode prompt": {"control": {"tag": "input"}, "bind": {"type": "barcode"}},
    "select multiple using": {"control": {"tag": "select"}, "bind": {"type": "select"}},
    "q decimal": {"control": {"tag": "input"}, "bind": {"type": "decimal"}},
    "end": {
        "bind": {
            "jr:preload": "timestamp",
            "type": "dateTime",
            "jr:preloadParams": "end",
        }
    },
    "add calculate prompt": {"bind": {"type": "string"}},
    "add dateTime prompt": {"control": {"tag": "input"}, "bind": {"type": "dateTime"}},
    "note": {
        "control": {"tag": "input"},
        "bind": {"readonly": "true()", "type": "string"},
    },
    "add location prompt": {"control": {"tag": "input"}, "bind": {"type": "geopoint"}},
    "get subscriber id": {
        "bind": {
            "jr:preload": "property",
            "type": "string",
            "jr:preloadParams": "subscriberid",
        }
    },
    "phone number": {
        "control": {"tag": "input"},
        "bind": {"type": "string", "constraint": "regex(., '^\\d*$')"},
        "hint": "Enter numbers only.",
    },
    "get device id": {
        "bind": {
            "jr:preload": "property",
            "type": "string",
            "jr:preloadParams": "deviceid",
        }
    },
    "add integer prompt": {"control": {"tag": "input"}, "bind": {"type": "int"}},
    "q dateTime": {"control": {"tag": "input"}, "bind": {"type": "dateTime"}},
    "date": {"control": {"tag": "input"}, "bind": {"type": "date"}},
    "q select1": {"control": {"tag": "select1"}, "bind": {"type": "select1"}},
    "start time": {
        "bind": {
            "jr:preload": "timestamp",
            "type": "dateTime",
            "jr:preloadParams": "start",
        }
    },
    "number of days in last year": {
        "control": {"tag": "input"},
        "bind": {"type": "int", "constraint": "0 <= . and . <= 365"},
        "hint": "Enter a number 0-365.",
    },
    "date time": {"control": {"tag": "input"}, "bind": {"type": "dateTime"}},
    "time": {"control": {"tag": "input"}, "bind": {"type": "time"}},
    "audio": {
        "control": {"tag": "upload", "mediatype": "audio/*"},
        "bind": {"type": "binary"},
    },
    "add select one prompt using": {
        "control": {"tag": "select1"},
        "bind": {"type": "select1"},
    },
    "hidden": {"bind": {"type": "string"}},
    "uri:subscriberid": {
        "bind": {
            "jr:preload": "property",
            "type": "string",
            "jr:preloadParams": "uri:subscriberid",
        }
    },
    "uri:phonenumber": {
        "bind": {
            "jr:preload": "property",
            "type": "string",
            "jr:preloadParams": "uri:phonenumber",
        }
    },
    "uri:simserial": {
        "bind": {
            "jr:preload": "property",
            "type": "string",
            "jr:preloadParams": "uri:simserial",
        }
    },
    "uri:deviceid": {
        "bind": {
            "jr:preload": "property",
            "type": "string",
            "jr:preloadParams": "uri:deviceid",
        }
    },
    "username": {
        "bind": {
            "jr:preload": "property",
            "type": "string",
            "jr:preloadParams": "username",
        }
    },
    "uri:username": {
        "bind": {
            "jr:preload": "property",
            "type": "string",
            "jr:preloadParams": "uri:username",
        }
    },
    "email": {
        "bind": {
            "jr:preload": "property",
            "type": "string",
            "jr:preloadParams": "email",
        }
    },
    "uri:email": {
        "bind": {
            "jr:preload": "property",
            "type": "string",
            "jr:preloadParams": "uri:email",
        }
    },
    "osm": {
        "control": {"tag": "upload", "mediatype": "osm/*"},
        "bind": {"type": "binary"},
    },
    "file": {
        "control": {"tag": "upload", "mediatype": "application/*"},
        "bind": {"type": "binary"},
    },
    "add file prompt": {
        "control": {"tag": "upload", "mediatype": "application/*"},
        "bind": {"type": "binary"},
    },
    "range": {"control": {"tag": "range"}, "bind": {"type": "int"}},
    "audit": {"bind": {"type": "binary"}},
    "xml-external": {
        # Only effect is to add an external instance.
    },
    "start-geopoint": {
        "control": {"tag": "action"},
        "bind": {"type": "geopoint"},
        "action": {"name": "odk:setgeopoint", "event": "odk-instance-first-load"},
    },
}
