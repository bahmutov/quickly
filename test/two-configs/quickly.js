/*
  The system should ask which
  config to run for a given service
*/
module.exports = {
  test: [{
    name: 'first config',
    exec: 'echo',
    args: 'running test 1'
  }, {
    name: 'second config',
    exec: 'echo',
    args: 'running test 2'
  }, {
    // no name, form it from exec and args
    exec: 'echo',
    args: 'running test 3'
  }]
};
