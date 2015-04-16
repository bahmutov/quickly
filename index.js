require('lazy-ass');
require('console.table');
var check = require('check-more-types');
var Promise = require('bluebird');
var exists = require('fs').existsSync;
var join = require('path').join;
var CONFIG_NAME = join(process.cwd(), 'quickly.js');
var R = require('ramda');
var spawn = require('child_process').spawn;
var quote = require('quote');

function startDependencies(config) {
  la(check.object(config), 'expected config', config);
  return Promise.resolve([]);
}

function startService(config) {
  var services = R.reject(R.eq('dependencies'), R.keys(config));

  return Promise.map(services, function (serviceName) {
    var serviceConfig = config[serviceName];
    la(check.object(serviceConfig) || check.unemptyString(serviceConfig),
      'invalid config', serviceConfig, 'for', serviceName);
    var cmd = check.unemptyString(serviceConfig) ? serviceConfig : serviceConfig.exec;
    la(check.unemptyString(cmd), 'cannot find command for service', serviceName,
      'in config', serviceConfig);

    console.log('starting', quote(serviceName),
      'in', quote(process.cwd()), 'command', quote(cmd));

    return {
      name: serviceName,
      child: spawn(cmd)
    };

  }, { concurrency: 1 });
}

function prepareToKill(namePids) {
  process.on('SIGINT', function cleanupStartedServices() {
    console.log('\nprocess is ready to exit');
    namePids.forEach(function (proc) {
      console.log('killing', proc.name);
      proc.child.kill('SIGKILL');
    });
    console.log('all done');
    process.exit();
  });
}

function printStartedDependencies(dependencies) {
  if (check.unemptyArray(dependencies)) {
    console.log('started dependencies', dependencies.join(', '));
  } else {
    console.log('no dependencies to start');
  }
}

function waitAndKill(services) {
  if (check.unemptyArray(services)) {
    var namePids = services.map(function (s) {
      return {
        name: s.name,
        pid: s.child.pid
      };
    });
    console.table('started services', namePids);
    console.log('Press Ctrl+C to stop this process and kill all services');
    prepareToKill(services);
  } else {
    console.log('no services to start');
  }
}

function quickly() {
  var configPath = CONFIG_NAME;
  if (!exists(configPath)) {
    console.error('Cannot find config', configPath);
    return;
  }
  console.log('loading', configPath);
  var config = require(CONFIG_NAME);
  console.log('loaded', config);

  var startNeededService = startService.bind(null, config);

  Promise.resolve(config)
    .then(startDependencies)
    .tap(printStartedDependencies)
    .then(startNeededService)
    .then(waitAndKill)
    .done();
}

module.exports = quickly;
