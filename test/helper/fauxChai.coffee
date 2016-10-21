chai = require('chai')
chaiExpect = chai.expect

module.exports =
  chai: chaiExpect
  expect: (x)->
    toBe: (y)->
      chaiExpect(x).to.equal(y)
    toThrow: (e)->
      chaiExpect(x).to.throw(e)
    toBeDefined: ()->
      chaiExpect(x).not.to.be.a('undefined')
    toContain: (y)->
      chaiExpect(x).to.contain(y)
    toEqual: (y)->
      chaiExpect(x).eql(y)
    toBeTruthy: ->
      chaiExpect(x).to.be.ok
    toBeUndefined: ->
      chaiExpect(x).to.be.a('undefined')
    'not':
      toEqual: (y)->
        chaiExpect(x).to.not.eql(y)
      toBe: (y)->
        chaiExpect(x).to.not.equal(y)
      toThrow: (e)->
        chaiExpect(x).to.not.throw(e)
      toBeTruthy: ->
        chaiExpect(x).to.not.be.ok
      toBeDefined: ->
        chaiExpect(x).to.be.a('undefined')
