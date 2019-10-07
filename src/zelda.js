const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const findRoot = require('find-root');
const rimraf = require('rimraf');
const now = require('performance-now');
const log = require('log');

const localPackageFolders = {};
let opts = {};

function getLocalPackageFolder(parentFolders, packageName){
	if(localPackageFolders[packageName]) return localPackageFolders[packageName];

	let localPackageFolder;

	for(let x = 0, count = parentFolders.length; x < count; ++x){
		localPackageFolder = path.join(parentFolders[x], packageName);

		if(!fs.existsSync(localPackageFolder)) localPackageFolder = '';

		else break;
	}

	if(localPackageFolder) localPackageFolders[packageName] = localPackageFolder;

	return localPackageFolder;
}

function getChildFolders(folder){
	try{
		return fs.readdirSync(folder).filter((entry) => {
			const stats = fs.lstatSync(path.join(folder, entry));

			return stats.isDirectory() && !stats.isSymbolicLink();
		});
	}

	catch(e){
		return [];
	}
}

function traverseNodeModules(pkgPath, cb){
	const modulesPath = path.join(pkgPath, 'node_modules');

	if(!fs.existsSync(modulesPath)) return;

	const entries = getChildFolders(modulesPath);

	entries.forEach((entry) => {
		const entryPath = path.join(modulesPath, entry);

		cb(entry, entryPath);

		traverseNodeModules(entryPath, cb);
	});
}

function findLocalPackageFolders(parentFolder){
	const folders = getChildFolders(parentFolder);
	const localPackageFolders = [];

	for(let x = 0, count = folders.length, folder, folderChildren; x < count; ++x){
		folder = path.join(parentFolder, folders[x]);
		folderChildren = getChildFolders(folder);

		if(fs.existsSync(path.join(folder, 'package.json')) && !localPackageFolders.includes(parentFolder)) localPackageFolders.push(parentFolder);

		for(let y = 0, yCount = folderChildren.length, folderChild; y < yCount; ++y){
			folderChild = path.join(folder, folderChildren[y]);

			if(fs.existsSync(path.join(folderChild, 'package.json')) && !localPackageFolders.includes(folder)){
				localPackageFolders.push(folder);

				break;
			}
		}
	}

	log.info(`[zelda] Found ${localPackageFolders.length} local package folders: ${localPackageFolders.join(', ')}`);

	return localPackageFolders;
}

function rmDir(folder){
	if(!fs.existsSync(folder)) return;

	log(opts.simulate ? 0 : 1)(`rm -rf ${folder}`);

	if(!opts.simulate) rimraf.sync(folder);
}

function npmInstall(packageFolder){
	if(!fs.existsSync(path.join(packageFolder, 'node_modules'))){
		log.warn(`[zelda] ${packageFolder} has no node_modules ... Must install to continue`);

		if(opts.simulate) return;
	}

	else if(!opts.install) return;

	rmDir(path.join(packageFolder, 'node_modules'));

	log(opts.simulate ? 0 : 1)(`cd ${packageFolder} && npm i`);

	if(!opts.simulate){
		log.info(`[zelda] Installing packages for ${packageFolder}`);

		childProcess.spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['i', '--loglevel=error'], { cwd: packageFolder, stdio: 'inherit' });
	}
}

module.exports = function zelda(options = {}){
	opts = options;

	const start = now();
	const rootPackageFolder = findRoot(process.cwd());
	const parentFolder = opts.parentFolder ? path.resolve(opts.parentFolder) : path.resolve(rootPackageFolder, '..');
	const parentModulesFolder = path.join(parentFolder, 'node_modules');
	let localPackageFolders = [];

	log.info(`[zelda] Using "${parentFolder}" to store links`);

	npmInstall(rootPackageFolder);

	if(opts.autoFolders) localPackageFolders = findLocalPackageFolders(parentFolder);

	if(opts.folder) localPackageFolders = localPackageFolders.concat(typeof opts.folder === 'object' ? opts.folder : [opts.folder]);

	if(fs.existsSync(parentModulesFolder) && opts.clean) rmDir(parentModulesFolder);

	if(!fs.existsSync(parentModulesFolder)){
		log(opts.simulate ? 0 : 1)(`mkdir ${parentFolder}/node_modules`);

		if(!opts.simulate) fs.mkdirSync(parentModulesFolder);
	}

	if(!localPackageFolders.length) return log.warn(`[zelda] No local package folders configured`);

	const packagesToLink = [];
	const linked = [];
	let traversed = 0;

	traverseNodeModules(rootPackageFolder, (packageName) => {
		log(2)(`Checking for local copy of "${packageName}"`);

		++traversed;

		if(packagesToLink[packageName]) return;

		const localPackageFolder = getLocalPackageFolder(localPackageFolders, packageName);

		if(!localPackageFolder) return;

		packagesToLink.push([packageName, localPackageFolder]);
		packagesToLink[packageName] = true;

		npmInstall(localPackageFolder);
	});

	packagesToLink.forEach((packageArr) => {
		const folder = packageArr[1], name = packageArr[0];
		const link = path.join(parentFolder, 'node_modules', name);

		rmDir(path.join(rootPackageFolder, 'node_modules', name));

		if(opts.install) rmDir(link);

		if(!fs.existsSync(link)){
			linked.push(name);

			log(opts.simulate ? 0 : 1)(`cd ${parentFolder}/node_modules && ln -s ${folder} ${name}`);

			if(!opts.simulate) fs.symlinkSync(folder, link, 'dir');
		}

		else log(1)(`Link for ${name} already exists`);

		traverseNodeModules(parentFolder, (packageName, packageFolder) => {
			log(2)(`Checking for nested copy of "${packageName}" in "${packageFolder}"`);

			if(packagesToLink[packageName]) rmDir(packageFolder);
		});
	});

	log.info(`[zelda]${opts.simulate ? '[simulate]' : ''} Traversed ${traversed} folders ... Found ${packagesToLink.length} local packages ... Setup links for ${linked.length} ... took ${(now() - start) / 1000}s`);
	log.info(opts.simulate ? 0 : 1)(linked);
};