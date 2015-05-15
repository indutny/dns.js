var framer = require('./framer');
var parser = require('./parser');
var dgram = require('dgram');

function Client(options) {
  var self = this;

  options = options || {};

  this._seq = (Math.random() * 0x10000) | 0;
  this._reqs = {};
  this.timeout = 30000;
  this.send = options.send;

  if (this.send) return;

  this.socket = dgram.createSocket('udp4');
  var dnsIP = options.dnsServer || Client.DEFAULT_DNS_SERVER;
  this.send = function(data) {
    var buf = new Buffer(data);
    self.socket.send(buf, 0, buf.length, 53, dnsIP);
  };

  this.socket.on('message', function(b) {
    self.feed(b);
  });
}

exports.Client = Client;
Client.DEFAULT_DNS_SERVER = '8.8.8.8';

Client.prototype.seq = function seq() {
  var seq = this._seq++;

  // Wrap-up
  if (this._seq > 0xffff)
    this._seq = 0;

  return seq;
};

/**
 * Meant to be used instead of Node.JS dns.resolve method
 */
Client.prototype.resolve = function(host, rrtype, callback) {
  if (typeof rrtype === 'function') {
    callback = rrtype;
    rrtype = undefined;
  }

  return this.query(rrtype || 'A', host, callback);
}

Client.prototype.resolve4 = function(host, callback) {
  return this.resolve(host, 'A', callback);
}

Client.prototype.resolve6 = function(host, callback) {
  return this.resolve(host, 'AAAA', callback);
}

Client.prototype.query = function query(type, host, cb) {
  if (this._destroyed) throw new Error('Client has been destroyed');

  var seq = this.seq();
  var header = framer.header({
    id: seq,
    opcode: 'QUERY',
    rcode: 'OK',
    qdcount: 1,
    rd: true,
    ra: true
  });

  if (host[host.length - 1] !== '.')
    host += '.';
  var qd = framer.question(host.split(/\./g), type, 'IN');

  this._addReq(seq, function(err, ans) {
    if (err)
      return cb(err);

    ans = ans.an.filter(function(an) {
      return an.type === type;
    }).map(function(an) {
      return an.rdata;
    });
    cb(null, ans);
  });

  this.send(header.concat(qd));
};

Client.prototype._addReq = function _addReq(seq, cb) {
  if (this._reqs[seq])
    throw new Error('More than 65535 active requests');

  this._reqs[seq] = {
    packets: [],
    timer: setTimeout(function() {
      cb(new Error('Timed out'), null);
    }, this.timeout),
    cb: cb
  };
};

Client.prototype.feed = function feed(data) {
  var packet = parser.feed(data);
  var seq = packet.id;

  // No request - ignore response
  var req = this._reqs[seq];
  if (!req)
    return;

  req.packets.push(packet);

  // Truncated - collect all data
  if (packet.tc)
    return;

  clearTimeout(req.timer);
  req.timer = null;

  var ans = {
    qd: [],
    an: [],
    ns: [],
    ar: []
  };
  for (var i = 0; i < req.packets.length; i++) {
    ans.qd = ans.qd.concat(req.packets[i].qd);
    ans.an = ans.an.concat(req.packets[i].an);
    ans.ns = ans.ns.concat(req.packets[i].ns);
    ans.ar = ans.ar.concat(req.packets[i].ar);
  }

  req.cb(null, ans, req.packets);
};

Client.prototype.destroy = function() {
  if (this._destroyed) return;

  this._destroyed = true;
  if (this.socket) this.socket.close();
};

[ 'resolve', 'resolve4', 'resolve6' ].forEach(function(method) {
  // the node.js dns module's methods that are currently supported
  exports[method] = function() {
    var client = new Client();
    var args = [].slice.call(arguments);
    var cb = args[args.length - 1];
    args[args.length - 1] = function(err, result) {
      client.destroy();
      cb(err, result);
    }

    client[method].apply(client, args);
  }
})
