const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const findRoot = require('find-root');
const rimraf = require('rimraf');

function getCodePackages(codePath){
	let entries;

	try{
		entries = fs.readdirSync(codePath);
	}

	catch(err){
		throw new Error(`Could not find ${codePath} | ${err.message}`);
	}

	const packages = {};

	entries.forEach(function(entry){
		const pkgPath = path.join(codePath, entry);

		try{
			const pkg = require(path.join(pkgPath, 'package.json'));

			packages[pkg.name] = pkgPath;
		}

		catch(err){
			return; // ignore folders without package.json
		}
	});

	return packages;
}

function traverseNodeModules(pkgPath, cb){
	const modulesPath = path.join(pkgPath, 'node_modules');
	let entries;

	try{
		entries = fs.readdirSync(modulesPath);
	}

	catch(err){
		return; // no node_modules
	}

	entries = entries.filter(function(entry){
		const stat = fs.lstatSync(path.join(modulesPath, entry));

		return !stat.isSymbolicLink();
	});

	entries.forEach(function(entry){
		const entryPath = path.join(modulesPath, entry);

		traverseNodeModules(entryPath, cb);

		cb(entry, entryPath);
	});
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

module.exports = function zelda(opts){
	if(!opts) opts = {};

	// Use folder with nearest package.json as root
	const rootPath = findRoot(process.cwd());

	const rootName = require(path.join(rootPath, 'package.json')).name;
	const codePath = path.resolve(rootPath, '..');

	if(!rootName) throw new Error('[zelda] Root package must have a name');

	rmDir(path.join(codePath, 'node_modules'));

	// add node_modules symlink in code folder - MAGIC
	console.log(`[zelda] cd ${codePath} && ln -s . node_modules`);

	if(!opts.simulate) fs.symlinkSync('.', path.join(codePath, 'node_modules'), 'dir');

	const codePackages = getCodePackages(codePath);

	if(opts.install) npmInstall(rootPath, opts.simulate);

	const packagesToPurge = { [rootName]: true };

	traverseNodeModules(rootPath, function(packageName, packagePath){
		if(!codePackages[packageName]) return;

		packagesToPurge[packageName] = true;

		if(opts.install) npmInstall(path.join(codePath, packageName), opts.simulate);

		if(packagesToPurge[packageName]) rmDir(packagePath, opts.simulate);
	});

	Object.keys(packagesToPurge).forEach(function(packageToPurge){
		if(packageToPurge === rootName) return;

		const packagePath = path.join(codePath, packageToPurge);

		traverseNodeModules(packagePath, function(packageName, packagePath){
			if(packagesToPurge[packageName]) rmDir(packagePath, opts.simulate);
		});
	});
};