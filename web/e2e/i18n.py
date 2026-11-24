"""Languages: phones choose their own interface language; Arabic is right-to-left; a live game works in mixed languages."""
import os
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://localhost:8789/PulsePlay/app/'); SHOTS = os.environ.get('SHOTS', '/tmp/shots')
results = []
def ok(c, m): results.append((c, m)); print(('PASS ' if c else 'FAIL ') + m, flush=True)
with sync_playwright() as pw:
    b = pw.chromium.launch()
    h = b.new_context(viewport={'width': 1366, 'height': 860}, locale='de-CH').new_page()
    h.goto(BASE + '#/host/would-you-rather'); h.wait_for_selector('[data-testid=create]'); h.click('[data-testid=create]'); h.wait_for_selector('[data-testid=room-code]', timeout=10000)
    code = h.inner_text('[data-testid=room-code]').replace(' ', '')
    ok('dabei' in h.inner_text('body') and h.evaluate('document.documentElement.lang') == 'de', 'browser language de-CH: projector in German')
    ph = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, locale='en-US').new_page()
    ph.goto(BASE + f'#/j/{code}'); ph.wait_for_selector('[data-testid=nickname]'); ph.select_option('[data-testid=lang]', 'ar'); ph.wait_for_timeout(200)
    ok(ph.evaluate('document.documentElement.dir') == 'rtl' and 'انضم' in ph.inner_text('body'), 'phone switches to Arabic: right-to-left')
    w = ph.evaluate('[document.documentElement.scrollWidth, innerWidth]'); ok(w[0] <= w[1], f'Arabic join page fits the phone ({w})')
    ph.fill('[data-testid=nickname]', 'سارة'); ph.check('[data-testid=consent]'); ph.click('[data-testid=join]'); ph.wait_for_selector('text=أنت معنا يا سارة!', timeout=10000)
    ok(True, 'Arabic phone joins with an Arabic nickname')
    ph.screenshot(path=f'{SHOTS}/ar_lobby.png')
    ph2 = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, locale='fr-CH').new_page()
    ph2.goto(BASE + f'#/j/{code}'); ph2.wait_for_selector('[data-testid=nickname]'); ph2.wait_for_timeout(300)
    ok('Rejoindre' in ph2.inner_text('body'), 'browser language fr-CH: phone in French')
    ph2.fill('[data-testid=nickname]', 'Lea'); ph2.check('[data-testid=consent]'); ph2.click('[data-testid=join]'); ph2.wait_for_selector("text=Tu es dans la partie, Lea !", timeout=10000)
    for _ in range(3): h.wait_for_selector('[data-testid=next]:not([disabled])'); h.click('[data-testid=next]')
    for p in (ph, ph2): p.wait_for_selector('button[data-option]:not([disabled])', timeout=15000); p.click('button[data-option="a"]')
    ph.wait_for_selector('text=تم الحفظ', timeout=10000); ph2.wait_for_selector('text=Enregistré', timeout=10000)
    ok(True, 'mixed languages: Arabic and French phones answer the same question')
    ph.screenshot(path=f'{SHOTS}/ar_answer.png')
    ph.reload(); ph.wait_for_selector('text=تم الحفظ', timeout=10000); ok(ph.evaluate('document.documentElement.dir') == 'rtl', 'language choice survives a refresh')
    b.close()
fails = [m for c, m in results if not c]
print(f'\n{len(results) - len(fails)} passed, {len(fails)} failed')
