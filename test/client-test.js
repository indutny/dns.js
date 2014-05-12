var assert = require('assert');
var dgram = require('dgram');

var dns = require('../');

describe('dns.js client', function() {
  var socket = dgram.createSocket('udp4');
  var client = new dns.Client({
    send: function(data) {
      var buf = new Buffer(data);
      socket.send(buf, 0, buf.length, 53, '8.8.8.8');
    }
  });

  socket.on('message', function(b) {
    client.feed(b);
  });

  it('should send A queries', function(cb) {
    client.query('A', 'google.com', function(err, answers) {
      assert(!err);
      assert(Array.isArray(answers));
      assert(answers.length > 0);
      assert(answers.every(function(a) {
        return /^(\d{1,3}\.){3}\d{1,3}$/.test(a);
      }));
      cb();
    });
  });

  it('should send TXT queries', function(cb) {
    client.query('TXT', 'blog.indutny.com', function(err, answers) {
      assert(!err);
      assert(Array.isArray(answers));
      assert(answers.length > 0);
      assert(answers.every(function(a) {
        return Array.isArray(a) && a.length > 0 && typeof a[0] === 'string';
      }));
      cb();
    });
  });
});
