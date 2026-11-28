"""Open Answer cross-browser smoke test: Firefox and WebKit (Safari's engine) for phones and the projector.
Publishes a small game with one open question, then phones in the chosen browser answer (EN and AR), the host approves and
the projector shows the cloud without overlaps.
Usage: BROWSER=firefox|webkit|chromium BASE=http://localhost:8789/PulsePlay/app/ python3 e2e/open_answer_xb.py
WebKit here is the Linux build of Safari's engine, not Safari on iOS or macOS."""
import os, json, urllib.request
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://localhost:8789/PulsePlay/app/'); API = BASE.split('/PulsePlay')[0]
NAME = os.environ.get('BROWSER', 'webkit'); SHOTS = os.environ.get('SHOTS', '/tmp/shots'); os.makedirs(SHOTS, exist_ok=True)
results = []
def ok(c, m): results.append((c, m)); print(('PASS ' if c else 'FAIL ') + f'[{NAME}] ' + m, flush=True)

with sync_playwright() as pw:
    bt = getattr(pw, NAME); b = bt.launch(); errors = []
    phone_opts = {'viewport': {'width': 375, 'height': 812}} | ({} if NAME == 'firefox' else {'is_mobile': True, 'has_touch': True})
    d = b.new_context(viewport={'width': 1280, 'height': 860}).new_page(); d.on('pageerror', lambda e: errors.append(str(e)))
    d.goto(BASE + '#/workspace'); d.wait_for_selector('[data-testid=email]')
    email = f'xb.{NAME}@example.org'
    d.fill('[data-testid=email]', email); d.click('[data-testid=send]'); d.wait_for_selector('[data-testid=code]')
    d.fill('[data-testid=code]', json.load(urllib.request.urlopen(f'{API}/__test/code?email={email}'))['code']); d.click('[data-testid=verify]')
    d.wait_for_selector('[data-testid=new-poll]', timeout=15000); d.click('[data-testid=new-poll]'); d.wait_for_selector('[data-testid=question]')
    q = d.locator('[data-testid=question]').nth(0); q.get_by_label('Type of question 1').select_option('open'); d.wait_for_selector('[data-testid=q-open]')
    q = d.locator('[data-testid=question]').nth(0); q.locator('[data-testid=q-prompt]').fill('One word?')
    q.get_by_label('Time to answer (0 = until I close it)').fill('0')
    for i in (1, 2):
        x = d.locator('[data-testid=question]').nth(i); x.locator('[data-testid=q-prompt]').fill(f'P{i}?')
        for j in range(2): x.locator('[data-testid=q-option]').nth(j).fill(f'O{j}')
    d.wait_for_timeout(1000); d.click('[data-testid=publish]'); d.wait_for_selector('[data-testid=msg]', timeout=15000)
    ok('Published' in d.inner_text('[data-testid=msg]'), 'builder: open question published')
    d.click('[data-testid=host]'); d.wait_for_selector('[data-testid=create]'); d.click('[data-testid=create]')
    d.wait_for_selector('[data-testid=room-code]', timeout=15000); code = d.inner_text('[data-testid=room-code]').replace(' ', '')
    phones = []
    for name, lang in (('Ann', None), ('سارة', 'ar')):
        ctx = b.new_context(**phone_opts)
        if lang: ctx.add_init_script("localStorage.setItem('pp_lang','ar')")
        p = ctx.new_page(); p.on('pageerror', lambda e: errors.append(str(e)))
        p.goto(BASE + f'#/j/{code}'); p.wait_for_selector('[data-testid=nickname]'); p.wait_for_timeout(300)
        p.fill('[data-testid=nickname]', name); p.check('[data-testid=consent]'); p.click('[data-testid=join]')
        p.wait_for_selector('[data-testid=join]', state='detached', timeout=15000); phones.append(p)
    d.wait_for_function("document.querySelector('[data-testid=joined]')?.innerText === '2'", timeout=15000)
    d.click('[data-testid=next]'); d.wait_for_timeout(500); d.click('[data-testid=next]'); d.wait_for_timeout(500)
    d.wait_for_selector('[data-testid=next]:not([disabled])'); d.click('[data-testid=next]'); d.wait_for_selector('[data-testid=oa-stage]', timeout=20000)
    for p, word in zip(phones, ('Calm', 'هادئ')):
        p.wait_for_selector('[data-testid=oa-input]', timeout=15000); p.fill('[data-testid=oa-input]', word); p.click('[data-testid=oa-send]')
        p.wait_for_selector('[data-testid=oa-ok], [data-testid=oa-error]', timeout=15000)
        ok(p.query_selector('[data-testid=oa-ok]') is not None, f'phone: "{word}" sent and confirmed')
    ar = phones[1]
    ok(ar.evaluate('document.documentElement.dir') == 'rtl' and not ar.evaluate('document.documentElement.scrollWidth > innerWidth + 1'), 'arabic phone: right-to-left, no sideways scrolling at 375 px')
    ar.reload(); ar.wait_for_selector('[data-testid=oa-mine]', timeout=15000); ok('هادئ' in ar.inner_text('[data-testid=oa-mine]'), 'phone reload restores own answer')
    d.wait_for_selector('[data-testid=oa-approve-all]', timeout=15000); d.click('[data-testid=oa-approve-all]')
    d.wait_for_function("document.querySelectorAll('[data-testid=oa-word]').length === 2", timeout=10000); d.wait_for_timeout(900)
    bx = d.eval_on_selector_all('[data-testid=oa-word]', 'els => els.map(e => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })')
    ok(not (min(bx[0][2], bx[1][2]) > max(bx[0][0], bx[1][0]) and min(bx[0][3], bx[1][3]) > max(bx[0][1], bx[1][1])), 'projector: Latin and Arabic words shown without overlap')
    d.screenshot(path=f'{SHOTS}/oa_xb_{NAME}.png'); phones[1].screenshot(path=f'{SHOTS}/oa_xb_{NAME}_phone_ar.png')
    d.click('[data-testid=next]'); phones[0].wait_for_selector('[data-testid=oa-closed]', timeout=10000); ok(True, 'close: phone shows answers are closed')
    ok(not errors, f'no page errors {errors[:2]}')
    b.close()
print(f"{sum(c for c, _ in results)} passed, {sum(not c for c, _ in results)} failed")
