import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
test('PHP V3 validates and sends with mock mailer, never real SMTP',()=>{
 const result=execFileSync('php',['test/availability-v3.php'],{encoding:'utf8'});
 assert.ok(result.includes('tests passed'));
});
