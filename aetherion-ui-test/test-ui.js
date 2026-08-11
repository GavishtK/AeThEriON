const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const UI_PATH = path.resolve(__dirname, 'index.html');
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots');

(async () => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 }
    });
    const page = await context.newPage();

    await page.goto(`file:///${UI_PATH.replace(/\\/g, '/')}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    // 1. Full page
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-full-dashboard.png'), fullPage: false });

    // 2. Hover over first panel to trigger 3D tilt
    const firstPanel = await page.$('.panel');
    if (firstPanel) {
        const box = await firstPanel.boundingBox();
        await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.3);
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-panel-hover.png'), fullPage: false });
    }

    // 3. Click second tab (Record)
    const tabs = await page.$$('.tab');
    if (tabs.length >= 2) {
        await tabs[1].click();
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-record-tab.png'), fullPage: false });
    }

    // 4. Click third tab (Analysis)
    if (tabs.length >= 3) {
        await tabs[2].click();
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '04-analysis-tab.png'), fullPage: false });
    }

    // 5. Click fourth tab (Settings)
    if (tabs.length >= 4) {
        await tabs[3].click();
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '05-settings-tab.png'), fullPage: false });
    }

    // 6. Back to Live tab
    if (tabs.length >= 1) {
        await tabs[0].click();
        await page.waitForTimeout(800);
        await page.screenshot({ path: path.join(SCREENSHOT_DIR, '06-live-tab-returned.png'), fullPage: false });
    }

    // 7. Verify no JS errors
    const errors = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // 8. Check GSAP loaded
    const gsapLoaded = await page.evaluate(() => typeof gsap !== 'undefined');
    console.log('GSAP loaded:', gsapLoaded);

    // 9. Check Animations module loaded
    const animsLoaded = await page.evaluate(() => typeof Animations !== 'undefined' && typeof Animations.init === 'function');
    console.log('Animations module loaded:', animsLoaded);

    // 10. Check panels have 3D perspective applied
    const hasPerspective = await page.evaluate(() => {
        const grid = document.querySelector('.live-grid');
        if (!grid) return false;
        const style = getComputedStyle(grid);
        return style.perspective !== 'none' && style.perspective !== '';
    });
    console.log('3D perspective applied:', hasPerspective);

    if (errors.length > 0) {
        console.log('JS Errors:', errors);
    } else {
        console.log('No JS errors detected.');
    }

    await browser.close();
    console.log('Screenshots saved to:', SCREENSHOT_DIR);
})();
