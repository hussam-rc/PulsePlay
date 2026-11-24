"""Live multiplayer browser test: 1 projector + N separate phone browsers per game, against a running API.
Usage: BASE=http://localhost:8788/PulsePlay/app/ python3 live_multiplayer.py"""
import os, re, json
from playwright.sync_api import sync_playwright
BASE = os.environ.get('BASE', 'http://localhost:8788/PulsePlay/app/'); SHOTS = os.environ.get('SHOTS', '/tmp/shots')
results = []
def ok(c, m): results.append((c, m)); print(('PASS ' if c else 'FAIL ') + m, flush=True)

def host_room(b, game, settings=None):
    h = b.new_context(viewport={'width': 1366, 'height': 860}).new_page()
    h.goto(BASE + f'#/host/{game}'); h.wait_for_selector('[data-testid=create]')
    for k, v in (settings or {}).items():
        if k == 'leaderboard': h.check('[data-testid=leaderboard]')
        else: h.select_option(f'#{k}', str(v))
    h.click('[data-testid=create]'); h.wait_for_selector('[data-testid=room-code]', timeout=10000)
    return h, h.inner_text('[data-testid=room-code]').replace(' ', '')

def join(b, code, name, board=False):
    p = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True).new_page()
    p.goto(BASE + f'#/j/{code}'); p.wait_for_selector('[data-testid=nickname]')
    p.wait_for_timeout(400)
    p.fill('[data-testid=nickname]', name)
    if board: p.check('[data-testid=board]')
    p.check('[data-testid=consent]'); p.click('[data-testid=join]')
    p.wait_for_selector(f'text=You\'re in, {name}!', timeout=10000)
    return p

def next_(h): h.wait_for_selector('[data-testid=next]:not([disabled])', timeout=15000); h.click('[data-testid=next]')

def play_game(b, game, n, picker, settings=None, boards=(), reload_player_at=None, reload_host_at=None, skip=lambda i, q: False):
    h, code = host_room(b, game, settings)
    join_url = h.inner_text('[data-testid=join-url]')
    ok(join_url.endswith(f'#/j/{code}'), f'{game}: QR/join link points to the join page ({join_url[-30:]})')
    phones = [join(b, code, f'P{i+1}', board=(i in boards)) for i in range(n)]
    h.wait_for_function(f"document.querySelector('[data-testid=joined]')?.innerText === '{n}'", timeout=10000)
    ok(True, f'{game}: projector lobby shows {n} joined')
    if game == 'ego-check': h.screenshot(path=f'{SHOTS}/live_lobby.png')
    next_(h); next_(h)
    total = 10
    for q in range(total):
        # wait until the projector shows THIS question (the previous one can linger for a moment after "next")
        h.wait_for_selector(f'[data-testid=prompt][data-idx="{q}"]', timeout=15000)
        prompt = h.inner_text('[data-testid=prompt]')
        for i, p in enumerate(phones):
            if skip(i, q): continue
            p.wait_for_selector('[data-testid=phone-prompt]'); 
            ok_sync = p.inner_text('[data-testid=phone-prompt]') == prompt
            if q == 0: ok(ok_sync, f'{game}: phone P{i+1} shows the same question as the projector')
            p.wait_for_selector('button[data-option]:not([disabled])', timeout=15000)
            p.click(f'button[data-option="{picker(i, q)}"]')
        if q == 1 and game == 'ego-check': h.screenshot(path=f'{SHOTS}/live_answer.png')
        if any(skip(i, q) for i in range(n)):
            h.wait_for_selector('[data-testid=transition], [data-testid=distribution], [data-testid=suppressed]', timeout=20000)  # server clock closes the window
        else:
            next_(h)  # everyone answered → reveal
        h.wait_for_selector('[data-testid=transition], [data-testid=distribution], [data-testid=suppressed]', timeout=15000)
        if q == 0 and reload_player_at is not None:
            p = phones[reload_player_at]; p.reload(); p.wait_for_selector('[data-testid=phone-prompt]', timeout=10000); p.wait_for_timeout(800)
            ok('Locked in' in p.inner_text('body'), f'{game}: phone refresh rejoins and keeps its answer')
        if q == 2 and reload_host_at:
            h.reload(); h.wait_for_selector('[data-testid=resume]'); h.click('[data-testid=resume]'); h.wait_for_selector('[data-testid=prompt]', timeout=10000)
            ok(h.get_attribute('[data-testid=prompt]', 'data-idx') == str(q) and h.inner_text('[data-testid=prompt]') == prompt, f'{game}: presenter refresh resumes the same room at the same question ({h.inner_text("[data-testid=prompt]")!r} vs {prompt!r})')
        if q == 0 and game == 'would-you-rather': h.screenshot(path=f'{SHOTS}/live_poll.png')
        if q == 0 and game == 'myth-or-fact': h.screenshot(path=f'{SHOTS}/live_trivia.png'); phones[0].screenshot(path=f'{SHOTS}/live_trivia_phone.png')
        next_(h)
    return h, phones, code

with sync_playwright() as pw:
    b = pw.chromium.launch(args=['--no-sandbox'])
    errors = []
    # ---- Ego Check: 6 players, pattern (i+q)%4 → team average 37; P6 misses 4 questions (still valid) ----
    acts = 'abcd'
    h, phones, code = play_game(b, 'ego-check', 6, lambda i, q: acts[(i + 1 + q) % 4], settings={'read': 3, 'answer': 5},
                                reload_player_at=1, reload_host_at=True)
    h.wait_for_selector('text=Look at your phone', timeout=10000); ok(True, 'ego: projector sends people to their phones')
    phones[0].click('[data-testid=reveal]'); sc = phones[0].inner_text('[data-testid=score]')
    ok(sc.startswith('43'), f'ego: P1 private score 43 (got {sc.split()[0]})')
    phones[0].screenshot(path=f'{SHOTS}/live_ego_result.png')
    ok('43' not in h.inner_text('[data-testid=stage]'), 'ego: no individual score on the projector')
    next_(h); h.wait_for_selector('[data-testid=group]')
    avg = h.get_attribute('[data-testid=group-average] [data-value]', 'data-value'); ok(avg == '37', f'ego: team average 37 on projector (got {avg[:6]})')
    ok(not h.query_selector('[data-testid=leaderboard]'), 'ego: no leaderboard')
    h.screenshot(path=f'{SHOTS}/live_ego_group.png')
    h.click('[data-testid=end]'); h.click('[data-testid=end-confirm]'); h.wait_for_selector('[data-testid=recap]', timeout=10000)
    phones[2].wait_for_selector('[data-testid=saved-result]', timeout=10000); ok('ended' in phones[2].inner_text('body'), 'ego: phones see the game end and keep their result')
    # ---- Would You Rather: 4 players, P1-P3 pick a, P4 picks b ----
    h, phones, code = play_game(b, 'would-you-rather', 4, lambda i, q: 'a' if i < 3 else 'b', settings={'read': 3, 'answer': 5})
    h.wait_for_selector('text=That was fun', timeout=10000); ok(True, 'wyr: completes all 10 questions')
    next_(h); h.wait_for_selector('text=Before you go'); ok(True, 'wyr: closing reflection shown')
    h.click('[data-testid=end]'); h.click('[data-testid=end-confirm]'); h.wait_for_selector('[data-testid=recap]')
    # ---- Myth or Fact: 3 players, leaderboard on, P1/P2 opt in; P3 skips q≥7 (invalid) ----
    right = ['myth','myth','myth','myth','fact','myth','myth','fact','fact','myth']
    def pick(i, q): return right[q] if i == 0 else (right[q] if q < 6 else ('fact' if right[q] == 'myth' else 'myth')) if i == 1 else ('fact' if right[q] == 'myth' else 'myth')
    h, phones, code = play_game(b, 'myth-or-fact', 3, pick, settings={'read': 3, 'answer': 5, 'leaderboard': True}, boards=(0, 1), skip=lambda i, q: i == 2 and q >= 6)
    h.wait_for_selector('[data-testid=leaderboard]'); lb = h.inner_text('[data-testid=leaderboard]')
    ok('P1' in lb and 'P2' in lb and 'P3' not in lb and lb.find('P1') < lb.find('P2'), 'trivia: leaderboard shows only opt-ins, P1 first')
    phones[0].click('[data-testid=reveal]'); ok(phones[0].inner_text('[data-testid=score]').startswith('10/10'), 'trivia: P1 sees 10/10 privately')
    phones[2].click('[data-testid=reveal]'); ok('Parked' in phones[2].inner_text('body'), 'trivia: P3 answered only 6/10 → no score (parked), excluded from group average')
    h.screenshot(path=f'{SHOTS}/live_trivia_board.png')
    next_(h); h.wait_for_selector('text=Not enough players', timeout=10000)
    ok('80' not in h.inner_text('[data-testid=stage]'), 'trivia: only 2 valid players (minimum 3) → group average withheld for privacy')
    h.click('[data-testid=end]'); h.click('[data-testid=end-confirm]'); h.wait_for_selector('[data-testid=recap]')
    # ---- Security from the browser: participant cannot call host functions ----
    p = phones[0]
    r = p.evaluate("""async () => { const t = JSON.parse(localStorage.getItem('pp_player')).token;
        const res = await fetch('/rest/v1/rpc/pp_host_state', {method:'POST', headers:{apikey:'testkey','content-type':'application/json'}, body: JSON.stringify({p_code:'000000', p_token:t})});
        return (await res.json()).ended === true || res.status === 400 }""")
    ok(r, 'security: participant token does not unlock host state')
    b.close()
print(f"\n{sum(1 for c, _ in results if c)} passed, {sum(1 for c, _ in results if not c)} failed")
