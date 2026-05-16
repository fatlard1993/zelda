# Zelda

![zelda](./img/zelda.jpg)

Sometimes Link needs a little help from Zelda.

## Features

- Automatically symlink all your local packages together
- Recursively discover and link local packages across your project folders

## Prerequisites

- [Bun](https://bun.sh) >= 1.0.0

## Usage

1. Install globally:

```sh
bun install -g fatlard1993/zelda
```

2. Run `zelda` from your node project directory:

```sh
cd ~/Projects/my-awesome-project
zelda
```

### Options

```
[zelda] Version: 2.7.5

Usage:

zelda [[--help|-h|-?] | [--version] | [--verbosity|-v <number>] | [--preclean|-C] | [--simulate|-s] | [--target|-t <string>] | [--autoFolders|-a] | [--autoFoldersDepth|-d <number>] | [--projectRoot|-p <string>] | [--folder|-f <string>] | [--recursive|-r]]


Flags:

--help, -h, -?
	[boolean]

--version
	[boolean]

--verbosity, -v
	[number :: 1]

--preclean, -C
	[boolean :: true]
	Clean old symlinks first

--simulate, -s
	[boolean]
	See what would happen, without making changes

--target, -t
	[string]
	<folder> The target package folder(s)

--autoFolders, -a
	[boolean :: true]
	Automatically find projectRoot and detect folders to source packages

--autoFoldersDepth, -d
	[number :: 2]
	<levels> The number of levels to traverse for finding source folders containing local packages

--projectRoot, -p
	[string]
	<folder> The top level folder containing all your code (defaults to target/..)

--folder, -f
	[string]
	<folder> Additional folder(s) to source packages

--recursive, -r
	[boolean]
	Recursively walk through and link all local git projects in the current source folders
```

### Example

1. Clone a cool project

```sh
mkdir -p ~/Projects
cd ~/Projects
git clone https://github.com/feross/webtorrent.git
```

2. Clone the project dependencies you plan to work on

```sh
git clone https://github.com/feross/bittorrent-protocol.git
git clone https://github.com/feross/bittorrent-swarm.git
git clone https://github.com/feross/bittorrent-dht.git
```

3. Symlink local packages into the project

```sh
cd ~/Projects/webtorrent
zelda -a
```

## Link is better with Zelda

Gone are the days of running tons of `npm link` commands by hand!

![link with zelda](./img/link_with_zelda.jpg)
