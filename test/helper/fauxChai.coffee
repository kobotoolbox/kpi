chai = require('chai')
chaiExpect = chai.expect

module.exports =
  chai: chaiExpect
  expect: (x)->
    toBe: (y)->
      chaiExpect(x).to.equal(y)
      return
    toThrow: (e)->
      chaiExpect(x).to.throw(e)
      return
    toBeDefined: ()->
      chaiExpect(x).not.to.be.a('undefined')
      return
    toContain: (y)->
      chaiExpect(x).to.contain(y)
      return
    toEqual: (y)->
      chaiExpect(x).eql(y)
      return
    toBeTruthy: ->
      chaiExpect(x).to.be.ok
      return
    toBeUndefined: ->
      chaiExpect(x).to.be.a('undefined')
      return
    'not':
      toEqual: (y)->
        chaiExpect(x).to.not.eql(y)
        return
      toBe: (y)->
        chaiExpect(x).to.not.equal(y)
        return
      toThrow: (e)->
        chaiExpect(x).to.not.throw(e)
        return
      toBeTruthy: ->
        chaiExpect(x).to.not.be.ok
        return
      toBeDefined: ->
        chaiExpect(x).to.be.a('undefined')
        return
