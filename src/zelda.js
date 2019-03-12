const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const findRoot = require('find-root');
const rimraf = require('rimraf');

const localPackageFolders = {};

function getLocalPackageFolder(parentFolders, packageName){
	if(localPackageFolders[packageName]) return localPackageFolders[packageName];

	let localPackageFolder;

	parentFolders.forEach((folder) => {
		folder = path.join(folder, packageName);

		if(fs.existsSync(folder)) localPackageFolder = folder;
	});

	if(localPackageFolder){
		console.log('[zelda] Found local package - ', localPackageFolder);

		localPackageFolders[packageName] = localPackageFolder;
	}

	return localPackageFolder;
}

function traverseNodeModules(pkgPath, cb){
	try{
		const modulesPath = path.join(pkgPath, 'node_modules');
		const entries = fs.readdirSync(modulesPath).filter((entry) => { return !fs.lstatSync(path.join(modulesPath, entry)).isSymbolicLink(); });

		entries.forEach((entry) => {
			const entryPath = path.join(modulesPath, entry);

			cb(entry, entryPath);

			traverseNodeModules(entryPath, cb);
		});
	}

	catch(err){ return; }
}

function rmDir(dirPath, simulate){
	console.log(`[zelda] rm -rf ${dirPath}`);

	if(!simulate) rimraf.sync(dirPath);
}

function npmInstall(packageFolder, simulate){
	console.log(`[zelda] cd ${packageFolder} && rm -rf node_modules/ && npm i`);

	if(simulate) return;

	rimraf.sync(path.join(packageFolder, 'node_modules'));

	childProcess.spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['i'], { cwd: packageFolder, stdio: 'inherit' });
}

module.exports = function zelda(opts = {}){
	const rootPackageFolder = findRoot(process.cwd());
	const parentFolder = opts.parentFolder ? path.resolve(opts.parentFolder) : path.resolve(rootPackageFolder, '..');
	let localPackageFolders = [parentFolder];

	if(opts.folder) localPackageFolders = localPackageFolders.concat(typeof opts.folder === 'object' ? opts.folder : [opts.folder]);

	rmDir(path.join(parentFolder, 'node_modules'));

	console.log(`[zelda] cd ${parentFolder} && mkdir node_modules`);

	if(!opts.simulate) fs.mkdirSync(path.join(parentFolder, 'node_modules'));

	if(opts.install) npmInstall(rootPackageFolder, opts.simulate);

	const packagesToPurge = {};

	traverseNodeModules(rootPackageFolder, (packageName) => {
		if(packagesToPurge[packageName]) return;

		const localPackageFolder = getLocalPackageFolder(localPackageFolders, packageName);

		if(!localPackageFolder) return;

		packagesToPurge[packageName] = true;

		if(opts.install) npmInstall(localPackageFolder, opts.simulate);

		rmDir(path.join(rootPackageFolder, 'node_modules', packageName), opts.simulate);
	});

	Object.keys(packagesToPurge).forEach((packageToPurge) => {
		const localPackageFolder = getLocalPackageFolder(localPackageFolders, packageToPurge);

		console.log(`[zelda] cd ${parentFolder}/node_modules && ln -s ${localPackageFolder} ${packageToPurge}`);

		if(!opts.simulate) fs.symlinkSync(localPackageFolder, path.join(parentFolder, 'node_modules', packageToPurge), 'dir');

		traverseNodeModules(localPackageFolder, (packageName, packageFolder) => {
			if(packagesToPurge[packageName]) rmDir(packageFolder, opts.simulate);
		});
	});
};