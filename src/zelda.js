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
	if(targetFolder === os.homedir()) return log.error('Could not find project root');

	let projectRoot;
	const parentFolder = path.resolve(targetFolder, '..');
	const grandparentFolder = path.resolve(parentFolder, '..');

	var parentContainPackages = folderContainsPackages(parentFolder), grandparentContainsPackages = folderContainsPackages(grandparentFolder);

	log.info(4)(parentFolder, parentContainPackages, grandparentFolder, grandparentContainsPackages);

	if(parentContainPackages && !grandparentContainsPackages) projectRoot = parentFolder;

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
		if(!fs.existsSync(folder)) return;

		log.warn(simulationVerbosity)(`$ rm -rf ${folder}`);

		if(!opts.simulate) fsExtended.rmPattern(folder, /.*/);
	}

	function mkdir(folder){
		if(fs.existsSync(folder)) return;

		log.warn(simulationVerbosity)(`$ mkdir -p ${folder}`);

		if(!opts.simulate) fsExtended.mkdir(folder);
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
	const tempCache = path.join(findRoot(__dirname), 'temp/cache');

	const targetPackageRoot = findRoot(opts.target || process.cwd());
	const targetNodeModules = path.join(targetPackageRoot, 'node_modules');
	const projectRoot = opts.projectRoot ? path.resolve(opts.projectRoot) : (opts.autoFolders ? findProjectRoot(targetPackageRoot) : path.resolve(targetPackageRoot, '..'));
	const rootNodeModules = path.join(projectRoot, 'node_modules');

	log.warn(`\nTargeting: ${targetPackageRoot} .. Using "${rootNodeModules}" to store links\n`);

	let traversed = 0, totalInstalledPackages = 0, totalPreMappedPackages = 0, foundPackageCount = 0, symlinkedFileCount = 0, cleaned = 0;

	function printStats(){
		let time = (now() - start) / 1000;

		time = time < 60 ? `${time}s` : `${Math.floor(time / 60)}m ${time - (Math.floor(time / 60) * 60)}s`;

		zlog[opts.simulate ? 'warn' : 'info'](`${opts.simulate ? '[simulate] ' : ''}Done with ${targetPackageRoot} .. Traversed ${traversed} folders .. Installed ${totalInstalledPackages} packages .. Utilized ${totalPreMappedPackages} pre-mapped packages .. Found ${foundPackageCount} local packages .. Created ${symlinkedFileCount} symlinks .. Cleaned ${cleaned} references .. Took ${time}`);
	}

	let searchFolders = [];

	if(opts.autoFolders) searchFolders = Object.keys(findPackageSourceFolders(projectRoot, opts.autoFoldersDepth));
	if(opts.folder) searchFolders = searchFolders.concat(typeof opts.folder === 'object' ? opts.folder : [opts.folder]);

	if(!searchFolders.length) return log.error(`No package source folders are configured`);

	log.info(`Using ${searchFolders.length} folders to search for local packages`);
	logArr(1, 'searchFolders', searchFolders);

	if(opts.clean){
		rmdir(rootNodeModules);
		rmdir(tempCache);
		rmdir(targetNodeModules);
	}

	mkdir(rootNodeModules);
	mkdir(tempCache);
	mkdir(targetNodeModules);

	if(opts.recursive){
		searchFolders.forEach((parentFolder) => {
			forEachPackage(parentFolder, (packageName) => {
				const stats = zelda(Object.assign(opts, { clean: false, recursive: false, target: path.join(parentFolder, packageName) }));

				traversed += stats.traversed;
				totalInstalledPackages += stats.totalInstalledPackages;
				totalPreMappedPackages += stats.totalPreMappedPackages;
				foundPackageCount += stats.foundPackageCount;
				symlinkedFileCount += stats.symlinkedFileCount;
				cleaned += stats.cleaned;
			});
		});

		printStats();

		return;
	}

	const targetPackageJSON = require(path.join(targetPackageRoot, 'package.json'));
	const targetPackageDependencyNames = Object.keys(targetPackageJSON.dependencies || {});
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

	logArr(2, 'targetPackageDependencyNames', targetPackageDependencyNames);
	if(!opts.clean) logArr(2, 'preMappedPackageNames', preMappedPackageNames);
	if(opts.npmCache && tempCacheNames.length) logArr(2, 'tempCacheNames', tempCacheNames);

	targetPackageDependencyNames.forEach((name) => {
		if(preMappedPackages[name]) return ++totalPreMappedPackages;

		if(opts.npmCache){
			const tarCacheFile = tempCacheNames.filter((tarName) => { return new RegExp(`.*\\b${name}\\b.*\\.tgz`).test(tarName); })[0];

			if(tarCacheFile) return dependenciesToInstall.push(path.join(tempCache, tarCacheFile));
		}

		if(!findLocalCopy(name)) dependenciesToInstall.push(name);
	});

	const dependenciesToInstallCount = dependenciesToInstall.length;

	if(dependenciesToInstallCount){
		log.info(`Installing ${dependenciesToInstallCount} packages for ${targetPackageRoot}`);
		logArr(1, 'dependenciesToInstall', dependenciesToInstall);

		totalInstalledPackages += dependenciesToInstallCount;

		spawnPackageManager(['i', '--silent', '--no-save'].concat(dependenciesToInstall), targetPackageRoot);

		if(opts.npmCache){
			dependenciesToInstall.forEach((name) => {
				if(name.endsWith('.tgz')) return;

				log.info(`Caching ${name}`);

				var installResult = spawnPackageManager(['pack', '--silent', name], path.join(tempCache));

				log.warn(installResult.status === 0 ? 2 : 0)('Pack install result', installResult);

				if(installResult.status !== 0) log.warn(`Unable to pack ${name}`);
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

		rmdir(path.join(targetPackageRoot, 'node_modules', name));

		++cleaned;

		if(!fs.existsSync(path.join(rootNodeModules, name))){
			log.info(3)(`Linking local copy of "${name}" to "${rootNodeModules}`);

			symlinkedFileNames.push(name);

			log.warn(simulationVerbosity)(`cd ${rootNodeModules} && ln -s ${foundPackageLocation} ${name}`);

			if(!opts.simulate) fs.symlinkSync(foundPackageLocation, path.join(rootNodeModules, name), 'dir');
		}

		if(foundPackageLocation !== targetPackageRoot){
			const stats = zelda(Object.assign(opts, { target: foundPackageLocation }));

			traversed += stats.traversed;
			totalInstalledPackages += stats.totalInstalledPackages;
			totalPreMappedPackages += stats.totalPreMappedPackages;
			foundPackageCount += stats.foundPackageCount;
			symlinkedFileCount += stats.symlinkedFileCount;
			cleaned += stats.cleaned;
		}
	});

	symlinkedFileCount += symlinkedFileNames.length;

	if(symlinkedFileCount) logArr(1, 'symlinkedFileNames', symlinkedFileNames);

	printStats();

	return { traversed, totalInstalledPackages, totalPreMappedPackages, foundPackageCount, symlinkedFileCount, cleaned };
};