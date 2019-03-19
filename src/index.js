#!/usr/bin/env node

const yargs = require('yargs');

const zelda = require('./zelda');

yargs.alias({
	h: 'help',
	v: 'version',
	i: 'install',
	s: 'simulate',
	a: 'autoFolders',
	p: 'parentFolder',
	f: 'folder'
});

yargs.boolean(['i', 's', 'a']);

yargs.describe({
	i: 'Force run `npm install` on each package',
	s: 'See what would happen, without making changes',
	a: 'Automatically detect folders to source modules',
	p: 'The top level folder containing all your code',
	f: 'Add an additional folder to source modules'
});

const args = yargs.argv;

zelda(args);