#!/usr/bin/env node

const yargs = require('yargs');

yargs.parserConfiguration({
	'camel-case-expansion': false
});

yargs.alias({
	h: 'help',
	ver: 'version',
	v: 'verbosity',
	c: 'clean',
	s: 'simulate',
	t: 'target',
	a: 'autoFolders',
	d: 'autoFoldersDepth',
	p: 'projectRoot',
	f: 'folder',
	r: 'recursive'
});

yargs.boolean(['h', 'ver', 'i', 's', 'a', 'r', 'npmCache']);

//todo support saving different defaults
yargs.default({
	v: 1,
	a: true,
	d: 2
});

yargs.describe({
	h: 'This',
	v: '<level>',
	c: 'Clean old symlinks and npm cache first',
	s: 'See what would happen, without making changes',
	t: '<folder> The target package folder(s) (defaults to process.cwd())',
	a: 'Automatically find projectRoot and detect folders to source packages',
	autoFoldersDepth: '<levels> The number of levels to traverse for finding source folders containing local packages',
	p: '<folder> The top level folder containing all your code (defaults to targetPackage/..)',
	f: '<folder> Additional folder(s) to source packages',
	r: 'Recursively walk through and link all local git projects in the current source folders',
	npmCache: 'Cache and use remote npm packages as a tarballs in zelda/temp'
});

const args = yargs.argv;

['_', '$0', 'v', 'c', 's', 't', 'a', 'd', 'p', 'f', 'r'].forEach((item) => { delete args[item]; });

const opts = Object.assign(args, { args: Object.assign({}, args), verbosity: Number(args.verbosity) });

const log = new (require('log'))({ tag: 'zelda', color: true, verbosity: opts.verbosity });

log(1)('Options', opts);

require('./zelda')(opts);