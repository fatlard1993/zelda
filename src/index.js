import argi from 'argi';
import Log from 'log';

import packageJSON from '../package.json';

import zelda from './zelda';

argi.package = packageJSON;
argi.defaults.type = 'boolean';

const { options } = argi.parse({
	verbosity: {
		type: 'number',
		defaultValue: 1,
		alias: 'v',
	},
	preclean: {
		description: 'Clean old symlinks first',
		defaultValue: true,
		alias: 'C',
	},
	simulate: {
		description: 'See what would happen, without making changes',
		alias: 's',
	},
	target: {
		type: 'string',
		description: '<folder> The target package folder(s)',
		defaultValue: process.cwd(),
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
		description: '<folder> The top level folder containing all your code (defaults to target/..)',
		alias: 'p',
	},
	folder: {
		type: 'string',
		description: '<folder> Additional folder(s) to source packages',
		transform: value => {
			return argi.options.folder ? argi.options.folder.concat(value) : [value];
		},
		alias: 'f',
	},
	recursive: {
		description: 'Recursively walk through and link all local git projects in the current source folders',
		alias: 'r',
	},
});

const log = new Log({ tag: 'zelda', color: true, verbosity: options.verbosity });

log(2)('Options', options);

zelda(options);
