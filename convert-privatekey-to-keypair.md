
node - <<'NODE'
const fs = require('fs');
const bs58 = require('bs58');

const privateKey = 'asfasdfasdf';
const secret = Array.from(bs58.decode(privateKey));

const out = '/mnt/c/Users/itand/.config/solana/treasury-owner-devnet.json';
fs.writeFileSync(out, JSON.stringify(secret));
console.log('written:', out);
NODE
