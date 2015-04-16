require('lazy-ass');
var check = require('check-more-types');
var Promise = require('bluebird');
var exists = require('fs').existsSync;
var join = require('path').join;
var CONFIG_NAME = join(process.cwd(), 'quick-up.js');
var R = require('ramda');

function startDependencies(config) {
  la(check.object(config), 'expected config', config);
  return Promise.resolve([]);
}

function startService(config) {
  var services = R.reject(R.eq('dependencies'), R.keys(config));
  return Promise.resolve(services);
}

function quickUp() {
  var configPath = CONFIG_NAME;
  if (!exists(configPath)) {
    console.error('Cannot find config', configPath);
    return;
  }
  console.log('loading', configPath);
  var config = require(CONFIG_NAME);
  console.log('loaded', config);

  startDependencies(config)
    .then(function (dependencies) {
      if (check.unemptyArray(dependencies)) {
        console.log('started dependencies', dependencies.join(', '));
      } else {
        console.log('no dependencies to start');
      }
    })
    .then(startService.bind(null, config))
    .then(function (services) {
      if (check.unemptyArray(services)) {
        console.log('started services', services.join(', '));
      } else {
        console.log('no services to start');
      }
    })
    .done();
}

module.exports = quickUp;
