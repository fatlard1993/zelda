## Automatically `npm link` all your packages together!

![link spin attack](./img/link-attack.jpg)

Sometimes Link needs a little help from Zelda.

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

### Example

1. Clone a cool project.

  ```bash
  mkdir ~/code
  cd ~/code
  git clone git@github.com:feross/webtorrent.git
  ```

2. Clone the project dependencies you plan to work on.

  ```bash
  git clone git@github.com:feross/bittorrent-protocol.git
  git clone git@github.com:feross/bittorrent-swarm.git
  git clone git@github.com:feross/bittorrent-dht.git
  ```

3. Recursively `npm install` all project dependencies, but `npm link` the ones that are local.

  ```bash
  cd webtorrent
  zelda
  ```

Gone are the days of running tons of `npm link` commands by hand!

### Features

- Automatically `npm link` all your modules together
- Supports `dependencies`, `devDependencies`, and `optionalDependencies`
- Recursively runs `npm install` so your freshly cloned projects are ready to go!

### Link is better with Zelda!

![link](./img/link-zelda.png)