var parser = exports;

var constants = require('./constants');

function readU16(p, off) {
  return (p[off] << 8) | p[off + 1];
}

parser.header = function header(packet, baton) {
  if (packet.length - baton.off < 12)
    throw new Error('Packet is too small to contain any header');

  var off = baton.off;
  var b1 = packet[off + 2];
  var b2 = packet[off + 3];

  baton.off += 12;

  return {
    id: readU16(packet, off),
    response: (b1 & 0x80) !== 0,
    opcode: constants.opcodeByValue[(b1 >> 3) & 0xf],
    aa: (b1 & 0x04) !== 0,
    tc: (b1 & 0x02) !== 0,
    rd: (b1 & 0x01) !== 0,
    ra: (b2 & 0x80) !== 0,
    rcode: constants.rcodeByValue[b2 & 0x0f],

    qdcount: readU16(packet, off + 4),
    ancount: readU16(packet, off + 6),
    nscount: readU16(packet, off + 8),
    arcount: readU16(packet, off + 10)
  };
};

parser.label = function label(p, baton) {
  var off = baton.off;

  if (off > p.length)
    throw new Error('Label size OOB');

  // Normal label
  var len = p[off++];
  if (off + len > p.length)
    throw new Error('Label name OOB');

  var res = '';
  for (var i = 0; i < len; i++)
    res += String.fromCharCode(p[off + i]);
  off += len;

  baton.off = off;
  return res;
};

parser.cstr2arr = function cstr2arr(p, baton) {
  var res = [];
  while (baton.off !== p.length) {
    var l = parser.label(p, baton);
    res.push(l);
  }
  return res;
};

parser.labels2arr = function labels2arr(p, baton) {
  var res = [];
  do {
    // Pointer
    if ((p[baton.off] & 0xc0) !== 0) {
      if (baton.off + 2 > p.length)
        throw new Error('Label pointer OOB');

      var off = (p[baton.off] & 0x3f) << 8 | p[baton.off + 1];
      baton.off += 2;
      res = res.concat(labels2arr(p, { off: off }));

      continue;
    }

    // Normal label
    var l = parser.label(p, baton);
    res.push(l);
  } while (res[res.length - 1].length !== 0);
  return res;
};

parser.qd = function qd(packet, baton) {
  var name = parser.labels2arr(packet, baton);
  if (packet.length - baton.off < 4)
    throw new Error('QD is too small to contain any data');

  var off = baton.off;
  baton.off += 4;

  return {
    name: name,
    qtype: constants.qtypeByValue[readU16(packet, off)],
    qclass: constants.qclassByValue[readU16(packet, off + 2)]
  };
};

parser.A = function A(r, baton) {
  var off = baton.off;
  if (off + 4 > r.length)
    throw new Error('A OOB');
  baton.off += 4;
  return r[off] + '.' + r[off + 1] + '.' + r[off + 2] + '.' + r[off + 3];
};

parser.TXT = function TXT(r, baton) {
  return parser.cstr2arr(r, baton);
};

parser.rr = function rr(packet, baton) {
  var name = parser.labels2arr(packet, baton);
  if (packet.length - baton.off < 10)
    throw new Error('RR is too small to contain any data');

  var off = baton.off;
  var type = constants.qtypeByValue[readU16(packet, off)];
  baton.off += 10;

  var rdlen = readU16(packet, off + 8);
  if (packet.length - baton.off < rdlen)
    throw new Error('RR\'s rdata OOB');
  baton.off += rdlen;

  var rbaton = { off: off + 10 };

  var rdata;
  if (type === 'A') {
    rdata = parser.A(packet, rbaton);
  } else if (type === 'TXT') {
    rdata = parser.TXT(packet, rbaton);
  } else {
    rbaton.off += rdlen;
    rdata = null;
  }
  if (rbaton.off !== off + 10 + rdlen)
    throw new Error('RR\'s rdata parse OOB');

  return {
    name: name,
    type: type,
    class: constants.qclassByValue[readU16(packet, off + 2)],
    ttl: (readU16(packet, off + 4) << 16) | readU16(packet, off + 6),
    rdlength: rdlen,
    rdata: rdata
  };
};

parser.feed = function feed(packet) {
  var baton = { off: 0 };
  var h = parser.header(packet, baton);

  var qd = [];
  for (var i = 0; i < h.qdcount; i++)
    qd.push(parser.qd(packet, baton));
  var an = [];
  for (var i = 0; i < h.ancount; i++)
    an.push(parser.rr(packet, baton));
  var ns = [];
  for (var i = 0; i < h.nscount; i++)
    ns.push(parser.rr(packet, baton));
  var ar = [];
  for (var i = 0; i < h.arcount; i++)
    ar.push(parser.rr(packet, baton));

  h.qd = qd;
  h.an = an;
  h.ns = ns;
  h.ar = ar;

  return h;
};
