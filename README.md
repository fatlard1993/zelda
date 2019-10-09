# Zelda

![zelda](./img/zelda.jpg)

Sometimes Link needs a little help from Zelda.


## Features

- Automatically `npm link` all your packages together
- Support for recursively running `npm install` (Automatically runs if node_modules is missing)


## Usage

1. Install it globally.

`npm install -g fatlard1993/zelda`

2. Run `zelda` from your node project directory. For example:

~/Projects/my-awesome-project$ `zelda`


### Options

```
Options:
  -h, --help          Show help                                        [boolean]
  -v, --verbosity     <level>                                       [default: 1]
  -c, --clean         Clean old symlinks first
  -i, --install       Force run `npm install` on each package          [boolean]
  -s, --simulate      See what would happen, without making changes    [boolean]
  -a, --autoFolders   Automatically detect folders to source modules   [boolean]
  -p, --parentFolder  <folder> (The top level folder containing all your code)
  -f, --folder        <folder> (An additional folder to source modules)
  --ver, --version    Show version number                              [boolean]
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