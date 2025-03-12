function createFunctions(Reflux, PromiseFactory) {
  const _ = Reflux.utils

  /**
   * Returns a Promise for the triggered action
   *
   * @return {Promise}
   *   Resolved by completed child action.
   *   Rejected by failed child action.
   *   If listenAndPromise'd, then promise associated to this trigger.
   *   Otherwise, the promise is for next child action completion.
   */
  function triggerPromise() {
    var args = arguments

    var canHandlePromise = this.children.indexOf('completed') >= 0 && this.children.indexOf('failed') >= 0

    var createdPromise = new PromiseFactory((resolve, reject) => {
      // If `listenAndPromise` is listening
      // patch `promise` w/ context-loaded resolve/reject
      if (this.willCallPromise) {
        _.nextTick(() => {
          var previousPromise = this.promise
          this.promise = (inputPromise) => {
            inputPromise.then(resolve, reject)
            // Back to your regularly schedule programming.
            this.promise = previousPromise
            return this.promise.apply(this, arguments)
          }
          this.trigger.apply(this, args)
        })
        return
      }

      if (canHandlePromise) {
        var removeSuccess = this.completed.listen(() => {
          var args = Array.prototype.slice.call(arguments)
          removeSuccess()
          removeFailed()
          resolve(args.length > 1 ? args : args[0])
        })

        var removeFailed = this.failed.listen(() => {
          var args = Array.prototype.slice.call(arguments)
          removeSuccess()
          removeFailed()
          reject(args.length > 1 ? args : args[0])
        })
      }

      _.nextTick(() => {
        this.trigger.apply(this, args)
      })

      if (!canHandlePromise) {
        resolve()
      }
    })

    // Ensure that the promise does trigger "Uncaught (in promise)" errors in console if no error handler is added
    // See: https://github.com/reflux/reflux-promise/issues/4
    createdPromise.catch(() => {})

    return createdPromise
  }

  /**
   * Attach handlers to promise that trigger the completed and failed
   * child publishers, if available.
   *
   * @param {Object} p The promise to attach to
   */
  function promise(p) {
    var canHandlePromise = this.children.indexOf('completed') >= 0 && this.children.indexOf('failed') >= 0

    if (!canHandlePromise) {
      throw new Error('Publisher must have "completed" and "failed" child publishers')
    }

    p.then(
      (response) => this.completed(response),
      (error) => this.failed(error),
    )
  }

  /**
   * Subscribes the given callback for action triggered, which should
   * return a promise that in turn is passed to `this.promise`
   *
   * @param {Function} callback The callback to register as event handler
   */
  function listenAndPromise(callback, bindContext) {
    bindContext = bindContext || this
    this.willCallPromise = (this.willCallPromise || 0) + 1

    var removeListen = this.listen(() => {
      if (!callback) {
        throw new Error('Expected a function returning a promise but got ' + callback)
      }

      var args = arguments,
        returnedPromise = callback.apply(bindContext, args)
      return this.promise.call(this, returnedPromise)
    }, bindContext)

    return () => {
      this.willCallPromise--
      removeListen.call(this)
    }
  }

  return {
    triggerPromise: triggerPromise,
    promise: promise,
    listenAndPromise: listenAndPromise,
  }
}

/**
 * Sets up reflux with Promise functionality
 */
export default function (promiseFactory) {
  return (Reflux) => {
    const { triggerPromise, promise, listenAndPromise } = createFunctions(Reflux, promiseFactory)
    Reflux.PublisherMethods.triggerAsync = triggerPromise
    Reflux.PublisherMethods.promise = promise
    Reflux.PublisherMethods.listenAndPromise = listenAndPromise
  }
}
