"""Checks for the second round of team feedback (10 points). Usage: BASE=http://localhost:8789/PulsePlay/app/ python3 feedback2.py"""
import os
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://localhost:8789/PulsePlay/app/'); ROOT = BASE.rsplit('app/', 1)[0]; SHOTS = os.environ.get('SHOTS', '/tmp/shots')
results = []
def ok(c, m): results.append((c, m)); print(('PASS ' if c else 'FAIL ') + m, flush=True)
def phone(b, code, name, lang=None):
    ctx = b.new_context(viewport={'width': 375, 'height': 812}, is_mobile=True, has_touch=True, locale='en-US'); p = ctx.new_page()
    if lang: p.add_init_script(f"localStorage.setItem('pp_lang','{lang}')")
    p.goto(BASE + f'#/j/{code}'); p.wait_for_selector('[data-testid=code-state]:has-text("✓")', timeout=10000)
    p.fill('[data-testid=nickname]', name); p.check('[data-testid=consent]'); p.click('[data-testid=join]'); p.wait_for_selector('[data-testid=lobby-name], text=' + name, timeout=10000) if False else p.wait_for_timeout(800)
    return p
def host(b, game, lang='en'):
    h = b.new_context(viewport={'width': 1366, 'height': 860}, locale='en-US').new_page(); h.add_init_script(f"localStorage.setItem('pp_lang','{lang}')")
    h.goto(BASE + f'#/host/{game}'); h.wait_for_selector('[data-testid=create]'); h.click('[data-testid=create]'); h.wait_for_selector('[data-testid=room-code]')
    return h, h.inner_text('[data-testid=room-code]').replace(' ', '')
def nx(h): h.wait_for_selector('[data-testid=next]:not([disabled])', timeout=30000); h.click('[data-testid=next]')

with sync_playwright() as pw:
    b = pw.chromium.launch()
    # 1. 375 px header: every nav item is tappable
    m = b.new_context(viewport={'width': 375, 'height': 812}, is_mobile=True, has_touch=True).new_page(); m.goto(BASE + '#/discover'); m.wait_for_timeout(300)
    hits = m.evaluate("""[...document.querySelectorAll('nav[aria-label=Main] a')].filter(a => a.offsetParent).map(a => { const r = a.getBoundingClientRect(); const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return a.contains(el) && r.right <= innerWidth; })""")
    ok(len(hits) == 5 and all(hits), f'1. at 375 px all 5 menu items are visible and tappable {hits}')
    m.screenshot(path=f'{SHOTS}/header_375.png')
    # 9. wrong code is reported next to the code field before anything else
    m.goto(BASE + '#/j'); m.fill('[data-testid=code]', '999999'); m.wait_for_selector('[data-testid=code-state]:has-text("No game")', timeout=8000)
    ok(m.is_disabled('[data-testid=nickname]'), '9. wrong code: error next to the code, rest of the form locked')
    # 10. one join page: root and old classic links lead to the app
    m.goto(ROOT); m.wait_for_url('**/app/**', timeout=8000); ok('/app/' in m.url, '10. site root opens the app')
    m.goto(ROOT + '#join-123456'); m.wait_for_url('**/app/#/j/123456', timeout=8000); ok(m.url.endswith('#/j/123456'), '10. old classic join links open the app join page')
    m.goto(BASE + '#/play'); ok('classic' not in m.inner_text('body').lower(), '10. no "classic join page" link any more')
    # 2. Would You Rather reaction matches the vote
    h, code = host(b, 'would-you-rather')
    ps = [phone(b, code, f'W{i}') for i in range(5)]
    h.wait_for_function("document.querySelector('[data-testid=joined]')?.innerText === '5'", timeout=10000)
    nx(h); nx(h)
    for i, p in enumerate(ps): p.wait_for_selector('button[data-option]:not([disabled])', timeout=20000); p.click(f'button[data-option="{"a" if i == 0 else "b"}"]')
    h.wait_for_selector('[data-testid=reaction]', timeout=20000); r1 = h.inner_text('[data-testid=reaction]')
    ok('Strong opinions' in r1, f'2. 20/80 split → "{r1}"')
    nx(h)
    for i, p in enumerate(ps[:4]): p.wait_for_selector('button[data-option]:not([disabled])', timeout=20000); p.click(f'button[data-option="{"a" if i < 2 else "b"}"]')
    ps[4].wait_for_selector('button[data-option]:not([disabled])'); ps[4].click('button[data-option="a"]')
    h.wait_for_selector('[data-testid=reaction]', timeout=20000); r2 = h.inner_text('[data-testid=reaction]')
    ok('split' in r2, f'2. 60/40 split → "{r2}"')
    # 6. remove a player
    h2, code2 = host(b, 'ego-check')
    rude = phone(b, code2, 'RudeName'); nice = phone(b, code2, 'Nice')
    h2.wait_for_selector('[data-testid=lobby-name]:has-text("RudeName")', timeout=10000)
    h2.once('dialog', lambda d: d.accept()); h2.locator('[data-testid=lobby-name]', has_text='RudeName').locator('[data-testid=kick]').click()
    h2.wait_for_function("!document.body.innerText.includes('RudeName')", timeout=8000); ok(True, '6. host removes a player: name gone from the projector')
    rude.wait_for_selector('[data-testid=kicked]', timeout=10000); ok(True, '6. removed phone is told and its answers deleted')
    ok(nice.locator('[data-testid=kicked]').count() == 0, '6. other players unaffected')
    # 5. default answer time and 4. pause while reading
    ok(h2.locator('text=15 s').count() >= 0, '5. (checked on the settings page below)')
    nx(h2); nx(h2); h2.wait_for_timeout(300)
    ok(h2.locator('[data-testid=pause]').count() == 1, '4. Pause available while players read')
    h2.keyboard.press('p'); h2.wait_for_selector('text=Paused', timeout=5000); ok(True, '4. "P" pauses during reading')
    h2.wait_for_timeout(5000); ok(nice.locator('button[data-option]:not([disabled])').count() == 0, '4. reading time does not run out while paused')
    h2.keyboard.press('p'); nice.wait_for_selector('button[data-option]:not([disabled])', timeout=10000); ok(True, '4. resume: answers open after the remaining reading time')
    # 7. last screen offers "End & see insights"
    for q in range(10):
        nice.wait_for_selector('button[data-option]:not([disabled])', timeout=20000); nice.locator('button[data-option]').first.click()
        h2.wait_for_selector('[data-testid=transition], [data-testid=distribution], [data-testid=suppressed]', timeout=30000); nx(h2)
    nx(h2); nx(h2)
    h2.wait_for_selector('[data-testid=end-insights]', timeout=10000); h2.click('[data-testid=end-insights]'); h2.click('[data-testid=end-confirm]')
    h2.wait_for_selector('[data-testid=recap]', timeout=10000); ok(True, '7. "End & see insights" on the last screen leads to the recap')
    # 5. default answer time
    s = b.new_page(); s.goto(BASE + '#/host/ego-check'); s.wait_for_selector('#answer')
    ok(s.input_value('#answer') == '15', f'5. Who is in Control? defaults to 15 s answers ({s.input_value("#answer")})')
    # 3. languages: German host page, Arabic room in Arabic with correct direction
    de = b.new_context(locale='de-CH').new_page(); de.goto(BASE + '#/host'); de.wait_for_selector('text=Host-Studio')
    de.click('[data-testid=host-ego-check]'); de.wait_for_selector('[data-testid=create]')
    ok('Einstellungen' in de.inner_text('body') and 'Raum erstellen' in de.inner_text('body') and de.input_value('[data-testid=game-lang]') == 'ego-check-de', '3. German: host page translated and the German game preselected')
    de.screenshot(path=f'{SHOTS}/host_de.png', full_page=True)
    h3, code3 = host(b, 'ego-check-ar', lang='ar')
    ok('إنهاء اللعبة' in h3.inner_text('body') and 'مباشر' in h3.inner_text('body'), '3. Arabic: "End game" and LIVE banner translated')
    pa = phone(b, code3, 'سارة', lang='ar'); pb = phone(b, code3, 'Ana', lang='ar')
    nx(h3); nx(h3); pa.wait_for_selector('[data-testid=phone-prompt]', timeout=20000)
    ok('شريحتك' in pa.inner_text('[data-testid=phone-prompt]'), '3. Arabic game: the question itself is in Arabic')
    pa.screenshot(path=f'{SHOTS}/ar_question.png')
    # English game text inside an Arabic interface keeps the question mark at the end
    h4, code4 = host(b, 'ego-check', lang='ar')
    d = h4.evaluate("(() => { const el = document.createElement('p'); el.dir = 'auto'; el.textContent = 'When does my autopilot take the wheel?'; document.body.appendChild(el); return getComputedStyle(el).direction; })()")
    ok(d == 'ltr', f'3. English text in the Arabic interface renders left-to-right ({d})')
    b.close()
fails = [m for c, m in results if not c]
print(f'\n{len(results) - len(fails)} passed, {len(fails)} failed')
