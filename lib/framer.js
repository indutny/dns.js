var framer = exports;

var constants = require('./constants');

framer.header = function header(options) {
  var opcode = constants.opcode[options.opcode];
  var b1 = (opcode & 0xf) << 3;
  if (options.response)
    b1 |= 0x80;
  if (options.aa)
    b1 |= 0x04;
  if (options.tc)
    b1 |= 0x02;
  if (options.rd)
    b1 |= 0x01;

  var b2 = 0;
  if (options.ra)
    b2 |= 0x80;

  var rcode = constants.rcode[options.rcode];
  if (rcode)
    b2 |= rcode & 0xf;

  var id = options.id;
  var qd = options.qdcount;
  var an = options.ancount;
  var ns = options.nscount;
  var ar = options.arcount;

  return [
    (id >>> 8) & 0xff, id & 0xff,
    b1, b2,  // opcode, flags, and rcode
    (qd >>> 8) & 0xff, qd & 0xff,
    (an >>> 8) & 0xff, an & 0xff,
    (ns >>> 8) & 0xff, ns & 0xff,
    (ar >>> 8) & 0xff, ar & 0xff
  ];
};

framer.arr2labels = function arr2labels(arr) {
  var labels = [];
  for (var i = 0; i < arr.length; i++) {
    if (arr[i].length > 63)
      throw new Error('Name component is longer than 64 octets');

    labels.push(arr[i].length);
    for (var j = 0; j < arr[i].length; j++)
      labels.push(arr[i].charCodeAt(j) & 0xff);
  }
  return labels;
};

framer.question = function question(name, qtype, qclass) {
  qtype = constants.qtype[qtype];
  qclass = constants.qclass[qclass];
  return framer.arr2labels(name).concat([
    (qtype >>> 8) & 0xff, qtype & 0xff,
    (qclass >>> 8) & 0xff, qclass & 0xff
  ]);
};
