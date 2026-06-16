import { chromium } from '@playwright/test';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 1400 } });
await ctx.addCookies([{ name: "docyan_token", value: "e2e", domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
await page.addInitScript(() => {
  localStorage.setItem("docyan-auth", JSON.stringify({ state:{ token:"e2e", refreshToken:"r", docoId:null, user:{ id:"u1", email:"admin@lab.mx", name:"Admin", role:"admin", org_name:"Mi organización" } }, version:0 }));
});
// Mock AMPLIO: cualquier llamada a la API de prod → JSON vacío/útil.
await page.route(/fly\.dev\//, r => {
  const u = r.request().url();
  let body = {};
  if (u.includes("/onboarding/org")) body = { org_id:"o1", nombre:"Lab", banda_mercado:"A", idioma:"es", plan:"freemium", lifecycle_status:"active", doc_limit:3 };
  else if (u.includes("/onboarding/usuarios")) body = { items:[{id:"u1",email:"admin@lab.mx",name:"Admin",role:"admin"}], total:1 };
  else if (u.includes("/invitations")) body = { items: [] };
  else if (u.includes("/cupo")) body = { aplica:false };
  return r.fulfill({ status:200, contentType:"application/json", body: JSON.stringify(body) });
});
page.setDefaultTimeout(60000);
await page.goto("http://localhost:3001/usuarios", { waitUntil: "commit", timeout: 60000 }).catch(e=>console.log("nav:", e.message.split("\n")[0]));
await page.waitForTimeout(6000);
console.log("URL:", page.url());
console.log("role-opt:", await page.locator(".role-opt").count(), "| invite-form:", await page.locator(".invite-form").count());
await page.screenshot({ path: "/tmp/usuarios.png", fullPage: true });
const html = await page.locator(".invite-form").first().evaluate(el => el.outerHTML).catch(()=> "(sin invite-form)");
console.log("INVITE-FORM HTML:\n", html.slice(0, 1400));
await b.close();
