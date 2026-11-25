'use strict';

/** An error whose message is safe to show to the person using the app. */
class UserError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'UserError';
    this.status = status;
  }
}

module.exports = { UserError };
