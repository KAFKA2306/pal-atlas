import os
from playwright.sync_api import sync_playwright

errors = []
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    page.on("console", lambda message: errors.append(message.text) if message.type == "error" else None)
    page.goto(os.environ.get("PAL_ATLAS_URL", "http://127.0.0.1:5173"), wait_until="domcontentloaded")
    for endpoint in ("/api/index.json", "/api/pals.json", "/api/breeding.json", "/api/sources.json", "/api/pals/anubis.json"):
        assert page.request.get(os.environ.get("PAL_ATLAS_URL", "http://127.0.0.1:5173") + endpoint).ok, f"static API failed: {endpoint}"
    anubis_detail = page.request.get(os.environ.get("PAL_ATLAS_URL", "http://127.0.0.1:5173") + "/api/pals/anubis.json").json()
    assert len(anubis_detail["recipes"]["outputs"]) > 0, "reverse output index is empty"
    page.wait_for_selector(".pal-card")
    assert page.locator(".pal-card").count() >= 297, "catalog cards did not render"
    first_ranks = [int(value) for value in page.locator(".pal-card .card-rank").all_inner_texts()[:6]]
    assert first_ranks == sorted(first_ranks), f"default rank order failed: {first_ranks}"
    assert page.locator(".breeding-graph").count() == 1, "graph did not render"
    assert page.locator(".recipe-row").count() >= 1, "recipe events did not render"
    assert page.locator(".recipe-row .recipe-pal.parent-a").count() == page.locator(".recipe-row .recipe-pal.parent-b").count(), "parent slots are not paired"
    assert page.locator(".recipe-row .recipe-pal.target").evaluate_all("els => els.every(el => el.tagName === 'SPAN')"), "recipe targets must not be clickable"
    assert page.locator(".output-panel").count() == 1, "reverse output panel did not render"
    assert page.locator(".output-card").count() > 0, "reverse output cards did not render"
    assert page.locator(".recipe-save").count() > 0, "recipe save controls did not render"
    page.locator(".recipe-save").first.click()
    assert page.locator("#saved-view").count() == 1, "saved recipe section did not render"
    assert page.locator(".saved-item").count() == 1, "saved recipe was not listed"
    page.reload(wait_until="domcontentloaded")
    page.wait_for_selector(".pal-card")
    assert page.locator("#saved-view").count() == 1, "saved recipe did not persist without login"
    page.locator(".saved-item .recipe-save").first.click()
    assert page.locator("#saved-view").count() == 0, "saved recipe was not removable"
    output_name = page.locator(".output-card strong").first.inner_text()
    page.locator(".output-card .output-open").first.click()
    assert output_name in page.locator(".trail span").inner_text(), "output card did not select its child"
    page.locator("[data-back]:not([disabled])").click()
    before = page.locator(".trail span").inner_text()
    page.locator('[data-drill="true"][data-select]').first.click()
    after = page.locator(".trail span").inner_text()
    assert page.locator("[data-back]:not([disabled])").count() == 1, "drill-down back button is not enabled"
    assert after != before and "→" in after, "breadcrumb did not grow after parent click"
    page.locator("[data-back]:not([disabled])").click()
    parent_b = page.locator(".recipe-row .recipe-pal.parent-b").first
    parent_b_name = parent_b.locator("b").inner_text()
    parent_b.click()
    assert parent_b_name in page.locator(".trail span").inner_text(), "parent B click did not select parent B"
    page.locator("[data-back]:not([disabled])").click()
    page.locator("[data-lang-toggle]").click()
    assert "Trace the parents" in page.locator("h1").inner_text(), "language toggle failed"
    page.locator("[data-theme-toggle]").click()
    assert page.locator("html[data-color-theme='light']").count() == 1, "theme toggle failed"
    page.locator('.pal-card[data-select="jetragon"]').first.click()
    assert page.locator("#graph-view .recipe-row.special").count() >= 1, "special recipe event did not render"
    assert page.locator("#graph-view .recipe-row.normal").count() == 0, "ignored Pal leaked into normal recipes"
    page.screenshot(path="/tmp/pal-atlas-smoke.png", full_page=True)
    browser.close()

if errors:
    raise AssertionError(f"browser console errors: {errors}")
print("smoke test passed: catalog, graph, drill-down breadcrumb, language, theme")
