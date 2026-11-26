// Test de fumée de la maquette : ouvre chaque écran et chaque sous-onglet, échoue s'il y a une erreur JS
// ou un écran vide. Usage : NODE_PATH=<dossier contenant playwright> node tests/smoke.cjs [captures/]
const { chromium } = require("playwright")
const path = require("path")
;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
  const errs = []
  p.on("pageerror", (e) => errs.push(`${p.url().split("#")[1]} : ${e.message}`))
  p.on("console", (m) => m.type() === "error" && errs.push(`${p.url().split("#")[1]} : ${m.text()}`))
  p.on("dialog", (d) => d.dismiss())
  const url = process.env.URL || "file://" + path.resolve(__dirname, "../index.html")
  await p.goto(url)
  const ids = await p.evaluate(() => Object.values(HMS.screens).filter((s) => !s.hidden).map((s) => s.id))
  const seen = new Set()
  const visit = async (route) => {
    if (seen.has(route)) return
    seen.add(route)
    await p.evaluate((r) => (location.hash = r), route)
    await p.waitForTimeout(60)
    const len = await p.evaluate(() => document.querySelector("#app").innerText.trim().length)
    if (len < 20) errs.push(`${route} : écran vide`)
    if (process.argv[2]) await p.screenshot({ path: path.join(process.argv[2], route.replace(/\//g, "_") + ".png"), fullPage: true })
    // sous-onglets déclarés par subtabs()
    const subs = await p.evaluate(() => [...document.querySelectorAll(".chips button[onclick^=\"go('\"]")].map((b) => b.getAttribute("onclick").match(/go\('([^']+)'\)/)[1]))
    for (const s of subs) await visit(s)
  }
  for (const id of ids) await visit(id)
  console.log(`${seen.size} écrans visités`)
  if (errs.length) { console.log("ERREURS :\n" + errs.join("\n")); process.exitCode = 1 } else console.log("OK, aucune erreur")
  await b.close()
})()
