// profiled.js
'use strict';

const fs = require('fs');


const profilers = {
	'default': {
		// this is for rapidly giving back wrapped modules
		'modules': {
			// empty
		},

		// this is for storing module/function information
		'info': {
			// empty
		},
	},
};



const debug = (text) => {
	if( typeof text !== 'string') {
		text = JSON.stringify(text, null, 2);
	}
	console.log(text);
}


const saveFunctionTime = ( config ) => {
	/*
		config = {
			callNumber: 0, 1, 2, 3...
			profiler: 'default',
			moduleName: 'module-name',
			functionName: 'function-name',
			callType: 'blocking', 'callback', or 'promise',
			executionTime: time in milliseconds
		}
	*/


	// Initialise the module
	if( !profilers[config.profiler].info[config.moduleName]) {
		profilers[config.profiler].info[config.moduleName] = {};
	}
	var module = profilers[config.profiler].info[config.moduleName];

	// Initialise the function info
	if( !module[config.functionName] ) {
		module[config.functionName] = {
			timeTaken: {
				// empty
			},
		};
	}

	// initialise the callType
	if( !module[config.functionName].timeTaken[config.callType]) {
		module[config.functionName].timeTaken.blocking = [];
		module[config.functionName].timeTaken.callback = [];
		module[config.functionName].timeTaken.promise = [];
	}
	// Save the calltime
	module[config.functionName].timeTaken[config.callType].push(config.timeTaken);
}



module.exports.require = (moduleName, profiler) => {

	if(!profiler) {
		profiler = 'default';
	}

	const modules = profilers[profiler].modules;

	// If we've already created it,
	// then return it as fast as possible
	if( modules[moduleName]) {
		return modules[moduleName];
	}

	// load in the module
	const wrappedModule = require(moduleName);

	const toReplace = [];
	debug(`Searching ${moduleName} for methods:`);
	for ( let prop in wrappedModule ) {
		debug(`  found ${prop} with ${wrappedModule[prop].length} arguments`);
		// if( it's a god damned function )
		toReplace.push(prop);
	}
	toReplace.forEach( functionName => {
		let func = wrappedModule[functionName];
		let callTotal = 0;


		wrappedModule[functionName] = function(/*uses arguments*/) {
			var callNumber = ++callTotal;
			const args = arguments;
			const start = new Date();
			let callback = null;
			let isPromise = false;

			// fires when the function did what it needed
			// to do (not just after it returned)
			const done = function(/*uses arguments*/) {
				const end = new Date();
				// get how long it took
				const timeTaken = end.getMilliseconds() - start.getMilliseconds();
				debug(`  Invocation ${callNumber} - Call to ${moduleName}.${functionName} took ${timeTaken}ms`);

				saveFunctionTime({
					callNumber: callNumber,
					profiler: profiler,
					moduleName: moduleName,
					functionName: functionName,
					timeTaken: timeTaken,
					callType: (isPromise?'promise':(callback?'callback':'blocking')),
				});

				// if we need to call the callback with args, let's do that
				if( callback ) {
					debug(`  Invocation ${callNumber} - Got ${arguments.length} argument in 'done'`);

					callback.apply(this, arguments);
				}
			};


			// do some argument sniffing:
			if( arguments.length > 0 && typeof arguments[arguments.length-1] === 'function') {
				// look for a callback (last argument)
				debug(`  Invocation ${callNumber} - Last argument is a callback`);

				// we need to wait for the callback to fire
				// so assign our callback to the last arg, and have it fire done
				callback = args[arguments.length-1];
				args[arguments.length-1] = done;
			}

			// run the function!
			debug(`  Invocation ${callNumber} - Calling function now!`);
			const ret = func.apply(this, args);

			// If we were given a promise, then we should wrap its then!
			// but not if the last argument is a callback, they probably want that
			if( typeof ret.then === 'function' && !callback) {
				isPromise = true;
				ret.then(done);
			}

			// If we haven't assigned the callback, then
			// it won't have fired. --do that here
			if(!callback && !isPromise ) {
				done();
			}

			return ret;
		}
		// FIXME: fails on 4.4.7
		// wrappedModule[functionName].length = func.length;
	});

	modules[moduleName] = wrappedModule;

	return wrappedModule;
}



module.exports.getInfo = ( name ) => {
	const path = name.split('.');

	var moduleName = null;
	var functionName = null;
	// if it was a local path
	if(path[0] === '') {
		moduleName = '.' + path[1];
		functionName = path[2];
	}
	else {
		moduleName = path[0];
		functionName = path[1];
	}

	const profiler = 'default';
	const moduleInfo = profilers[profiler].info[moduleName];
	const info = moduleInfo[functionName];

	// doesnt actually average but w/e
	function shitty_averagizer(a, b) {
		return (a + b) / 2;
	}

	info.timeTaken.average =
		info.timeTaken.callback.reduce(shitty_averagizer, 0) +
		info.timeTaken.blocking.reduce(shitty_averagizer, 0) +
		info.timeTaken.promise.reduce(shitty_averagizer, 0);

	info.timeTaken['total-count'] =
		info.timeTaken.callback.length +
		info.timeTaken.blocking.length +
		info.timeTaken.promise.length;

	return info;
}
