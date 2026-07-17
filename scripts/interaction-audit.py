import os
from playwright.sync_api import sync_playwright

url = os.environ.get("PAL_ATLAS_URL", "http://127.0.0.1:5173")
page_errors = []
console_errors = []

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1280, "height": 900})
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.goto(url, wait_until="domcontentloaded")
    page.wait_for_selector(".pal-card")
    print("loaded", flush=True)

    results = {"cards": page.locator(".pal-card").count(), "first_rank": page.locator(".pal-card .card-rank").first.inner_text()}
    results["recipe_anchor"] = page.locator("#recipe-view").count()
    results["recipe_panel_visible"] = page.locator(".recipe-panel").is_visible()

    search = page.locator("[data-search]")
    search.fill("Anubis")
    print("search", flush=True)
    results["search_value"] = page.locator("[data-search]").input_value()
    results["search_cards"] = page.locator(".pal-card").count()
    page.locator("[data-element]").select_option("fire")
    print("filter", flush=True)
    results["filter_value"] = page.locator("[data-element]").input_value()

    page.locator("[data-lang-toggle]").click(timeout=3000)
    print("lang", flush=True)
    results["english"] = "Saved" in page.locator("[data-saved-link]").inner_text()
    page.locator("[data-theme-toggle]").click()
    print("theme", flush=True)
    results["light"] = page.locator("html[data-color-theme='light']").count()

    page.locator("[data-search]").fill("")
    print("clear", flush=True)
    page.locator('[data-drill="true"][data-select]').first.click()
    print("drill", flush=True)
    results["breadcrumb_after_drill"] = page.locator(".trail span").inner_text()
    page.locator("[data-back]").click()
    print("back", flush=True)
    results["breadcrumb_after_back"] = page.locator(".trail span").inner_text()
    results["output_cards"] = page.locator(".output-card").count()
    assert results["output_cards"] > 0, "reverse output cards did not render"
    page.locator(".recipe-save").first.click()
    results["saved_recipes"] = page.locator(".saved-item").count()
    assert results["saved_recipes"] == 1, "recipe was not saved"
    page.locator(".saved-item .recipe-save").first.click()
    assert page.locator(".saved-item").count() == 0, "recipe was not removed"
    page.locator(".output-card .recipe-save").first.click()
    assert page.locator(".saved-item").count() == 1, "output recipe was not saved"
    page.locator(".saved-item .recipe-save").first.click()
    assert page.locator(".saved-item").count() == 0, "output recipe was not removed"
    output_name = page.locator(".output-card strong").first.inner_text()
    page.locator(".output-card .output-open").first.click()
    assert output_name in page.locator(".trail span").inner_text(), "output card did not select its child"
    page.locator("[data-back]").click()
    page.locator('[data-drill="true"][data-select]').first.click()

    print(results)
    print({"page_errors": page_errors, "console_errors": console_errors})
    browser.close()
