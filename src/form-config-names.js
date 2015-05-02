require('lazy-ass');
var check = require('check-more-types');

function configToName(c) {
  if (check.unemptyString(c)) {
    return c;
  }
  la(check.object(c), 'expected config to be an object', c);
  if (check.unemptyString(c.name)) {
    return c.name;
  }
  la(check.unemptyString(c.exec), 'expected config to have exec', c);
  var name = c.exec;
  if (check.unemptyString(c.args)) {
    name += ' ' + c.args;
  }
  return name;
}

function formConfigNames(configs) {
  la(check.array(configs), 'expected configs array', configs);
  return configs.map(configToName);
}

module.exports = check.defend(formConfigNames,
  check.array, 'expected array of configs');
