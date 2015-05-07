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
var j = R.partialRight(JSON.stringify, null, 2);
var ask = require('inquirer');
var formConfigNames = require('./src/form-config-names');

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
    console.log('the config has single dependency', quote(name));
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

function selectOneConfig(configs) {
  var names = formConfigNames(configs);

  la(check.arrayOfStrings(names), 'expected config names', names);
  la(names.length > 1, 'expected multiple config names', names);

  // TODO verify that all names are distinct

  var question = {
    type: 'list',
    name: 'config',
    message: 'Pick a configuration to start',
    choices: names
  };

  return new Promise(function (resolve) {
    ask.prompt([question], function (answers) {
      var name = answers.config;
      console.log('user chose config', quote(name));
      var index = names.indexOf(name);
      la(index >= 0 && index < configs.length, 'cannot find selected config', name);
      resolve(configs[index]);
    });
  });
}

function startService(serviceName, serviceConfig) {
  la(check.unemptyString(serviceName), 'expected service name', serviceName);

  var selectedConfig;
  if (check.array(serviceConfig)) {
    if (serviceConfig.length === 1) {
      selectConfig = Promise.resolve(serviceConfig[0]);
    } else {
      selectConfig = selectOneConfig(serviceConfig);
    }
  } else {
    selectConfig = Promise.resolve(serviceConfig);
  }

  return selectConfig.then(function (serviceConfig) {
    la(check.object(serviceConfig) || check.unemptyString(serviceConfig),
      'invalid', typeof serviceConfig,
      'config', serviceConfig, 'for', quote(serviceName));

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
  });

}

function startServices(config, services) {
  la(check.arrayOfStrings(services), 'expected service names', services);
  console.log('starting services', services);

  return Promise.map(services, function (name) {
    return startService(name, config[name]);
  }, { concurrency: 1 });
}

function selectOneService(services) {
  la(check.arrayOfStrings(services), 'expected service names', services);
  la(services.length > 1, 'expected multiple services', services);

  var question = {
    type: 'list',
    name: 'service',
    message: 'Pick a service to start',
    choices: services
  };

  return new Promise(function (resolve) {
    ask.prompt([question], function (answers) {
      console.log('user chose', answers.service);
      resolve([answers.service]);
    });
  });
}

function startMainService(config, serviceName) {
  if (check.unemptyString(serviceName)) {
    la(check.has(config, serviceName),
      'cannot find service', quote(serviceName), 'in config', config);
    console.log('starting specific service', quote(serviceName));
    return [startService(serviceName, config[serviceName])];
  }

  var services = R.reject(R.eq('dependencies'), R.keys(config));
  la(check.arrayOfStrings(services), 'expected service names', services,
    'from config', config);

  var selectService;

  if (services.length > 1) {
    console.log('found multiple services', services.map(quote).join(', '));
    selectService = selectOneService(services);
  } else {
    selectService = Promise.resolve(services);
  }

  return selectService
    .then(R.partial(startServices, config));
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

var isService = R.partial(check.schema, {
  name: check.string,
  child: check.object
});

function printErrors(services) {
  if (!check.unemptyArray(services)) {
    return;
  }
  services.forEach(function (s, k) {
    la(isService(s), 'not a service', s,
      'at position', k, 'in list of services', services);
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

function printOnExit(services) {
  if (!check.unemptyArray(services)) {
    return;
  }
  services.forEach(function (s) {
    la(s.child, 'missing child process for service', s);
    s.child.on('close', function (code) {
      console.log('service', quote(s.name), 'finished with code', code);
      // TODO handle non-zero exit
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
  console.log('loaded config\n' + j(config) + '\nfrom', quote(filename));
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
    .tap(printOnExit)
    .tap(printRunningServices)
    .then(function (services) {
      return R.partial(killStarted, services);
    });
}

module.exports = quickly;
