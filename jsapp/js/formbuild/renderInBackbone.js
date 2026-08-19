import React from 'react'

import { MantineProvider } from '@mantine/core'
import { List, Map } from 'immutable'
import { createRoot } from 'react-dom/client'
import { cssVariablesResolverKobo, themeKobo } from '#/theme'
import { recordKeys } from '#/utils'
import KoboMatrix from './containers/KoboMatrix'

/*
Initially, this KoboMatrixRow class will be an intermediary between
the react interface and the backbone `model.row` code.
*/
class KoboMatrixRow {
  constructor(model) {
    const obj2 = {}
    const _o = model
    obj2.label = _o.getValue('label')
    var choices = {}

    recordKeys(_o.items).forEach((key) => {
      if (_o.items[key] && _o.items[key].options) {
        _o.items[key].options.map((item) => {
          const { $kuid } = item.attributes
          item.attributes.list_name = key
          choices[$kuid] = item.attributes
        })
      }
    })

    obj2.cols = _o._kobomatrix_cols().map((item) => {
      const _type = item.get('type').get('typeId')
      const attrs = Object.assign(item.toJSON(), {
        type: _type,
      })
      const { $kuid } = attrs
      obj2[$kuid] = attrs
      return $kuid
    })

    const _b = _o.toJSON()
    this.kobomatrix_list = _b['kobo--matrix_list']
    const colKuids = obj2.cols
    const colEntries = colKuids.map((kuid) => [kuid, Map(obj2[kuid])])
    this.data = Map({
      ...Object.fromEntries(colEntries),
      label: obj2.label,
      cols: List(colKuids),
    })
    const choiceEntries = Object.entries(choices).map(([kuid, val]) => [kuid, Map(val)])
    var _c = Map(Object.fromEntries(choiceEntries))
    this.data = this.data.set('choices', _c.toOrderedMap())
    this.kuid = _b.$kuid
  }
}

export function renderKobomatrix(view, el) {
  const model = new KoboMatrixRow(view.model)
  const root = createRoot(el.get(0))
  // Backbone gives us a detached React root, so the app's `MantineProvider`
  // (see `basicLayout.component.tsx`) is not an ancestor here. Mantine
  // components read their theme from context, so this root needs its own
  // provider. `withCssVariables` is off because the app root already put the
  // very same variables on `:root`.
  root.render(
    <MantineProvider theme={themeKobo} cssVariablesResolver={cssVariablesResolverKobo} withCssVariables={false}>
      <KoboMatrix model={model} />
    </MantineProvider>,
  )
  // TODO: should this root be unmounted at some point?
  // https://react.dev/reference/react-dom/client/createRoot#root-unmount
  // Maybe instantiate the root in KoboMatrixView, then unmount it when
  // KoboMatrixView is disposed.
}
