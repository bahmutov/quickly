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
var chdir = require('chdir-promise');

function configDescribesSingleService(config) {
  return (Object.keys(config).length) === 1;
}

function startDependency(info) {
  info.service = info.service || info.name;
  var isValidDependency = R.partial(check.schema, {
    path: check.unemptyString,
    service: check.unemptyString,
  });
  la(isValidDependency(info), 'expected dependency info', info);

  return chdir.to(info.path)
    .then(function () {
      console.log('starting', quote(info.service), 'in', quote(process.cwd()));
      return info.service;
    })
    .tap(chdir.back);

  // return Promise.resolve(info.service);
}

function startDependencies(config) {
  la(check.object(config), 'expected config', config);

  if (configDescribesSingleService(config)) {
    var name = Object.keys(config)[0];
    config = config[name];
  }

  var deps = config.dependencies;
  if (!deps || check.empty(deps)) {
    return Promise.resolve([]);
  }

  if (check.string(deps)) {
    deps = [deps];
  }
  if (!check.array(deps)) {
    deps = [deps];
  }

  console.log('found dependencies to start', deps);
  la(check.array(deps), 'expected list of dependencies', deps);
  return Promise.map(deps, startDependency, { concurrency: 1 });
}

function startService(serviceName, serviceConfig) {
  la(check.object(serviceConfig) || check.unemptyString(serviceConfig),
    'invalid config', serviceConfig, 'for', serviceName);

  var cmd = check.unemptyString(serviceConfig) ? serviceConfig : serviceConfig.exec;
  la(check.unemptyString(cmd), 'cannot find command for service', serviceName,
    'in config', serviceConfig);

  var args = check.unemptyString(serviceConfig) ? [] : serviceConfig.args;
  if (!args) {
    args = [];
  } else if (check.string(args)) {
    args = args.split(' ');
  }

  console.log('starting', quote(serviceName),
    'in', quote(process.cwd()), 'command', quote(cmd), quote(args.join(' ')));

  return {
    name: serviceName,
    child: spawn(cmd, args),
    cmd: cmd,
    args: args
  };

}

function startMainService(config, serviceName) {
  if (check.unemptyString(serviceName)) {
    la(check.has(config, serviceName),
      'cannot find service', quote(serviceName), 'in config', config);
    return startService(serviceName, config[serviceName]);
  }

  var services = R.reject(R.eq('dependencies'), R.keys(config));

  return Promise.map(services, function (name) {
    return startService(name, config[name]);
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

function printErrors(services) {
  if (!check.unemptyArray(services)) {
    return;
  }
  services.forEach(function (s) {
    s.child.stdout.setEncoding('utf8');
    s.child.stdout.on('data', function (txt) {
      console.error(s.name + ':', txt);
    });

    s.child.stderr.setEncoding('utf8');
    s.child.stderr.on('data', function (txt) {
      console.error(s.name + ' error:', txt);
    });
  });
}

function toString(x) {
  if (check.array(x)) {
    return x.join(' ');
  }
  return check.string(x) ? x : JSON.stringify(x);
}

function printRunningServices(services) {
  if (!check.unemptyArray(services)) {
    return;
  }
  var namePids = services.map(function (s) {
    return {
      name: s.name,
      pid: s.child.pid,
      cmd: s.cmd,
      args: toString(s.args)
    };
  });
  console.table('started services', namePids);
}

function waitAndKill(services) {
  if (check.unemptyArray(services)) {
    console.log('Press Ctrl+C to stop this process and kill all services');
    prepareToKill(services);
  } else {
    console.log('no services to start');
  }
}

function loadConfig(filename) {
  la(check.unemptyString(filename), 'need a filename');
  if (!exists(filename)) {
    console.error('Cannot find config', filename);
    throw new Error('Config not found ' + filename);
  }
  console.log('loading', filename);
  var config = require(filename);
  console.log('loaded config', config, 'from', quote(filename));
  return config;
}

function quickly(config, serviceName) {
  if (!config) {
    config = loadConfig(CONFIG_NAME);
  }

  var startNeededService = startMainService.bind(null, config, serviceName);

  Promise.resolve(config)
    .then(startDependencies)
    .tap(printStartedDependencies)
    .then(startNeededService)
    .tap(printErrors)
    .tap(printRunningServices)
    .then(waitAndKill)
    .done();
}

module.exports = quickly;
