require('lazy-ass');
var check = require('check-more-types');
var form = require('./form-config-names');
var R = require('ramda');

describe('form config names', function () {
  it('is a function', function () {
    la(check.fn(form));
  });

  it('works if each has name property', function () {
    var configs = [{
      name: 'first config',
      exec: 'echo',
      args: 'running test 1'
    }, {
      name: 'second config',
      exec: 'echo',
      args: 'running test 2'
    }];
    var names = form(configs);
    la(R.eqDeep(names, ['first config', 'second config']));
  });

  it('can form name from exec and args', function () {
    var configs = [{
      exec: 'echo',
      args: 'running test 1'
    }, {
      name: 'second config',
      exec: 'echo',
      args: 'running test 2'
    }];
    var names = form(configs);
    la(R.eqDeep(names, ['echo running test 1', 'second config']));
  });

  it('can handle plain strings', function () {
    var configs = ['echo', 'echo2'];
    var names = form(configs);
    la(R.eqDeep(names, ['echo', 'echo2']));
  });
});
