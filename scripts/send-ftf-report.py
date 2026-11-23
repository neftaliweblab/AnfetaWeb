"""Mail transport: core service credentials remain on Render."""
import datetime
import json
import os
import smtplib
import ssl
import time
import urllib.parse
import urllib.request
from email.message import EmailMessage


def request(base, secret, payload=None):
    path = '/api/health' if payload is None else '/api/jobs/report-mail'
    req = urllib.request.Request(base + path, data=None if payload is None else json.dumps(payload).encode(),
        headers={'Authorization': 'Bearer ' + secret, 'Content-Type': 'application/json'})
    with urllib.request.urlopen(req, timeout=150 if payload else 25) as response:
        return json.load(response)


def deliver(smtp, delivery):
    message = EmailMessage()
    message['From'] = os.environ['SMTP_USER']
    message['To'] = ', '.join(delivery['to'])
    message['Subject'] = delivery['subject']
    message['Message-ID'] = '<' + delivery['key'] + '@anfeta-report.local>'
    message.set_content('Reporte ANFETA. Consulta la versión HTML del correo.')
    message.add_alternative(delivery['html'], subtype='html')
    try:
        return 'uncertain' if smtp.send_message(message) else 'sent'
    except (smtplib.SMTPRecipientsRefused, smtplib.SMTPSenderRefused, smtplib.SMTPDataError):
        return 'failed'
    except Exception:
        return 'uncertain'


def main():
    base = os.environ['APP_URL'].rstrip('/')
    url = urllib.parse.urlsplit(base)
    if url.scheme != 'https' or not (url.hostname or '').endswith('.onrender.com') or url.username or url.password or url.path or url.query or url.fragment:
        raise ValueError('Invalid Render URL.')
    secret = os.environ['CRON_SECRET']
    if len(secret) < 32:
        raise ValueError('Missing scheduler configuration.')
    job = os.environ['REPORT_JOB']
    if job not in ('ftf-report', 'ftf-weekly'):
        raise ValueError('Invalid report.')
    dry = os.environ.get('DRY_RUN', '').lower() == 'true'
    verify = os.environ.get('VERIFY_MAIL', '').lower() == 'true'
    payload = {'action': 'prepare', 'job': job, 'dryRun': dry, 'to': os.environ.get('EMAIL_TO', '')}
    if os.environ.get('REPORT_DATE'):
        payload['date'] = datetime.date.fromisoformat(os.environ['REPORT_DATE']).isoformat()
    ready = False
    for attempt in range(6):
        try:
            ready = request(base, secret).get('ok') is True
            if ready:
                break
        except Exception:
            pass
        time.sleep(15)
    if not ready:
        raise RuntimeError('Render did not become ready.')
    smtp = None
    try:
        if not dry or verify:
            user = os.environ.get('SMTP_USER', '')
            password = os.environ.get('SMTP_PASS', '').replace(' ', '')
            if not user or not password:
                raise ValueError('Missing Gmail app password configuration.')
            smtp = smtplib.SMTP_SSL('smtp.gmail.com', 465, timeout=30, context=ssl.create_default_context())
            smtp.login(user, password)
        result = request(base, secret, payload)
        if result.get('success') is not True:
            raise RuntimeError('Report preparation failed.')
        state = result.get('state')
        if not dry and result.get('delivery'):
            delivery = result['delivery']
            state = deliver(smtp, delivery)
            ack = {'action': 'finish', 'key': delivery['key'], 'token': delivery['token'], 'state': state}
            confirmed = False
            for attempt in range(3):
                try:
                    confirmed = request(base, secret, ack).get('success') is True
                    if confirmed:
                        break
                except Exception:
                    pass
                time.sleep(2)
            if not confirmed:
                raise RuntimeError('Delivery acknowledgment failed; check Gmail before retrying.')
            if state != 'sent':
                raise RuntimeError('Email delivery is ' + state)
        print(json.dumps({'success': True, 'job': job, 'date': result.get('date'), 'dryRun': dry,
            'emailVerified': bool(smtp), 'state': state, 'skipped': result.get('skipped'), 'people': result.get('people')}))
    finally:
        if smtp:
            try:
                smtp.quit()
            except Exception:
                pass


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print('Report worker failed:', type(error).__name__)
        raise SystemExit(1)
