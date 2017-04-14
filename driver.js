// driver.js
'use strict';

const fs = require('fs');


// because it doubles as a library
module.exports.doStuff = ( a, b, callback ) => {
	return new Promise(resolve => {
		fs.readFile('profiled.js', function( err, data) {
			var sum = 0;
			for( var i=0; i<data.toString().length; i++) {
				var value = data.toString()[i];
				if( parseInt(value) === 65 ) {
					sum += value * a + b;
				}
			}
			if( callback ) {
				callback( sum );
			}
			resolve( sum );
		});
	});
};

const debug = function( json ) {
	console.log( JSON.stringify(json, null, 2));
}

var callCount = 0;
const callback = function(answer) {
	callCount++;
	if( callCount === 5) {
		debug(profiled.getInfo('./driver.doStuff'));
	}
};

const profiled = require('./profiled');

const myNewModule = profiled.require('./driver');

myNewModule.doStuff(40,40,callback);
myNewModule.doStuff(40,40).then(callback);
myNewModule.doStuff(40,40,callback);
myNewModule.doStuff(40,40).then(callback);
myNewModule.doStuff(40,40,callback);
