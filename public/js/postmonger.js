/**
 * Postmonger.js - Communication layer between Custom Activity and Journey Builder
 * This is a simplified version. The full version is provided by Salesforce.
 * In production, use the official postmonger from:
 * https://github.com/nicholascarlson/postmonger
 */
(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Postmonger = factory();
  }
}(this, function() {
  'use strict';

  function Session() {
    this._listeners = {};
  }

  Session.prototype.on = function(event, callback) {
    if (!this._listeners[event]) {
      this._listeners[event] = [];
    }
    this._listeners[event].push(callback);
  };

  Session.prototype.trigger = function(event, data) {
    // Send message to parent (Journey Builder)
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({
        event: event,
        data: data
      }, '*');
    }

    // Also trigger local listeners
    if (this._listeners[event]) {
      this._listeners[event].forEach(function(cb) {
        cb(data);
      });
    }
  };

  // Listen for messages from Journey Builder
  window.addEventListener('message', function(evt) {
    if (evt.data && evt.data.event && Session._instance) {
      var session = Session._instance;
      if (session._listeners[evt.data.event]) {
        session._listeners[evt.data.event].forEach(function(cb) {
          cb(evt.data.data);
        });
      }
    }
  });

  var createSession = function() {
    var session = new Session();
    Session._instance = session;
    return session;
  };

  return {
    Session: createSession
  };
}));
