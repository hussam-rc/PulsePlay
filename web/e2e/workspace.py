"""Workspace browser test: sign-in, organisations, roles, drafts, publish, host, isolation — separate browser per person.
Needs the full local emulator (Auth + REST + Edge Function). Usage: BASE=http://localhost:8789/PulsePlay/app/ python3 workspace.py"""
import os, json, urllib.request
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://localhost:8789/PulsePlay/app/'); API = BASE.split('/PulsePlay')[0]
SHOTS = os.environ.get('SHOTS', '/tmp/shots'); os.makedirs(SHOTS, exist_ok=True)
results = []
def ok(c, m): results.append((c, m)); print(('PASS ' if c else 'FAIL ') + m, flush=True)

def sign_in(b, email, mobile=False):
    ctx = b.new_context(viewport={'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 860}, is_mobile=mobile, has_touch=mobile)
    p = ctx.new_page(); p.goto(BASE + '#/workspace')
    p.fill('[data-testid=email]', email); p.click('[data-testid=send]'); p.wait_for_selector('[data-testid=code]')
    code = json.load(urllib.request.urlopen(f'{API}/__test/code?email={email}'))['code']
    p.fill('[data-testid=code]', code); p.click('[data-testid=verify]'); p.wait_for_selector('[data-testid=who]', timeout=10000)
    return p

def space(p, name): p.click(f'[data-testid=spaces] button:has-text("{name}")')

def fetch(p, path, body, fn=False):
    return p.evaluate("""async ([path, body, fn]) => { const s = JSON.parse(localStorage.getItem('pp_auth'));
      const r = await fetch(location.origin + (fn ? '/functions/v1/' : '/rest/v1/rpc/') + path, { method: 'POST', headers: { 'content-type': 'application/json', apikey: 'testkey', Authorization: 'Bearer ' + s.access_token }, body: JSON.stringify(body) });
      return { status: r.status, body: await r.json().catch(() => null) }; }""", [path, body, fn])

with sync_playwright() as pw:
    b = pw.chromium.launch()
    # ---- Alice: owner ----
    a = sign_in(b, 'alice@example.org')
    ok(a.inner_text('[data-testid=who]') == 'alice@example.org', 'auth: email code signs Alice in')
    a.reload(); a.wait_for_selector('[data-testid=who]'); ok(True, 'auth: session survives a page reload')
    a.click('[data-testid=new-org]'); a.fill('[data-testid=org-name]', 'Org A'); a.click('[data-testid=org-create]')
    a.wait_for_selector('[data-testid=spaces] button:has-text("Org A")'); ok('owner' in a.inner_text('[data-testid=spaces]'), 'org: Alice creates Org A and is owner')
    a.click('[role=tab]:has-text("Members")')
    for email, role in [('carol@example.org', 'creator'), ('dave@example.org', 'facilitator')]:
        a.fill('[data-testid=invite-email]', email); a.select_option('[aria-label=Role]', role); a.click('[data-testid=invite]'); a.wait_for_selector(f'text={email}')
    ok(a.locator('text=invited · creator').count() == 1 and a.locator('text=invited · facilitator').count() == 1, 'members: invites listed with roles')
    a.click('[role=tab]:has-text("Library")'); a.select_option('#tpl', 'myth-or-fact'); a.click('[data-testid=copy-template]')
    a.wait_for_selector('[data-testid=checker]'); exp_id = a.url.split('/edit/')[1]
    ok('Ready to publish' in a.inner_text('[data-testid=checker]'), 'builder: template copy opens in the no-code builder, ready to publish')
    ok(a.locator('[data-testid=question]').count() == 10 and a.locator('textarea[aria-label="Game file"]').count() == 0, 'builder: 10 questions as forms, no code visible')
    a.screenshot(path=f'{SHOTS}/ws_builder.png', full_page=True)
    a.click('[data-testid=publish]'); a.wait_for_selector('[data-testid=msg]', timeout=10000)
    ok('Published version 1' in a.inner_text('[data-testid=msg]'), 'publish: v1 via the Edge Function (server-side validation)')
    # break it through the form: client blocks, autosave stores the draft, server still refuses
    a.fill('[data-testid=b-title]', ''); a.wait_for_selector('[data-testid=save-state]:has-text("All changes saved")', timeout=10000)
    ok('Basics: Game name is empty.' in a.inner_text('[data-testid=checker]') and a.is_disabled('[data-testid=publish]'), 'checker: plain-language problem and publish disabled')
    r = fetch(a, 'publish', {'experienceId': exp_id, 'visibility': 'org'}, fn=True)
    ok(r['status'] == 422, f'publish: server refuses the broken draft directly ({r["status"]})')
    a.fill('[data-testid=b-title]', 'Team Myths'); a.wait_for_selector('[data-testid=save-state]:has-text("All changes saved")', timeout=10000)
    a.reload(); a.wait_for_selector('[data-testid=b-title]'); ok(a.input_value('[data-testid=b-title]') == 'Team Myths', 'autosave: edits survive a reload')
    # ---- Carol: creator via invite ----
    c = sign_in(b, 'carol@example.org')
    c.wait_for_selector('[data-testid=spaces] button:has-text("Org A")'); ok('creator' in c.inner_text('[data-testid=spaces]'), 'invite: Carol joins Org A as creator on first sign-in')
    space(c, 'Org A'); c.wait_for_selector('[data-testid=lib-item]'); ok(c.locator('[data-testid=lib-item]').count() == 1, 'library: Carol sees the org experience')
    # ---- Dave: facilitator ----
    d = sign_in(b, 'dave@example.org')
    space(d, 'Org A'); d.wait_for_selector('[data-testid=lib-item]')
    ok(d.locator('[data-testid=copy-template]').count() == 0, 'roles: facilitator cannot create drafts (no template button)')
    d.goto(BASE + f'#/workspace/edit/{exp_id}'); d.wait_for_selector('[data-testid=checker]')
    ok(d.locator('[data-testid=save-state]').count() == 0 and d.locator('[data-testid=publish]').count() == 0 and d.locator('text=view only').count() == 1 and d.is_disabled('[data-testid=b-title]'), 'roles: facilitator sees the game view-only, no publish')
    r = fetch(d, 'publish', {'experienceId': exp_id, 'visibility': 'org'}, fn=True)
    ok(r['status'] == 403, f'roles: facilitator publish refused by the server ({r["status"]})')
    d.goto(BASE + f'#/host/{exp_id}'); d.wait_for_selector('[data-testid=create]'); d.click('[data-testid=create]')
    d.wait_for_selector('[data-testid=room-code]', timeout=10000); code = d.inner_text('[data-testid=room-code]').replace(' ', '')
    ok(len(code) == 6, f'host: facilitator hosts the org experience ({code})')
    phone = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True).new_page()
    phone.goto(BASE + f'#/j/{code}'); phone.wait_for_selector('[data-testid=nickname]'); phone.wait_for_timeout(300)
    phone.fill('[data-testid=nickname]', 'Guest'); phone.check('[data-testid=consent]'); phone.click('[data-testid=join]')
    phone.wait_for_selector("text=You're in, Guest!", timeout=10000); ok(True, 'play: anonymous phone joins without an account')
    ok(phone.evaluate("localStorage.getItem('pp_auth')") is None, 'play: the participant browser holds no account token')
    d.wait_for_function("document.querySelector('[data-testid=joined]')?.innerText === '1'", timeout=10000)
    d.click('[data-testid=end]'); d.click('[data-testid=end-confirm]'); d.wait_for_selector('[data-testid=recap]', timeout=10000)
    a.goto(BASE + '#/workspace'); space(a, 'Org A'); a.click('[role=tab]:has-text("Sessions")'); a.wait_for_selector('[data-testid=sessions]', timeout=10000)
    ok('Copy of Myth or Fact' in a.inner_text('[data-testid=sessions]'), 'insights: owner sees the facilitator\'s session (anonymous totals)')
    # ---- Bob: outsider ----
    bob = sign_in(b, 'bob@example.org')
    ok('Org A' not in bob.inner_text('[data-testid=spaces]'), 'iso: Bob sees no Org A')
    bob.goto(BASE + f'#/workspace/edit/{exp_id}'); bob.wait_for_selector('text=Not found'); ok(True, 'iso: Bob cannot open the org experience')
    bob.goto(BASE + f'#/host/{exp_id}'); bob.wait_for_selector('[role=alert]'); ok(bob.locator('[data-testid=create]').count() == 0, 'iso: Bob cannot host it')
    org_a = a.evaluate("localStorage.getItem('pp_space')")
    for fn, args in [('pp_library', {'p_org': org_a}), ('pp_members', {'p_org': org_a}), ('pp_my_sessions', {'p_org': org_a}), ('pp_get_experience', {'p_id': exp_id})]:
        r = fetch(bob, fn, args); leaked = r['status'] == 200 and r['body'] not in (None, [], {})
        ok(not leaked, f'iso: Bob calling {fn} on Org A gets nothing ({r["status"]})')
    r = fetch(bob, 'pp_create_session', {'p_experience': exp_id, 'p_settings': {}}); ok(r['status'] >= 400, f'iso: Bob cannot create a room for it via the API ({r["status"]})')
    # personal space: build a quiz from scratch with forms only, preview, publish, play it live
    bob.goto(BASE + '#/workspace'); bob.wait_for_selector('[data-testid=library]'); bob.click('[data-testid=new-quiz]')
    bob.wait_for_selector('[data-testid=checker]'); bob_id = bob.url.split('/edit/')[1]
    ok('to fix' in bob.inner_text('[data-testid=checker]') and 'Question 1: Question text is empty.' in bob.inner_text('[data-testid=checker]'), 'builder: blank quiz lists what to fill in, in plain words')
    bob.fill('[data-testid=b-title]', 'Capitals')
    bob.click('[data-testid=add-choice]'); ok(bob.locator('[data-testid=question]').count() == 4, 'builder: add question')
    bob.on('dialog', lambda dlg: dlg.accept())
    bob.locator('[data-testid=question]').nth(3).locator('[aria-label=Delete]').click(); ok(bob.locator('[data-testid=question]').count() == 3, 'builder: delete question')
    qs = [('Capital of Switzerland?', ['Bern', 'Zurich']), ('Capital of Egypt?', ['Cairo', 'Alexandria']), ('Capital of Syria?', ['Damascus', 'Aleppo'])]
    for i, (q, opts) in enumerate(qs):
        card = bob.locator('[data-testid=question]').nth(i); card.locator('[data-testid=q-prompt]').fill(q)
        for j, o in enumerate(opts): card.locator('[data-testid=q-option]').nth(j).fill(o)
    card.locator('[data-testid=q-add-option]').click(); card.locator('[data-testid=q-option]').nth(2).fill('Homs')
    bob.click('[data-testid=split-3]')
    bob.wait_for_selector('[data-testid=checker]:has-text("Ready to publish")', timeout=5000); ok(True, 'builder: quiz built with forms only passes the checker')
    bob.locator('[data-testid=question]').nth(0).locator('[aria-label="Move down"]').click()
    ok(bob.locator('[data-testid=q-prompt]').nth(1).input_value() == 'Capital of Switzerland?', 'builder: reorder questions')
    bob.wait_for_selector('[data-testid=save-state]:has-text("All changes saved")', timeout=10000)
    bob.click('[data-testid=preview]'); bob.wait_for_selector('text=Restart', timeout=10000); ok(True, 'preview: the built quiz runs with simulated players')
    bob.click('text=Exit'); bob.wait_for_selector('[data-testid=publish]'); bob.click('[data-testid=publish]'); bob.wait_for_selector('[data-testid=msg]', timeout=10000)
    ok('version 1' in bob.inner_text('[data-testid=msg]'), 'publish: personal quiz published privately')
    bob.click('[data-testid=host]'); bob.wait_for_selector('[data-testid=create]'); bob.click('[data-testid=create]'); bob.wait_for_selector('[data-testid=room-code]', timeout=10000)
    rc = bob.inner_text('[data-testid=room-code]').replace(' ', '')
    pl = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True).new_page()
    pl.goto(BASE + f'#/j/{rc}'); pl.wait_for_selector('[data-testid=nickname]'); pl.wait_for_timeout(300)
    pl.fill('[data-testid=nickname]', 'Sam'); pl.check('[data-testid=consent]'); pl.click('[data-testid=join]'); pl.wait_for_selector("text=You're in, Sam!", timeout=10000)
    bob.wait_for_function("document.querySelector('[data-testid=joined]')?.innerText === '1'", timeout=10000)
    def nx(): bob.wait_for_selector('[data-testid=next]:not([disabled])', timeout=15000); bob.click('[data-testid=next]')
    nx(); nx()
    answers = {'Capital of Egypt?': 'a', 'Capital of Switzerland?': 'a', 'Capital of Syria?': 'a'}
    for q in range(3):
        pl.wait_for_selector('button[data-option]:not([disabled])', timeout=15000)
        pr = pl.inner_text('[data-testid=phone-prompt]'); pl.click(f'button[data-option="{answers[pr]}"]')
        bob.wait_for_selector('[data-testid=transition], [data-testid=distribution], [data-testid=suppressed]', timeout=20000); nx()
    pl.wait_for_selector('text=3/3', timeout=20000); ok(True, 'live: a phone plays the creator-built quiz to the end (3/3)')
    bob.click('[data-testid=end]'); bob.click('[data-testid=end-confirm]'); bob.wait_for_selector('[data-testid=recap]', timeout=10000)
    r = fetch(a, 'pp_create_session', {'p_experience': bob_id, 'p_settings': {}}); ok(r['status'] >= 400, f'iso: Alice cannot host Bob\'s private experience ({r["status"]})')
    # ---- role changes ----
    a.goto(BASE + '#/workspace'); space(a, 'Org A'); a.click('[role=tab]:has-text("Members")'); a.wait_for_selector('[data-testid=member] >> text=carol@example.org')
    a.on('dialog', lambda dlg: dlg.accept())
    a.locator('[data-testid=member]', has_text='carol@example.org').locator('button:has-text("Remove")').click(); a.wait_for_timeout(800)
    ok(a.locator('[data-testid=member]', has_text='carol@example.org').count() == 0, 'roles: owner removes Carol')
    c.reload(); c.wait_for_selector('[data-testid=spaces]'); ok('Org A' not in c.inner_text('[data-testid=spaces]'), 'roles: Carol loses Org A after removal')
    r = fetch(c, 'pp_get_experience', {'p_id': exp_id}); ok(r['body'] is None, 'roles: removed member can no longer read org drafts')
    # ---- mobile layout + sign out ----
    m = sign_in(b, 'alice@example.org', mobile=True)
    w = m.evaluate('[document.documentElement.scrollWidth, innerWidth]'); ok(w[0] <= w[1], f'mobile: workspace fits a 390px phone ({w})')
    m.screenshot(path=f'{SHOTS}/ws_mobile.png', full_page=True)
    m.goto(BASE + f'#/workspace/edit/{exp_id}'); m.wait_for_selector('[data-testid=checker]'); m.wait_for_timeout(300)
    w = m.evaluate('[document.documentElement.scrollWidth, innerWidth]'); ok(w[0] <= w[1], f'mobile: the builder fits a 390px phone ({w})')
    m.screenshot(path=f'{SHOTS}/ws_builder_mobile.png'); m.goto(BASE + '#/workspace'); m.wait_for_selector('[data-testid=who]')
    m.click('text=Sign out'); m.wait_for_selector('[data-testid=email]'); ok(m.evaluate("localStorage.getItem('pp_auth')") is None, 'auth: sign out clears the token')
    b.close()
fails = [m for c, m in results if not c]
print(f'\n{len(results) - len(fails)} passed, {len(fails)} failed')
