"""Weak-connection test: a phone loses its connection, answers while offline, and comes back. The answer must still count.
Usage: BASE=http://localhost:8789/PulsePlay/app/ python3 resilience.py"""
import os
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://localhost:8789/PulsePlay/app/')
results = []
def ok(c, m): results.append((c, m)); print(('PASS ' if c else 'FAIL ') + m, flush=True)
with sync_playwright() as pw:
    b = pw.chromium.launch()
    h = b.new_context(viewport={'width': 1366, 'height': 860}).new_page()
    h.goto(BASE + '#/host/would-you-rather'); h.wait_for_selector('[data-testid=create]'); h.select_option('#answer', '12')
    h.click('[data-testid=create]'); h.wait_for_selector('[data-testid=room-code]', timeout=10000); code = h.inner_text('[data-testid=room-code]').replace(' ', '')
    phones = []
    for i in range(3):
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); p = ctx.new_page()
        p.goto(BASE + f'#/j/{code}'); p.wait_for_selector('[data-testid=nickname]'); p.wait_for_timeout(300)
        p.fill('[data-testid=nickname]', f'P{i}'); p.check('[data-testid=consent]'); p.click('[data-testid=join]'); p.wait_for_selector(f"text=You're in, P{i}!", timeout=10000)
        phones.append((ctx, p))
    h.wait_for_function("document.querySelector('[data-testid=joined]')?.innerText === '3'", timeout=10000)
    for _ in range(2): h.wait_for_selector('[data-testid=next]:not([disabled])'); h.click('[data-testid=next]')
    for _, p in phones: p.wait_for_selector('button[data-option]:not([disabled])', timeout=15000)
    ctx0, p0 = phones[0]
    ctx0.set_offline(True)
    p0.click('button[data-option="a"]'); p0.wait_for_timeout(2500)
    ok('Sending your answer again' in p0.inner_text('body') or 'Reconnecting' in p0.inner_text('body'), 'offline: phone shows it is retrying, answer kept on screen')
    ok(h.inner_text('[data-testid=answered]').strip().startswith('0') if h.locator('[data-testid=answered]').count() else True, 'offline: server has not received it yet')
    ctx0.set_offline(False)
    h.wait_for_function("(document.querySelector('[data-testid=answered]')?.innerText || '').trim().startsWith('1')", timeout=15000)
    ok(True, 'online again: the answer reaches the server automatically')
    for _, p in phones[1:]: p.click('button[data-option="b"]')
    h.wait_for_selector('[data-testid=distribution]', timeout=20000)
    ok('Connection lost' not in p0.inner_text('body'), 'online again: the warning clears')
    # screen off / background: catches up on return
    p1 = phones[1][1]
    p1.evaluate("Object.defineProperty(document, 'hidden', {value: true, configurable: true}); document.dispatchEvent(new Event('visibilitychange'))")
    h.wait_for_selector('[data-testid=next]:not([disabled])'); h.click('[data-testid=next]'); h.wait_for_timeout(300)
    h.wait_for_selector('[data-testid=next]:not([disabled])'); h.click('[data-testid=next]')
    p1.evaluate("Object.defineProperty(document, 'hidden', {value: false, configurable: true}); document.dispatchEvent(new Event('visibilitychange'))")
    p1.wait_for_selector('button[data-option]:not([disabled])', timeout=5000)
    ok(p1.inner_text('[data-testid=phone-prompt]') == h.inner_text('[data-testid=prompt]'), 'screen back on: phone catches up to the current question at once')
    b.close()
fails = [m for c, m in results if not c]
print(f'\n{len(results) - len(fails)} passed, {len(fails)} failed')
