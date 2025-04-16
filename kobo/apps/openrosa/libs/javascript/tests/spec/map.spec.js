// Formhub Map Component Specs
// ---------------------------
describe('Formhub Map', () => {
  // Handle to our map's DOM element
  var el

  var layer_configs = [
    { label: 'Mapbox Streets', options: { user: 'modilabs', map: 'map-iuetkf9u' } },
    { label: 'MapBox Streets Light', options: { user: 'modilabs', map: 'map-p543gvbh' } },
    { label: 'MapBox Streets Zenburn', options: { user: 'modilabs', map: 'map-bjhr55gf' } },
    { label: 'Cloudless Earth', options: { user: 'modilabs', map: 'map-aef58tqo' } },
    { label: 'Mapbox Streets (Français)', options: { user: 'modilabs', map: 'map-vdpjhtgz' }, lang: 'fr' },
    { label: 'Mapbox Streets (Español)', options: { user: 'modilabs', map: 'map-5gjzjlah' }, lang: 'es' },
  ]
  var customMapBoxTileLayer = {
    label: 'Mapbox Street Custom',
    options: {
      url: 'http://{s}.tiles.mapbox.com/v3/modilabs.map-iuetkf9u.json',
      attribution: '&copy; Me',
    },
    is_custom: true,
  }

  // Create a `#map` div before each spec and assign it to the `el` variable.
  beforeEach(() => {
    $('body').append($('<div id="map"></div>'))
    el = $('#map')
  })

  // Remove the `#map` div after each spec and un-define the `el` variable.
  afterEach(() => {
    el.remove()
    el = undefined
  })

  // ### Test the map's initialization
  describe('Map initialization', () => {
    // Test that default map options are overridden when specified.
    it('overrides defaults', () => {
      var map = new FH.Map({
        el: el,
        zoom: 13,
        center: [36.0, -1.0],
      })
      expect(map.options.zoom).toEqual(13)
      expect(map.options.center).toEqual([36.0, -1.0])
    })

    // Test that default map options are used if overrides are not specified.
    it('uses defaults if they are not specified', () => {
      var map = new FH.Map({
        el: el,
      })
      expect(map.options.zoom).toEqual(8)
      expect(map.options.center).toEqual([0, 0])
    })
  })

  // ### Test base layer functionality.
  describe('Base Layers', () => {
    it('creates base layers defined at initialisation', () => {
      var map = new FH.Map({
        el: el,
        layers: layer_configs.concat([customMapBoxTileLayer]),
      })
      expect(_.keys(map._layersControl._layers).length).toEqual(7)
    })

    describe('Layer Initialisation by type', () => {
      var map
      // Create an FH.Map before each spec
      beforeEach(() => {
        map = new FH.Map({
          el: el,
        })
      })

      // Test that `addBaseLayer` can add a MapBox layer
      it('can add a mapbox layer', () => {
        var mapbox_layer_config = {
            type: FH.layers.MAPBOX,
            label: 'Mapbox Streets',
            options: {
              user: 'modilabs',
              map: 'map-iuetkf9u',
              attribution: 'Map data (c) OpenStreetMap contributors, CC-BY-SA',
            },
          },
          layer
        layer = map.addBaseLayer(mapbox_layer_config, true)
        expect(map._map.hasLayer(layer)).toEqual(true)
      })

      // Test that `addBaseLayer` can add a Google layer
      it('can add a Google layer', () => {
        var google_layer_config = {
            type: FH.layers.GOOGLE,
            label: 'Google Hybrid',
            options: {
              type: 'HYBRID',
            },
          },
          layer
        layer = map.addBaseLayer(google_layer_config, true)
        expect(map._map.hasLayer(layer)).toEqual(true)
      })

      // Test that `addBaseLayer` can add a generic layer defined by url
      it('can add a generic layer', () => {
        var generic_layer_config = {
            label: 'Custom Layer',
            options: {
              url: 'http://{s}.tiles.mapbox.com/v3/modilabs.map-iuetkf9u.json',
              attribution: '&copy; Me',
            },
          },
          layer
        layer = map.addBaseLayer(generic_layer_config, true)
        expect(map._map.hasLayer(layer)).toEqual(true)
      })
    })
  })

  describe('determineDefaultLayer', () => {
    it('sets the custom layer as the default if its defined', () => {
      // add the custom layer
      var base_layers = layer_configs.concat([customMapBoxTileLayer])
      var default_layer = FH.Map.determineDefaultLayer(base_layers, 'en')
      expect(default_layer).toBeDefined()
      expect(default_layer).toBe(customMapBoxTileLayer)
    })

    it('sets the layer matching the language code as the default if no custom layer is defined', () => {
      var default_layer = FH.Map.determineDefaultLayer(layer_configs, 'fr')
      expect(default_layer).toBeDefined()
      expect(default_layer.label).toEqual('Mapbox Streets (Français)')
    })

    it('sets the first defined layer as the default if no custom or language layer is found', () => {
      var default_layer = FH.Map.determineDefaultLayer(layer_configs, 'en')
      expect(default_layer).toBeDefined()
      expect(default_layer.label).toEqual('Mapbox Streets')
    })
  })
})

describe('FeatureLayer', () => {
  describe('parseLatLngString', () => {
    describe('valid string', () => {
      var lat_lng_str = '36.0 -1.2 3600 25',
        result

      beforeEach(() => {
        result = FH.FeatureLayer.parseLatLngString(lat_lng_str)
      })

      it('returns an array with two elements', () => {
        expect(result.length).toEqual(2)
      })

      it('converts the string values into floats', () => {
        expect(typeof result[0]).toEqual('number')
        expect(result[0]).not.toBeNaN()
      })
    })
  })
})

describe('DataView', () => {
  var fieldSet,
    raw_questions = [
      {
        name: 'name',
        type: 'text',
        label: 'Name',
      },
      {
        name: 'age',
        type: 'integer',
        label: 'Age',
      },
    ]

  beforeEach(() => {
    fieldSet = new FH.FieldSet()
    FH.Form.parseQuestions(raw_questions).forEach((field) => {
      fieldSet.add(field)
    })
  })

  xit('creates a template from the specified fieldSet', () => {
    var dataView = new FH.DataView()
    dataView.renderTemplate(fieldSet)
    expect(dataView.template).toBeDefined()
  })

  xdescribe('templateFromFields', () => {
    it('creates a table row for each question', () => {
      var result

      result = FH.DataView.templateFromFields(fieldSet)
      expect(result).toEqual(
        '<table class="table table-bordered table-striped">' +
          '<tr><th>Question</th><th>Response</th></tr>' +
          '<tr><td>Name</td><td><%= record["name"] %></td></tr>' +
          '<tr><td>Age</td><td><%= record["age"] %></td></tr>' +
          '</table>',
      )
    })

    it('uses the specified language if provided', () => {
      var result,
        multi_lang_questions = [
          {
            name: 'name',
            type: 'text',
            label: {
              English: 'Name',
              Swahili: 'Jina',
            },
          },
          {
            name: 'age',
            type: 'integer',
            label: {
              English: 'Age',
              Swahili: 'Umri',
            },
          },
        ]

      fieldSet = new FH.FieldSet()
      FH.Form.parseQuestions(multi_lang_questions).forEach((field) => {
        fieldSet.add(field)
      })

      result = FH.DataView.templateFromFields(fieldSet, 'Swahili')
      expect(result).toEqual(
        '<table class="table table-bordered table-striped">' +
          '<tr><th>Question</th><th>Response</th></tr>' +
          '<tr><td>Jina</td><td><%= record["name"] %></td></tr>' +
          '<tr><td>Umri</td><td><%= record["age"] %></td></tr>' +
          '</table>',
      )
    })

    it('handles grouped questions', () => {
      var result
      raw_questions = [
        {
          name: 'a_group',
          type: 'group',
          children: [
            {
              name: 'name',
              type: 'text',
              label: 'Name',
            },
            {
              name: 'age',
              type: 'integer',
              label: 'Age',
            },
          ],
        },
      ]
      fieldSet = new FH.FieldSet()
      FH.Form.parseQuestions(raw_questions).forEach((field) => {
        fieldSet.add(field)
      })

      result = FH.DataView.templateFromFields(fieldSet)
      expect(result).toEqual(
        '<table class="table table-bordered table-striped">' +
          '<tr><th>Question</th><th>Response</th></tr>' +
          '<tr><td>Name</td><td><%= record["a_group/name"] %></td></tr>' +
          '<tr><td>Age</td><td><%= record["a_group/age"] %></td></tr>' +
          '</table>',
      )
    })
  })
})
