"""Results stay on the player's phone (refresh, game end) until the player deletes them. Screenshots of the new result screens."""
import os
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://localhost:8789/PulsePlay/app/'); SHOTS = os.environ.get('SHOTS', '/tmp/shots'); os.makedirs(SHOTS, exist_ok=True)
results = []
def ok(c, m): results.append((c, m)); print(('PASS ' if c else 'FAIL ') + m, flush=True)
with sync_playwright() as pw:
    b = pw.chromium.launch(); h = b.new_page(viewport={'width': 1366, 'height': 900})
    h.goto(BASE + '#/host/ego-check'); h.wait_for_selector('[data-testid=create]'); h.click('[data-testid=create]'); h.wait_for_selector('[data-testid=room-code]')
    code = h.inner_text('[data-testid=room-code]').replace(' ', '')
    phones = []
    for i in range(6):
        p = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True).new_page(); p.goto(BASE + f'#/j/{code}'); p.wait_for_selector('[data-testid=nickname]'); p.wait_for_timeout(300)
        p.fill('[data-testid=nickname]', f'P{i}'); p.check('[data-testid=consent]'); p.click('[data-testid=join]'); p.wait_for_selector(f"text=You're in, P{i}!"); phones.append(p)
    def nx(): h.wait_for_selector('[data-testid=next]:not([disabled])', timeout=30000); h.click('[data-testid=next]')
    nx(); nx()
    for q in range(10):
        for i, p in enumerate(phones):
            p.wait_for_selector('button[data-option]:not([disabled])', timeout=30000)
            opts = p.locator('button[data-option]'); opts.nth(0 if i < 4 else 1).click()
        if q == 0: phones[0].wait_for_timeout(300); phones[0].screenshot(path=f'{SHOTS}/fun_question.png')
        h.wait_for_selector('[data-testid=transition], [data-testid=distribution], [data-testid=suppressed]', timeout=30000); nx()
    p0 = phones[0]; p0.wait_for_selector('[data-testid=reveal]', timeout=20000); p0.click('[data-testid=reveal]'); p0.wait_for_selector('[data-testid=result-card]'); p0.wait_for_timeout(1200)
    p0.screenshot(path=f'{SHOTS}/new_result_phone.png', full_page=True)
    score = p0.inner_text('[data-testid=score]')
    ok('Delete my result' in p0.inner_text('body') and 'Saved on this phone only' in p0.inner_text('body'), 'result: keep/delete choice shown')
    nx(); h.wait_for_selector('[data-testid=group]', timeout=10000); h.wait_for_timeout(1300); h.screenshot(path=f'{SHOTS}/new_group_projector.png', full_page=True)
    ok(h.locator('[data-testid=group-average]').count() == 1, 'projector: group result shown')
    h.click('[data-testid=end]'); h.click('[data-testid=end-confirm]'); h.wait_for_selector('[data-testid=recap]', timeout=10000)
    p0.wait_for_selector('[data-testid=saved-result]', timeout=10000)
    ok(p0.inner_text('[data-testid=score]') == score, f'after the host ends: phone still shows the same result ({score})')
    p0.reload(); p0.wait_for_selector('[data-testid=saved-result]', timeout=10000)
    ok(p0.inner_text('[data-testid=score]') == score, 'after a refresh once the game ended: result still there')
    p1 = phones[1]; p1.reload(); p1.wait_for_selector('[data-testid=saved-result]', timeout=10000); ok(True, 'a player who never opened their result can still see it after the end')
    p0.once('dialog', lambda d: d.accept()); p0.click('[data-testid=delete-result]'); p0.wait_for_timeout(300)
    ok(p0.locator('[data-testid=saved-result]').count() == 0, 'delete: result removed on request')
    p0.reload(); p0.wait_for_timeout(1500); ok(p0.locator('[data-testid=saved-result]').count() == 0 and p0.evaluate("!(localStorage.getItem('pp_results')||'').includes('" + code + "')"), 'delete: gone after refresh too, nothing left on the phone')
    b.close()
fails = [m for c, m in results if not c]
print(f'\n{len(results) - len(fails)} passed, {len(fails)} failed')
