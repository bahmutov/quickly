# quickly

> Quickly setups dependent services and servers for local development

[![NPM info][nodei.co]](https://npmjs.org/package/quickly)

[![Build status][ci-image]][ci-url]
[![Circle CI](https://circleci.com/gh/bahmutov/quickly.svg?style=svg)](https://circleci.com/gh/bahmutov/quickly)
[![dependencies][dependencies-image]][dependencies-url]
[![devdependencies][quickly-devdependencies-image] ][quickly-devdependencies-url]

Inspired by [Aviator][aviator].

Often your application requires other services to run. If you develop locally, starting a particular version
of a service locally, or pointing at a remote can be complicated. `Quickly` solves this. Just write 
a local `quickly.js` file in each project that provides local service or needs other local services.
Then start all other services needed by entering `quickly`. If there are multiple configurations,
`quickly` will ask you. 

## Example

Imagine project A depends on the application B to be running. A could be a server and B could be an API.
In the A's root folder create new file `quickly.js`

```js
module.exports = {
  // this project provides service A
  A: {
    dependencies: {
      path: '../B',
      service: 'API' // which service to load from ../B/quickly.js
    },
    // service A starts 'npm run dev'
    exec: 'npm',
    args: 'run dev'
  }
};
```

Create another `quickly.js` file in the project B folder

```js
// project B provides API service
module.exports = {
  API: [{
    exec: 'npm',
    args: 'run watch'
  }]
};
```

### Lifecycle

When starting a project A using `quickly` command all dependent child processes will be started.
When you kill the project A (using Command+C), all child processes will be killed too.

### Choices

A `quickly.js` file can export multiple configurations / services. In this case the system
will ask the user which service to ask. For example, if `quickly.js` has

```js
module.exports = {
  test1: {
    exec: 'echo',
    args: 'running test 1'
  },
  test2: {
    exec: 'echo',
    args: 'running test 2'
  }
};
```

Then the shell will be

```bash
$ quickly 
quickly@0.1.4 - Quickly setup dependent services and servers for local development
quickly in "/Users/gleb/git/quickly/test/two-choices" undefined
loading /Users/gleb/git/quickly/test/two-choices/quickly.js
...
no dependencies to start
found multiple services "test1", "test2"
? Pick a service to start: (Use arrow keys)
❯ test1 
  test2
# picked second
user chose test2
starting "test2" in "/Users/gleb/git/quickly/test/two-choices" command "echo running test 2"
...
test2: running test 2
service "test2" finished with code 0
```

Other projects can specify which service to start without prompting the `service` property

```js
A: {
  dependencies: {
    path: '../two-choices',
    service: 'test2' // do not ask the user, just start test2
  },
  ...
}
```

For more configuration examples, browser the [test](test) folder.

## Install

    npm install -g quickly

In each project create `quickly.js` as shown in the example.

[aviator]: http://engineering.clever.com/2015/04/08/aviator-locally-launch-a-service-and-all-its-dependent-services/

## Small print

Author: Gleb Bahmutov &copy; 2015
[@bahmutov](https://twitter.com/bahmutov) [glebbahmutov.com](http://glebbahmutov.com)
[glebbahmutov.com/blog](http://glebbahmutov.com/blog)

License: MIT - do anything with the code, but don't blame me if it does not work.

Spread the word: tweet, star on github, etc.

Support: if you find any problems with this module, email / tweet / open issue on Github

[ci-image]: https://travis-ci.org/bahmutov/quickly.png?branch=master
[ci-url]: https://travis-ci.org/bahmutov/quickly
[nodei.co]: https://nodei.co/npm/quickly.png?downloads=true
[dependencies-image]: https://david-dm.org/bahmutov/quickly.png
[dependencies-url]: https://david-dm.org/bahmutov/quickly
[quickly-devdependencies-image]: https://david-dm.org/bahmutov/quickly/dev-status.png
[quickly-devdependencies-url]: https://david-dm.org/bahmutov/quickly#info=devDependencies
