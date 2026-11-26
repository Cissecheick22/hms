// Parcours de bout en bout entre modules, par l'interface, sur les données factices :
// réservation → check-in avec clé → clé visible au contrôle d'accès → repas imputé en chambre (POS)
// → check-out → facture avec le repas → clé révoquée → chambre sale → bloc d'événement qui réduit l'inventaire
// → ordre de travail serrure transmis à la maintenance → persistance après rechargement.
// Usage : NODE_PATH=<node_modules avec playwright> node tests/parcours.cjs
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
  await ev(() => localStorage.clear())
  await p.reload()

  // 1. Réservation (Réservations)
  await go("reservations/new")
  await p.selectOption("#f-guest", "G3")
  await p.selectOption("#f-type", "STD")
  await p.fill("#f-from", "2026-11-26")
  await p.fill("#f-to", "2026-11-28")
  await p.selectOption("#f-guar", "Carte bancaire")
  await p.click("text=Créer la réservation")
  await p.waitForTimeout(150)
  const id = await ev(() => D.reservations.at(-1).id)
  assert(await ev((i) => R(i).status === "confirmee" && R(i).guest === "G3", id), `réservation ${id} créée`)

  // 2. Check-in avec émission de clé (Réception)
  await go("checkin/" + id)
  const room = await ev((i) => D.rooms.find((x) => x.type === "STD" && x.hk === "propre" && !occupant(x.no)).no, id)
  await p.check(`input[name=room][value='${room}']`)
  await p.check("#id-ok")
  await p.click("#enc")
  await p.waitForSelector("text=Clé encodée", { timeout: 5000 })
  assert(await ev((i) => R(i).status === "arrivee" && R(i).key === "active", id), `check-in en chambre ${room}`)

  // 3. Contrôle d'accès : la carte apparaît, active
  await go("acc-cles")
  assert(await ev((i) => D.acc.creds.some((c) => c.resId === i && c.status === "active"), id), "carte active visible au contrôle d'accès")

  // 4. Restaurant : ticket imputé sur la chambre
  await go("fnb/salle")
  const table = await ev(() => { const o = D.fnb.outlets.find((x) => x.id === ui.fnbOutlet) || D.fnb.outlets.find((x) => x.tables.length); ui.fnbOutlet = o.id; return o.tables.find((t) => !D.fnb.checks.some((c) => c.table === t && c.status !== "clos")) })
  await go("fnb/salle/" + table)
  await p.click("text=Ouvrir le ticket")
  await p.waitForTimeout(100)
  const cid = await ev(() => D.fnb.checks.at(-1).id)
  const item = await ev(() => D.fnb.items.find((i) => i.avail !== false).id)
  await ev(([c, i]) => { A.fnb.add(c, i); A.fnb.send(c); D.fnb.checks.find((x) => x.id === c).lines.forEach((l) => (l.st = "servi")); render() }, [cid, item])
  await p.selectOption("#fnb-mode", "Imputation chambre")
  await ev(() => (document.getElementById("fnb-room-box").style.display = "block"))
  await p.selectOption("#fnb-room", id)
  await p.fill("#fnb-name", await ev((i) => G(R(i).guest).name.split(" ").at(-1), id))
  await p.check("#fnb-sign")
  await p.click("text=Encaisser")
  await p.waitForTimeout(150)
  assert(await ev((i) => (D.extras[i] || []).some((l) => /ticket/.test(l.label)), id), "repas imputé au folio de la chambre")

  // 5. Check-out : facture, clé révoquée, chambre sale
  await go("checkout/" + id)
  await p.click("text=facturer et révoquer la clé")
  await p.waitForSelector("text=Clé révoquée", { timeout: 5000 })
  assert(await ev((i) => R(i).status === "partie" && !!R(i).invoice, id), "facture émise")
  assert((await p.textContent("#app")).includes("ticket"), "la facture contient le repas")
  assert(await ev((r) => D.rooms.find((x) => x.no === r).hk === "sale", room), `chambre ${room} passée en sale`)
  await go("acc-cles")
  assert(await ev((i) => D.acc.creds.filter((c) => c.resId === i).every((c) => c.status === "révoquée"), id), "clé révoquée au contrôle d'accès")

  // 6. Événement définitif : son bloc de chambres réduit l'inventaire de la réception
  const evt = await ev(() => D.evt.events.find((e) => e.block && !e.block.created && e.status !== "annule"))
  if (evt) {
    const d = evt.block.from
    const before = await ev(([t, x]) => available(t, x), [evt.block.type, d])
    await ev((e) => { const x = D.evt.events.find((y) => y.id === e); x.quote = "signe"; A.evt.confirm(e) }, evt.id)
    const after = await ev(([t, x]) => available(t, x), [evt.block.type, d])
    assert(after === before - evt.block.rooms, `bloc ${evt.id} : disponibilités ${evt.block.type} le ${d} ${before} → ${after}`)
  }

  // 7. Alerte serrure → ordre de travail dans la maintenance
  const door = await ev(() => { const a = D.acc.alarms.find((x) => /Batterie|hors ligne/i.test(x.type) && !D.acc.workOrders.some((w) => w.door === x.door)); return a && [a.door, a.type] })
  if (door) {
    await ev(([d, t]) => A.acc.workOrder(d, t), door)
    const ot = await ev(() => D.acc.workOrders[0].id)
    assert(await ev((o) => D.mnt.orders.some((x) => x.id === o), ot), `ordre de travail ${ot} présent dans la maintenance`)
  }

  // 8. Persistance
  await p.reload()
  await p.waitForTimeout(200)
  assert(await ev((i) => R(i) && R(i).status === "partie", id), "état conservé après rechargement")

  if (errs.length) throw new Error("Erreurs console : " + errs.join(" | "))
  console.log("PARCOURS OK")
  await b.close()
})().catch((e) => { console.error(e.message); process.exit(1) })
