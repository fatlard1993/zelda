const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const findRoot = require('find-root');
const rimraf = require('rimraf');
const now = require('performance-now');

const localPackageFolders = {};

function log(msg){
	console.log(`[zelda] ${msg}`);
}

function getLocalPackageFolder(parentFolders, packageName){
	if(localPackageFolders[packageName]) return localPackageFolders[packageName];

	let localPackageFolder;

	parentFolders.forEach((folder) => {
		folder = path.join(folder, packageName);

		if(fs.existsSync(folder)) localPackageFolder = folder;
	});

	if(localPackageFolder) localPackageFolders[packageName] = localPackageFolder;

	return localPackageFolder;
}

function getChildFolders(folder){
	return fs.readdirSync(folder).filter((entry) => {
		const stats = fs.lstatSync(path.join(folder, entry));

		return stats.isDirectory() && !stats.isSymbolicLink();
	});
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

	for(var x = 0, count = folders.length, folder, folderChildren; x < count; ++x){
		folder = path.join(parentFolder, folders[x]);
		folderChildren = getChildFolders(folder);

		for(var y = 0, yCount = folderChildren.length, folderGrandchild; y < yCount; ++y){
			folderGrandchild = path.join(folder, folderChildren[y]);

			if(fs.existsSync(path.join(folderGrandchild, 'package.json'))){
				localPackageFolders.push(folder);

				break;
			}
		}
	}

	log(`Found ${localPackageFolders.length} local package folders: ${localPackageFolders.join(', ')}`);

	return localPackageFolders;
}

function rmDir(folder, opts){
	if(!fs.existsSync(folder)) return;

	if(opts.simulate) return log(`rm -rf ${folder}`);

	rimraf.sync(folder);
}

function npmInstall(packageFolder, opts){
	if(!fs.existsSync(path.join(packageFolder, 'node_modules'))){
		log(`${packageFolder} has no node_modules ... Must install to continue`);

		opts.simulate = false;
	}

	else if(!opts.install) return;

	rmDir(path.join(packageFolder, 'node_modules'), opts);

	if(opts.simulate) log(`cd ${packageFolder} && npm i`);
	else childProcess.spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['i', '--loglevel=error'], { cwd: packageFolder, stdio: 'inherit' });
}

module.exports = function zelda(opts = {}){
	const start = now();
	const rootPackageFolder = findRoot(process.cwd());
	const parentFolder = opts.parentFolder ? path.resolve(opts.parentFolder) : path.resolve(rootPackageFolder, '..');
	const parentModulesFolder = path.join(parentFolder, 'node_modules');
	let localPackageFolders = [parentFolder];

	if(opts.autoFolders) localPackageFolders = localPackageFolders.concat(findLocalPackageFolders(parentFolder));

	if(opts.folder) localPackageFolders = localPackageFolders.concat(typeof opts.folder === 'object' ? opts.folder : [opts.folder]);

	if(fs.existsSync(parentModulesFolder) && opts.clean) rmDir(parentModulesFolder, opts);

	if(!fs.existsSync(parentModulesFolder)){
		if(opts.simulate) log(`mkdir ${parentFolder}/node_modules`);
		else fs.mkdirSync(parentModulesFolder);
	}

	npmInstall(rootPackageFolder, opts);

	const packagesToPurge = {};

	traverseNodeModules(rootPackageFolder, (packageName) => {
		if(packagesToPurge[packageName]) return;

		const localPackageFolder = getLocalPackageFolder(localPackageFolders, packageName);

		if(!localPackageFolder) return;

		packagesToPurge[packageName] = true;

		npmInstall(localPackageFolder, opts);

		rmDir(path.join(rootPackageFolder, 'node_modules', packageName), opts);
	});

	const packageNamesToPurge = Object.keys(packagesToPurge), packagesToPurgeCount = packageNamesToPurge.length;

	packageNamesToPurge.forEach((packageToPurge) => {
		const localPackageFolder = getLocalPackageFolder(localPackageFolders, packageToPurge);

		if(opts.simulate) log(`cd ${parentFolder}/node_modules && ln -s ${localPackageFolder} ${packageToPurge}`);
		else fs.symlinkSync(localPackageFolder, path.join(parentFolder, 'node_modules', packageToPurge), 'dir');

		traverseNodeModules(localPackageFolder, (packageName, packageFolder) => {
			if(packagesToPurge[packageName]) rmDir(packageFolder, opts);
		});
	});

	if(packagesToPurgeCount) log(`${opts.simulate ? 'SIMULATED' : ''} Setup links for ${packagesToPurgeCount} local packages in ${(now() - start) / 1000}s. Packages: ${packageNamesToPurge.join(', ')}`);
};