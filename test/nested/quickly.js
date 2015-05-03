/*
  Nested dependencies calling services in other
  test folders
*/
module.exports = {
  nested: {
    dependencies: [{
      path: '../child-exit',
      service: 'test'
    }],
    exec: 'echo',
    args: 'nested runs fine'
  }
};
