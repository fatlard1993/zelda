#!/usr/bin/env node

const minimist = require('minimist');

const zelda = require('./zelda');

const argv = minimist(process.argv.slice(2), {
	alias: {
		i: 'install',
		s: 'simulate',
		h: 'help',
		v: 'version'
	},
	boolean: [
		'install',
		'simulate',
		'help',
		'version'
	]
});

if(argv.version) console.log(require('../package.json').version);

else if(argv.help){
	var help = 'Usage: zelda [OPTIONS]';
	help += '\n -i, --install     force run `npm install` on each package';
	help += '\n -s, --simulate    see what would happen, without making any changes';
	help += '\n -h, --help        show help (this)';
	help += '\n -v, --version     show version';

	console.log(help);
}

else zelda(argv);