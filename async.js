/**
 * async
 *
 * Exports:
 * - Promise()
 * - PromiseChain()
 */
(function (exports) //{{{
{

	var my = exports;

	/**
	 * @see http://developer.yahoo.com/yui/theater/video.php?v=crockonjs-3
	 */
	exports.Promise = function ()
	{
		var status = 'unresolved',
			outcome,
			waiting = [],
			dreading = [],
			funcArray, i,
			deferredErrors = [];

		function vouch(deed, func)
		{
			switch (status) {
			case 'unresolved':
				if (deed === 'fulfilled') {
					waiting.push(func);
				} else {
					dreading.push(func);
				}
				break;
			case deed:
				func(outcome);
				break;

			}
		}

		function resolve(deed, value)
		{
			if (status !== 'unresolved') {
				throw new Error('The promise has already been resolved: ' + status);
			}

			status = deed;
			outcome = value;

			funcArray = (deed === 'fulfilled') ? waiting : dreading;

			for (i = 0; i < funcArray.length; i++) {
				funcArray[i](outcome);
				/*
				try {
					funcArray[i](outcome);
				} catch (err) {
					deferredErrors.push(err);
				}
				*/
			}

			waiting = null;
			dreading = null;

			// I didn't like how Crock's code was swallowing errors entirely,
			// so here at least we're throwing the first error we caught while
			// still allowing all our "when" callbacks to run.
			if (deferredErrors.length > 0) {
				throw deferredErrors[0];
			}

		}

		return {
			when: function (func) {
				vouch('fulfilled', func);
				return this;
			},

			fail: function (func) {
				vouch('smashed', func);
				return this;
			},

			fulfill: function (value) {
				resolve('fulfilled', value);
				return this;
			},

			smash: function (msg) {
				resolve('smashed', msg);
				return this;
			},

			status: function () {
				return status;
			},

			// support converting this Promise to a Chain on the fly
			then: function ()
			{
				var chain = my.PromiseChain(this);
				return chain.then.apply(chain, Array.prototype.slice.apply(arguments));
			},
			also: function (also)
			{
				var chain = my.PromiseChain(this);
				return chain.also.apply(chain, Array.prototype.slice.apply(arguments));
			}
		};
	};

	/**
	 * @param Takes an arbitrary number of promises or functions that return
	 * promises. Each subsequent argument gets passed to the when() of the
	 * previous one.
	 *
	 * If an argument returns a falsy value when called, the chain will end,
	 * even if there are more arguments. If an argument is an Array 
	 * (parallel), the chain will only end prematurely if all members return
	 * false.
	 *
	 * @return Promise A meta-promise for the chain as a whole with the
	 * additional methods:
	 * - Promise then(promise): add more links to the chain,
	 * - Promise also(promise): add a parallel promise to the last link
	 *
	 * If an argument is or returns an Array, its members will be processed in
	 * parallel. Results will be passed to the next step as an Array, in the
	 * order in which they were fulfilled.
	 */
	exports.PromiseChain = function ()
	{
		var chain = Array.prototype.slice.call(arguments),
			promise,
			metaPromise = my.Promise(),
			i = 0; // Our index in the chain


		/**
		 * runs for each link in the chain with i incremented each time
		 */
		function next(args)
		{
			var j,
				w = 0, // width of a parallel link
				f = 0, // count parallel promises fulfilled
				pargs = []; // arguments for the next step from a parallel link

			/**
			 * For parallelization; called as each parallel promise is
			 * fulfilled. When all promises are fulfilled, runs the next link
			 * in the chain.
			 */
			function gather(arg)
			{
				f += 1;
				pargs.push(arg);
				if (f === w) {
					i += 1;
					next(pargs);
				}
			}

			if (chain[i] instanceof Array) {
				// A parallel link: start all promises, handing them our
				// gather() function.
				for (j = 0; j < chain[i].length; j++) {
					promise = chain[i][j] instanceof Function ? chain[i][j](args) : chain[i][j];
					if (!promise) {
						continue;
					}
					w += 1;
					promise.fail(metaPromise.smash);
					promise.when(gather);
				}
				if (w === 0) {
					// chain has ended
					if (i < chain.length - 1) {
						// The chain has been broken before the last link was run.
						metaPromise.smash();
					} else {
						metaPromise.fulfill(args);
					}
				}
				return;
			}

			promise = chain[i] instanceof Function ? chain[i](args) : chain[i];

			if (!promise) {
				if (i < chain.length - 1) {
					// The chain has been broken before the last link was run.
					metaPromise.smash();
				} else {
					metaPromise.fulfill(args);
				}
				return;
			}

			if (promise instanceof Array) {
				// this link has decided it is parallel...
				for (j = 0; j < promise.length; j++) {
					w += 1;
					promise[j].fail(metaPromise.smash);
					promise[j].when(gather);
				}
				return;
			}

			i += 1;
			promise.fail(metaPromise.smash);
			promise.when(next);
		}

		next();

		return {
			then: function (promise)
			{
				chain.push(promise);
				return this;
			},
			also: function (promise)
			{
				var lastLink = chain[chain.length - 1];

				if (!(lastLink instanceof Array)) {
					lastLink = chain[chain.length - 1] = [lastLink];
				}
				lastLink.push(promise);
				return this;
			},
			when: metaPromise.when,
			fail: metaPromise.fail,
			status: metaPromise.status
		};
	};

}(module.exports('async'))); // }}}

