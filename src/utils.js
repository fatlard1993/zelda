import os from 'os';
import fs from 'fs';
import path from 'path';
import Log from 'log';

const log = new Log({ tag: 'zelda' });

const getChildFolders = (parentFolder, options = {}) => {
	options = { blacklist: {}, ignoreSymlinks: false, ...options };
	try {
		return fs.readdirSync(parentFolder).filter(folder => {
			const location = path.join(parentFolder, folder);
			const stats = fs.lstatSync(location);
			let isDirectory;

			if (typeof options.blacklist === 'object' && options.blacklist[folder]) isDirectory = false;
			else if (!options.ignoreSymlinks && stats.isSymbolicLink()) {
				try {
					isDirectory = fs.readdirSync(location).length;
				} catch (error) {
					log(3)(error);

					return false;
				}
			} else isDirectory = stats.isDirectory();

			return isDirectory;
		});
	} catch (error) {
		log(3)(error);

		return [];
	}
};

export const forEachNodeModule = (parentPath, callback) => {
	const modulesPath = path.join(parentPath, 'node_modules');

	if (!fs.existsSync(modulesPath)) return;

	const modules = getChildFolders(modulesPath, { blacklist: { '.bin': 1 } });

	modules.forEach(name => {
		const modulePath = path.join(modulesPath, name);

		if (name.startsWith('@')) {
			const scopedPackages = getChildFolders(modulePath);

			scopedPackages.forEach(scopedName => {
				const scopedPath = path.join(modulePath, scopedName);
				const fullName = `${name}/${scopedName}`;

				callback(fullName, scopedPath);

				forEachNodeModule(scopedPath, callback);
			});
		} else {
			callback(name, modulePath);

			forEachNodeModule(modulePath, callback);
		}
	});
};

export const forEachPackage = async (parentFolder, callback) => {
	if (!fs.existsSync(parentFolder)) return;

	const packages = getChildFolders(parentFolder, { blacklist: { '.bin': 1 } });

	for (const packageName of packages) {
		const childPath = path.join(parentFolder, packageName);

		if (!fs.existsSync(path.join(childPath, 'package.json'))) continue;

		await callback(packageName, childPath);

		await forEachPackage(childPath, callback);
	}
};

const folderContainsPackages = parentFolder => {
	let result = false;

	if (parentFolder === os.homedir()) return false;

	const folders = getChildFolders(parentFolder, { blacklist: { node_modules: 1 } });

	for (let x = 0, count = folders.length, folder; x < count; ++x) {
		folder = folders[x];

		if (folder[0] === '.' || !fs.existsSync(path.join(parentFolder, folder, 'package.json'))) continue;

		result = true;

		break;
	}

	return result;
};

export const findProjectRoot = targetFolder => {
	const root = path.parse(targetFolder).root;

	if (targetFolder === root || targetFolder === os.homedir()) {
		log.error(`Could not find a project root folder above ${targetFolder}`);
		return undefined;
	}

	let projectRoot;
	const parentFolder = path.resolve(targetFolder, '..');

	const targetContainPackages = folderContainsPackages(targetFolder),
		parentContainPackages = folderContainsPackages(parentFolder);

	log.info(4)({ targetFolder, targetContainPackages, parentFolder, parentContainPackages });

	if (targetContainPackages && !parentContainPackages) projectRoot = targetFolder;

	if (!projectRoot) projectRoot = findProjectRoot(parentFolder);

	return projectRoot;
};

export const findPackageSourceFolders = (targetFolder, levels) => {
	let folders = {};

	if (!levels || fs.existsSync(path.join(targetFolder, 'package.json'))) return folders;

	if (folderContainsPackages(targetFolder)) folders[targetFolder] = 1;

	getChildFolders(targetFolder, { blacklist: { node_modules: 1 } }).forEach(folder => {
		folders = Object.assign(folders, findPackageSourceFolders(path.join(targetFolder, folder), levels - 1));
	});

	return folders;
};

export const findPackage = (parentFolders, packageName) => {
	let localPackageFolder;

	for (let x = 0, count = parentFolders.length; x < count; ++x) {
		localPackageFolder = path.join(parentFolders[x], packageName);

		if (!fs.existsSync(localPackageFolder)) localPackageFolder = '';
		else break;
	}

	return localPackageFolder;
};
