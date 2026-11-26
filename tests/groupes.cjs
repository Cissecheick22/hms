// Groupes et date hôtelière, par l'interface, sur les données factices :
// bloc de groupe qui retient l'inventaire → génération des réservations (sans double comptage) → cut-off
// qui rend les chambres non reprises → audit de nuit qui fait avancer la date hôtelière de toute la maquette.
// Usage : NODE_PATH=<node_modules avec playwright> node tests/groupes.cjs
const { chromium } = require("playwright")
const path = require("path")
const assert = (cond, msg) => { if (!cond) throw new Error("ÉCHEC : " + msg); console.log("ok  " + msg) }

;(async () => {
  const b = await chromium.launch()
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } })
  const errs = []
  p.on("pageerror", (e) => errs.push(e.message))
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()))
  p.on("dialog", (d) => d.accept())
  const url = process.env.URL || "file://" + path.resolve(__dirname, "../index.html")
  const go = async (h) => { await p.evaluate((x) => (location.hash = x), h); await p.waitForTimeout(120) }
  const ev = (fn, arg) => p.evaluate(fn, arg)
  await p.goto(url)
  await p.evaluate(() => localStorage.setItem("hms-session", JSON.stringify({ email: "direction@hotel-exemple.test" })))
  await p.reload()
  await ev(() => { localStorage.clear(); localStorage.setItem("hms-session", JSON.stringify({ email: "direction@hotel-exemple.test" })) })
  await p.reload()

  // Bloc GRP-01 : 4 STD + 2 SUP du 03/12 au 05/12, 3 noms déjà dans la rooming list
  const g = await ev(() => JSON.parse(JSON.stringify(D.sej.groups.find((x) => x.id === "GRP-01"))))
  const d = g.from
  const free = (t) => ev(([t, d]) => available(t, d), [t, d])
  const physical = (t) => ev(([t, d]) => D.rooms.filter((r) => r.type === t && r.hk !== "hs").length - D.reservations.filter((r) => r.type === t && ["confirmee", "arrivee"].includes(r.status) && r.from <= d && d < r.to).length, [t, d])
  const stdFree = await free("STD"), stdPhys = await physical("STD")
  assert(stdFree === stdPhys - g.block.STD, `le bloc retient ${g.block.STD} STD le ${d} (${stdPhys} → ${stdFree})`)

  // Génération des réservations : l'inventaire ne bouge pas (le bloc se transforme en réservations)
  await go("sej-groupes/groupes")
  await ev(() => (ui.sejGroup = "GRP-01"))
  await go("sej-groupes/groupes")
  await p.click("text=Générer les réservations")
  await p.waitForTimeout(150)
  const made = await ev(() => D.reservations.filter((r) => r.group === "GRP-01").length)
  assert(made === g.rooming.length, `${made} réservation(s) générée(s) depuis la rooming list`)
  assert((await free("STD")) === stdFree, "pas de double comptage après génération")

  // Cut-off : les chambres non reprises retournent à l'inventaire
  await p.click("text=Appliquer le cut-off")
  await p.waitForTimeout(150)
  const pickedStd = g.rooming.filter((x) => x.type === "STD").length
  assert((await free("STD")) === stdFree + (g.block.STD - pickedStd), `cut-off : ${g.block.STD - pickedStd} STD remise(s) en vente`)

  // Audit de nuit : la date hôtelière avance pour toute la maquette
  const before = await ev(() => today)
  await go("sej-audit")
  await ev(() => { // lever les contrôles bloquants de l'exemple (arrivées en attente → no-show, paiements à vérifier)
    D.reservations.filter((r) => r.from === today && r.status === "confirmee").forEach((r) => (r.status = "noshow"))
    D.sej.payLog.forEach((x) => { if (["à vérifier", "en attente"].includes(x.status)) x.status = "confirmé" })
    render()
  })
  await p.click("text=Lancer l'audit")
  await p.waitForFunction(() => today !== "2026-11-26", null, { timeout: 15000 })
  const after = await ev(() => today)
  assert(after === "2026-11-27" && before === "2026-11-26", `date hôtelière ${before} → ${after}`)
  await go("accueil")
  assert((await p.textContent("#ctx")).includes("27/11/2026"), "en-tête à la nouvelle date")
  await p.reload()
  await p.waitForTimeout(200)
  assert((await ev(() => today)) === "2026-11-27", "date conservée après rechargement")

  if (errs.length) throw new Error("Erreurs console : " + errs.join(" | "))
  console.log("GROUPES OK")
  await b.close()
})().catch((e) => { console.error(e.message); process.exit(1) })
