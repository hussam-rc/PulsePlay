# Release 3.0A in a real browser: host setup (game length, selection, timing, duration), lobby display, server-locked selection.
import os, re, json, urllib.request
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://localhost:8789/PulsePlay/app/'); SHOTS = os.environ.get('SHOTS', '/tmp/shots')
results = []
def ok(c, m): results.append((c, m)); print(('PASS ' if c else 'FAIL ') + m, flush=True)

with sync_playwright() as pw:
    b = pw.chromium.launch()
    h = b.new_context(viewport={'width': 1366, 'height': 900}).new_page()
    h.goto(BASE + '#/host/ego-check'); h.wait_for_selector('[data-testid=lengths]')
    ok(h.get_attribute('[data-testid=len-10]', 'aria-pressed') == 'true', 'setup: 10 questions selected by default')
    ok(h.is_disabled('[data-testid=len-15]') and h.is_disabled('[data-testid=len-20]'), 'setup: 15 and 20 not offered for a 10-question game')
    ok('Needs 5 more questions' in h.inner_text('[data-testid=len-15]') and 'Needs 10 more questions' in h.inner_text('[data-testid=len-20]'), 'setup: says exactly what is missing')
    ok('10 questions available' in h.inner_text('[data-testid=bank-size]'), 'setup: shows how many questions exist')
    opts = h.eval_on_selector_all('#selection option', 'os => os.map(o => o.value)')
    ok(opts == ['fixed', 'random'], f'setup: selection offers fixed or random for a game without a bank ({opts})')
    reads = h.eval_on_selector_all('#read option', 'os => os.map(o => +o.value)'); answers = h.eval_on_selector_all('#answer option', 'os => os.map(o => +o.value)')
    ok(reads == [4, 5, 8, 10] and answers == [3, 5, 8, 12, 15], f'setup: reading 5/8/10 s and answering 3/5/8/12 s, plus the game\'s recommended time ({reads} {answers})')
    ok(h.input_value('#read') == '4' and h.input_value('#answer') == '15', 'setup: the game\'s recommended times stay the default')
    d1 = h.inner_text('[data-testid=duration]'); h.select_option('#answer', '3'); d2 = h.inner_text('[data-testid=duration]')
    m1, m2 = int(re.search(r'(\d+) min', d1).group(1)), int(re.search(r'(\d+) min', d2).group(1))
    ok(m1 == 8 and m2 < m1, f'setup: duration estimated from the settings and updates live ({m1} -> {m2} min)')
    ok('10 questions · Fixed order · 4 s reading · 3 s answering' in h.inner_text('[data-testid=game-summary]'), 'setup: preview of the chosen configuration')
    h.screenshot(path=f'{SHOTS}/3a_setup_en.png', full_page=True)
    # Arabic, right to left, no overflow
    h.evaluate("localStorage.setItem('pp_lang','ar')"); h.reload(); h.wait_for_selector('[data-testid=lengths]')
    ok(h.evaluate('document.documentElement.dir') == 'rtl' and 'لعبة سريعة' in h.inner_text('[data-testid=len-10]'), 'setup: Arabic labels, right to left')
    ok(h.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'setup: no horizontal overflow in Arabic')
    h.screenshot(path=f'{SHOTS}/3a_setup_ar.png', full_page=True)
    h.evaluate("localStorage.setItem('pp_lang','en')")
    m = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True).new_page(); m.goto(BASE + '#/host/would-you-rather'); m.wait_for_selector('[data-testid=lengths]')
    ok(m.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'setup: fits a phone screen')
    m.screenshot(path=f'{SHOTS}/3a_setup_phone.png', full_page=True)

    # Lobby shows the locked length; random order differs between rooms; fixed order matches the authored order.
    h.goto(BASE + '#/host/would-you-rather'); h.reload(); h.wait_for_selector('[data-testid=create]'); h.click('[data-testid=create]'); h.wait_for_selector('[data-testid=lobby-length]')
    h.screenshot(path=f'{SHOTS}/3a_lobby.png')
    ok(re.search(r'10 questions · about \d+ min', h.inner_text('[data-testid=lobby-length]')) is not None, 'lobby: shows the number of questions and estimated time before start')
    h.click('[data-testid=end]'); h.click('[data-testid=end-confirm]')
    for k in range(3):
        h.goto(BASE + '#/host/would-you-rather'); h.reload(); h.wait_for_selector('[data-testid=create]'); h.select_option('#selection', 'random'); h.click('[data-testid=create]'); h.wait_for_selector('[data-testid=room-code]')
        h.click('[data-testid=end]'); h.click('[data-testid=end-confirm]'); h.wait_for_selector('[data-testid=recap]')
    recent = h.evaluate("JSON.parse(localStorage.getItem('pp_recent_q:would-you-rather') || '[]')")
    ok(len(recent) == 3 and all(len(r) == 10 for r in recent), 'random: the host browser keeps its own last selections (question ids only)')
    ok(not any(k.startswith('pp_recent') and 'nickname' in (h.evaluate(f"localStorage.getItem('{k}')") or '') for k in h.evaluate('Object.keys(localStorage)')), 'random: nothing about participants is stored')
    ok(len({tuple(r) for r in recent}) >= 2, 'random: different question order in different rooms')
    b.close()

passed = sum(1 for c, _ in results if c); print(f'{passed} passed, {len(results) - passed} failed')
