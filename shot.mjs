import { chromium } from 'playwright';
try {
  const browser = await chromium.launch({headless:true});
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  await page.goto('http://127.0.0.1:8000/trials/ez-pave-objetivo-intensivo-colesterol-ldl-menor-55-mg-dl-menor/index.html', {waitUntil:'domcontentloaded', timeout:15000});
  await page.screenshot({path:'/tmp/shot.png'});
  await browser.close();
  console.log("OK");
} catch(e) {
  console.error("FAIL", e.message);
  process.exit(1);
}
