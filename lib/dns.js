var framer = require('./framer');
var parser = require('./parser');

function Client(options) {
  this.send = options.send;

  this._seq = (Math.random() * 0x10000) | 0;
  this._reqs = {};
  this.timeout = 30000;
}
exports.Client = Client;

Client.prototype.seq = function seq() {
  var seq = this._seq++;

  // Wrap-up
  if (this._seq > 0xffff)
    this._seq = 0;

  return seq;
};

Client.prototype.query = function query(type, host, cb) {
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
