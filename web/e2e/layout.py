from playwright.sync_api import sync_playwright
def ok(c,m): print(('PASS ' if c else 'FAIL ')+m)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--no-sandbox']); errs=[]
    m=b.new_page(viewport={'width':375,'height':800}); m.on('pageerror', lambda e: errs.append(str(e)))
    m.goto('http://localhost:4174/PulsePlay/app/'); m.wait_for_selector('text=Games that help people connect'); ok(True,'app loads at /PulsePlay/app/')
    m.goto('http://localhost:4174/PulsePlay/app/#/play'); m.fill('input[inputmode=numeric]','482913')
    with m.expect_navigation(): m.click('text=Join 🚗')
    m.wait_for_selector('#codeIn'); ok(m.url.endswith('/PulsePlay/#join-482913') and m.input_value('#codeIn')=='482913', 'join routes to live Ego Check with code prefilled: '+m.url)
    m.goto('http://localhost:4174/PulsePlay/app/#/x/ego-check'); ok(m.get_attribute('text=Host live','href').endswith('/PulsePlay/'), 'Host live links to /PulsePlay/')
    m.goto('http://localhost:4174/PulsePlay/app/#/practice/would-you-rather'); m.click('[data-testid=next]'); m.click('[data-testid=next]')
    m.wait_for_selector('[data-testid=stage-options]'); ok(m.locator('[data-testid=stage-options] > div').count()==2, 'poll options visible on projector before reveal')
    m.reload(); m.wait_for_selector('[data-testid=joined]'); ok(True,'refresh on a deep link works (hash routing)')
    print('errors', errs); b.close()
