
node - <<'NODE'
const fs = require('fs');
const bs58 = require('bs58');

const privateKey = 'sdsdfd';
const secret = Array.from(bs58.decode(privateKey));

const out = '/home/tandin/.config/solana/meta-updater.json';
fs.writeFileSync(out, JSON.stringify(secret));
console.log('written:', out);
NODE
