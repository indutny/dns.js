function rev(map) {
  var r = {};
  Object.keys(map).forEach(function(key) {
    r[map[key]] = key;
  });
  return r;
}
exports.opcode = {
  QUERY: 0,
  IQUERY: 1,
  STATUS: 2
};
exports.opcodeByValue = rev(exports.opcode);

exports.qtype = {
  A: 1,
  NS: 2,
  MD: 3,
  MF: 4,
  CNAME: 5,
  SOA: 6,
  MB: 7,
  MG: 8,
  MR: 9,
  NULL: 10,
  WKS: 11,
  PTR: 12,
  HINFO: 13,
  MINFO: 14,
  MX: 15,
  TXT: 16,

  // Additional
  AXFR: 252,
  MAILB: 253,
  MAILA: 254,
  ANY: 255
};
exports.qtypeByValue = rev(exports.qtype);

exports.qclass = {
  IN: 1,
  CS: 2,
  CH: 3,
  HS: 4,
  ANY: 255
};
exports.qclassByValue = rev(exports.qclass);

exports.rcode = {
  OK: 0,
  FORMAT: 1,
  SERVER: 2,
  NAME: 3,
  NOTIMPL: 4,
  REFUSED: 5
};
exports.rcodeByValue = rev(exports.rcode);
