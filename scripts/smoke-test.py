from playwright.sync_api import sync_playwright

errors = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.goto("http://127.0.0.1:5173", wait_until="networkidle")
    assert page.locator(".pal-card").count() >= 297, "catalog cards did not render"
    assert page.locator(".breeding-graph").count() == 1, "graph did not render"
    before = page.locator(".trail span").inner_text()
    page.locator('[data-drill="true"][data-select]').first.click()
    after = page.locator(".trail span").inner_text()
    assert page.locator("[data-back]:not([disabled])").count() == 1, "drill-down back button is not enabled"
    assert after != before and "→" in after, "breadcrumb did not grow after parent click"
    page.locator("[data-lang]").click()
    assert "Trace the parents" in page.locator("h1").inner_text(), "language toggle failed"
    page.locator('[data-theme="toggle"]').click()
    assert page.locator("html[data-theme='light']").count() == 1, "theme toggle failed"
    page.screenshot(path="/tmp/pal-atlas-smoke.png", full_page=True)
    browser.close()

if errors:
    raise AssertionError(f"browser console errors: {errors}")
print("smoke test passed: catalog, graph, drill-down breadcrumb, language, theme")
