import importlib.util
import os
import smtplib
import unittest
from unittest.mock import Mock, patch
spec = importlib.util.spec_from_file_location('worker', os.path.join(os.path.dirname(__file__), 'send-ftf-report.py'))
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)
DELIVERY = {'key': 'a'*64, 'token': 'test-token', 'to': ['recipient@example.com'], 'subject': 'Report', 'html': '<p>Private report</p>'}

class WorkerTests(unittest.TestCase):
    def test_transport_results(self):
        with patch.dict(os.environ, {'SMTP_USER': 'sender@example.com'}):
            for outcome, expected in [({}, 'sent'), ({'recipient@example.com': (550, b'no')}, 'uncertain'), (smtplib.SMTPDataError(550, b'no'), 'failed'), (TimeoutError(), 'uncertain')]:
                smtp = Mock()
                if isinstance(outcome, Exception): smtp.send_message.side_effect = outcome
                else: smtp.send_message.return_value = outcome
                self.assertEqual(worker.deliver(smtp, DELIVERY), expected)
                smtp.send_message.assert_called_once()

    def test_dry_run_never_connects_smtp(self):
        env = {'APP_URL': 'https://anfeta-web.onrender.com', 'CRON_SECRET': 'x'*40, 'REPORT_JOB': 'ftf-report', 'DRY_RUN': 'true'}
        with patch.dict(os.environ, env, clear=True), patch.object(worker, 'request', side_effect=[{'ok': True}, {'success': True, 'dryRun': True}]), patch.object(worker.smtplib, 'SMTP_SSL') as smtp:
            worker.main()
            smtp.assert_not_called()

    def test_ack_retry_never_repeats_smtp_send(self):
        env = {'APP_URL': 'https://anfeta-web.onrender.com', 'CRON_SECRET': 'x'*40, 'REPORT_JOB': 'ftf-report', 'SMTP_USER': 'sender@example.com', 'SMTP_PASS': 'test-only'}
        smtp = Mock()
        smtp.send_message.return_value = {}
        responses = [{'ok': True}, {'success': True, 'delivery': DELIVERY}, TimeoutError(), {'success': True}]
        with patch.dict(os.environ, env, clear=True), patch.object(worker, 'request', side_effect=responses) as api, patch.object(worker.smtplib, 'SMTP_SSL', return_value=smtp), patch.object(worker.time, 'sleep'):
            worker.main()
            smtp.send_message.assert_called_once()
            self.assertEqual(api.call_count, 4)
            self.assertEqual(api.call_args.args[2]['state'], 'sent')

    def test_bad_password_does_not_prepare_delivery(self):
        env = {'APP_URL': 'https://anfeta-web.onrender.com', 'CRON_SECRET': 'x'*40, 'REPORT_JOB': 'ftf-report', 'SMTP_USER': 'sender@example.com', 'SMTP_PASS': 'test-only'}
        smtp = Mock()
        smtp.login.side_effect = smtplib.SMTPAuthenticationError(535, b'no')
        with patch.dict(os.environ, env, clear=True), patch.object(worker, 'request', return_value={'ok': True}) as api, patch.object(worker.smtplib, 'SMTP_SSL', return_value=smtp):
            with self.assertRaises(smtplib.SMTPAuthenticationError): worker.main()
            self.assertEqual(api.call_count, 1)
            smtp.send_message.assert_not_called()

if __name__ == '__main__': unittest.main()
