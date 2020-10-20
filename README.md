# Zelda

![zelda](./img/zelda.jpg)

Sometimes Link needs a little help from Zelda.


## Features

- Automatically `npm link` all your local packages together
- Recursively run `npm install` on all local packages
- A simple cache method built on `npm pack` for quicker consecutive installs of remote packages


## Usage

1. Install it globally.

`npm install -g fatlard1993/zelda`

2. Run `zelda` from your node project directory. For example:

~/Projects/my-awesome-project$ `zelda`


### Options

```
Options:
  -h, --help              Show help                                    [boolean]
  -v, --verbosity         <level>                                   [default: 1]
  -c, --cleanInstall      Clean old node_modules before installing
  -C, --fullClean         Clean old symlinks and npm cache first       [boolean]
  -s, --simulate          See what would happen, without making changes[boolean]
  -t, --target            <folder> The target package folder(s) (defaults to
                          process.cwd())
  -a, --autoFolders       Automatically find projectRoot and detect folders to
                          source packages              [boolean] [default: true]
  -d, --autoFoldersDepth  <levels> The number of levels to traverse for finding
                          source folders containing local packages  [default: 2]
  -p, --projectRoot       <folder> The top level folder containing all your code
                          (defaults to targetPackage/..)
  -f, --folder            <folder> Additional folder(s) to source packages
  -r, --recursive         Recursively walk through and link all local git
                          projects in the current source folders       [boolean]
      --npmCache          Cache and use remote npm packages as a tarballs in
                          zelda/temp                                   [boolean]
      --ver, --version    Show version number                          [boolean]
```


### Example

1. Clone a cool project

```
mkdir -p ~/Projects
cd ~/Projects
git clone https://github.com/feross/webtorrent.git
```

2. Clone the project dependencies you plan to work on

```
git clone https://github.com/feross/bittorrent-protocol.git
git clone https://github.com/feross/bittorrent-swarm.git
git clone https://github.com/feross/bittorrent-dht.git
```

3. Recursively `npm install` all project dependencies, `npm link` any local ones

```
cd ~/Projects/webtorrent
zelda -a
```


## Link is better with Zelda

Gone are the days of running tons of `npm link` commands by hand!

![link with zelda](./img/link_with_zelda.jpg)