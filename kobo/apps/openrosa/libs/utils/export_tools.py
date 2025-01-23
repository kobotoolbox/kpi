# coding: utf-8
import json
import os
import re
from datetime import datetime, date, time, timedelta

from bson import json_util
from django.conf import settings
from django.core.files.base import File
from django.core.files.storage import FileSystemStorage
from django.core.files.temp import NamedTemporaryFile
from django.shortcuts import render
from django.utils.text import slugify
from openpyxl.utils.datetime import to_excel, time_to_days, timedelta_to_days
from openpyxl.workbook import Workbook
from pyxform.constants import SELECT_ALL_THAT_APPLY
from pyxform.question import Question
from pyxform.section import Section, RepeatingSection

from kobo.apps.kobo_auth.shortcuts import User
from kobo.apps.openrosa.apps.logger.models import Attachment, Instance, XForm
from kobo.apps.openrosa.apps.viewer.models.export import Export
from kobo.apps.openrosa.libs.utils.viewer_tools import create_attachments_zipfile
from kobo.apps.openrosa.libs.utils.common_tags import (
    ID,
    XFORM_ID_STRING,
    STATUS,
    ATTACHMENTS,
    GEOLOCATION,
    DELETEDAT,
    USERFORM_ID,
    INDEX,
    PARENT_INDEX,
    PARENT_TABLE_NAME,
    SUBMISSION_TIME,
    UUID,
    TAGS,
    NOTES
)
from kpi.deployment_backends.kc_access.storage import (
    default_kobocat_storage as default_storage,
)
from kpi.utils.mongo_helper import MongoHelper

# this is Mongo Collection where we will store the parsed submissions
xform_instances = settings.MONGO_DB.instances

QUESTION_TYPES_TO_EXCLUDE = [
    'note',
]
GEOPOINT_BIND_TYPE = "geopoint"


def to_str(row, key, encode_dates=False, empty_on_none=True):
    val = row.get(key)

    if empty_on_none and val is None:
        return ''

    if encode_dates and isinstance(val, datetime):
        return val.strftime('%Y-%m-%dT%H:%M:%S%z')

    if encode_dates and isinstance(val, date):
        return val.strftime('%Y-%m-%d')

    if isinstance(val, bytes):
        return val.decode()

    if not isinstance(val, str):
        return str(val)

    return val


def question_types_to_exclude(_type):
    return _type in QUESTION_TYPES_TO_EXCLUDE


class DictOrganizer:

    def set_dict_iterator(self, dict_iterator):
        self._dict_iterator = dict_iterator

    # Every section will get its own table
    # I need to think of an easy way to flatten out a dictionary
    # parent name, index, table name, data
    def _build_obs_from_dict(self, d, obs, table_name,
                             parent_table_name, parent_index):
        if table_name not in obs:
            obs[table_name] = []
        this_index = len(obs[table_name])
        obs[table_name].append({
            "_parent_table_name": parent_table_name,
            "_parent_index": parent_index,
        })
        for k, v in d.items():
            if type(v) != dict and type(v) != list:
                assert k not in obs[table_name][-1]
                obs[table_name][-1][k] = v
        obs[table_name][-1]["_index"] = this_index

        for k, v in d.items():
            if type(v) == dict:
                kwargs = {
                    "d": v,
                    "obs": obs,
                    "table_name": k,
                    "parent_table_name": table_name,
                    "parent_index": this_index
                }
                self._build_obs_from_dict(**kwargs)
            if type(v) == list:
                for i, item in enumerate(v):
                    kwargs = {
                        "d": item,
                        "obs": obs,
                        "table_name": k,
                        "parent_table_name": table_name,
                        "parent_index": this_index,
                    }
                    self._build_obs_from_dict(**kwargs)
        return obs

    def get_observation_from_dict(self, d):
        result = {}
        assert len(d.keys()) == 1
        root_name = list(d)[0]
        kwargs = {
            "d": d[root_name],
            "obs": result,
            "table_name": root_name,
            "parent_table_name": "",
            "parent_index": -1,
        }
        self._build_obs_from_dict(**kwargs)
        return result


def dict_to_joined_export(data, index, indices, name):
    """
    Converts a dict into one or more tabular datasets
    """
    output = {}
    # TODO: test for _geolocation and attachment lists
    if isinstance(data, dict):
        for key, val in data.items():
            if isinstance(val, list) and key not in [NOTES, TAGS]:
                output[key] = []
                for child in val:
                    if key not in indices:
                        indices[key] = 0
                    indices[key] += 1
                    child_index = indices[key]
                    new_output = dict_to_joined_export(
                        child, child_index, indices, key)
                    d = {INDEX: child_index, PARENT_INDEX: index,
                         PARENT_TABLE_NAME: name}
                    # iterate over keys within new_output and append to
                    # main output
                    for out_key, out_val in new_output.items():
                        if isinstance(out_val, list):
                            if out_key not in output:
                                output[out_key] = []
                            output[out_key].extend(out_val)
                        else:
                            d.update(out_val)
                    output[key].append(d)
            else:
                if name not in output:
                    output[name] = {}
                if key in [TAGS]:
                    output[name][key] = ",".join(val)
                elif key in [NOTES]:
                    output[name][key] = "\r\n".join(
                        [v['note'] for v in val])
                else:
                    output[name][key] = val

    return output


class ExportBuilder:
    IGNORED_COLUMNS = [
        XFORM_ID_STRING,
        STATUS,
        ATTACHMENTS,
        GEOLOCATION,
        DELETEDAT,  # no longer used but may persist in old submissions
    ]
    # fields we export but are not within the form's structure
    EXTRA_FIELDS = [ID, UUID, SUBMISSION_TIME, INDEX, PARENT_TABLE_NAME,
                    PARENT_INDEX, TAGS, NOTES]
    SPLIT_SELECT_MULTIPLES = True
    BINARY_SELECT_MULTIPLES = False

    # column group delimiters
    GROUP_DELIMITER_SLASH = '/'
    GROUP_DELIMITER_DOT = '.'
    GROUP_DELIMITER = GROUP_DELIMITER_SLASH
    GROUP_DELIMITERS = [GROUP_DELIMITER_SLASH, GROUP_DELIMITER_DOT]
    TYPES_TO_CONVERT = ['int', 'decimal', 'date']  # , 'dateTime']
    CONVERT_FUNCS = {
        'int': lambda x: int(x),
        'decimal': lambda x: float(x),
        'date': lambda x: ExportBuilder.string_to_date_with_xls_validation(x),
        'dateTime': lambda x: datetime.strptime(x[:19], '%Y-%m-%dT%H:%M:%S')
    }

    XLS_SHEET_NAME_MAX_CHARS = 31

    @classmethod
    def string_to_date_with_xls_validation(cls, date_str):
        date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
        try:
            # SharedDate().datetime_to_julian(date_obj)
            # Copy code from v2.0.5. Could not find where SharedDate is in
            # latest version of openpyxl (and if it's useful)
            if isinstance(date_obj, datetime):
                to_excel(date_obj)
            elif isinstance(date_obj, date):
                to_excel(date_obj)
            elif isinstance(date_obj, time):
                time_to_days(date_obj)
            elif isinstance(date_obj, timedelta):
                timedelta_to_days(date_obj)
        except ValueError:
            return date_str
        else:
            return date_obj

    @classmethod
    def format_field_title(cls, abbreviated_xpath, field_delimiter):
        if field_delimiter != '/':
            return field_delimiter.join(abbreviated_xpath.split('/'))
        return abbreviated_xpath

    def set_survey(self, survey):
        # TODO resolve circular import
        from kobo.apps.openrosa.apps.viewer.models.data_dictionary import\
            DataDictionary

        def build_sections(
                current_section, survey_element, sections, select_multiples,
                gps_fields, encoded_fields, field_delimiter='/'):
            for child in survey_element.children:
                current_section_name = current_section['name']
                # if a section, recurs
                if isinstance(child, Section):
                    # if its repeating, build a new section
                    if isinstance(child, RepeatingSection):
                        # section_name in recursive call changes
                        section = {
                            'name': child.get_abbreviated_xpath(),
                            'elements': []}
                        self.sections.append(section)
                        build_sections(
                            section, child, sections, select_multiples,
                            gps_fields, encoded_fields, field_delimiter)
                    else:
                        # its a group, recurs using the same section
                        build_sections(
                            current_section, child, sections, select_multiples,
                            gps_fields, encoded_fields, field_delimiter)
                elif isinstance(child, Question) and child.bind.get("type")\
                        not in QUESTION_TYPES_TO_EXCLUDE:
                    # add to survey_sections
                    if isinstance(child, Question):
                        child_xpath = child.get_abbreviated_xpath()
                        current_section['elements'].append({
                            'title': ExportBuilder.format_field_title(
                                child.get_abbreviated_xpath(),
                                field_delimiter),
                            'xpath': child_xpath,
                            'type': child.bind.get("type")
                        })

                        if MongoHelper.is_attribute_invalid(child_xpath):
                            if current_section_name not in encoded_fields:
                                encoded_fields[current_section_name] = {}
                            encoded_fields[current_section_name].update(
                                {child_xpath: MongoHelper.encode(child_xpath)})

                    # if its a select multiple, make columns out of its choices
                    if child.type == SELECT_ALL_THAT_APPLY\
                            and self.SPLIT_SELECT_MULTIPLES:
                        for c in child.children:
                            _xpath = c.get_abbreviated_xpath()
                            _title = ExportBuilder.format_field_title(
                                _xpath, field_delimiter)
                            choice = {
                                'title': _title,
                                'xpath': _xpath,
                                'type': 'string'
                            }

                            if choice not in current_section['elements']:
                                current_section['elements'].append(choice)
                        _append_xpaths_to_section(
                            current_section_name, select_multiples,
                            child.get_abbreviated_xpath(),
                            [c.get_abbreviated_xpath()
                             for c in child.children])

                    # split gps fields within this section
                    if child.bind.get("type") == GEOPOINT_BIND_TYPE:
                        # add columns for geopoint components
                        xpaths = DataDictionary.get_additional_geopoint_xpaths(
                            child.get_abbreviated_xpath())
                        current_section['elements'].extend(
                            [
                                {
                                    'title': ExportBuilder.format_field_title(
                                        xpath, field_delimiter),
                                    'xpath': xpath,
                                    'type': 'decimal'
                                }
                                for xpath in xpaths
                            ])
                        _append_xpaths_to_section(
                            current_section_name, gps_fields,
                            child.get_abbreviated_xpath(), xpaths)

        def _append_xpaths_to_section(current_section_name, field_list, xpath,
                                      xpaths):
            if current_section_name not in field_list:
                field_list[current_section_name] = {}
            field_list[
                current_section_name][xpath] = xpaths

        self.survey = survey
        self.select_multiples = {}
        self.gps_fields = {}
        self.encoded_fields = {}
        main_section = {'name': survey.name, 'elements': []}
        self.sections = [main_section]
        build_sections(
            main_section, self.survey, self.sections,
            self.select_multiples, self.gps_fields, self.encoded_fields,
            self.GROUP_DELIMITER)

    def section_by_name(self, name):
        matches = [s for s in self.sections if s['name'] == name]
        assert(len(matches) == 1)
        return matches[0]

    @classmethod
    def split_select_multiples(cls, row, select_multiples):
        # for each select_multiple, get the associated data and split it
        for xpath, choices in select_multiples.items():
            # get the data matching this xpath
            data = row.get(xpath)
            selections = []
            if data:
                selections = [
                    '{0}/{1}'.format(
                        xpath, selection) for selection in data.split()]
            if not cls.BINARY_SELECT_MULTIPLES:
                row.update(dict(
                    [(choice, choice in selections if selections else None)
                     for choice in choices]))
            else:
                YES = 1
                NO = 0
                row.update(dict(
                    [(choice, YES if choice in selections else NO)
                     for choice in choices]))
        return row

    @classmethod
    def split_gps_components(cls, row, gps_fields):
        # for each gps_field, get associated data and split it
        for xpath, gps_components in gps_fields.items():
            data = row.get(xpath)
            if data:
                gps_parts = data.split()
                if len(gps_parts) > 0:
                    row.update(zip(gps_components, gps_parts))
        return row

    @classmethod
    def decode_mongo_encoded_fields(cls, row, encoded_fields):
        for xpath, encoded_xpath in encoded_fields.items():
            if row.get(encoded_xpath):
                val = row.pop(encoded_xpath)
                row.update({xpath: val})
        return row

    @classmethod
    def decode_mongo_encoded_section_names(cls, data):
        return dict([(MongoHelper.decode(k), v) for k, v in data.items()])

    @classmethod
    def convert_type(cls, value, data_type):
        """
        Convert data to its native type e.g. string '1' to int 1
        @param value: the string value to convert
        @param data_type: the native data type to convert to
        @return: the converted value
        """
        func = ExportBuilder.CONVERT_FUNCS.get(data_type, lambda x: x)
        try:
            return func(value)
        except ValueError:
            return value

    def pre_process_row(self, row, section):
        """
        Split select multiples, gps and decode . and $
        """
        section_name = section['name']

        # first decode fields so that subsequent lookups
        # have decoded field names
        if section_name in self.encoded_fields:
            row = ExportBuilder.decode_mongo_encoded_fields(
                row, self.encoded_fields[section_name])

        if self.SPLIT_SELECT_MULTIPLES and\
                section_name in self.select_multiples:
            row = ExportBuilder.split_select_multiples(
                row, self.select_multiples[section_name])

        if section_name in self.gps_fields:
            row = ExportBuilder.split_gps_components(
                row, self.gps_fields[section_name])

        # convert to native types
        for elm in section['elements']:
            # only convert if its in our list and its not empty, just to
            # optimize
            value = row.get(elm['xpath'])
            if elm['type'] in ExportBuilder.TYPES_TO_CONVERT\
                    and value is not None and value != '':
                row[elm['xpath']] = ExportBuilder.convert_type(
                    value, elm['type'])

        return row

    @classmethod
    def get_valid_sheet_name(cls, desired_name, existing_names):
        # a sheet name has to be <= 31 characters and not a duplicate of an
        # existing sheet
        # truncate sheet_name to XLSDataFrameBuilder.SHEET_NAME_MAX_CHARS
        new_sheet_name = \
            desired_name[:cls.XLS_SHEET_NAME_MAX_CHARS]

        # make sure its unique within the list
        i = 1
        generated_name = new_sheet_name
        while generated_name in existing_names:
            digit_length = len(str(i))
            allowed_name_len = cls.XLS_SHEET_NAME_MAX_CHARS - \
                digit_length
            # make name the required len
            if len(generated_name) > allowed_name_len:
                generated_name = generated_name[:allowed_name_len]
            generated_name = "{0}{1}".format(generated_name, i)
            i += 1
        return generated_name

    def to_xls_export(self, path, data, *args):
        def write_row(data, work_sheet, fields, work_sheet_titles):
            # update parent_table with the generated sheet's title
            data[PARENT_TABLE_NAME] = work_sheet_titles.get(
                data.get(PARENT_TABLE_NAME))
            work_sheet.append([data.get(f) for f in fields])

        wb = Workbook(write_only=True)
        work_sheets = {}
        # map of section_names to generated_names
        work_sheet_titles = {}
        for section in self.sections:
            section_name = section['name']
            work_sheet_title = ExportBuilder.get_valid_sheet_name(
                "_".join(section_name.split("/")), list(work_sheet_titles.values()))
            work_sheet_titles[section_name] = work_sheet_title
            work_sheets[section_name] = wb.create_sheet(
                title=work_sheet_title)

        # write the headers
        for section in self.sections:
            section_name = section['name']
            headers = [
                element['title'] for element in
                section['elements']] + self.EXTRA_FIELDS
            # get the worksheet
            ws = work_sheets[section_name]
            ws.append(headers)

        index = 1
        indices = {}
        survey_name = self.survey.name
        for d in data:
            joined_export = dict_to_joined_export(
                d, index, indices, survey_name
            )
            output = ExportBuilder.decode_mongo_encoded_section_names(
                joined_export
            )
            # attach meta fields (index, parent_index, parent_table)
            # output has keys for every section
            if survey_name not in output:
                output[survey_name] = {}
            output[survey_name][INDEX] = index
            output[survey_name][PARENT_INDEX] = -1
            for section in self.sections:
                # get data for this section and write to xls
                section_name = section['name']
                fields = [
                    element['xpath'] for element in
                    section['elements']] + self.EXTRA_FIELDS

                ws = work_sheets[section_name]
                # section might not exist within the output, e.g. data was
                # not provided for said repeat - write test to check this
                row = output.get(section_name, None)
                if type(row) == dict:
                    write_row(
                        self.pre_process_row(row, section),
                        ws, fields, work_sheet_titles)
                elif type(row) == list:
                    for child_row in row:
                        write_row(
                            self.pre_process_row(child_row, section),
                            ws, fields, work_sheet_titles)
            index += 1

        wb.save(filename=path)

    def to_flat_csv_export(self, path, data, username, id_string, filter_query):
        # TODO resolve circular import
        from kobo.apps.openrosa.apps.viewer.pandas_mongo_bridge import CSVDataFrameBuilder

        csv_builder = CSVDataFrameBuilder(
            username,
            id_string,
            filter_query,
            self.GROUP_DELIMITER,
            self.SPLIT_SELECT_MULTIPLES,
            self.BINARY_SELECT_MULTIPLES,
        )
        csv_builder.export_to(path)


def dict_to_flat_export(d, parent_index=0):
    pass


def generate_export(export_type, extension, username, id_string,
                    export_id=None, filter_query=None, group_delimiter='/',
                    split_select_multiples=True,
                    binary_select_multiples=False):
    """
    Create appropriate export object given the export type
    """

    export_type_func_map = {
        Export.XLS_EXPORT: 'to_xls_export',
        Export.CSV_EXPORT: 'to_flat_csv_export',
    }

    xform = XForm.objects.get(
        user__username__iexact=username, id_string__exact=id_string)

    # query mongo for the cursor
    records = query_mongo(username, id_string, filter_query)

    export_builder = ExportBuilder()
    export_builder.GROUP_DELIMITER = group_delimiter
    export_builder.SPLIT_SELECT_MULTIPLES = split_select_multiples
    export_builder.BINARY_SELECT_MULTIPLES = binary_select_multiples
    export_builder.set_survey(xform.data_dictionary().survey)

    prefix = slugify('{}_export__{}__{}'.format(export_type, username, id_string))
    temp_file = NamedTemporaryFile(prefix=prefix, suffix=("." + extension))

    # get the export function by export type
    func = getattr(export_builder, export_type_func_map[export_type])
    func.__call__(
        temp_file.name, records, username, id_string, filter_query)

    # generate filename
    basename = "%s_%s" % (
        id_string, datetime.now().strftime("%Y_%m_%d_%H_%M_%S"))
    filename = basename + "." + extension

    # check filename is unique
    while not Export.is_filename_unique(xform, filename):
        filename = increment_index_in_filename(filename)

    file_path = os.path.join(
        username,
        'exports',
        id_string,
        export_type,
        filename)

    # TODO: if s3 storage, make private - how will we protect local storage??
    # seek to the beginning as required by storage classes
    temp_file.seek(0)
    export_filename = default_storage.save(
        file_path,
        File(temp_file, file_path))
    temp_file.close()

    dir_name, basename = os.path.split(export_filename)

    # get or create export object
    if export_id:
        export = Export.objects.get(id=export_id)
    else:
        export = Export(xform=xform, export_type=export_type)
    export.filedir = dir_name
    export.filename = basename
    export.internal_status = Export.SUCCESSFUL
    # do not persist exports that have a filter
    if filter_query is None:
        export.save()
    return export


def query_mongo(username, id_string, query=None):
    query = (
        json.loads(query, object_hook=json_util.object_hook) if query else {}
    )
    query = MongoHelper.to_safe_dict(query)
    query[USERFORM_ID] = '{0}_{1}'.format(username, id_string)
    return xform_instances.find(
        query, max_time_ms=MongoHelper.get_max_time_ms()
    )


def should_create_new_export(xform, export_type):
    if (
        not Export.objects.filter(xform=xform, export_type=export_type).exists()
        or Export.exports_outdated(xform, export_type=export_type)
    ):
        return True
    return False


def newset_export_for(xform, export_type):
    """
    Make sure you check that an export exists before calling this,
    it will a DoesNotExist exception otherwise
    """
    return Export.objects.filter(xform=xform, export_type=export_type)\
        .latest('created_on')


def increment_index_in_filename(filename):
    """
    filename should be in the form file.ext or file-2.ext - we check for the
    dash and index and increment appropriately
    """
    # check for an index i.e. dash then number then dot extension
    regex = re.compile(r"(.+?)\-(\d+)(\..+)")
    match = regex.match(filename)
    if match:
        basename = match.groups()[0]
        index = int(match.groups()[1]) + 1
        ext = match.groups()[2]
    else:
        index = 1
        # split filename from ext
        basename, ext = os.path.splitext(filename)
    new_filename = "%s-%d%s" % (basename, index, ext)
    return new_filename


def generate_attachments_zip_export(
        export_type, extension, username, id_string, export_id=None,
        filter_query=None):
    xform = XForm.objects.get(user__username=username, id_string=id_string)
    attachments = Attachment.objects.filter(instance__xform=xform)
    basename = "%s_%s" % (id_string,
                          datetime.now().strftime("%Y_%m_%d_%H_%M_%S"))
    filename = basename + "." + extension
    file_path = os.path.join(
        username,
        'exports',
        id_string,
        export_type,
        filename)

    absolute_filename = _get_absolute_filename(file_path)

    with default_storage.open(absolute_filename, 'wb') as destination_file:
        create_attachments_zipfile(
            attachments,
            output_file=destination_file,
        )

    dir_name, basename = os.path.split(absolute_filename)

    # get or create export object
    if export_id:
        export = Export.objects.get(id=export_id)
    else:
        export = Export.objects.create(xform=xform, export_type=export_type)

    export.filedir = dir_name
    export.filename = basename
    export.internal_status = Export.SUCCESSFUL
    export.save()
    return export


def generate_kml_export(
    export_type,
    extension,
    username,
    id_string,
    export_id=None,
    filter_query=None,  # Not used, ToDo removed it?
):
    user = User.objects.get(username=username)
    xform = XForm.objects.get(user__username=username, id_string=id_string)
    response = render(
        request=None,
        template_name='survey.kml',
        context={'data': kml_export_data(id_string, user)},
    )

    basename = "%s_%s" % (
        id_string,
        datetime.now().strftime("%Y_%m_%d_%H_%M_%S"),
    )
    filename = basename + "." + extension
    file_path = os.path.join(
        username, 'exports', id_string, export_type, filename
    )

    temp_file = NamedTemporaryFile(suffix=extension)
    temp_file.write(response.content)
    temp_file.seek(0)
    export_filename = default_storage.save(
        file_path, File(temp_file, file_path)
    )
    temp_file.close()

    dir_name, basename = os.path.split(export_filename)

    # get or create export object
    if export_id:
        export = Export.objects.get(id=export_id)
    else:
        export = Export.objects.create(xform=xform, export_type=export_type)

    export.filedir = dir_name
    export.filename = basename
    export.internal_status = Export.SUCCESSFUL
    export.save()

    return export


def kml_export_data(id_string, user):

    instances = Instance.objects.filter(
        xform__user=user,
        xform__id_string=id_string,
        geom__isnull=False
    ).order_by('id')
    data_for_template = []

    for instance in instances:
        point = instance.point
        if point:
            data_for_template.append({
                'name': id_string,
                'id': instance.uuid,
                'lat': point.y,
                'lng': point.x,
                })

    return data_for_template


def _get_absolute_filename(filename: str) -> str:
    """
    Get absolute filename related to storage root.
    """

    filename = default_storage.generate_filename(filename)
    # We cannot call `self.result.save()` before reopening the file
    # in write mode (i.e. open(filename, 'wb')). because it does not work
    # with AzureStorage.
    # Unfortunately, `self.result.save()` does few things that we need to
    # reimplement here:
    # - Create parent folders (if they do not exist) for local storage
    # - Get a unique filename if filename already exists on storage

    # Copied from `FileSystemStorage._save()` 😢
    if isinstance(default_storage, FileSystemStorage):
        full_path = default_storage.path(filename)

        # Create any intermediate directories that do not exist.
        directory = os.path.dirname(full_path)
        if not os.path.exists(directory):
            try:
                if default_storage.directory_permissions_mode is not None:
                    # os.makedirs applies the global umask, so we reset it,
                    # for consistency with file_permissions_mode behavior.
                    old_umask = os.umask(0)
                    try:
                        os.makedirs(
                            directory, default_storage.directory_permissions_mode
                        )
                    finally:
                        os.umask(old_umask)
                else:
                    os.makedirs(directory)
            except FileExistsError:
                # There's a race between os.path.exists() and os.makedirs().
                # If os.makedirs() fails with FileExistsError, the directory
                # was created concurrently.
                pass
        if not os.path.isdir(directory):
            raise IOError("%s exists and is not a directory." % directory)

        # Store filenames with forward slashes, even on Windows.
        filename = filename.replace('\\', '/')

    return default_storage.get_available_name(filename)
