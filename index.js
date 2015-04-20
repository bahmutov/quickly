require('lazy-ass');
require('console.table');
var check = require('check-more-types');
var Promise = require('bluebird');
var exists = require('fs').existsSync;
var join = require('path').join;
var CONFIG_NAME = 'quickly.js';
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
      return quickly(null, info.service);
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
    args: args,
    kill: function kill() {
      var signal = this.signal || 'SIGKILL';
      console.log('killing', quote(this.name), 'via', quote(signal));
      this.child.kill(signal);
    }
  };

}

function startMainService(config, serviceName) {
  if (check.unemptyString(serviceName)) {
    la(check.has(config, serviceName),
      'cannot find service', quote(serviceName), 'in config', config);
    console.log('starting specific serice', quote(serviceName));
    return [startService(serviceName, config[serviceName])];
  }

  var services = R.reject(R.eq('dependencies'), R.keys(config));

  return Promise.map(services, function (name) {
    return startService(name, config[name]);
  }, { concurrency: 1 });
}

function printStartedDependencies(dependencies) {
  if (check.unemptyArray(dependencies)) {
    console.log('started', dependencies.length, 'dependencies');
    la(check.arrayOf(check.fn, dependencies),
      'expected stop / kill function for each dependency', dependencies);
  } else {
    console.log('no dependencies to start');
  }

  return dependencies;
}

function printErrors(services) {
  if (!check.unemptyArray(services)) {
    return;
  }
  services.forEach(function (s) {
    s.child.stdout.setEncoding('utf8');
    s.child.stdout.on('data', function (txt) {
      process.stdout.write(s.name + ': ' + txt);
    });

    s.child.stderr.setEncoding('utf8');
    s.child.stderr.on('data', function (txt) {
      process.stderr.write(s.name + ' error: ' + txt);
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

function stopStartedServices(namePids) {
  console.log('stopping', namePids.map(R.prop('name')));
  la(check.array(namePids), 'expected list of services', namePids);

  namePids.forEach(function (proc) {
    la(check.fn(proc.kill), 'child process', proc.name, 'is missing kill fn', proc);
    proc.kill();
  });
}

function killCallback(serviceName, killDependencies, services) {
  console.log('kill callback', quote(serviceName));
  console.log('kill dependencies', killDependencies.length);
  console.log('kill services', services.length);

  if (check.unemptyArray(services)) {
    // return R.partial(stopStartedServices, services);
    stopStartedServices(services);
    /*
    services.forEach(function (service, k) {
      console.log('stopping service', k);
    });*/
  } else {
    console.log('no services to kill for', quote(serviceName));
  }
  if (check.unemptyArray(killDependencies)) {
    killDependencies.forEach(function (kill, k) {
      console.log('stopping dependency', k);
      kill();
    });
  } else {
    console.log('no dependencies to kill for', quote(serviceName));
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
  console.log('quickly in', quote(process.cwd()), serviceName);

  if (!config) {
    var fullConfigName = join(process.cwd(), CONFIG_NAME);
    config = loadConfig(fullConfigName);
  }

  var startNeededService = R.partial(startMainService, config, serviceName);
  var killStarted;

  return Promise.resolve(config)
    .then(startDependencies) // returns list of kill functions
    .tap(function (killDeps) {
      killStarted = R.partial(killCallback, serviceName, killDeps);
    })
    .tap(printStartedDependencies)
    .then(startNeededService)
    .tap(printErrors)
    .tap(printRunningServices)
    .then(function (services) {
      return R.partial(killStarted, services);
    });
}

module.exports = quickly;
