from playwright.sync_api import sync_playwright
import time

def run_test():
    with sync_playwright() as p:
        print("Launching browser...")
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        
        print("Navigating to http://localhost:5001...")
        try:
            page.goto('http://localhost:5001')
            page.wait_for_load_state('networkidle')
            
            print(f"Page title: {page.title()}")
            
            # Take screenshot of landing page
            page.screenshot(path='landing_page.png')
            print("Landing page screenshot saved.")
            
            # Find and click login button/link
            # Let's look for a link that says "Login" or has /login href
            login_link = page.locator('a[href="/login"]').first
            if login_link.is_visible():
                print("Clicking Login link...")
                login_link.click()
                page.wait_for_load_state('networkidle')
                print(f"Navigated to: {page.url}")
                page.screenshot(path='login_page.png')
                print("Login page screenshot saved.")
            else:
                print("Login link not found. Searching for buttons...")
                buttons = page.locator('button').all()
                for i, btn in enumerate(buttons):
                    print(f"Button {i}: {btn.inner_text()}")
                    if "login" in btn.inner_text().lower():
                        btn.click()
                        page.wait_for_load_state('networkidle')
                        print(f"Navigated to: {page.url}")
                        page.screenshot(path='login_page.png')
                        break
        except Exception as e:
            print(f"Error during test: {e}")
            page.screenshot(path='error_state.png')
        
        browser.close()

if __name__ == "__main__":
    run_test()
