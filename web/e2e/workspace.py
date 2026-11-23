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
    a.wait_for_selector('[data-testid=draft]'); exp_id = a.url.split('/edit/')[1]
    a.click('[data-testid=check]'); ok('Ready to publish' in a.inner_text('[data-testid=check-result]'), 'editor: template copy passes the shared checker')
    a.screenshot(path=f'{SHOTS}/ws_editor.png', full_page=True)
    a.click('[data-testid=publish]'); a.wait_for_selector('[data-testid=msg]', timeout=10000)
    ok('Published version 1' in a.inner_text('[data-testid=msg]'), 'publish: v1 via the Edge Function (server-side validation)')
    # broken draft: client blocks, and the server refuses even if called directly
    draft = json.loads(a.input_value('[data-testid=draft]')); draft['results'] = draft['results'][:-1]
    a.fill('[data-testid=draft]', json.dumps(draft, indent=2)); a.click('[data-testid=save]'); a.wait_for_selector('[data-testid=msg]:has-text("Draft saved")')
    a.click('[data-testid=publish]'); a.wait_for_timeout(500)
    ok('problem' in a.inner_text('[data-testid=check-result]'), 'publish: broken result bands blocked in the browser')
    r = fetch(a, 'publish', {'experienceId': exp_id, 'visibility': 'org'}, fn=True)
    ok(r['status'] == 422 and any('band' in e for e in r['body']['errors']), f'publish: server refuses the broken draft directly ({r["status"]})')
    draft['results'] = json.loads(json.dumps(draft['results']))  # restore from template
    a.goto(BASE + '#/workspace'); a.wait_for_selector('[data-testid=library]')
    a.goto(BASE + f'#/workspace/edit/{exp_id}'); a.wait_for_selector('[data-testid=draft]')
    fixed = json.loads(a.input_value('[data-testid=draft]'))
    # ---- Carol: creator via invite ----
    c = sign_in(b, 'carol@example.org')
    c.wait_for_selector('[data-testid=spaces] button:has-text("Org A")'); ok('creator' in c.inner_text('[data-testid=spaces]'), 'invite: Carol joins Org A as creator on first sign-in')
    space(c, 'Org A'); c.wait_for_selector('[data-testid=lib-item]'); ok(c.locator('[data-testid=lib-item]').count() == 1, 'library: Carol sees the org experience')
    # ---- Dave: facilitator ----
    d = sign_in(b, 'dave@example.org')
    space(d, 'Org A'); d.wait_for_selector('[data-testid=lib-item]')
    ok(d.locator('[data-testid=copy-template]').count() == 0, 'roles: facilitator cannot create drafts (no template button)')
    d.goto(BASE + f'#/workspace/edit/{exp_id}'); d.wait_for_selector('[data-testid=draft]')
    ok(d.locator('[data-testid=save]').count() == 0 and d.locator('[data-testid=publish]').count() == 0 and d.locator('text=read only').count() == 1, 'roles: facilitator sees the draft read-only, no publish')
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
    # personal space + preview
    bob.goto(BASE + '#/workspace'); bob.wait_for_selector('[data-testid=library]'); bob.select_option('#tpl', 'would-you-rather'); bob.click('[data-testid=copy-template]')
    bob.wait_for_selector('[data-testid=draft]'); bob_id = bob.url.split('/edit/')[1]
    bob.click('[data-testid=preview]'); bob.wait_for_selector('text=Restart', timeout=10000); ok(True, 'preview: draft runs in practice mode with simulated players')
    bob.click('text=Exit'); bob.wait_for_selector('[data-testid=publish]'); bob.click('[data-testid=publish]'); bob.wait_for_selector('[data-testid=msg]', timeout=10000)
    ok('version 1' in bob.inner_text('[data-testid=msg]'), 'publish: personal experience published privately')
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
    m.click('text=Sign out'); m.wait_for_selector('[data-testid=email]'); ok(m.evaluate("localStorage.getItem('pp_auth')") is None, 'auth: sign out clears the token')
    b.close()
fails = [m for c, m in results if not c]
print(f'\n{len(results) - len(fails)} passed, {len(fails)} failed')
