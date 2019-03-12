const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const findRoot = require('find-root');
const rimraf = require('rimraf');

function getCodePackages(codePath){
	try{
		const packages = {};

		fs.readdirSync(codePath).forEach((entry) => {
			const pkgPath = path.join(codePath, entry);

			try{ packages[require(path.join(pkgPath, 'package.json')).name] = pkgPath; }

			catch(err){ return; }
		});

		return packages;
	}

	catch(err){ throw new Error(`Could not find ${codePath} | ${err.message}`); }
}

function traverseNodeModules(pkgPath, cb){
	try{
		const modulesPath = path.join(pkgPath, 'node_modules');
		const entries = fs.readdirSync(modulesPath).filter((entry) => { return !fs.lstatSync(path.join(modulesPath, entry)).isSymbolicLink(); });

		entries.forEach((entry) => {
			const entryPath = path.join(modulesPath, entry);

			traverseNodeModules(entryPath, cb);

			cb(entry, entryPath);
		});
	}

	catch(err){ return; }
}

function rmDir(dirPath, simulate){
	console.log(`[zelda] rm -rf ${dirPath}`);

	if(!simulate) rimraf.sync(dirPath);
}

function npmInstall(packagePath, simulate){
	console.log(`[zelda] cd ${packagePath} && rm node_modules/ && npm i`);

	if(simulate) return;

	rimraf.sync(path.join(packagePath, 'node_modules'));

	childProcess.spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['i'], { cwd: packagePath, stdio: 'inherit' });
}

module.exports = function zelda(opts = {}){
	const rootPath = findRoot(process.cwd());
	const codePath = opts.parentFolder ? path.resolve(opts.parentFolder) : path.resolve(rootPath, '..');

	rmDir(path.join(codePath, 'node_modules'));

	console.log(`[zelda] cd ${codePath} && ln -s . node_modules`);

	if(!opts.simulate) fs.symlinkSync('.', path.join(codePath, 'node_modules'), 'dir');

	const codePackages = getCodePackages(codePath);

	if(opts.install) npmInstall(rootPath, opts.simulate);

	const packagesToPurge = {};

	traverseNodeModules(rootPath, (packageName) => {
		if(!codePackages[packageName] || packagesToPurge[packageName]) return;

		packagesToPurge[packageName] = true;

		if(opts.install) npmInstall(path.join(codePath, packageName), opts.simulate);

		rmDir(path.join(rootPath, 'node_modules', packageName), opts.simulate);
	});

	Object.keys(packagesToPurge).forEach((packageToPurge) => {
		traverseNodeModules(path.join(codePath, packageToPurge), (packageName, packagePath) => {
			if(packagesToPurge[packageName]) rmDir(packagePath, opts.simulate);
		});
	});
};