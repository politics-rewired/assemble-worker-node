# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [1.0.0](https://github.com/politics-rewired/assemble-worker-node/compare/v0.2.1...v1.0.0) (2021-10-19)

### ⚠ BREAKING CHANGES

- drops support for Node < 14

### Features

- simplify complete_job function ([#15](https://github.com/politics-rewired/assemble-worker-node/issues/15)) ([6109d3b](https://github.com/politics-rewired/assemble-worker-node/commit/6109d3b65620c15926b6f3c2b0fc9f702e2137c3))

### Bug Fixes

- allow installation with npm ([9f0d79a](https://github.com/politics-rewired/assemble-worker-node/commit/9f0d79a711e0cd2838892b2ab8c147b41b829038))

### ci

- use github workflows ([#30](https://github.com/politics-rewired/assemble-worker-node/issues/30)) ([e5fa29a](https://github.com/politics-rewired/assemble-worker-node/commit/e5fa29ad28e997d86dfd1f42c6f3191d12d7887a))

## [0.2.1](https://github.com/politics-rewired/assemble-worker-node/compare/v0.2.0...v0.2.1) (2020-10-25)

### Bug Fixes

- **index:** thread onRabbitDisconnect ([4aae23b](https://github.com/politics-rewired/assemble-worker-node/commit/4aae23bc5d01347655315cf5832ce480fa9a2dee))
- **renotify_unacked_jobs:** limit to jobs younger than 6 minutes ([4e8ce26](https://github.com/politics-rewired/assemble-worker-node/commit/4e8ce26d7178e598dcd775ee758f7a69ff245de8))
- **runner:** increase max concurrency ([6b96d9c](https://github.com/politics-rewired/assemble-worker-node/commit/6b96d9ce26bebbac7715441b6e06e328e8fc6abb))

### Features

- **runner:** support custom disconnect handler ([2b59b1b](https://github.com/politics-rewired/assemble-worker-node/commit/2b59b1b1578ba7dc82f398ee13064d59439dbb1b))

# [0.2.0](https://github.com/politics-rewired/assemble-worker-node/compare/v0.1.5...v0.2.0) (2020-07-02)

### Features

- switch to configurable winston logger ([#10](https://github.com/politics-rewired/assemble-worker-node/issues/10)) ([1103c75](https://github.com/politics-rewired/assemble-worker-node/commit/1103c754dbc40f88455c871dddd510104a844e74))

## [0.1.5](https://github.com/politics-rewired/assemble-worker-node/compare/v0.1.4...v0.1.5) (2020-06-27)

### Features

- additional logging ([c5d8e91](https://github.com/politics-rewired/assemble-worker-node/commit/c5d8e91de595b6dbca998da15782dfab0b9236bb))

## [0.1.4](https://github.com/politics-rewired/assemble-worker-node/compare/v0.1.3...v0.1.4) (2020-06-27)

### Bug Fixes

- tpe errors ([a11d1a4](https://github.com/politics-rewired/assemble-worker-node/commit/a11d1a40a406917afe09079f91cfde99b5d83fa3))

## [0.1.3](https://github.com/politics-rewired/assemble-worker-node/compare/v0.1.2...v0.1.3) (2020-06-27)

### Features

- batch processing ([b5f3f58](https://github.com/politics-rewired/assemble-worker-node/commit/b5f3f58204ca61a9c1746e2ebd95e0d7b4b439c6))
- prevent concurrent pokes ([8ca0614](https://github.com/politics-rewired/assemble-worker-node/commit/8ca06143e96f8645605e4a176c6bdbe3a4165de1))

## [0.1.2](https://github.com/politics-rewired/assemble-worker-node/compare/v0.1.1...v0.1.2) (2019-12-11)

### Bug Fixes

- notify unacked jobs ([92c1792](https://github.com/politics-rewired/assemble-worker-node/commit/92c1792f3443b94f58bd9ec68cfab7d3279abeb2))
- renotify_unacked_jobs ([131d101](https://github.com/politics-rewired/assemble-worker-node/commit/131d10193ed924d8a82dd9856f9925c5790c74ca))

### Features

- add renotify function ([7ffbd16](https://github.com/politics-rewired/assemble-worker-node/commit/7ffbd1666b98b4ea0ff4b1b8f1d8212ed557be7e))

## [0.1.1](https://github.com/politics-rewired/assemble-worker-node/compare/v0.1.0...v0.1.1) (2019-10-26)

# [0.1.0](https://github.com/politics-rewired/assemble-worker-node/compare/v0.0.10...v0.1.0) (2019-10-26)

### Bug Fixes

- simpler concurrency ([07964bb](https://github.com/politics-rewired/assemble-worker-node/commit/07964bb4db3b1bfad00eeb85e262f9d31c65c812))

## [0.0.10](https://github.com/politics-rewired/assemble-worker-node/compare/v0.0.9...v0.0.10) (2019-10-26)

### Bug Fixes

- move ack to finally ([e4d9f46](https://github.com/politics-rewired/assemble-worker-node/commit/e4d9f46912d87cf575882ca27bb3f0924a7336c3))

## [0.0.9](https://github.com/politics-rewired/assemble-worker-node/compare/v0.0.8...v0.0.9) (2019-10-20)

### Bug Fixes

- set prefect to one ([44d3ad1](https://github.com/politics-rewired/assemble-worker-node/commit/44d3ad1d0cb4ce46c7ab765d26fcdbb2f45ed642))

## [0.0.8](https://github.com/politics-rewired/assemble-worker-node/compare/v0.0.7...v0.0.8) (2019-08-08)

## [0.0.7](https://github.com/politics-rewired/assemble-worker-node/compare/v0.0.6...v0.0.7) (2019-08-08)

### Bug Fixes

- set max concurrency ([ec0af63](https://github.com/politics-rewired/assemble-worker-node/commit/ec0af63b45631850b28cdca902306cd3eef838e7))

## [0.0.6](https://github.com/politics-rewired/assemble-worker-node/compare/v0.0.5...v0.0.6) (2019-08-08)

## [0.0.5](https://github.com/politics-rewired/assemble-worker-node/compare/v0.0.4...v0.0.5) (2019-08-08)

### Bug Fixes

- remote prefect ([7e98749](https://github.com/politics-rewired/assemble-worker-node/commit/7e98749edb22db7ef9c06256cc4db333b08d3e3c))

### Features

- log consumption events ([e98a192](https://github.com/politics-rewired/assemble-worker-node/commit/e98a1926fc111fbb656595e2bbee9d7ae0ecdd58))

## [0.0.4](https://github.com/politics-rewired/assemble-worker-node/compare/v0.0.3...v0.0.4) (2019-08-07)

### Bug Fixes

- log connection details ([0dcafe4](https://github.com/politics-rewired/assemble-worker-node/commit/0dcafe4472ef528009a3cf75e2faff5ae44e5009))

## [0.0.3](https://github.com/politics-rewired/assemble-worker-node/compare/v0.0.2...v0.0.3) (2019-08-07)

## [0.0.2](https://github.com/politics-rewired/assemble-worker-node/compare/v0.0.1...v0.0.2) (2019-08-07)

### Bug Fixes

- built migrations; ([46bcf2d](https://github.com/politics-rewired/assemble-worker-node/commit/46bcf2d00bf8e941f62a572ffd525cfd2b9a1d60))

## [0.0.1](https://github.com/politics-rewired/assemble-worker-node/compare/7c751fd4e8d7501f9e0c767bc8ff10e4097ce724...v0.0.1) (2019-08-02)

### Bug Fixes

- should require successful update before acking ([a3f5549](https://github.com/politics-rewired/assemble-worker-node/commit/a3f5549d2e82bf45debdee5d333ba3b7ff6e9599))

### Features

- ack on failure ([3d65f7c](https://github.com/politics-rewired/assemble-worker-node/commit/3d65f7c1853e27488776111e9279fe56c3a26d95))
- add task concurrency ([8416424](https://github.com/politics-rewired/assemble-worker-node/commit/841642478ef53b3b822c1abf88568e4577dbf5e9))
- add tests for migration, complete job, fail job ([0a86da6](https://github.com/politics-rewired/assemble-worker-node/commit/0a86da673959b894d610091402d62b1084187e2d))
- full index.ts pipeline ([9d09a49](https://github.com/politics-rewired/assemble-worker-node/commit/9d09a4946991f3d26cc9533a0cd2958db27be392))
- global integration tests ([5f81f6a](https://github.com/politics-rewired/assemble-worker-node/commit/5f81f6a613cfb5b20c0a0f1323cfe694bd038465))
- poke + register queue w/ tests ([967ca4e](https://github.com/politics-rewired/assemble-worker-node/commit/967ca4e980374aade04f6dab83df037f1666dfec))
- **rabbit-runner:** all tests passing ([53b8ebf](https://github.com/politics-rewired/assemble-worker-node/commit/53b8ebf87e20e64c99c8ccbb7e7a6a50027bad25))
- **src:** rabbitmq job queueing with callbacks and acking on failure ([7c751fd](https://github.com/politics-rewired/assemble-worker-node/commit/7c751fd4e8d7501f9e0c767bc8ff10e4097ce724))
