from __future__ import annotations

import re
from typing import Optional, Union
from xml.dom import Node

from defusedxml import minidom
from django.db.models import F, Q
from django.db.models.query import QuerySet

from kobo.apps.open_rosa_server.apps.form_disclaimer.models import FormDisclaimer


class XMLFormWithDisclaimer:

    # TODO merge this with KPI when Kobocat becomes a Django-app
    def __init__(self, obj: Union['logger.XForm']):
        self._object = obj
        self._unique_id = obj.id_string
        self._add_disclaimer()

    def get_object(self):
        return self._object

    def _add_disclaimer(self):

        if not (disclaimers := self._get_disclaimers(self._object)):
            return

        if not (value := self._get_translations(disclaimers)):
            return

        translated, disclaimers_dict, default_language_code = value

        self._root_node = minidom.parseString(self._object.xml)

        if translated:
            self._add_translation_nodes(disclaimers_dict, default_language_code)

        self._add_instance_and_bind_nodes()
        self._add_disclaimer_input(
            translated, disclaimers_dict, default_language_code
        )

        self._object.xml = self._root_node.toxml(encoding='utf-8').decode()

    def _add_instance_and_bind_nodes(self):
        # Search for main <model> node
        model_node = [
            n
            for n in self._root_node.getElementsByTagName('h:head')[0].childNodes
            if n.nodeType == Node.ELEMENT_NODE and n.tagName == 'model'
        ][0]

        # Inject <bind nodeset /> inside <model odk:xforms-version="1.0.0">
        bind_node = self._root_node.createElement('bind')
        bind_node.setAttribute(
            'nodeset', f'/{self._unique_id}/_{self._unique_id}__disclaimer'
        )
        bind_node.setAttribute('readonly', 'true()')
        bind_node.setAttribute('required', 'false()')
        bind_node.setAttribute('type', 'string')
        bind_node.setAttribute('relevant', 'false()')
        model_node.appendChild(bind_node)

        # Inject note node inside <{self._unique_id}>
        instance_node = model_node.getElementsByTagName('instance')[0]
        instance_node = instance_node.getElementsByTagName(self._unique_id)[0]
        instance_node.appendChild(
            self._root_node.createElement(f'_{self._unique_id}__disclaimer')
        )

    def _add_disclaimer_input(
        self,
        translated: bool,
        disclaimers_dict: dict,
        default_language_code: str,
    ):
        """

        """
        body_node = self._root_node.getElementsByTagName('h:body')[0]
        disclaimer_input = self._root_node.createElement('input')
        disclaimer_input_label = self._root_node.createElement('label')
        disclaimer_input.setAttribute('appearance', 'kobo-disclaimer')
        disclaimer_input.setAttribute(
            'ref', f'/{self._unique_id}/_{self._unique_id}__disclaimer'
        )

        if translated:
            itext = f'/{self._unique_id}/_{self._unique_id}__disclaimer:label'
            disclaimer_input_label.setAttribute(
                'ref',
                f"jr:itext('{itext}')",
            )
        else:
            disclaimer_input_label.appendChild(
                self._root_node.createTextNode(
                    disclaimers_dict[default_language_code]
                )
            )

        disclaimer_input.appendChild(disclaimer_input_label)
        body_node.appendChild(disclaimer_input)

    def _add_translation_nodes(
        self, disclaimers_dict: dict, default_language_code: str
    ):
        """
        Add <itext> nodes to <instance> if translations are detected.
        Will add only translations that match form translations.
        """

        for n in self._root_node.getElementsByTagName('itext')[0].childNodes:
            if n.nodeType == Node.ELEMENT_NODE and n.tagName == 'translation':
                disclaimer_translation = self._root_node.createElement('text')
                disclaimer_translation.setAttribute(
                    'id',
                    f'/{self._unique_id}/_{self._unique_id}__disclaimer:label',
                )
                value = self._root_node.createElement('value')
                language = n.getAttribute('lang').lower().strip()
                if m := re.match(r'[^\(]*\(([a-z]{2,})\)', language):
                    language_code = m.groups()[0]
                else:
                    language_code = default_language_code

                value.appendChild(
                    self._root_node.createTextNode(
                        disclaimers_dict.get(
                            language_code,
                            disclaimers_dict.get(default_language_code)
                        )
                    )
                )
                disclaimer_translation.appendChild(value)
                n.appendChild(disclaimer_translation)

    def _get_disclaimers(self, xform: 'logger.XForm') -> Optional[QuerySet]:

        # Order by '-message' to ensure that default is overridden later if
        # an override exists for the same language. See `_get_translations()`
        disclaimers = (
            FormDisclaimer.objects.values(
                'language_code', 'message', 'default', 'hidden'
            )
            .filter(Q(xform__isnull=True) | Q(xform=xform))
            # Hidden first, per-asset (non-null xform) first, then alphabetical
            # by language code
            .order_by('-hidden', '-xform_id', 'language_code')
        )

        if not disclaimers:
            return

        return disclaimers

    def _get_translations(
        self, disclaimers: QuerySet
    ) -> Optional[tuple[bool, dict, str]]:
        """
        Detect whether the form is translated and return its value plus a dictionary
        of all available messages and the default language code.
        """

        # Do not go further if disclaimer must be hidden
        if disclaimers[0]['hidden']:
            return

        translated = '<itext>' in self._object.xml
        disclaimers_dict = {}
        default_language_code = None
        for d in disclaimers:
            disclaimers_dict[d['language_code']] = d['message']
            if d['default']:
                default_language_code = d['language_code']

        if not translated and not disclaimers_dict[default_language_code]:
            return

        return translated, disclaimers_dict, default_language_code
