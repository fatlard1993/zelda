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
	f: '<folder> (Add an additional folder to source modules)'
});

var args = yargs.argv;

args.v = Number(args.v);

//log args polyfill
process.env.DBG = args.v;
process.env.COLOR = true;

const log = require('log');

log(1)(args);

const zelda = require('./zelda');

zelda(args);