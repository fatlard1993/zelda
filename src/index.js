#!/usr/bin/env node

const argi = require('argi');

argi.defaults.type = 'boolean';

const { options } = argi.parse({
	verbosity: {
		type: 'number',
		defaultValue: 1,
		alias: 'v',
	},
	cleanInstall: {
		description: 'Clean old node_modules before installing',
		alias: 'c',
	},
	preclean: {
		description: 'Clean old symlinks and npm cache first',
		alias: 'C',
	},
	simulate: {
		description: 'See what would happen, without making changes',
		alias: 's',
	},
	target: {
		type: 'string',
		description: '<folder> The target package folder(s) (defaults to process.cwd())',
		alias: 't',
	},
	autoFolders: {
		description: 'Automatically find projectRoot and detect folders to source packages',
		defaultValue: true,
		alias: 'a',
	},
	autoFoldersDepth: {
		type: 'number',
		description: '<levels> The number of levels to traverse for finding source folders containing local packages',
		defaultValue: 2,
		alias: 'd',
	},
	projectRoot: {
		type: 'string',
		description: '<folder> The top level folder containing all your code (defaults to targetPackage/..)',
		alias: 'p',
	},
	folder: {
		type: 'string',
		description: '<folder> Additional folder(s) to source packages',
		transform: (value) => { return argi.options.folder ? argi.options.folder.concat(value) : [value]; },
		alias: 'f',
	},
	recursive: {
		description: 'Recursively walk through and link all local git projects in the current source folders',
		alias: 'r',
	},
	npmCache: {
		description: 'Cache and use remote npm packages as a tarballs in zelda/temp',
	},
});

const log = new (require('log'))({ tag: 'zelda', color: true, verbosity: options.verbosity });

log()('Options', options);

require('./zelda')(options);