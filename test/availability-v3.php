<?php
define('SKY_AVAILABILITY_TEST', true);
require __DIR__ . '/../public/send_quote_v3.php';
function check($condition, $message) { if (!$condition) throw new RuntimeException($message); }
final class MockMailer {
 public $CharSet, $Subject, $Body, $AltBody;
 public $recipient, $recipientName;
 public int $sends = 0;
 public bool $cleared = false;
 public bool $fail = false;
 function clearAllRecipients() {}
 function clearAttachments() { $this->cleared = true; }
 function addAddress($email, $name) { $this->recipient=$email; $this->recipientName=$name; }
 function isHTML($value) {}
 function send() { $this->sends++; if ($this->fail) throw new RuntimeException('SECRET SMTP PASSWORD'); return true; }
}
$mailer = new MockMailer();
$config = fn() => ['authorize'=>fn()=>true, 'mailer'=>fn()=>$mailer];
$payload = ['email'=>'client@example.test','to'=>'client@example.test','quote'=>'TEST-1','part_number'=>'PART-1','client_name'=>'','certificate_type'=>'','subject'=>'Availability Confirmation','body'=>"Hello\n\nPlain message <script>bad</script>"];
[$code,$result] = availability_handle('POST',$payload,[],$config);
check($code===200 && $result===['success'=>true,'message'=>'Email sent successfully'], 'success contract');
check($mailer->sends===1 && $mailer->cleared && $mailer->recipientName==='Customer', 'send without files and name fallback');
check(!str_contains($mailer->Body,'<script>') && str_contains($mailer->Body,'&lt;script&gt;'), 'escaped html');
check($mailer->AltBody===$payload['body'], 'plain alternative');
foreach (['quote','part_number','subject','body'] as $field) {
 $bad=$payload;unset($bad[$field]);check(availability_handle('POST',$bad,[],$config)[0]===400,'required '.$field);
}
$bad=$payload;$bad['email']='invalid';check(availability_handle('POST',$bad,[],$config)[0]===400,'invalid email');
$bad=$payload;$bad['subject']="Subject\r\nBcc: victim@example.test";check(availability_handle('POST',$bad,[],$config)[0]===400,'CRLF');
$bad=$payload;$bad['to']='other@example.test';check(availability_handle('POST',$bad,[],$config)[0]===400,'recipient mismatch');
$bad=$payload;$bad['price']='100';check(availability_handle('POST',$bad,[],$config)[0]===400,'reject price');
check(availability_handle('POST',$payload,['pdf'=>[]],$config)[0]===400,'reject PDF');
check(availability_handle('GET',$payload,[],$config)[0]===405,'method');
check(availability_handle('POST',$payload,[],fn()=>null)[0]===503,'no configuration fails closed');
check(availability_handle('POST',$payload,[],fn()=>['authorize'=>fn()=>false,'mailer'=>fn()=>$mailer])[0]===401,'auth');
check($mailer->sends===1,'errors never send');
$mailer->fail=true;
[$code,$result]=availability_handle('POST',$payload,[],$config);
check($code===500 && $result===['success'=>false,'message'=>'Email could not be sent'],'safe failure');
check(!str_contains(json_encode($result),'SECRET'),'no secret leakage');
echo "PHP V3 mocked validation, auth and mail tests passed\n";
