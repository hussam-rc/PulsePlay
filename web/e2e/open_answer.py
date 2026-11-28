"""Open Answer questions and live word clouds (generic PulsePlay question type), end to end in the browser.
Creator Studio -> practice -> publish -> live room with a projector, a host moderation panel, a projector window and phones
(one in Arabic), plus 80 concurrent participants through the public API. Checks moderation (also while answers keep arriving),
privacy, markup holding, duplicates, limits, edits, reconnection, offline retry, clear/remove surviving refreshes, reveal after
closing, Arabic RTL, accessibility, 375 px phones, full screen without controls, and that the rest of the game still plays.
Needs the test environment (test-env/start.sh). Usage: BASE=http://localhost:8789/PulsePlay/app/ python3 e2e/open_answer.py"""
import os, json, time, threading, urllib.request
from concurrent.futures import ThreadPoolExecutor
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://localhost:8789/PulsePlay/app/'); API = BASE.split('/PulsePlay')[0]
SHOTS = os.environ.get('SHOTS', '/tmp/shots'); os.makedirs(SHOTS, exist_ok=True)
AXE = os.path.join(os.path.dirname(__file__), '..', 'node_modules', 'axe-core', 'axe.min.js')
results = []
def ok(c, m): results.append((c, m)); print(('PASS ' if c else 'FAIL ') + m, flush=True)

def rpc(fn, args):
    req = urllib.request.Request(f'{API}/rest/v1/rpc/{fn}', data=json.dumps(args).encode(), method='POST',
                                 headers={'content-type': 'application/json', 'apikey': 'testkey', 'Authorization': 'Bearer testkey'})
    return json.load(urllib.request.urlopen(req, timeout=30))

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
    p.wait_for_selector('[data-testid=oa-ok], [data-testid=oa-error]', timeout=20000)
    el = p.query_selector('[data-testid=oa-error]'); return ('error', el.inner_text()) if el else ('ok', p.inner_text('[data-testid=oa-ok]'))

def cloud_words(h): return h.eval_on_selector_all('[data-testid=oa-word]', "els => els.map(e => [e.innerText.split('×')[0].trim(), +e.dataset.count])")
def mod_items(h): return h.eval_on_selector_all('[data-testid=oa-mod-item]', 'els => els.map(e => [e.querySelector("span").innerText, +e.dataset.n])')
def tab_count(h, k): return int(''.join(ch for ch in h.inner_text(f'[data-testid=oa-tab-{k}]').split('(')[-1] if ch.isdigit()) or 0)
def boxes_ok(h):
    boxes = h.eval_on_selector_all('[data-testid=oa-word]', 'els => els.map(e => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; })')
    cl = h.eval_on_selector('[data-testid=oa-cloud]', 'e => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }')
    over = sum(1 for i in range(len(boxes)) for j in range(i + 1, len(boxes)) if min(boxes[i][2], boxes[j][2]) - max(boxes[i][0], boxes[j][0]) > 2 and min(boxes[i][3], boxes[j][3]) - max(boxes[i][1], boxes[j][1]) > 2)
    inside = all(x[0] >= cl[0] - 1 and x[2] <= cl[2] + 1 and x[1] >= cl[1] - 1 and x[3] <= cl[3] + 1 for x in boxes)
    return len(boxes), over, inside

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
    q1 = d.locator('[data-testid=question]').nth(0)
    q1.get_by_label('Type of question 1').select_option('open'); d.wait_for_selector('[data-testid=q-open]')
    q1 = d.locator('[data-testid=question]').nth(0)
    q1.locator('[data-testid=q-prompt]').fill('One word for how this week felt?')
    q1.get_by_label('Answers per person').fill('2')
    q1.get_by_label('Time to answer (0 = until I close it)').fill('0')
    q1.get_by_label('Time to change an answer after sending').fill('30')
    ok(d.inner_text('[data-testid=preview-open]').count('Anonymous') == 1 and '0/25' in d.inner_text('[data-testid=preview-open]'), 'builder: phone preview shows the answer box, 25-character limit and anonymity')
    ok('anonymous, never scored' in q1.inner_text(), 'builder: privacy and scoring are explained next to the settings')
    q = d.locator('[data-testid=question]').nth(1); q.locator('[data-testid=q-prompt]').fill('Poll 1?')
    for j in range(2): q.locator('[data-testid=q-option]').nth(j).fill(f'Option {j + 1}')
    q3 = d.locator('[data-testid=question]').nth(2); q3.get_by_label('Type of question 3').select_option('open')
    q3 = d.locator('[data-testid=question]').nth(2); q3.locator('[data-testid=q-prompt]').fill('One idea for next quarter?')
    q3.get_by_label('Show answers as').select_option('wall'); q3.get_by_label('Before answers appear on screen').select_option('live')
    q3.get_by_label('On the big screen').select_option('closed'); q3.get_by_label('Time to answer (0 = until I close it)').fill('0')
    d.screenshot(path=f'{SHOTS}/oa_builder.png', full_page=True)
    d.wait_for_timeout(800); d.click('[data-testid=publish]'); d.wait_for_selector('[data-testid=msg]', timeout=15000)
    ok('Published version 1' in d.inner_text('[data-testid=msg]'), f'publish: server-side validation accepts two open questions ({d.inner_text("[data-testid=msg]")[:80]})')
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
    st = rpc('pp_state', {'p_code': code}); aid = st['activity']['id']
    ok(h.inner_text('[data-testid=next]').strip() == 'Close submissions' and h.is_enabled('[data-testid=next]'), 'host: Next reads "Close submissions" and does not wait for everyone')
    ok(not h.query_selector('[data-testid=countdown]'), 'projector: no countdown when the question stays open until the host closes it')
    ok('Waiting for the first answers' in h.inner_text('[data-testid=oa-stage]'), 'projector: waiting state before answers')
    p1 = phones[0]
    ok(p1.get_attribute('[data-testid=oa-input]', 'dir') == 'auto' and 'Anonymous' in p1.inner_text('[data-testid=oa-phone]') and 'host checks' in p1.inner_text('[data-testid=oa-phone]'),
       'phone: anonymous notice, host-approval notice, direction follows the text')
    ok(not p1.query_selector('[data-testid=oa-content-lang]'), 'phone (English UI): no language notice for an English question')
    ar.wait_for_selector('[data-testid=oa-content-lang]')
    ok('الإنجليزية' in ar.inner_text('[data-testid=oa-content-lang]') and 'بأي لغة' in ar.inner_text('[data-testid=oa-content-lang]'), f'arabic phone: says the question is written in English and any language may be used ({ar.inner_text("[data-testid=oa-content-lang]")})')
    # submissions
    r = send(p1, 'Calm'); ok(r[0] == 'ok' and 'Sent' in r[1], f'phone: answer sent with confirmation ({r})')
    r = send(p1, 'calm!'); ok(r[0] == 'error' and 'already sent' in r[1], f'phone: same answer again (case/punctuation) is refused ({r})')
    p1.fill('[data-testid=oa-input]', 'x' * 30); ok('30/25' in p1.inner_text('[data-testid=oa-count]'), 'phone: character counter warns when too long')
    p1.click('[data-testid=oa-send]'); p1.wait_for_selector('[data-testid=oa-error]'); ok('at most 25' in p1.inner_text('[data-testid=oa-error]'), 'phone: too long refused before sending')
    r = send(p1, 'Busy'); ok(r[0] == 'ok' and p1.query_selector('[data-testid=oa-done]') is not None and not p1.query_selector('[data-testid=oa-input]'), 'one participant, several answers: second accepted, then "all answers sent" (limit 2)')
    r = send(phones[1], 'CALM'); ok(r[0] == 'ok', 'two participants, same word: both accepted')
    r = send(phones[2], 'see spam.ru'); ok(r[0] == 'error' and 'Links' in r[1], f'phone: links refused ({r})')
    r = send(phones[2], 'sh1t'); ok(r[0] == 'ok', 'phone: a filtered word is accepted but held for the host (no hint to the sender)')
    r = send(phones[3], '<b>bold</b>'); ok(r[0] == 'ok', 'phone: HTML-like text accepted as plain text (then held for review)')
    r = send(phones[4], 'Focused'); r2 = send(phones[5], 'Teamarbeit'); r3 = send(ar, 'هادئ')
    ok(r[0] == r2[0] == r3[0] == 'ok', 'phones: German and Arabic answers accepted')
    phones[5].fill('[data-testid=oa-input]', 'Tired'); phones[5].eval_on_selector('[data-testid=oa-send]', 'b => { b.click(); b.click(); b.click(); }')
    phones[5].wait_for_timeout(1200)
    ok(ar.evaluate('document.documentElement.dir') == 'rtl' and 'إجاباتك' in ar.inner_text('body'), 'arabic phone: right-to-left with Arabic texts')
    ok('تم الإرسال' in ar.inner_text('[data-testid=oa-phone]'), 'arabic phone: confirmation in Arabic')
    ar.screenshot(path=f'{SHOTS}/oa_phone_ar.png')
    # network interruption: the answer is retried and stored once
    p3 = phones[2]; p3.context.set_offline(True)
    p3.fill('[data-testid=oa-input]', 'Offline'); p3.click('[data-testid=oa-send]'); p3.wait_for_timeout(1800); p3.context.set_offline(False)
    p3.wait_for_selector('[data-testid=oa-ok]', timeout=20000)
    # host moderation: everything waits for approval
    h.wait_for_function("(document.querySelector('[data-testid=oa-tab-pending]')?.innerText || '').includes('(10)')", timeout=20000)
    items = dict(mod_items(h))
    ok(items.get('Tired') == 1, f'double tap produced one answer ({items.get("Tired")})')
    ok(items.get('Offline') == 1, f'network interruption: retried until stored, exactly once ({items.get("Offline")})')
    ok((items.get('Calm') or items.get('CALM')) == 2, f'moderation groups identical answers: "Calm" ×2 in one row ({items})')
    ok(not cloud_words(h) and 'Waiting' in h.inner_text('[data-testid=oa-stage]'), 'projector: nothing appears before the host approves')
    ok(h.query_selector('[data-testid=oa-flag][data-reason=word]') is not None and h.query_selector('[data-testid=oa-flag][data-reason=markup]') is not None,
       'moderation: offensive-looking word and code-like text marked separately for checking')
    mod = h.inner_text('[data-testid=oa-mod]')
    ok(not any(f'P{i}' in mod for i in range(1, 7)) and 'عربي' not in mod and 'anonymous' in mod, 'moderation: no names next to answers (host cannot see who wrote what)')
    ok(not h.locator('[data-testid=stage] [data-testid=oa-mod]').count(), 'moderation panel is outside the projected frame')
    ok('10 received' in h.inner_text('[data-testid=oa-mod-received]') and tab_count(h, 'pending') == 10, f'counts: 10 received, 10 waiting ({h.inner_text("[data-testid=oa-mod-received]")})')
    h.click('[data-testid=oa-approve-all]')
    h.wait_for_function("document.querySelectorAll('[data-testid=oa-word]').length >= 7", timeout=10000)
    w = dict(cloud_words(h))
    ok(w.get('Calm') == 2 or w.get('CALM') == 2, f'cloud: "Calm" and "CALM" grouped, count 2 ({w})')
    ok('Teamarbeit' in w and 'هادئ' in w and 'Calm' in w, 'cloud: Arabic and English together; translations stay separate')
    ok('sh1t' not in w and '<b>bold</b>' not in w, 'cloud: "show all" never shows flagged or code-like answers')
    ok(h.inner_text('[data-testid=oa-n]').startswith('8 on screen') and '10 received' in h.inner_text('[data-testid=oa-received]'), f'projector counts: {h.inner_text("[data-testid=oa-n]")} / {h.inner_text("[data-testid=oa-received]")}')
    _, over, inside = boxes_ok(h); ok(over == 0 and inside, 'cloud: mixed Arabic/Latin words do not overlap')
    # approve and remove while new answers keep arriving
    def stream():
        for i in range(12):
            tk = rpc('pp_join', {'p_code': code, 'p_nickname': f'S{i}', 'p_consent': True})['token']
            rpc('pp_open_submit', {'p_token': tk, 'p_activity': aid, 'p_text': f'stream{i}'}); time.sleep(0.15)
    th = threading.Thread(target=stream); th.start(); time.sleep(0.6)
    h.wait_for_selector('[data-testid=oa-approve-all]', timeout=10000)
    label_n = int(''.join(ch for ch in h.inner_text('[data-testid=oa-approve-all]') if ch.isdigit()))
    shown_before = tab_count(h, 'shown')
    h.click('[data-testid=oa-approve-all]'); h.wait_for_timeout(400)
    h.click('[data-testid=oa-tab-shown]'); h.locator('[data-testid=oa-mod-item]', has_text='Busy').locator('[data-testid=oa-hide]').click()
    th.join(); h.wait_for_timeout(1500)
    shown_after = tab_count(h, 'shown'); pending_after = tab_count(h, 'pending')
    ok(shown_after <= shown_before + label_n - 1 and shown_after >= shown_before + 1 and pending_after >= 2,
       f'moderation under load: "show all" approved only answers that were on the list ({label_n}); later arrivals wait ({pending_after} pending)')
    ok(not any(x == 'Busy' for x, _ in cloud_words(h)), 'moderation under load: removed answer disappears from the projector')
    # edit, and reconnecting during the edit window
    p5 = phones[4]; p5.reload(); p5.wait_for_selector('[data-testid=oa-edit]', timeout=15000)
    ok(True, 'reconnect during the edit window: phone reload keeps the answer and its Edit button')
    p5.click('[data-testid=oa-edit]'); p5.fill('[data-testid=oa-input]', 'Focus'); p5.click('[data-testid=oa-send]')
    p5.wait_for_selector('[data-testid=oa-ok]'); ok('Focus' in p5.inner_text('[data-testid=oa-mine]') and 'Focused' not in p5.inner_text('[data-testid=oa-mine]'), 'edit after reconnecting: answer changed')
    h.click('[data-testid=oa-tab-pending]')
    h.wait_for_function("[...document.querySelectorAll('[data-testid=oa-mod-item]')].some(e => e.innerText.startsWith('Focus'))", timeout=8000)
    ok(True, 'moderation: an edited answer goes back to the host for approval')
    p1.reload(); p1.wait_for_selector('[data-testid=oa-mine]', timeout=15000)
    mine = p1.inner_text('[data-testid=oa-mine]'); ok('Calm' in mine and 'Busy' not in mine and p1.query_selector('[data-testid=oa-done]') is not None, f'reconnect: own answers restored; the removed one is gone and still counts toward the limit ({mine!r})')
    # privacy
    p1.wait_for_timeout(1500)
    ok(pub_bodies and not any('Calm' in x or 'Teamarbeit' in x or '"items"' in x for x in pub_bodies), f'privacy: public room state has no answer texts ({len(pub_bodies)} responses checked)')
    st = rpc('pp_state', {'p_code': code}); ok('items' not in st['open'] and all(k in st['open'] for k in ('n', 'shown', 'pending', 'removed')), 'privacy: public API returns counts only')
    # accessibility and layout
    v = axe(p1, '[data-testid=oa-phone]'); ok(not v, f'axe phone open answer: {v or "none"}')
    v = axe(ar, '[data-testid=oa-phone]'); ok(not v, f'axe Arabic phone: {v or "none"}')
    v = axe(h, '[data-testid=oa-mod]'); ok(not v, f'axe moderation panel: {v or "none"}')
    v = axe(h, '[data-testid=oa-stage]'); ok(not v, f'axe projector: {v or "none"}')
    ok(not p1.evaluate('document.documentElement.scrollWidth > innerWidth + 1') and not ar.evaluate('document.documentElement.scrollWidth > innerWidth + 1'), 'phones: no sideways scrolling at 375 px (LTR and RTL)')
    ok(h.evaluate("document.querySelector('[data-testid=oa-cloud] ul.sr-only')?.children.length") == len(cloud_words(h)) > 0, 'projector: word cloud has a screen-reader list of every word')
    h.screenshot(path=f'{SHOTS}/oa_host.png', full_page=True); p1.screenshot(path=f'{SHOTS}/oa_phone.png')
    # ---------------- 80 concurrent participants ----------------
    vocab = ['Calm', 'Busy', 'Focused', 'Tired', 'Hopeful', 'Productive', 'Chaotic', 'Fun', 'Long', 'Energised', 'Stressful', 'Creative',
             'Rewarding', 'Slow', 'Teamwork', 'Learning', 'Growth', 'Curious', 'Extraordinarily', 'هادئ', 'مرهق', 'ممتع', 'طويل', 'إبداع', 'تعلّم', 'Zusammenarbeit', 'Fatigué']
    def participant(i):
        t0 = time.time(); tk = rpc('pp_join', {'p_code': code, 'p_nickname': f'G{i}', 'p_consent': True})['token']; out = []
        for k in range(1 + (i % 2)): out.append(rpc('pp_open_submit', {'p_token': tk, 'p_activity': aid, 'p_text': vocab[(i * 7 + k * 5) % len(vocab)]})['status'])
        return out, time.time() - t0
    t0 = time.time()
    with ThreadPoolExecutor(80) as ex: res = list(ex.map(participant, range(80)))
    statuses = [s for o, _ in res for s in o]; slowest = max(x for _, x in res)
    ok(statuses.count('ok') >= 110 and set(statuses) <= {'ok', 'duplicate'}, f'80 concurrent participants: {len(statuses)} answers, {statuses.count("ok")} ok, all in {time.time() - t0:.1f}s (slowest {slowest:.1f}s)')
    h.click('[data-testid=oa-tab-pending]'); h.wait_for_selector('[data-testid=oa-approve-all]', timeout=10000); h.click('[data-testid=oa-approve-all]')
    h.wait_for_function("document.querySelectorAll('[data-testid=oa-word]').length >= 30", timeout=15000); h.wait_for_timeout(1200)
    n_words, over, inside = boxes_ok(h)
    ok(over == 0 and inside, f'large group: {n_words} words (Latin, Arabic, long, repeated), no overlaps ({over}), all inside the cloud ({inside})')
    sizes = h.eval_on_selector_all('[data-testid=oa-word]', 'els => els.map(e => [e.getBoundingClientRect().width, e.getBoundingClientRect().height])')
    cl_w = h.eval_on_selector('[data-testid=oa-cloud]', 'e => e.getBoundingClientRect().width')
    ok(max(x[0] for x in sizes) <= cl_w * 0.65 and min(x[1] for x in sizes) >= 16, f'readability: biggest word ≤ 65% of the width, smallest ≥ 16 px tall ({max(x[0] for x in sizes):.0f}/{cl_w:.0f}, {min(x[1] for x in sizes):.0f})')
    CENTRES = "els => { const c = document.querySelector('[data-testid=oa-cloud]').getBoundingClientRect(); return Object.fromEntries(els.map(e => { const r = e.getBoundingClientRect(); return [e.innerText, [Math.round(r.left - c.left + r.width / 2), Math.round(r.top - c.top + r.height / 2)]]; })); }"
    before = h.eval_on_selector_all('[data-testid=oa-word]', CENTRES)
    tk = rpc('pp_join', {'p_code': code, 'p_nickname': 'Late', 'p_consent': True})['token']
    rpc('pp_open_submit', {'p_token': tk, 'p_activity': aid, 'p_text': 'Brandnew'})
    h.wait_for_function("[...document.querySelectorAll('[data-testid=oa-mod-item]')].some(e => e.innerText.startsWith('Brandnew'))", timeout=8000)
    h.locator('[data-testid=oa-mod-item]', has_text='Brandnew').locator('[data-testid=oa-approve]').click()
    h.wait_for_function("[...document.querySelectorAll('[data-testid=oa-word]')].some(e => e.innerText === 'Brandnew')", timeout=8000); h.wait_for_timeout(900)
    after = h.eval_on_selector_all('[data-testid=oa-word]', CENTRES)
    moved = [k for k in before if k in after and max(abs(before[k][0] - after[k][0]), abs(before[k][1] - after[k][1])) > 2]
    ok(len(moved) == 0, f'stable cloud: a new word does not move the existing ones ({len(moved)} moved)')
    fr = h.evaluate("() => new Promise(res => { let n = 0, t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(f); else res(n); }; requestAnimationFrame(f); })")
    ok(fr >= 30, f'projector stays smooth with ~140 answers ({fr} frames/s)')
    h.screenshot(path=f'{SHOTS}/oa_cloud_large.png')
    # full screen = projector: no controls, no moderation
    h.focus('body'); h.keyboard.press('f'); h.wait_for_timeout(800)
    fs = h.evaluate('!!document.fullscreenElement')
    ok(fs and h.evaluate("document.fullscreenElement.querySelectorAll('button').length") == 0 and h.evaluate("!document.fullscreenElement.querySelector('[data-testid=oa-mod]')"),
       'full screen: only the projector, no buttons and no moderation inside it')
    h.screenshot(path=f'{SHOTS}/oa_fullscreen.png'); h.evaluate('document.exitFullscreen()'); h.wait_for_timeout(500)
    # projector window for a second display
    with h.expect_popup() as pop: h.click('[data-testid=open-screen]')
    scr = pop.value; scr.wait_for_selector('[data-testid=oa-stage]', timeout=15000); scr.wait_for_selector('[data-testid=oa-word]', timeout=10000)
    ok(not scr.query_selector('[data-testid=oa-mod]') and not scr.query_selector('[data-testid=next]') and code not in scr.url and 'token' not in scr.url.lower(),
       'projector window: the cloud without any host controls; no code or token in its address')
    # clear, then make sure nothing comes back after refreshing the host and the projector window
    h.click('[data-testid=oa-clear]'); h.wait_for_selector('[data-testid=oa-empty]', timeout=8000)
    ok('Screen cleared' in h.inner_text('[data-testid=oa-stage]'), 'clear: projector empties and says so')
    h.reload(); h.wait_for_selector('[data-testid=resume]', timeout=15000); h.click('[data-testid=resume]'); h.wait_for_selector('[data-testid=oa-stage]', timeout=15000); h.wait_for_timeout(1500)
    scr.reload(); scr.wait_for_selector('[data-testid=oa-stage]', timeout=15000); scr.wait_for_timeout(1500)
    ok(not cloud_words(h) and not cloud_words(scr) and tab_count(h, 'hidden') >= 1, 'refresh: cleared and removed answers do not reappear on the host or the projector window')
    rpc('pp_open_submit', {'p_token': tk, 'p_activity': aid, 'p_text': 'Aftermath'})
    h.wait_for_selector('[data-testid=oa-tab-pending]'); h.click('[data-testid=oa-tab-pending]')
    h.wait_for_function("[...document.querySelectorAll('[data-testid=oa-mod-item]')].some(e => e.innerText.startsWith('Aftermath'))", timeout=8000)
    h.locator('[data-testid=oa-mod-item]', has_text='Aftermath').locator('[data-testid=oa-approve]').click()
    h.wait_for_function("[...document.querySelectorAll('[data-testid=oa-word]')].map(e => e.innerText).join() === 'Aftermath'", timeout=8000)
    ok(True, 'after clear: a newly approved answer appears on its own')
    scr.close()
    # close submissions
    h.click('[data-testid=next]'); phones[1].wait_for_selector('[data-testid=oa-closed]', timeout=10000)
    ok(True, 'close: phones see that answers are closed')
    r = rpc('pp_open_submit', {'p_token': tk, 'p_activity': aid, 'p_text': 'After'}); ok(r['status'] in ('not_open', 'late'), f'close: server refuses answers after closing ({r["status"]})')
    # the poll still plays
    h.wait_for_selector('[data-testid=next]:not([disabled])'); h.click('[data-testid=next]')
    h.wait_for_selector('[data-testid=prompt][data-idx="1"]', timeout=15000)
    ok('Poll 1?' in h.inner_text('[data-testid=prompt]'), 'game continues with the next (poll) question')
    h.wait_for_selector('[data-testid=next]:not([disabled])'); h.click('[data-testid=next]')
    for p in phones[:5]: p.wait_for_selector('button[data-option]:not([disabled])', timeout=15000); p.click('button[data-option="a"]')
    ok(True, 'phones answer the poll with buttons as before')
    h.wait_for_selector('[data-testid=prompt][data-idx="1"]')
    h.wait_for_selector('[data-testid=next]:not([disabled])', timeout=40000); h.click('[data-testid=next]'); h.wait_for_timeout(800)   # poll reveal -> q3 (read)
    # q3: wall, approved at once (live) but only on the big screen after the host reveals
    h.wait_for_selector('[data-testid=prompt][data-idx="2"]', timeout=15000); h.wait_for_selector('[data-testid=next]:not([disabled])'); h.click('[data-testid=next]')
    r1 = send(phones[0], 'More pairing'); r2 = send(phones[1], 'Less meetings'); r3 = send(ar, 'تعلّم أكثر')
    ok(r1[0] == r2[0] == r3[0] == 'ok', f'wall question: answers accepted ({r1}, {r2}, {r3})')
    h.wait_for_timeout(1200)
    ok(h.query_selector('[data-testid=oa-hidden]') is not None and 'reveals' in h.inner_text('[data-testid=oa-hidden]') and not h.query_selector('[data-testid=oa-wall]'), 'reveal mode: nothing on the projector while answering')
    h.click('[data-testid=next]'); h.wait_for_timeout(1200)
    ok(h.query_selector('[data-testid=oa-hidden]') is not None and h.query_selector('[data-testid=oa-reveal-box]') is not None, 'reveal mode: still hidden after closing; the host sees "ready to reveal"')
    h.focus('body'); h.keyboard.press('r')
    h.wait_for_selector('[data-testid=oa-wall]', timeout=8000)
    cards = h.eval_on_selector_all('[data-testid=oa-wall] [data-testid=oa-word]', 'els => els.map(e => e.innerText)')
    ok(len(cards) == 3 and any('تعلّم' in c for c in cards), f'reveal (R key): all approved answers appear together on the wall ({cards})')
    h.screenshot(path=f'{SHOTS}/oa_wall.png')
    h.click('[data-testid=end]'); h.click('[data-testid=end-confirm]'); h.wait_for_selector('[data-testid=recap]', timeout=10000)
    st2 = None
    try: st2 = rpc('pp_state', {'p_code': code})
    except Exception: pass
    ok(not st2 or st2.get('ended'), 'end: room ended; answers are deleted with the session (checked in the SQL suite)')
    ok(not errors, f'no page errors {errors[:2]}')
    b.close()
print(f"{sum(c for c, _ in results)} passed, {sum(not c for c, _ in results)} failed")
