import { rm, mkdir } from 'node:fs/promises';
import fs from 'fs';
import path from 'path';

import Log from 'log';
import { findPackage, findPackageSourceFolders, findProjectRoot, forEachNodeModule, forEachPackage } from './utils';

const findRoot = start => {
	let dir = path.resolve(start);

	while (true) {
		if (fs.existsSync(path.join(dir, 'package.json'))) return dir;

		const parent = path.dirname(dir);

		if (parent === dir) throw new Error('package.json not found in path');

		dir = parent;
	}
};

const log = new Log({ tag: 'zelda', methodMap: { array: 'info', simulation: 'warn' } });

const now = () => Bun.nanoseconds();

const zelda = async (options = {}) => {
	const simulationVerbosity = options.simulate ? 0 : 3;

	const removeFolder = async folder => {
		if (!fs.existsSync(folder)) return false;

		// eslint-disable-next-line spellcheck/spell-checker
		log.simulation(simulationVerbosity)(`$ rm -rf ${folder}`);

		if (!options.simulate) await rm(folder, { recursive: true, force: true });

		return true;
	};

	const makeFolder = async folder => {
		if (fs.existsSync(folder)) return false;

		log.simulation(simulationVerbosity)(`$ mkdir -p ${folder}`);

		if (!options.simulate) await mkdir(folder, { recursive: true });

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

	let checkedPackages = 0,
		missingRemotePackages = 0,
		totalPreMappedPackages = 0,
		foundPackageCount = 0,
		createdSymlinks = 0,
		cleanedReferences = 0,
		recursivelyRan = 0;
	const getStats = () => ({
		checkedPackages,
		missingRemotePackages,
		totalPreMappedPackages,
		foundPackageCount,
		createdSymlinks,
		cleanedReferences,
	});

	let searchFolders = [];

	if (options.autoFolders) searchFolders = Object.keys(findPackageSourceFolders(projectRoot, options.autoFoldersDepth));
	if (options.folder)
		searchFolders = searchFolders.concat(Array.isArray(options.folder) ? options.folder : [options.folder]);

	if (searchFolders.length === 0) {
		log.error(`No package source folders are configured`);
		return getStats();
	}

	if (!options.reRun) {
		log.info(`Using ${searchFolders.length} folders to search for local packages`);
		logArray(0, 'searchFolders', searchFolders);
	}

	const printStats = () => {
		let time = (now() - start) / 1_000_000_000;

		time = time < 60 ? `${time.toFixed(2)}s` : `${Math.floor(time / 60)}m ${(time - Math.floor(time / 60) * 60).toFixed(2)}s`;

		const verb = options.simulate ? 'Would create' : 'Created';
		const lines = [
			`Done${options.recursive ? '' : ` with ${targetPackageRoot}`}. Took ${time}`,
			`Checked ${checkedPackages} packages`,
			`${totalPreMappedPackages} already linked`,
			`${missingRemotePackages} missing remote packages`,
			`Found ${foundPackageCount} local packages`,
			`${verb} ${createdSymlinks} symlinks`,
			`Cleaned ${cleanedReferences} references`,
		];

		if (options.recursive) lines.push(`Recursively ran zelda for ${recursivelyRan} local packages`);

		log[options.simulate ? 'simulate' : 'info'](lines.join('\n'));
	};

	const updateStats = stats => {
		checkedPackages += stats.checkedPackages;
		missingRemotePackages += stats.missingRemotePackages;
		totalPreMappedPackages += stats.totalPreMappedPackages;
		foundPackageCount += stats.foundPackageCount;
		createdSymlinks += stats.createdSymlinks;
		cleanedReferences += stats.cleanedReferences;
	};

	const reRun = async newOptions => {
		updateStats(
			await zelda({
				...options,
				reRun: true,
				preclean: false,
				recursive: false,
				autoFolders: false,
				folder: searchFolders,
				projectRoot,
				...newOptions,
			}),
		);
	};

	if (!options.reRun && options.preclean) await removeFolder(rootNodeModules);

	await makeFolder(rootNodeModules);
	if (targetNodeModules) await makeFolder(targetNodeModules);

	if (Array.isArray(options.target)) {
		await Promise.all(options.target.map(async name => await reRun({ target: path.resolve(projectRoot, name) })));

		printStats();
		return getStats();
	}

	if (options.recursive) {
		await Promise.all(
			searchFolders.map(async parentFolder => {
				await forEachPackage(parentFolder, async name => {
					++recursivelyRan;

					await reRun({ target: path.resolve(parentFolder, name) });
				});
			}),
		);

		printStats();
		return getStats();
	}

	let targetPackageJSON;

	try {
		targetPackageJSON = require(path.join(targetPackageRoot, 'package.json'));
	} catch {
		log.error(`Could not read package.json in ${targetPackageRoot}`);
		return getStats();
	}
	const targetPackageDependencyNames = Object.keys({
		...targetPackageJSON.dependencies,
		...targetPackageJSON.devDependencies,
	});
	const preMappedPackageNames = fs.readdirSync(rootNodeModules);
	const preMappedPackages = Object.fromEntries(
		preMappedPackageNames.map(item => {
			return [item, 1];
		}),
	);
	const foundPackages = {};

	const findLocalCopy = packageName => {
		log(3)(`Checking for local copy of "${packageName}"`);

		++checkedPackages;

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

	const installedModules = {};

	for (const item of fs.readdirSync(targetNodeModules)) {
		if (item.startsWith('@')) {
			const scopePath = path.join(targetNodeModules, item);

			for (const child of fs.readdirSync(scopePath)) {
				installedModules[`${item}/${child}`] = 1;
			}
		} else {
			installedModules[item] = 1;
		}
	}

	targetPackageDependencyNames.forEach(name => {
		if (preMappedPackages[name]) return ++totalPreMappedPackages;

		if (findLocalCopy(name) || installedModules[name]) return;

		++missingRemotePackages;
	});

	forEachNodeModule(targetPackageRoot, findLocalCopy);

	const foundPackageNames = Object.keys(foundPackages);
	foundPackageCount += foundPackageNames.length;

	if (foundPackageCount) logArray(0, 'foundPackageNames', foundPackageNames);

	const symlinkedFileNames = [];

	await Promise.all(
		foundPackageNames.map(async name => {
			const foundPackageLocation = foundPackages[name];

			const cleanedReference = await removeFolder(path.join(targetNodeModules, name));

			if (cleanedReference) ++cleanedReferences;

			const symlinkPath = path.join(rootNodeModules, name);

			if (!fs.existsSync(symlinkPath)) {
				log.info(3)(`Linking local copy of "${name}" to "${rootNodeModules}"`);

				symlinkedFileNames.push(name);

				if (name.includes('/')) await makeFolder(path.dirname(symlinkPath));

				log.simulation(simulationVerbosity)(`cd ${rootNodeModules} && ln -s ${foundPackageLocation} ${name}`);

				if (!options.simulate) fs.symlinkSync(foundPackageLocation, symlinkPath, 'dir');
			}
		}),
	);

	createdSymlinks += symlinkedFileNames.length;

	if (createdSymlinks) logArray(1, 'symlinkedFileNames', symlinkedFileNames);

	printStats();

	return getStats();
};

export default zelda;
