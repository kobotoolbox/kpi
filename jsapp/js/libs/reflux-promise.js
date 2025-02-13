function createFunctions(Reflux, PromiseFactory) {

    const _ = Reflux.utils;

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
        var me = this;
        var args = arguments;

        var canHandlePromise =
            this.children.indexOf('completed') >= 0 &&
            this.children.indexOf('failed') >= 0;

        var createdPromise = new PromiseFactory(function(resolve, reject) {
            // If `listenAndPromise` is listening
            // patch `promise` w/ context-loaded resolve/reject
            if (me.willCallPromise) {
                _.nextTick(function() {
                    var previousPromise = me.promise;
                    me.promise = function (inputPromise) {
                        inputPromise.then(resolve, reject);
                        // Back to your regularly schedule programming.
                        me.promise = previousPromise;
                        return me.promise.apply(me, arguments);
                    };
                    me.trigger.apply(me, args);
                });
                return;
            }

            if (canHandlePromise) {
                var removeSuccess = me.completed.listen(function () {
                    var args = Array.prototype.slice.call(arguments);
                    removeSuccess();
                    removeFailed();
                    resolve(args.length > 1 ? args : args[0]);
                });

                var removeFailed = me.failed.listen(function () {
                    var args = Array.prototype.slice.call(arguments);
                    removeSuccess();
                    removeFailed();
                    reject(args.length > 1 ? args : args[0]);
                });
            }

            _.nextTick(function () {
                me.trigger.apply(me, args);
            });

            if (!canHandlePromise) {
                resolve();
            }
        });

        // Ensure that the promise does trigger "Uncaught (in promise)" errors in console if no error handler is added
        // See: https://github.com/reflux/reflux-promise/issues/4
        createdPromise.catch(function() {});

        return createdPromise;
    }

    /**
     * Attach handlers to promise that trigger the completed and failed
     * child publishers, if available.
     *
     * @param {Object} p The promise to attach to
     */
    function promise(p) {
        var me = this;

        var canHandlePromise =
            this.children.indexOf('completed') >= 0 &&
            this.children.indexOf('failed') >= 0;

        if (!canHandlePromise){
            throw new Error('Publisher must have "completed" and "failed" child publishers');
        }

        p.then(function(response) {
            return me.completed(response);
        }, function(error) {
            return me.failed(error);
        });
    }

    /**
     * Subscribes the given callback for action triggered, which should
     * return a promise that in turn is passed to `this.promise`
     *
     * @param {Function} callback The callback to register as event handler
     */
    function listenAndPromise(callback, bindContext) {
        var me = this;
        bindContext = bindContext || this;
        this.willCallPromise = (this.willCallPromise || 0) + 1;

        var removeListen = this.listen(function() {

            if (!callback) {
                throw new Error('Expected a function returning a promise but got ' + callback);
            }

            var args = arguments,
                returnedPromise = callback.apply(bindContext, args);
            return me.promise.call(me, returnedPromise);
        }, bindContext);

        return function () {
          me.willCallPromise--;
          removeListen.call(me);
        };

    }

    return {
        triggerPromise: triggerPromise,
        promise: promise,
        listenAndPromise: listenAndPromise
    };
}

/**
 * Sets up reflux with Promise functionality
 */
export default function(promiseFactory) {
    return function(Reflux) {
        const { triggerPromise, promise, listenAndPromise } = createFunctions(Reflux, promiseFactory);
        Reflux.PublisherMethods.triggerAsync = triggerPromise;
        Reflux.PublisherMethods.promise = promise;
        Reflux.PublisherMethods.listenAndPromise = listenAndPromise;
    };
}
