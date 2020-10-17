#!/usr/bin/env node

const yargs = require('yargs');

yargs.alias({
	h: 'help',
	ver: 'version',
	v: 'verbosity',
	c: 'clean',
	i: 'install',
	s: 'simulate',
	a: 'autoFolders',
	p: 'parentFolder',
	f: 'folder'
});

yargs.boolean(['h', 'ver', 'i', 's', 'a']);

yargs.default({
	v: 1
});

yargs.describe({
	h: 'This',
	v: '<level>',
	c: 'Clean old symlinks first',
	i: 'Force run `npm install` on each package',
	s: 'See what would happen, without making changes',
	a: 'Automatically detect folders to source modules',
	p: '<folder> (The top level folder containing all your code)',
	f: '<folder> (An additional folder to source modules)'
});

var args = yargs.argv;

['_', '$0', 'v', 'c', 'i', 's', 'a', 'p', 'f'].forEach((item) => { delete args[item]; });

var opts = Object.assign(args, { args: Object.assign({}, args), verbosity: Number(args.verbosity) });

const log = new (require('log'))({ tag: 'zelda', color: true, verbosity: opts.verbosity });

log(1)('Options', opts);

const zelda = require('./zelda');

zelda(args);