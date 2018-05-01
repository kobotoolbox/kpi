{expect} = require('../helper/fauxChai')
$utils = require("../../jsapp/xlform/src/model.utils")

pasted = [
            ["list_name", "name", "label", "state", "county"],
            ["state", "texas", "Texas", ""],
            ["state", "washington", "Washington", ""],
            ["county", "king 1", "King", "washington", ""],
            ["county", "pierce", "Pierce", "washington", ""],
            ["county", "king 2", "King", "texas", ""],
            ["county", "cameron", "Cameron", "texas", ""],
            ["city", "dumont", "Dumont", "texas", "king 2"],
            ["city", "finney", "Finney", "texas", "king 2"],
            ["city", "brownsville", "brownsville", "texas", "cameron"],
            ["city", "harlingen", "harlingen", "texas", "cameron"],
            ["city", "seattle", "Seattle", "washington", "king 1"],
            ["city", "redmond", "Redmond", "washington", "king 1"],
            ["city", "tacoma", "Tacoma", "washington", "pierce"],
            ["city", "puyallup", "Puyallup", "washington", "pierce"]
        ].map((r)-> r.join("\t")).join("\n")

expectation = JSON.parse("""
[
    {
        "list_name": "state",
        "name": "texas",
        "label": "Texas"
    },
    {
        "list_name": "state",
        "name": "washington",
        "label": "Washington"
    },
    {
        "list_name": "county",
        "name": "king 1",
        "label": "King",
        "state": "washington"
    },
    {
        "list_name": "county",
        "name": "pierce",
        "label": "Pierce",
        "state": "washington"
    },
    {
        "list_name": "county",
        "name": "king 2",
        "label": "King",
        "state": "texas"
    },
    {
        "list_name": "county",
        "name": "cameron",
        "label": "Cameron",
        "state": "texas"
    },
    {
        "list_name": "city",
        "name": "dumont",
        "label": "Dumont",
        "state": "texas",
        "county": "king 2"
    },
    {
        "list_name": "city",
        "name": "finney",
        "label": "Finney",
        "state": "texas",
        "county": "king 2"
    },
    {
        "list_name": "city",
        "name": "brownsville",
        "label": "brownsville",
        "state": "texas",
        "county": "cameron"
    },
    {
        "list_name": "city",
        "name": "harlingen",
        "label": "harlingen",
        "state": "texas",
        "county": "cameron"
    },
    {
        "list_name": "city",
        "name": "seattle",
        "label": "Seattle",
        "state": "washington",
        "county": "king 1"
    },
    {
        "list_name": "city",
        "name": "redmond",
        "label": "Redmond",
        "state": "washington",
        "county": "king 1"
    },
    {
        "list_name": "city",
        "name": "tacoma",
        "label": "Tacoma",
        "state": "washington",
        "county": "pierce"
    },
    {
        "list_name": "city",
        "name": "puyallup",
        "label": "Puyallup",
        "state": "washington",
        "county": "pierce"
    }
]
""")


do ->
  describe 'model.utils', ->
    describe 'pasted', ->
      _eqKeyVals = (a, b)->
        expect(_.keys(a).sort().join(',')).toEqual(_.keys(b).sort().join(','))
        expect(_.values(a).sort().join(',')).toEqual(_.values(b).sort().join(','))

      it 'splits pasted code into appropriate chunks', ->
        splitted = $utils.split_paste(pasted)
        expect(splitted.length).toEqual(expectation.length)
        for i in [0..splitted.length]
            _eqKeyVals(splitted[i], expectation[i])

    describe 'sluggify', ->
      it 'lowerCases: true', ->
        expect($utils.sluggify("TESTING LOWERCASE TRUE", lowerCase: true)).toEqual('testing_lowercase_true')
      it 'lowerCases: false', ->
        expect($utils.sluggify("TESTING LOWERCASE FALSE", lowerCase: false)).toEqual('TESTING_LOWERCASE_FALSE')
      it 'isValidXmlTag passes with valid strings', ->
        valid_xml = [
          'abc',
          '_123',
          'a456',
          '_.',
        ]
        for str in valid_xml
          expect($utils.isValidXmlTag(str)).toBeTruthy()
      it 'isValidXmlTag fails with invalid strings', ->
        invalid_xml = [
          '1xyz',
          ' startswithspace',
          '._',
        ]
        for str in invalid_xml
          expect($utils.isValidXmlTag(str)).not.toBeTruthy()

      it 'handles a number of strings consistenly', ->
        inp_exps = [
            [["asdf jkl"],              "asdf_jkl"],
            [["asdf", ["asdf"]],        "asdf_001"],
            [["2. asdf"],               "_2_asdf"],
            [["2. asdf", ["_2_asdf"]],  "_2_asdf_001"],
            [["asdf#123"],              "asdf_123"],
            [[" hello "],               "hello"],
        ]
        for [inps, exps], i in inp_exps
          [str, additionals] = inps
          _out = $utils.sluggifyLabel(str, additionals)
          expect(_out).toBe(exps)

