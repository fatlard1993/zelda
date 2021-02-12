const os = require('os');
const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const findRoot = require('find-root');
const fsExtended = require('fs-extended');
const now = require('performance-now');
const zlog = new (require('log'))({ tag: 'zelda' });
const log = new (require('log'))({ verbosity: zlog.opts.verbosity });

function forEachNodeModule(packagePath, cb){
	const modulesPath = path.join(packagePath, 'node_modules');

	if(!fs.existsSync(modulesPath)) return;

	const modules = fsExtended.getChildFolders(modulesPath, { blacklist: { '.bin': 1 }});

	modules.forEach((packageName) => {
		const packagePath = path.join(modulesPath, packageName);

		cb(packageName, packagePath);

		forEachNodeModule(packagePath, cb);
	});
}

function forEachPackage(parentFolder, cb){
	if(!fs.existsSync(parentFolder)) return;

	const packages = fsExtended.getChildFolders(parentFolder, { blacklist: { '.bin': 1 }});

	packages.forEach((packageName) => {
		const packagePath = path.join(parentFolder, packageName);

		if(!fs.existsSync(path.join(packagePath, 'package.json'))) return;

		cb(packageName, packagePath);

		forEachPackage(packagePath, cb);
	});
}

function folderContainsPackages(parentFolder){
	let result = false;

	if(parentFolder === os.homedir()) return false;

	const folders = fsExtended.getChildFolders(parentFolder, { blacklist: { node_modules: 1 } });

	for(let x = 0, count = folders.length, folder; x < count; ++x){
		folder = folders[x];

		if(folder[0] !== '.' && !fs.existsSync(path.join(parentFolder, folder, 'package.json'))) continue;

		result = true;

		break;
	}

	return result;
}

function findProjectRoot(targetFolder){
	if(targetFolder === os.homedir()) return log.error(`Could not find a project root folder above ${targetFolder}`);

	let projectRoot;
	const parentFolder = path.resolve(targetFolder, '..');

	var targetContainPackages = folderContainsPackages(targetFolder), parentContainPackages = folderContainsPackages(parentFolder);

	log.info(4)(targetFolder, targetContainPackages, parentFolder, parentContainPackages);

	if(targetContainPackages && !parentContainPackages) projectRoot = targetFolder;

	if(!projectRoot) projectRoot = findProjectRoot(parentFolder);

	return projectRoot;
}

function findPackageSourceFolders(targetFolder, levels){
	let folders = {};

	if(!levels || fs.existsSync(path.join(targetFolder, 'package.json'))) return folders;

	if(folderContainsPackages(targetFolder)) folders[targetFolder] = 1;

	fsExtended.getChildFolders(targetFolder, { blacklist: { node_modules: 1 } }).forEach((folder) => { folders = Object.assign(folders, findPackageSourceFolders(path.join(targetFolder, folder), levels - 1)); });

	return folders;
}

function findPackage(parentFolders, packageName){
	let localPackageFolder;

	for(let x = 0, count = parentFolders.length; x < count; ++x){
		localPackageFolder = path.join(parentFolders[x], packageName);

		if(!fs.existsSync(localPackageFolder)) localPackageFolder = '';

		else break;
	}

	return localPackageFolder;
}

module.exports = function zelda(opts = {}){
	const simulationVerbosity = opts.simulate ? 0 : 3;

	function rmdir(folder){
		if(!fs.existsSync(folder)) return false;

		log.warn(simulationVerbosity)(`$ rm -rf ${folder}`);

		if(!opts.simulate) fsExtended.rmPattern(folder, /.*/);

		return true;
	}

	function mkdir(folder){
		if(fs.existsSync(folder)) return false;

		log.warn(simulationVerbosity)(`$ mkdir -p ${folder}`);

		if(!opts.simulate) fsExtended.mkdir(folder);

		return true;
	}

	function spawnPackageManager(args, cwd){
		const platformSpecific = {
			win32: 'npm.cmd',
			default: 'npm'
		}, cmd = platformSpecific[process.platform] || platformSpecific.default;

		log.warn(simulationVerbosity)(`$ cd ${cwd} && ${cmd} ${args}`);

		return opts.simulate ? { status: 1 } : childProcess.spawnSync(cmd, args, { cwd: cwd, stdio: 'inherit' });
	}

	function logArr(verbosity, label, arr){ log.info(verbosity)(`\n[[${label}]]\n ┣ ${arr.join('\n ┣ ')}\n`); }

	const start = now();
	const tempFolder = path.join(findRoot(__dirname), 'temp');
	const tempCache = path.join(tempFolder, 'cache');
	const npmCache = path.join(tempFolder, 'npmCache');
	const cwd = process.cwd();

	if(!opts.recursive && !opts.target){
		try{ findRoot(cwd); }
		catch(err){
			zlog.info('No target specified .. No single git project found .. Attempting recursive mode');

			opts.recursive = true;
		}
	}

	const targetPackageRoot = opts.recursive ? cwd : (opts.target instanceof Array ? cwd : findRoot(opts.target || cwd));
	const targetNodeModules = opts.recursive ? undefined : path.join(targetPackageRoot, 'node_modules');
	const projectRoot = (opts.projectRoot ? path.resolve(opts.projectRoot) : (opts.autoFolders ? findProjectRoot(targetPackageRoot) : path.resolve(targetPackageRoot, '..'))) || process.cwd();
	const rootNodeModules = path.join(projectRoot, 'node_modules');

	zlog.info(opts.recursive ? 0 : 1)(`Targeting: ${opts.recursive ? projectRoot : targetPackageRoot}`);
	if(!opts.recursive && !opts.reRun) zlog.info(`Using "${rootNodeModules}" to store links`);

	let traversed = 0, installedRemotePackages = 0, totalPreMappedPackages = 0, foundPackageCount = 0, createdSymlinks = 0, cleanedReferences = 0, recursivelyRan = 0, newCache = 0, usedCache = 0;
	let searchFolders = [];

	if(opts.autoFolders) searchFolders = Object.keys(findPackageSourceFolders(projectRoot, opts.autoFoldersDepth));
	if(opts.folder) searchFolders = searchFolders.concat(opts.folder instanceof Array ? opts.folder : [opts.folder]);

	if(!searchFolders.length) return log.error(`No package source folders are configured`);

	if(!opts.reRun){
		log.info(`Using ${searchFolders.length} folders to search for local packages`);
		logArr(0, 'searchFolders', searchFolders);
	}

	function printStats(){
		let time = (now() - start) / 1000;

		time = time < 60 ? `${time}s` : `${Math.floor(time / 60)}m ${time - (Math.floor(time / 60) * 60)}s`;

		// zlog[opts.simulate ? 'warn' : 'info'](opts.reRun ? 1 : 0)(`${opts.simulate ? '[simulate] ' : ''}Done with ${targetPackageRoot} .. Traversed ${traversed} folders .. Installed ${installedRemotePackages} packages .. Utilized pre-mapped packages in ${totalPreMappedPackages} places .. Found ${foundPackageCount} new local packages .. Created ${createdSymlinks} symlinks .. Cleaned ${cleanedReferences} references .. Recursively ran zelda for ${recursivelyRan} local packages .. Took ${time}`);
		zlog[opts.simulate ? 'warn' : 'info'](opts.reRun ? 1 : 0)(`${opts.simulate ? '[simulate] ' : ''}Done${opts.recursive ? '' : ' with '+ targetPackageRoot} Took ${time}
Traversed ${traversed} folders
Installed ${installedRemotePackages} remote packages
Utilized pre-mapped packages in ${totalPreMappedPackages} places
Found ${foundPackageCount} local packages
Created ${createdSymlinks} symlinks
Cleaned ${cleanedReferences} references
Cached ${newCache} new npm packages
Utilized ${usedCache} cached npm packages
Recursively ran zelda for ${recursivelyRan} local packages`);
	}

	function updateStats(stats){
		traversed += stats.traversed;
		installedRemotePackages += stats.installedRemotePackages;
		totalPreMappedPackages += stats.totalPreMappedPackages;
		foundPackageCount += stats.foundPackageCount;
		createdSymlinks += stats.createdSymlinks;
		cleanedReferences += stats.cleanedReferences;
		newCache += stats.newCache;
		usedCache += stats.usedCache;
	}

	function reRun(newOpts){
		updateStats(zelda(Object.assign(opts, { reRun: true, fullClean: false, recursive: false, autoFolders: false, folder: searchFolders, projectRoot }, newOpts)));
	}

	if(!opts.reRun && opts.fullClean){
		rmdir(rootNodeModules);
		rmdir(tempFolder);
	}
	if(opts.cleanInstall) rmdir(targetNodeModules);

	mkdir(rootNodeModules);
	mkdir(tempCache);
	mkdir(npmCache);
	mkdir(targetNodeModules);

	if(opts.target instanceof Array){
		opts.target.forEach((name) => {
			reRun({ target: path.resolve(projectRoot, name) });
		});

		printStats();

		return;
	}

	if(opts.recursive){
		searchFolders.forEach((parentFolder) => {
			forEachPackage(parentFolder, (name) => {
				++recursivelyRan;

				reRun({ target: path.resolve(parentFolder, name) });
			});
		});

		printStats();

		return;
	}

	const targetPackageJSON = require(path.join(targetPackageRoot, 'package.json'));
	const targetPackageDependencyNames = Object.keys(Object.assign(targetPackageJSON.dependencies || {}, targetPackageJSON.devDependencies || {}) || {});
	const preMappedPackageNames = fs.readdirSync(rootNodeModules);
	const preMappedPackages = Object.fromEntries(preMappedPackageNames.map((item) => { return [item, 1]; }));
	const tempCacheNames = fs.readdirSync(tempCache) || [];
	const dependenciesToInstall = [], foundPackages = {};

	function findLocalCopy(packageName){
		log(3)(`Checking for local copy of "${packageName}"`);

		++traversed;

		if(preMappedPackages[packageName]) return preMappedPackages[packageName];
		if(foundPackages[packageName]) return foundPackages[packageName];

		const foundPackage = findPackage(searchFolders, packageName);

		if(foundPackage){
			foundPackages[packageName] = foundPackage;

			log.info(2)(`Found local copy of "${packageName}"`);
		}

		return foundPackage;
	}

	if(targetPackageDependencyNames.length) logArr(2, 'targetPackageDependencyNames', targetPackageDependencyNames);
	if(!opts.fullClean) logArr(2, 'preMappedPackageNames', preMappedPackageNames);
	if(opts.npmCache && tempCacheNames.length) logArr(2, 'tempCacheNames', tempCacheNames);

	const installedModules = Object.fromEntries(fs.readdirSync(targetNodeModules).map((item) => { return [item, 1]; }));

	targetPackageDependencyNames.forEach((name) => {
		if(preMappedPackages[name]) return ++totalPreMappedPackages;

		if(findLocalCopy(name) || installedModules[name]) return;

		if(opts.npmCache){
			const tarCacheFile = tempCacheNames.filter((tarName) => { return new RegExp(`.*\\b${name}\\b.*\\.tgz`).test(tarName); })[0];

			if(tarCacheFile) return dependenciesToInstall.push(path.join(tempCache, tarCacheFile));
		}

		++installedRemotePackages;

		dependenciesToInstall.push(name);
	});

	const dependenciesToInstallCount = dependenciesToInstall.length;

	if(dependenciesToInstallCount){
		log.info(`Installing ${dependenciesToInstallCount} remote package${dependenciesToInstallCount > 1 ? 's' : ''} for ${targetPackageRoot}`);
		logArr(1, 'dependenciesToInstall', dependenciesToInstall);

		spawnPackageManager(['i', '--silent', '--no-save', `--cache=${npmCache}`].concat(dependenciesToInstall), targetPackageRoot);

		if(opts.npmCache){
			dependenciesToInstall.forEach((name) => {
				if(name.endsWith('.tgz')) return (++usedCache);

				log.info(`Caching ${name}`);

				var installResult = spawnPackageManager(['pack', '--silent', name], tempCache);

				log.warn(installResult.status === 0 ? 2 : 0)('Pack install result', installResult);

				if(installResult.status !== 0) log.warn(`Unable to pack ${name}`);

				else ++newCache;
			});
		}
	}

	forEachNodeModule(targetPackageRoot, findLocalCopy);

	const foundPackageNames = Object.keys(foundPackages);
	foundPackageCount += foundPackageNames.length;

	if(foundPackageCount) logArr(2, 'foundPackageNames', foundPackageNames);

	const symlinkedFileNames = [];

	foundPackageNames.forEach((name) => {
		const foundPackageLocation = foundPackages[name];

		++traversed;

		const cleanedReference = rmdir(path.join(targetNodeModules, name));

		if(cleanedReference) ++cleanedReferences;

		if(!fs.existsSync(path.join(rootNodeModules, name))){
			log.info(3)(`Linking local copy of "${name}" to "${rootNodeModules}`);

			symlinkedFileNames.push(name);

			log.warn(simulationVerbosity)(`cd ${rootNodeModules} && ln -s ${foundPackageLocation} ${name}`);

			if(!opts.simulate) fs.symlinkSync(foundPackageLocation, path.join(rootNodeModules, name), 'dir');
		}
	});

	const alreadyRan = {};

	foundPackageNames.forEach((name) => {
		if(alreadyRan[name]) return;

		const foundPackageLocation = foundPackages[name];

		++traversed;

		if(foundPackageLocation !== targetPackageRoot){
			reRun({ target: foundPackageLocation });

			alreadyRan[name] = true;
		}
	});

	createdSymlinks += symlinkedFileNames.length;

	if(createdSymlinks) logArr(1, 'symlinkedFileNames', symlinkedFileNames);

	printStats();

	return { traversed, installedRemotePackages, totalPreMappedPackages, foundPackageCount, createdSymlinks, cleanedReferences, newCache, usedCache };
};