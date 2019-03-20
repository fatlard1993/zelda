# Zelda

![zelda](./img/zelda.jpg)

Sometimes Link needs a little help from Zelda.


### Features

- Automatically `npm link` all your packages together
- Recursively runs `npm install` so your freshly cloned projects are ready to go!


### Usage

1. Install it globally.

```bash
npm install -g fatlard1993/zelda
```

2. Run `zelda` from your node project directory. For example:

```bash
cd ~/code/my-project
zelda
```

`zelda` finds all the node packages in your code folder (`~/code/` in the example).
If any of these packages are listed as a dependency in the nearest `package.json`
of your working directory, it automatically symlinks it for you.

Zelda assumes that all your code lives in the directory one level up from the
folder where you run `zelda`. So, keep all your packages in a single folder like
`~/code` and run `zelda` inside one of the projects (ex: `~/code/my-project`).


### Options

```bash
zelda --help
```

```
Options:
  -i, --install       Force run `npm install` on each package          [boolean]
  -s, --simulate      See what would happen, without making changes    [boolean]
  -a, --autoFolders   Automatically detect folders to source modules   [boolean]
  -p, --parentFolder  The top level folder containing all your code
  -f, --folder        Add an additional folder to source modules
  -h, --help          Show help                                        [boolean]
  -v, --version       Show version number                              [boolean]
```


### Example

1. Clone a cool project.

```bash
mkdir ~/code
cd ~/code
git clone https://github.com/feross/webtorrent.git
```

2. Clone the project dependencies you plan to work on.

```bash
git clone https://github.com/feross/bittorrent-protocol.git
git clone https://github.com/feross/bittorrent-swarm.git
git clone https://github.com/feross/bittorrent-dht.git
```

3. Recursively `npm install` all project dependencies, `npm link` any local ones.

```bash
cd webtorrent
zelda
```


### Link is better with Zelda

Gone are the days of running tons of `npm link` commands by hand!

![link with zelda](./img/link_with_zelda.jpg)