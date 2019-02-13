const fs = require('fs');
const path = require('path');
const childProcess = require('child_process');

const findRoot = require('find-root');
const rimraf = require('rimraf');

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function getCodePackages(codePath){
	var entries;

  try{
    entries = fs.readdirSync(codePath);
	}

	catch(err){
    throw new Error(`Could not find ${codePath} | ${err.message}`);
  }

  var packages = {};

  entries.forEach(function(entry){
    var pkgPath = path.join(codePath, entry);
		var pkg;

    try{
      pkg = require(path.join(pkgPath, 'package.json'));
		}

		catch(err){
      return; // ignore folders without package.json
		}

    packages[pkg.name] = pkgPath;
  });

  return packages;
}

function traverseNodeModules(pkgPath, cb){
  var modulesPath = path.join(pkgPath, 'node_modules');
	var entries;

	try{
    entries = fs.readdirSync(modulesPath);
	}

	catch(err){
    return; // no node_modules
  }

  entries = entries.filter(function(entry){
		var stat = fs.lstatSync(path.join(modulesPath, entry));

    return !stat.isSymbolicLink();
  });

  entries.forEach(function(entry){
		var entryPath = path.join(modulesPath, entry);

		traverseNodeModules(entryPath, cb);

    cb(entry, entryPath);
  });
}

module.exports = function zelda(opts){
  if(!opts) opts = {};

  // Use folder with nearest package.json as root
  var rootPath = findRoot();

  var rootName = require(path.join(rootPath, 'package.json')).name;
  var codePath = path.resolve(rootPath, '..');

  if(!rootName) throw new Error('Root package must have a name');

  // add node_modules symlink in code folder - MAGIC
  try{
		console.log(`[zelda] cd ${codePath} && rm -rf ./node_modules && ln -s . node_modules`);

    if(!opts.simulate){
			rimraf.sync(path.join(codePath, 'node_modules'));

			fs.symlinkSync('.', path.join(codePath, 'node_modules'), 'dir');
		}
	}

	catch(err){
    // ignore err (symlink already exists)
  }

  var codePackages = getCodePackages(codePath);

  if(opts.install) npmInstall(rootPath);

	var packagesToPurge = {};

  packagesToPurge[rootName] = true;

  traverseNodeModules(rootPath, function(packageName){
		if(!codePackages[packageName]) return;

		packagesToPurge[packageName] = true;

		if(opts.install) npmInstall(path.join(codePath, packageName));
  });

  traverseNodeModules(rootPath, function(packageName, packagePath){
    if(packagesToPurge[packageName]) rmDir(packagePath);
  });

  Object.keys(packagesToPurge).forEach(function(packageToPurge){
    if(packageToPurge === rootName) return;

		var packagePath = path.join(codePath, packageToPurge);

    traverseNodeModules(packagePath, function(packageName, packagePath){
      if(packagesToPurge[packageName]) rmDir(packagePath);
    });
  });

  function rmDir(dirPath){
		console.log(`[zelda] rm -rf ${dirPath}`);

    if(!opts.simulate) rimraf.sync(dirPath);
  }

  function npmInstall(packagePath){
		console.log(`[zelda] cd ${packagePath} && rm node_modules/ && npm i`);

		var args = ['i'];

    if(opts.production) args.push('--production');

		if(opts.simulate) return;

		rimraf.sync(path.join(packagePath, 'node_modules'));

		childProcess.spawnSync(npmCmd, args, {
			cwd: packagePath,
			stdio: 'inherit'
		});
  }
};