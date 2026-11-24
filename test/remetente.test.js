require('./ajuda');
const test = require('node:test');
const assert = require('node:assert');
const { quemMandou } = require('../src/whatsapp/remetente');

// no config de exemplo a Ana é 5534900000001
test('número normal é reconhecido', async () => {
  assert.strictEqual(await quemMandou({ from: '5534900000001@c.us' }), 'Ana');
});

test('id interno (@lid) é traduzido para o telefone', async () => {
  const msg = {
    from: '187654321098765@lid',
    client: { getContactLidAndPhone: async () => [{ lid: '187654321098765@lid', pn: '5534900000001@c.us' }] },
  };
  assert.strictEqual(await quemMandou(msg), 'Ana');
});

test('@lid sem a função nova cai no getContact', async () => {
  const msg = { from: '187654321098765@lid', client: {}, getContact: async () => ({ number: '5534900000002' }) };
  assert.strictEqual(await quemMandou(msg), 'Bia');
});

test('quem não é da casa vira null', async () => {
  assert.strictEqual(await quemMandou({ from: '5511999999999@c.us' }), null);
  const semJeito = { from: '1@lid', client: {}, getContact: async () => { throw new Error('x'); } };
  assert.strictEqual(await quemMandou(semJeito), null);
});
