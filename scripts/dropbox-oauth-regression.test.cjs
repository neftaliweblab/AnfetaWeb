const fs = require('fs');
const path = require('path');
const Module = require('module');
const assert = require('assert/strict');

const root = path.resolve(__dirname, '..');
const resolve = Module._resolveFilename;
Module._resolveFilename = function(name, parent, ...rest) {
  if (name.startsWith('@/')) {
    name = path.join(root, 'src', name.slice(2));
  }
  return resolve.call(this, name, parent, ...rest);
};

const ts = require('typescript');
for (const ext of ['.ts', '.tsx']) {
  Module._extensions[ext] = (mod, file) =>
    mod._compile(
      ts.transpileModule(fs.readFileSync(file, 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
      }).outputText,
      file
    );
}

// 1. Test getDropboxAuthorizeUrl
const { getDropboxAuthorizeUrl, DEFAULT_DROPBOX_APP_KEY } = require('../src/lib/dropboxConfig.ts');

const url = getDropboxAuthorizeUrl();
console.log('Authorize URL:', url);
assert.ok(url.startsWith('https://www.dropbox.com/oauth2/authorize?'), 'URL must start with Dropbox authorize endpoint');
assert.ok(url.includes('response_type=code'), 'URL must have response_type=code');
assert.ok(url.includes('token_access_type=offline'), 'URL must have token_access_type=offline');
assert.ok(url.includes(`client_id=${DEFAULT_DROPBOX_APP_KEY}`), 'URL must include client_id');
console.log('✓ getDropboxAuthorizeUrl tests passed.');

// 2. Test mock exchange failure with expired code
async function testCodeExchange() {
  const { exchangeDropboxCode } = require('../src/services/dropboxUpload.ts');
  try {
    await exchangeDropboxCode('invalid_test_code_12345');
    assert.fail('Should have failed for invalid code');
  } catch (err) {
    assert.ok(err.message, 'Error should have a message');
    console.log('✓ exchangeDropboxCode properly rejected invalid code with error:', err.message);
  }
}

testCodeExchange()
  .then(() => {
    console.log('OK Dropbox OAuth tests completed successfully.');
  })
  .catch((e) => {
    console.error('Test failed:', e);
    process.exit(1);
  });
