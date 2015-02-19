var assert = require('assert');
var dgram = require('dgram');

var dns = require('../');

describe('dns.js client', function() {
  describe('it works with default DNS servers (Google)', function() {
    runTests(); // Default is GoogleDNS @ 8.8.8.8
  });

  describe('it works with OpenDNS', function() {
    runTests('208.67.222.222'); // OpenDNS
  })
});

function runTests(dnsServer) {
  var options = {};
  if (dnsServer) {
    options.dnsServer = dnsServer;
    dns.Client.DEFAULT_DNS_SERVER = dnsServer
  }

  var client = new dns.Client(options);

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
    client.query('TXT', 'google.com', function(err, answers) {
      assert(!err);
      assert(Array.isArray(answers));
      assert(answers.length > 0);
      assert(answers.every(function(a) {
        return Array.isArray(a) && a.length > 0 && typeof a[0] === 'string';
      }));
      cb();
    });
  });

  it('closes socket on destroy, throws err if used after', function(cb) {
    client.destroy();
    var buf = new Buffer('something else');

    assert(client.socket);
    assert.throws(function() {
      client.socket.send(buf, 0, buf.length, 53, '8.8.8.8');
    }, Error);

    assert.throws(function() {
      client.resolve('google.com');
    }, Error);

    cb();
  });

  it('provides node\'s dns module\'s resolve method', function(cb) {
    dns.resolve('google.com', function(err, addresses) {
      assert(!err);
      assert(Array.isArray(addresses));
      assert(addresses.length > 0);
      assert(addresses.every(function(a) {
        return /^(\d{1,3}\.){3}\d{1,3}$/.test(a);
      }));
      cb();
    });
  });

  it('provides node\'s dns module\'s resolve4 method', function(cb) {
    dns.resolve4('google.com', function(err, addresses) {
      assert(!err);
      assert(Array.isArray(addresses));
      assert(addresses.length > 0);
      assert(addresses.every(function(a) {
        return /^(\d{1,3}\.){3}\d{1,3}$/.test(a);
      }));
      cb();
    });
  });
}
