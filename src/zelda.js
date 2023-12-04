import fs from 'fs';
import path from 'path';

import Log from 'log';
import findRoot from 'find-root';
import now from 'performance-now';
import {
	findPackage,
	findPackageSourceFolders,
	findProjectRoot,
	forEachNodeModule,
	forEachPackage,
	fsUtil,
} from './utils';
const log = new Log({ tag: 'zelda', methodMap: { array: 'info', simulation: 'warn' } });

const zelda = (options = {}) => {
	const simulationVerbosity = options.simulate ? 0 : 3;

	const removeFolder = folder => {
		if (!fs.existsSync(folder)) return false;

		// eslint-disable-next-line spellcheck/spell-checker
		log.simulation(simulationVerbosity)(`$ rm -rf ${folder}`);

		if (!options.simulate) fsUtil.rmPattern(folder, /.*/);

		return true;
	};

	const makeFolder = folder => {
		if (fs.existsSync(folder)) return false;

		log.simulation(simulationVerbosity)(`$ mkdir -p ${folder}`);

		if (!options.simulate) fsUtil.mkdir(folder);

		return true;
	};

	const logArray = (verbosity, label, array) => {
		log.array(verbosity)(`\n[[${label}]]\n ┣ ${array.join('\n ┣ ')}\n`);
	};

	const start = now();
	const cwd = process.cwd();

	if (!options.recursive && !options.target) {
		try {
			findRoot(cwd);
		} catch {
			log.info('No target specified .. No single git project found .. Attempting recursive mode');

			options.recursive = true;
		}
	}

	let targetPackageRoot;

	if (options.recursive) targetPackageRoot = cwd;
	else targetPackageRoot = Array.isArray(options.target) ? cwd : findRoot(options.target || cwd);

	const targetNodeModules = options.recursive ? undefined : path.join(targetPackageRoot, 'node_modules');
	let projectRoot;

	if (options.projectRoot) projectRoot = path.resolve(options.projectRoot);
	else projectRoot = options.autoFolders ? findProjectRoot(targetPackageRoot) : path.resolve(targetPackageRoot, '..');

	if (!projectRoot) projectRoot = process.cwd();

	const rootNodeModules = path.join(projectRoot, 'node_modules');

	log.info(options.recursive ? 0 : 1)(`Targeting: ${options.recursive ? projectRoot : targetPackageRoot}`);
	if (!options.recursive && !options.reRun) log.info(`Using "${rootNodeModules}" to store links`);

	let traversed = 0,
		missingRemotePackages = 0,
		totalPreMappedPackages = 0,
		foundPackageCount = 0,
		createdSymlinks = 0,
		cleanedReferences = 0,
		recursivelyRan = 0;
	let searchFolders = [];

	if (options.autoFolders) searchFolders = Object.keys(findPackageSourceFolders(projectRoot, options.autoFoldersDepth));
	if (options.folder)
		searchFolders = searchFolders.concat(Array.isArray(options.folder) ? options.folder : [options.folder]);

	if (searchFolders.length === 0) return log.error(`No package source folders are configured`);

	if (!options.reRun) {
		log.info(`Using ${searchFolders.length} folders to search for local packages`);
		logArray(0, 'searchFolders', searchFolders);
	}

	const printStats = () => {
		let time = (now() - start) / 1000;

		time = time < 60 ? `${time}s` : `${Math.floor(time / 60)}m ${time - Math.floor(time / 60) * 60}s`;

		// zlog[opts.simulate ? 'warn' : 'info'](opts.reRun ? 1 : 0)(`${opts.simulate ? '[simulate] ' : ''}Done with ${targetPackageRoot} .. Traversed ${traversed} folders .. Found ${missingRemotePackages} missing packages .. Utilized pre-mapped packages in ${totalPreMappedPackages} places .. Found ${foundPackageCount} new local packages .. Created ${createdSymlinks} symlinks .. Cleaned ${cleanedReferences} references .. Recursively ran zelda for ${recursivelyRan} local packages .. Took ${time}`);
		log[options.simulate ? 'warn' : 'info'](options.reRun ? 1 : 0)(`${options.simulate ? '[simulate] ' : ''}Done${
			options.recursive ? '' : ' with ' + targetPackageRoot
		} Took ${time}
Traversed ${traversed} folders
Found ${missingRemotePackages} missing remote packages
Utilized pre-mapped packages in ${totalPreMappedPackages} places
Found ${foundPackageCount} local packages
Created ${createdSymlinks} symlinks
Cleaned ${cleanedReferences} references
${options.recursive ? `Recursively ran zelda for ${recursivelyRan} local packages` : ''}`);
	};

	const updateStats = stats => {
		traversed += stats.traversed;
		missingRemotePackages += stats.missingRemotePackages;
		totalPreMappedPackages += stats.totalPreMappedPackages;
		foundPackageCount += stats.foundPackageCount;
		createdSymlinks += stats.createdSymlinks;
		cleanedReferences += stats.cleanedReferences;
	};

	const reRun = newOptions => {
		updateStats(
			zelda(
				Object.assign(
					options,
					{ reRun: true, preclean: false, recursive: false, autoFolders: false, folder: searchFolders, projectRoot },
					newOptions,
				),
			),
		);
	};

	if (!options.reRun && options.preclean) removeFolder(rootNodeModules);

	makeFolder(rootNodeModules);
	makeFolder(targetNodeModules);

	if (Array.isArray(options.target)) {
		options.target.forEach(name => {
			reRun({ target: path.resolve(projectRoot, name) });
		});

		printStats();

		return;
	}

	if (options.recursive) {
		searchFolders.forEach(parentFolder => {
			forEachPackage(parentFolder, name => {
				++recursivelyRan;

				reRun({ target: path.resolve(parentFolder, name) });
			});
		});

		printStats();

		return;
	}

	// eslint-disable-next-line unicorn/prefer-module
	const targetPackageJSON = require(path.join(targetPackageRoot, 'package.json'));
	const targetPackageDependencyNames = Object.keys(
		Object.assign(targetPackageJSON.dependencies || {}, targetPackageJSON.devDependencies || {}) || {},
	);
	const preMappedPackageNames = fs.readdirSync(rootNodeModules);
	const preMappedPackages = Object.fromEntries(
		preMappedPackageNames.map(item => {
			return [item, 1];
		}),
	);
	const foundPackages = {};

	const findLocalCopy = packageName => {
		log(3)(`Checking for local copy of "${packageName}"`);

		++traversed;

		if (preMappedPackages[packageName]) return preMappedPackages[packageName];
		if (foundPackages[packageName]) return foundPackages[packageName];

		const foundPackage = findPackage(searchFolders, packageName);

		if (foundPackage) {
			foundPackages[packageName] = foundPackage;

			log.info(2)(`Found local copy of "${packageName}"`);
		}

		return foundPackage;
	};

	if (targetPackageDependencyNames.length > 0)
		logArray(2, 'targetPackageDependencyNames', targetPackageDependencyNames);
	if (!options.preclean) logArray(2, 'preMappedPackageNames', preMappedPackageNames);

	const installedModules = Object.fromEntries(
		fs.readdirSync(targetNodeModules).map(item => {
			return [item, 1];
		}),
	);

	targetPackageDependencyNames.forEach(name => {
		if (preMappedPackages[name]) return ++totalPreMappedPackages;

		if (findLocalCopy(name) || installedModules[name]) return;

		++missingRemotePackages;
	});

	forEachNodeModule(targetPackageRoot, findLocalCopy);

	const foundPackageNames = Object.keys(foundPackages);
	foundPackageCount += foundPackageNames.length;

	if (foundPackageCount) logArray(2, 'foundPackageNames', foundPackageNames);

	const symlinkedFileNames = [];

	foundPackageNames.forEach(name => {
		const foundPackageLocation = foundPackages[name];

		++traversed;

		const cleanedReference = removeFolder(path.join(targetNodeModules, name));

		if (cleanedReference) ++cleanedReferences;

		if (!fs.existsSync(path.join(rootNodeModules, name))) {
			log.info(3)(`Linking local copy of "${name}" to "${rootNodeModules}`);

			symlinkedFileNames.push(name);

			log.simulation(simulationVerbosity)(`cd ${rootNodeModules} && ln -s ${foundPackageLocation} ${name}`);

			if (!options.simulate) fs.symlinkSync(foundPackageLocation, path.join(rootNodeModules, name), 'dir');
		}
	});

	const alreadyRan = {};

	foundPackageNames.forEach(name => {
		if (alreadyRan[name]) return;

		const foundPackageLocation = foundPackages[name];

		++traversed;

		if (foundPackageLocation !== targetPackageRoot) {
			reRun({ target: foundPackageLocation });

			alreadyRan[name] = true;
		}
	});

	createdSymlinks += symlinkedFileNames.length;

	if (createdSymlinks) logArray(1, 'symlinkedFileNames', symlinkedFileNames);

	printStats();

	return {
		traversed,
		missingRemotePackages,
		totalPreMappedPackages,
		foundPackageCount,
		createdSymlinks,
		cleanedReferences,
	};
};

export default zelda;
