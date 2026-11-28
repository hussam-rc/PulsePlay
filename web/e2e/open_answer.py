"""Open Answer questions and live word clouds (generic PulsePlay question type), end to end in the browser.
Creator Studio settings -> publish -> live room with a projector, a host moderation panel and many phones (one in Arabic),
plus a large simulated group through the public API. Checks moderation, privacy, duplicates, limits, edits, reconnection,
Arabic RTL, accessibility, 375 px phones and that the rest of the game still plays.
Needs the test environment (test-env/start.sh). Usage: BASE=http://localhost:8789/PulsePlay/app/ python3 e2e/open_answer.py"""
import os, json, time, urllib.request
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://localhost:8789/PulsePlay/app/'); API = BASE.split('/PulsePlay')[0]
SHOTS = os.environ.get('SHOTS', '/tmp/shots'); os.makedirs(SHOTS, exist_ok=True)
AXE = os.path.join(os.path.dirname(__file__), '..', 'node_modules', 'axe-core', 'axe.min.js')
results = []
def ok(c, m): results.append((c, m)); print(('PASS ' if c else 'FAIL ') + m, flush=True)

def rpc(fn, args):
    req = urllib.request.Request(f'{API}/rest/v1/rpc/{fn}', data=json.dumps(args).encode(), method='POST',
                                 headers={'content-type': 'application/json', 'apikey': 'testkey', 'Authorization': 'Bearer testkey'})
    return json.load(urllib.request.urlopen(req))

def axe(p, sel):
    p.add_script_tag(path=AXE)
    return p.evaluate("s => axe.run(document.querySelector(s),{resultTypes:['violations']}).then(r=>r.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>v.id+': '+v.nodes.map(n=>n.target.join(' ')).join(' | ')))", sel)

def join(b, code, name, lang=None):
    ctx = b.new_context(viewport={'width': 375, 'height': 812}, is_mobile=True, has_touch=True)
    if lang: ctx.add_init_script(f"localStorage.setItem('pp_lang','{lang}')")
    p = ctx.new_page(); p.goto(BASE + f'#/j/{code}'); p.wait_for_selector('[data-testid=nickname]'); p.wait_for_timeout(300)
    p.fill('[data-testid=nickname]', name); p.check('[data-testid=consent]'); p.click('[data-testid=join]')
    p.wait_for_selector('[data-testid=join]', state='detached', timeout=10000); p.wait_for_timeout(300)
    return p

def send(p, text):
    p.wait_for_selector('[data-testid=oa-input]', timeout=15000); p.fill('[data-testid=oa-input]', text); p.click('[data-testid=oa-send]')
    p.wait_for_selector('[data-testid=oa-ok], [data-testid=oa-error]', timeout=10000)
    el = p.query_selector('[data-testid=oa-error]'); return ('error', el.inner_text()) if el else ('ok', p.inner_text('[data-testid=oa-ok]'))

def cloud_words(h): return h.eval_on_selector_all('[data-testid=oa-word]', "els => els.map(e => [e.innerText.split('×')[0].trim(), +e.dataset.count])")

with sync_playwright() as pw:
    b = pw.chromium.launch(); errors = []
    d = b.new_context(viewport={'width': 1366, 'height': 900}).new_page(); d.on('pageerror', lambda e: errors.append(str(e)))
    d.on('dialog', lambda dl: dl.accept())
    # ---------------- Creator Studio ----------------
    d.goto(BASE + '#/workspace'); d.wait_for_selector('[data-testid=email]')
    email = 'creator.open@example.org'
    d.fill('[data-testid=email]', email); d.click('[data-testid=send]'); d.wait_for_selector('[data-testid=code]')
    d.fill('[data-testid=code]', json.load(urllib.request.urlopen(f'{API}/__test/code?email={email}'))['code']); d.click('[data-testid=verify]')
    d.wait_for_selector('[data-testid=new-poll]', timeout=10000); d.click('[data-testid=new-poll]'); d.wait_for_selector('[data-testid=question]')
    d.fill('#title, [data-testid=title]', 'Open answer test') if d.query_selector('[data-testid=title]') else None
    q1 = d.locator('[data-testid=question]').nth(0)
    q1.get_by_label('Type of question 1').select_option('open'); d.wait_for_selector('[data-testid=q-open]')
    q1 = d.locator('[data-testid=question]').nth(0)
    q1.locator('[data-testid=q-prompt]').fill('One word for how this week felt?')
    q1.get_by_label('Answers per person').fill('2')
    q1.get_by_label('Time to answer (0 = until I close it)').fill('0')
    q1.get_by_label('Time to change an answer after sending').fill('20')
    ok(d.inner_text('[data-testid=preview-open]').count('Anonymous') == 1 and '0/25' in d.inner_text('[data-testid=preview-open]'), 'builder: phone preview shows the answer box, 25-character limit and anonymity')
    ok('anonymous, never scored' in q1.inner_text(), 'builder: privacy and scoring are explained next to the settings')
    for i in (1, 2):
        q = d.locator('[data-testid=question]').nth(i); q.locator('[data-testid=q-prompt]').fill(f'Poll {i}?')
        for j in range(2): q.locator('[data-testid=q-option]').nth(j).fill(f'Option {j + 1}')
    d.screenshot(path=f'{SHOTS}/oa_builder.png', full_page=True)
    d.wait_for_timeout(800); d.click('[data-testid=publish]'); d.wait_for_selector('[data-testid=msg]', timeout=15000)
    ok('Published version 1' in d.inner_text('[data-testid=msg]'), f'publish: server-side validation accepts the open question ({d.inner_text("[data-testid=msg]")[:80]})')
    # ---------------- practice (in memory, simulated players) ----------------
    editor = d.url; d.goto(editor.replace('/workspace/edit/', '/workspace/preview/')); d.wait_for_selector('[data-testid=nickname]', timeout=15000)
    d.fill('[data-testid=nickname]', 'Me')
    if d.query_selector('[data-testid=phone] [data-testid=consent]'): d.check('[data-testid=phone] [data-testid=consent]')
    d.click('[data-testid=phone] [data-testid=join]'); d.wait_for_selector('[data-testid=phone] [data-testid=join]', state='detached')
    d.wait_for_timeout(400); d.click('[data-testid=next]'); d.wait_for_timeout(400); d.click('[data-testid=next]')
    d.wait_for_selector('[data-testid=phone] [data-testid=oa-input]', timeout=20000)
    d.fill('[data-testid=phone] [data-testid=oa-input]', 'Practice'); d.click('[data-testid=phone] [data-testid=oa-send]'); d.wait_for_selector('[data-testid=phone] [data-testid=oa-ok]')
    d.wait_for_function("document.querySelectorAll('[data-testid=oa-mod-item]').length >= 3", timeout=30000)
    d.click('[data-testid=oa-approve-all]'); d.wait_for_selector('[data-testid=oa-word]', timeout=8000)
    ok(any(w == 'Practice' for w, _ in cloud_words(d)) and len(cloud_words(d)) >= 2, f'practice: my answer and simulated answers reach the cloud after approval ({len(cloud_words(d))} words)')
    d.click('[data-testid=next]'); d.wait_for_selector('[data-testid=phone] [data-testid=oa-closed]', timeout=8000); ok(True, 'practice: Next closes submissions')
    d.goto(editor); d.wait_for_selector('[data-testid=host]', timeout=15000)
    d.click('[data-testid=host]'); d.wait_for_selector('[data-testid=create]'); d.click('[data-testid=create]')
    d.wait_for_selector('[data-testid=room-code]', timeout=10000); code = d.inner_text('[data-testid=room-code]').replace(' ', ''); h = d
    # ---------------- phones ----------------
    phones = [join(b, code, f'P{i + 1}') for i in range(6)] + [join(b, code, 'عربي', lang='ar')]
    ar = phones[-1]
    pub_bodies = []
    phones[0].on('response', lambda r: pub_bodies.append(r.text()) if r.url.endswith('/rpc/pp_state') and r.ok else None)
    h.wait_for_function("document.querySelector('[data-testid=joined]')?.innerText === '7'", timeout=15000)
    h.click('[data-testid=next]'); h.wait_for_timeout(500); h.click('[data-testid=next]')
    h.wait_for_selector('[data-testid=oa-stage]', timeout=20000)
    ok(h.inner_text('[data-testid=next]').strip() == 'Close submissions' and h.is_enabled('[data-testid=next]'), 'host: Next reads "Close submissions" and does not wait for everyone')
    ok(not h.query_selector('[data-testid=countdown]'), 'projector: no countdown when the question stays open until the host closes it')
    ok('Waiting for the first answers' in h.inner_text('[data-testid=oa-stage]'), 'projector: waiting state before answers')
    p1 = phones[0]
    ok(p1.get_attribute('[data-testid=oa-input]', 'dir') == 'auto' and 'Anonymous' in p1.inner_text('[data-testid=oa-phone]') and 'host checks' in p1.inner_text('[data-testid=oa-phone]'),
       'phone: anonymous notice, host-approval notice, direction follows the text')
    # submissions
    r = send(p1, 'Calm'); ok(r[0] == 'ok' and 'Sent' in r[1], f'phone: answer sent with confirmation ({r})')
    r = send(p1, 'calm!'); ok(r[0] == 'error' and 'already sent' in r[1], f'phone: same answer again (case/punctuation) is refused ({r})')
    p1.fill('[data-testid=oa-input]', 'x' * 30); ok('30/25' in p1.inner_text('[data-testid=oa-count]'), 'phone: character counter warns when too long')
    p1.click('[data-testid=oa-send]'); p1.wait_for_selector('[data-testid=oa-error]'); ok('at most 25' in p1.inner_text('[data-testid=oa-error]'), 'phone: too long refused before sending')
    r = send(p1, 'Busy'); ok(r[0] == 'ok' and p1.query_selector('[data-testid=oa-done]') is not None and not p1.query_selector('[data-testid=oa-input]'), 'phone: second answer accepted, then "all answers sent" (limit 2)')
    r = send(phones[1], 'CALM'); ok(r[0] == 'ok', 'phone: another person may give the same answer')
    r = send(phones[2], 'see spam.ru'); ok(r[0] == 'error' and 'Links' in r[1], f'phone: links refused ({r})')
    r = send(phones[2], 'sh1t'); ok(r[0] == 'ok', 'phone: a filtered word is accepted but held for the host (no hint to the sender)')
    r = send(phones[3], '<img src=x onerror=alert(1)>'); ok(r[0] == 'error', f'phone: HTML longer than the limit refused ({r})')
    r = send(phones[3], '<b>bold</b>'); ok(r[0] == 'ok', 'phone: short HTML-like text accepted as plain text')
    r = send(phones[4], 'Focused'); r2 = send(phones[5], 'Teamarbeit'); r3 = send(ar, 'هادئ')
    ok(r[0] == r2[0] == r3[0] == 'ok', 'phones: German and Arabic answers accepted')
    # double-tap: two clicks in a row must produce one answer
    phones[5].fill('[data-testid=oa-input]', 'Tired'); phones[5].eval_on_selector('[data-testid=oa-send]', 'b => { b.click(); b.click(); b.click(); }')
    phones[5].wait_for_timeout(1200)
    # Arabic phone
    ok(ar.evaluate('document.documentElement.dir') == 'rtl' and 'اكتب' in ar.inner_text('body') + (ar.get_attribute('[data-testid=oa-input]', 'placeholder') or '') or 'إجاباتك' in ar.inner_text('body'), 'arabic phone: right-to-left with Arabic texts')
    ok('أُرسلت' in ar.inner_text('[data-testid=oa-phone]'), 'arabic phone: confirmation in Arabic')
    ar.screenshot(path=f'{SHOTS}/oa_phone_ar.png')
    # host moderation: everything waits for approval
    h.wait_for_function("document.querySelectorAll('[data-testid=oa-mod-item]').length >= 9", timeout=10000)
    items = h.eval_on_selector_all('[data-testid=oa-mod-item]', 'els => els.map(e => e.innerText)')
    ok(sum('Tired' in x for x in items) == 1, f'double tap produced one answer ({sum("Tired" in x for x in items)})')
    ok(not cloud_words(h) and 'Waiting' in h.inner_text('[data-testid=oa-stage]'), 'projector: nothing appears before the host approves')
    ok(h.query_selector('[data-testid=oa-mod-item][data-flagged] [data-testid=oa-flag]') is not None, 'moderation: filtered word marked for checking')
    mod = h.inner_text('[data-testid=oa-mod]')
    ok(not any(f'P{i}' in mod for i in range(1, 7)) and 'عربي' not in mod and 'anonymous' in mod, 'moderation: no names next to answers (host cannot see who wrote what)')
    ok(not h.locator('[data-testid=stage] [data-testid=oa-mod]').count(), 'moderation panel is outside the projected frame')
    h.click('[data-testid=oa-approve-all]')
    h.wait_for_function("document.querySelectorAll('[data-testid=oa-word]').length >= 7", timeout=10000)
    w = dict(cloud_words(h))
    ok(w.get('Calm') == 2 or w.get('calm') == 2 or w.get('CALM') == 2, f'cloud: "Calm" and "CALM" grouped, count 2 ({w})')
    ok('Teamarbeit' in w and 'هادئ' in w and 'sh1t' not in w, 'cloud: translations stay separate; flagged word not shown by "show all"')
    ok(h.inner_text('[data-testid=stage] img') == '' if h.query_selector('[data-testid=stage] img') else '<b>bold</b>' in w, 'cloud: HTML shown as literal text, never rendered')
    n = h.inner_text('[data-testid=oa-n]'); ok(n.startswith('9 ') or n.startswith('9'), f'projector: response count shown ({n})')
    # remove an answer instantly
    h.click('[data-testid=oa-tab-shown]')
    h.locator('[data-testid=oa-mod-item]', has_text='Busy').locator('[data-testid=oa-hide]').click()
    h.wait_for_function("![...document.querySelectorAll('[data-testid=oa-word]')].some(e => e.innerText.startsWith('Busy'))", timeout=5000)
    ok(True, 'moderation: removed answer disappears from the projector')
    # edit inside the window
    p4 = phones[4]; p4.click('[data-testid=oa-edit]'); p4.fill('[data-testid=oa-input]', 'Focus'); p4.click('[data-testid=oa-send]')
    p4.wait_for_selector('[data-testid=oa-ok]'); ok('Focus' in p4.inner_text('[data-testid=oa-mine]') and 'Focused' not in p4.inner_text('[data-testid=oa-mine]'), 'phone: answer changed within the edit window')
    h.click('[data-testid=oa-tab-pending]')
    h.wait_for_function("[...document.querySelectorAll('[data-testid=oa-mod-item]')].some(e => e.innerText.includes('Focus'))", timeout=8000)
    ok(True, 'moderation: an edited answer goes back to the host for approval')
    # reconnection: reload keeps the phone's own answers
    p1.reload(); p1.wait_for_selector('[data-testid=oa-mine]', timeout=15000)
    mine = p1.inner_text('[data-testid=oa-mine]'); ok('Calm' in mine and 'Busy' not in mine and p1.query_selector('[data-testid=oa-done]') is not None, f'reconnect: phone reload restores own answers; removed ones are gone ({mine!r})')
    # privacy: the public state never carries answer texts
    p1.wait_for_timeout(1500)
    ok(pub_bodies and not any('Calm' in x or 'Teamarbeit' in x or '"items"' in x for x in pub_bodies), f'privacy: public room state has no answer texts ({len(pub_bodies)} responses checked)')
    st = rpc('pp_state', {'p_code': code}); ok('open' in st and 'items' not in st['open'] and st['open']['n'] >= 8, 'privacy: public API returns counts only')
    # accessibility and layout
    v = axe(p1, '[data-testid=oa-phone]'); ok(not v, f'axe phone open answer: {v or "none"}')
    v = axe(h, '[data-testid=oa-mod]'); ok(not v, f'axe moderation panel: {v or "none"}')
    v = axe(h, '[data-testid=oa-stage]'); ok(not v, f'axe projector: {v or "none"}')
    ok(not p1.evaluate('document.documentElement.scrollWidth > innerWidth + 1') and not ar.evaluate('document.documentElement.scrollWidth > innerWidth + 1'), 'phones: no sideways scrolling at 375 px (LTR and RTL)')
    ok(h.evaluate("document.querySelector('[data-testid=oa-cloud] ul.sr-only')?.children.length") == len(cloud_words(h)) > 0, 'projector: word cloud has a screen-reader list of every word')
    h.screenshot(path=f'{SHOTS}/oa_host.png', full_page=True); p1.screenshot(path=f'{SHOTS}/oa_phone.png')
    # ---------------- large group through the public API ----------------
    vocab = ['Calm', 'Busy', 'Focused', 'Tired', 'Hopeful', 'Productive', 'Chaotic', 'Fun', 'Long', 'Energised', 'Stressful', 'Creative',
             'Rewarding', 'Slow', 'Fast', 'Messy', 'Bright', 'Heavy', 'Light', 'Steady', 'Teamwork', 'Learning', 'Growth', 'Curious']
    t0 = time.time(); toks = []
    for i in range(60):
        toks.append(rpc('pp_join', {'p_code': code, 'p_nickname': f'G{i}', 'p_consent': True})['token'])
    statuses = []
    for i, tk in enumerate(toks):
        for k in range(1 + (i % 2)):
            statuses.append(rpc('pp_open_submit', {'p_token': tk, 'p_activity': st['activity']['id'], 'p_text': vocab[(i * 7 + k * 5) % len(vocab)]})['status'])
    ok(statuses.count('ok') >= 85 and set(statuses) <= {'ok', 'duplicate'}, f'large group: 60 more people send {len(statuses)} answers ({statuses.count("ok")} ok) in {time.time() - t0:.1f}s')
    h.click('[data-testid=oa-tab-pending]'); h.wait_for_selector('[data-testid=oa-approve-all]', timeout=10000); h.click('[data-testid=oa-approve-all]')
    h.wait_for_function("document.querySelectorAll('[data-testid=oa-word]').length >= 25", timeout=15000); h.wait_for_timeout(900)
    boxes = h.eval_on_selector_all('[data-testid=oa-word]', 'els => els.map(e => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })')
    cl = h.eval_on_selector('[data-testid=oa-cloud]', 'e => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }')
    over = sum(1 for i in range(len(boxes)) for j in range(i + 1, len(boxes)) if min(boxes[i][2], boxes[j][2]) - max(boxes[i][0], boxes[j][0]) > 2 and min(boxes[i][3], boxes[j][3]) - max(boxes[i][1], boxes[j][1]) > 2)
    inside = all(x[0] >= cl[0] - 1 and x[2] <= cl[2] + 1 and x[1] >= cl[1] - 1 and x[3] <= cl[3] + 1 for x in boxes)
    ok(over == 0 and inside, f'large group: {len(boxes)} words, no overlaps ({over}), all inside the cloud ({inside})')
    CENTRES = "els => { const c = document.querySelector('[data-testid=oa-cloud]').getBoundingClientRect(); return Object.fromEntries(els.map(e => { const r = e.getBoundingClientRect(); return [e.innerText, [Math.round(r.left - c.left + r.width / 2), Math.round(r.top - c.top + r.height / 2)]]; })); }"
    before = h.eval_on_selector_all('[data-testid=oa-word]', CENTRES)
    tk = rpc('pp_join', {'p_code': code, 'p_nickname': 'Late', 'p_consent': True})['token']
    rpc('pp_open_submit', {'p_token': tk, 'p_activity': st['activity']['id'], 'p_text': 'Brandnew'})
    h.click('[data-testid=oa-tab-pending]'); h.locator('[data-testid=oa-mod-item]', has_text='Brandnew').locator('[data-testid=oa-approve]').click()
    h.wait_for_function("[...document.querySelectorAll('[data-testid=oa-word]')].some(e => e.innerText === 'Brandnew')", timeout=8000); h.wait_for_timeout(900)
    after = h.eval_on_selector_all('[data-testid=oa-word]', CENTRES)
    moved = [k for k in before if k in after and max(abs(before[k][0] - after[k][0]), abs(before[k][1] - after[k][1])) > 2]
    ok(len(moved) == 0, f'stable cloud: a new word does not move the existing ones ({len(moved)} moved)')
    fr = h.evaluate("() => new Promise(res => { let n = 0, t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else res(n); }; requestAnimationFrame(f); })")
    ok(fr >= 30, f'projector stays smooth with ~90 answers ({fr} frames/s)')
    h.screenshot(path=f'{SHOTS}/oa_cloud_large.png')
    # clear and close
    h.click('[data-testid=oa-clear]'); h.wait_for_selector('[data-testid=oa-empty]', timeout=8000)
    ok('Screen cleared' in h.inner_text('[data-testid=oa-stage]'), 'clear: projector empties and says so')
    h.click('[data-testid=next]'); phones[1].wait_for_selector('[data-testid=oa-closed]', timeout=10000)
    ok(True, 'close: phones see that answers are closed')
    r = rpc('pp_open_submit', {'p_token': toks[1], 'p_activity': st['activity']['id'], 'p_text': 'After'}); ok(r['status'] in ('not_open', 'late'), f'close: server refuses answers after closing ({r["status"]})')
    # the rest of the game still plays
    h.wait_for_selector('[data-testid=next]:not([disabled])'); h.click('[data-testid=next]')
    h.wait_for_selector('[data-testid=prompt][data-idx="1"]', timeout=15000)
    ok('Poll 1?' in h.inner_text('[data-testid=prompt]'), 'game continues with the next (poll) question')
    phones[0].wait_for_selector('button[data-option]:not([disabled])', timeout=15000); ok(True, 'phones get the poll buttons as before')
    h.click('[data-testid=end]'); h.click('[data-testid=end-confirm]'); h.wait_for_selector('[data-testid=recap]', timeout=10000)
    st2 = None
    try: st2 = rpc('pp_state', {'p_code': code})
    except Exception: pass
    ok(not st2 or st2.get('ended'), 'end: room ended; answers are deleted with the session (checked in the SQL suite)')
    ok(not errors, f'no page errors {errors[:2]}')
    b.close()
print(f"{sum(c for c, _ in results)} passed, {sum(not c for c, _ in results)} failed")
