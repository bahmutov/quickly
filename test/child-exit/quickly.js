/*
  The single child service here exits after
  printing a message to the console.
  The system should at least print the notification
  that the child process has exitted.
*/
module.exports = {
  test: {
    exec: 'echo',
    args: 'hi there'
  }
};
