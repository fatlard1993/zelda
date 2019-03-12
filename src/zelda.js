const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const findRoot = require('find-root');
const rimraf = require('rimraf');

function getPackages(packageFolder){
	try{
		const packages = {};

		fs.readdirSync(packageFolder).forEach((entry) => {
			const pkgPath = path.join(packageFolder, entry);

			try{ packages[require(path.join(pkgPath, 'package.json')).name] = pkgPath; }

			catch(err){ return; }
		});

		return packages;
	}

	catch(err){ throw new Error(`Could not find ${packageFolder} | ${err.message}`); }
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

	rmDir(path.join(parentFolder, 'node_modules'));

	console.log(`[zelda] cd ${parentFolder} && mkdir node_modules`);

	if(!opts.simulate) fs.mkdirSync(path.join(parentFolder, 'node_modules'));

	const codePackages = getPackages(parentFolder);

	if(opts.install) npmInstall(rootPackageFolder, opts.simulate);

	const packagesToPurge = {};

	traverseNodeModules(rootPackageFolder, (packageName) => {
		if(!codePackages[packageName] || packagesToPurge[packageName]) return;

		packagesToPurge[packageName] = true;

		if(opts.install) npmInstall(path.join(parentFolder, packageName), opts.simulate);

		rmDir(path.join(rootPackageFolder, 'node_modules', packageName), opts.simulate);
	});

	Object.keys(packagesToPurge).forEach((packageToPurge) => {
		const localPackageFolder = path.join(parentFolder, packageToPurge);

		console.log(`[zelda] cd ${parentFolder}/node_modules && ln -s ${localPackageFolder} ${packageToPurge}`);

		if(!opts.simulate) fs.symlinkSync(localPackageFolder, path.join(parentFolder, 'node_modules', packageToPurge), 'dir');

		traverseNodeModules(localPackageFolder, (packageName, packageFolder) => {
			if(packagesToPurge[packageName]) rmDir(packageFolder, opts.simulate);
		});
	});
};