// modules/pilotage.js — Vue d'ensemble : tableau de bord alimenté par tous les modules et page Analytique.
// Les chiffres du jour sont calculés sur les données de la maquette ; l'historique 30 jours est un exemple
// déterministe (mêmes valeurs à chaque chargement), raccordé au jour courant.
;(() => {
  const rnd = (i) => { const x = Math.sin(i * 91.17 + 3.1) * 43758.5453; return x - Math.floor(x) }
  const sellable = () => D.rooms.filter((r) => r.hk !== "hs").length || 1
  const sumBy = (arr, f) => (arr || []).reduce((s, x) => s + (Number(f(x)) || 0), 0)
  const cnt = (arr, f) => (arr || []).reduce((m, x) => { const k = f(x); m[k] = (m[k] || 0) + 1; return m }, {})
  const fdLabel = (d) => d.slice(8, 10) + "/" + d.slice(5, 7)

  // ---------- Le jour (données réelles de la maquette) ----------
  const tonight = () => {
    const ih = inHouse(), n = sellable(), room = sumBy(ih, (r) => r.rate)
    return { sold: ih.length, n, occ: (ih.length / n) * 100, adr: ih.length ? room / ih.length : 0, revpar: room / n, room }
  }
  const classify = (label) => /restaurant|ticket|room service|bar|petit-d|minibar|repas|dîner|déjeuner/i.test(label) ? "Restauration"
    : /spa|massage|soin|hammam/i.test(label) ? "Spa et loisirs" : /pressing|blanchisserie|linge|chemise/i.test(label) ? "Pressing"
    : /séminaire|salle|banquet|événement/i.test(label) ? "Événements" : "Autres services"
  const revenueToday = () => {
    const t = { Hébergement: tonight().room, Restauration: 0, "Spa et loisirs": 0, Pressing: 0, Événements: 0, "Autres services": 0 }
    Object.values(D.extras || {}).flat().forEach((l) => { if (l && l.amount > 0) t[classify(l.label || "")] += l.amount })
    ;(D.fnb?.closed || []).filter((c) => !c.hotel).forEach((c) => (t.Restauration += c.total || 0))
    return Object.entries(t).map(([label, value]) => ({ label, value: Math.round(value) })).filter((x) => x.value > 0)
  }

  // ---------- Historique d'exemple (30 jours) + carnet de réservations (14 jours) ----------
  const history = () => {
    const now = tonight()
    return Array.from({ length: 30 }, (_, i) => {
      const d = addDays(today, i - 29), dow = day(d).getDay(), wk = dow >= 1 && dow <= 4
      const last = i === 29
      const occ = last ? now.occ : Math.min(97, Math.max(28, (wk ? 70 : 55) + rnd(i) * 22 - 8))
      const adr = last && now.adr ? now.adr : Math.round((55000 + rnd(i + 40) * 9000) / 100) * 100
      const sold = (occ / 100) * sellable(), room = sold * adr
      const fnb = Math.round(sold * (15000 + rnd(i + 80) * 9000)), spa = Math.round(sold * (2500 + rnd(i + 120) * 3500)), other = Math.round(sold * (1500 + rnd(i + 160) * 2000))
      return { d, occ, adr, revpar: room / sellable(), room, fnb, spa, other, total: room + fnb + spa + other, nps: 40 + rnd(i + 200) * 35 }
    })
  }
  const onBooks = () => Array.from({ length: 14 }, (_, i) => {
    const d = addDays(today, i), n = sellable()
    const free = D.roomTypes.reduce((s, t) => s + Math.max(0, available(t.code, d)), 0)
    return { d, occ: Math.min(100, ((n - free) / n) * 100) }
  })
  const delta = (a, b) => (b ? ((a - b) / Math.abs(b)) * 100 : null)

  // ---------- Fil d'activité (tous modules) ----------
  const feed = () => {
    const items = []
    ;(D.sej?.log || []).forEach((x) => items.push({ at: x.at, icon: "message", text: `${x.type} · ch. ${x.room || "—"} : ${x.text}`, route: "sej-audit" }))
    ;(D.mnt?.orders || []).forEach((o) => items.push({ at: o.created, icon: "wrench", text: `${o.id} ${o.title} (${o.target}) — ${o.status.replace("_", " ")}`, route: "mnt-ot" }))
    ;(D.acc?.alarms || []).forEach((a) => items.push({ at: a.at || `${today} 06:00`, icon: "shield", text: `${a.type} — ${a.door}`, route: "acc-securite" }))
    ;(D.bln?.orders || []).forEach((o) => items.push({ at: o.taken, icon: "shirt", text: `Pressing ${o.id} (${o.channel})`, route: "bln-pressing" }))
    return items.filter((x) => x.at && canSee(x.route)).sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, 7)
  }

  const views = {
    dashboard() {
      const u = currentUser(), h = history(), now = tonight(), prev = h[28], fut = onBooks()
      const rev = revenueToday(), revTotal = sumBy(rev, (x) => x.value)
      const arr = arrivals(), dep = departures(), pend = arr.filter((r) => r.status === "confirmee")
      const hk = cnt(D.rooms, (r) => (r.hk === "hs" ? "hs" : occupant(r.no) ? "occ" : r.hk))
      const notes = notifications()
      const reviews = D.crm?.reviews || [], nps = reviews.length ? Math.round(((reviews.filter((r) => r.nps >= 9).length - reviews.filter((r) => r.nps <= 6).length) / reviews.length) * 100) : 0
      const openMnt = (D.mnt?.orders || []).filter((o) => o.status !== "clos")
      const toClean = D.rooms.filter((r) => r.hk === "sale").length
      const quick = [["Nouvelle réservation", "reservations/new", "calendar"], ["Check-in", "checkin", "key"], ["Check-out", "checkout", "receipt"], ["Walk-in", "sej-mouv", "user"], ["Signaler une panne", "mnt-ot", "wrench"], ["Analytique", "analytique", "trend"]].filter(([, r]) => canSee(r.split("/")[0]))
      return pageHead(`Bonjour ${u.name.split(" ")[0]}`, `${D.hotel} · ${fdLong(today)} · données d'exemple`)
        + `<div class="quick" style="margin-bottom:18px">${quick.map(([l, r, i]) => `<button class="btn ghost sm" onclick="go('${r}')">${ico(i, 15)} ${esc(l)}</button>`).join("")}</div>`
        + `<div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr))">
            ${stat({ label: "Occupation ce soir", value: pct(now.occ), icon: "bed", delta: delta(now.occ, prev.occ), hint: `${now.sold}/${now.n} chambres · vs hier`, trend: h.slice(-14).map((x) => x.occ), route: "analytique/hebergement" })}
            ${stat({ label: "Prix moyen (ADR)", value: money(now.adr), icon: "tag", delta: delta(now.adr, prev.adr), hint: "vs hier", trend: h.slice(-14).map((x) => x.adr), route: "analytique/hebergement" })}
            ${stat({ label: "RevPAR", value: money(now.revpar), icon: "trend", delta: delta(now.revpar, prev.revpar), hint: "revenu par chambre disponible", trend: h.slice(-14).map((x) => x.revpar), route: "analytique/revenus" })}
            ${stat({ label: "Chiffre d'affaires du jour", value: money(revTotal), icon: "coins", delta: delta(revTotal, prev.total), hint: "toutes activités · vs hier", trend: h.slice(-14).map((x) => x.total), route: "analytique/revenus" })}
            ${stat({ label: "Arrivées", value: `${arr.length - pend.length}/${arr.length}`, icon: "key", hint: `${pend.length} à enregistrer`, route: "checkin" })}
            ${stat({ label: "Départs", value: `${dep.filter((r) => r.status === "partie").length}/${dep.length}`, icon: "door", hint: `${dep.filter((r) => r.status === "arrivee").length} à facturer`, route: "checkout" })}
          </div>`
        + `<div class="dash" style="margin-top:16px">
          <div class="w8">${section("Occupation : 15 derniers jours et carnet à 14 jours", lineChart([...h.slice(-15).map((x) => fdLabel(x.d)), ...fut.slice(1).map((x) => fdLabel(x.d))], [{ name: "Occupation (%)", values: [...h.slice(-15).map((x) => x.occ), ...fut.slice(1).map((x) => x.occ)] }], { fmt: (v) => Math.round(v) + " %", max: 100 }) + `<p class="muted" style="margin:6px 0 0">Jusqu'à aujourd'hui : réalisé (exemple) ; ensuite : réservations confirmées et blocs de groupes.</p>`, btn("Analytique", "go('analytique/hebergement')", "ghost sm"))}</div>
          <div class="w4">${section("Statut des chambres", donut([
              { label: "Libres et propres", value: hk.propre || 0, color: "var(--s3)" }, { label: "Occupées", value: hk.occ || 0, color: "var(--s1)" },
              { label: "Sales", value: hk.sale || 0, color: "var(--s4)" }, { label: "En inspection", value: hk.inspection || 0, color: "var(--s5)" }, { label: "Hors commande", value: hk.hs || 0, color: "var(--s2)" }],
              { fmt: (v) => v, center: String(D.rooms.length), sub: "chambres" }), canSee("chambres") ? btn("Voir", "go('chambres')", "ghost sm") : "")}</div>
          <div class="w6">${section("Chiffre d'affaires du jour par activité", rev.length ? donut(rev, { fmt: money, center: shortNum(revTotal), sub: "FCFA" }) : `<p class="muted">Aucune vente aujourd'hui.</p>`)}</div>
          <div class="w6">${section("Revenus sur 30 jours", lineChart(h.map((x) => fdLabel(x.d)), [{ name: "Hébergement", values: h.map((x) => x.room) }, { name: "Restauration", values: h.map((x) => x.fnb) }, { name: "Spa et autres", values: h.map((x) => x.spa + x.other) }], { fmt: shortNum }))}</div>
          <div class="w4">${section(`Alertes (${notes.length})`, notes.length ? `<div class="feed">${notes.map((x) => `<div class="clickable" style="cursor:pointer" onclick="go('${esc(x.route)}')"><span class="fi">${ico(x.kind === "Sécurité" ? "shield" : x.kind === "Maintenance" ? "wrench" : "star", 15)}</span><span><strong style="font-size:13px">${esc(x.kind)}</strong><br>${esc(x.text)}</span></div>`).join("")}</div>` : `<p class="muted">Rien à signaler.</p>`)}</div>
          <div class="w4">${section("Tâches du jour", `<div class="feed">
              <div><span class="fi">${ico("key", 15)}</span><span>${pend.length} arrivée(s) à enregistrer</span></div>
              <div><span class="fi">${ico("receipt", 15)}</span><span>${dep.filter((r) => r.status === "arrivee").length} départ(s) à facturer</span></div>
              <div><span class="fi">${ico("bed", 15)}</span><span>${toClean} chambre(s) à nettoyer, ${hk.inspection || 0} à inspecter</span></div>
              <div><span class="fi">${ico("wrench", 15)}</span><span>${openMnt.length} ordre(s) de travail ouverts, dont ${openMnt.filter((o) => o.blocking).length} bloquant(s)</span></div>
              <div><span class="fi">${ico("shirt", 15)}</span><span>${(D.bln?.orders || []).filter((o) => !o.delivered).length} commande(s) de pressing à livrer</span></div>
              <div><span class="fi">${ico("party", 15)}</span><span>${(D.evt?.events || []).filter((e) => e.status === "definitif").length} événement(s) confirmés à préparer</span></div></div>`)}</div>
          <div class="w4">${section("Satisfaction client", `<div class="row" style="gap:16px;flex-wrap:nowrap">${gauge(Math.max(0, nps), "NPS")}<div><div class="stat-val">${nps}</div><div class="muted">NPS sur ${reviews.length} avis (exemple)</div></div></div>
              ${reviews.length ? `<p style="margin:12px 0 0;font-size:14px">« ${esc((reviews[0].text || "").slice(0, 120))} »</p><p class="muted" style="margin:4px 0 0">${esc(G(reviews[0].guest)?.name || "")} · ${esc(reviews[0].source || "")}</p>` : ""}`, canSee("crm") ? btn("Avis", "go('crm/avis')", "ghost sm") : "")}</div>
          <div class="w6">${section("Arrivées VIP et demandes spéciales", (() => { const l = [...inHouse(), ...pend].filter((r) => G(r.guest)?.vip || r.request)
              return l.length ? `<div class="feed">${l.slice(0, 6).map((r) => `<div><span class="avatar sm">${esc(initials(G(r.guest).name))}</span><span><strong>${esc(G(r.guest).name)}</strong>${G(r.guest).vip ? " " + badge("VIP", "ok") : ""}<br><span class="muted">${r.status === "arrivee" ? `En séjour · ch. ${esc(r.room)}` : "Arrive aujourd'hui"}${r.request ? " · " + esc(r.request) : ""}</span></span></div>`).join("")}</div>` : `<p class="muted">Aucune.</p>` })())}</div>
          <div class="w6">${section("Activité récente", (() => { const f = feed(); return f.length ? `<div class="feed">${f.map((x) => `<div style="cursor:pointer" onclick="go('${esc(x.route)}')"><span class="fi">${ico(x.icon, 15)}</span><span>${esc(x.text)}<br><span class="muted">${esc(String(x.at).slice(5).replace("-", "/").replace(" ", " · "))}</span></span></div>`).join("")}</div>` : `<p class="muted">Pas d'activité.</p>` })())}</div>
        </div>`
    },

    analytique(p) {
      if (!ui.anPeriod) ui.anPeriod = "30"
      const tab = p[0] || "hebergement", days = ui.anPeriod === "7" ? 7 : 30
      const h = history(), cur = h.slice(-days), before = h.slice(-2 * days, -days)
      const avg = (rows, f) => (rows.length ? sumBy(rows, f) / rows.length : 0)
      const labels = cur.map((x) => fdLabel(x.d))
      const head = pageHead("Analytique", "Indicateurs calculés sur les données de la maquette ; historique d'exemple raccordé au jour courant.")
        + `<div class="row between" style="align-items:flex-start">${subtabs("analytique", [["hebergement", "Hébergement"], ["revenus", "Revenus"], ["clients", "Clients"], ["operations", "Opérations"], ["services", "Services"]], tab)}
           ${["hebergement", "revenus"].includes(tab) ? chips("anPeriod", { 7: "7 jours", 30: "30 jours" }) : ""}</div>`
      let body = ""
      if (tab === "hebergement") {
        const nights = D.reservations.filter((r) => !["annulee", "noshow"].includes(r.status)).map((r) => nights_(r))
        const los = [1, 2, 3, 4, 5].map((n) => nights.filter((x) => (n === 5 ? x >= 5 : x === n)).length)
        const seg = (D.bir?.segments || []).map((s) => ({ label: s.name, value: s.rn }))
        const src = cnt(D.reservations, (r) => D.sej?.meta?.[r.id]?.source || (r.walkin ? "Walk-in" : r.group ? "Groupe" : "Direct / réception"))
        body = `<div class="grid g4">
            ${stat({ label: "Occupation moyenne", value: pct(avg(cur, (x) => x.occ)), icon: "bed", delta: delta(avg(cur, (x) => x.occ), avg(before, (x) => x.occ)), hint: `vs ${days} jours précédents`, trend: cur.map((x) => x.occ) })}
            ${stat({ label: "ADR moyen", value: money(avg(cur, (x) => x.adr)), icon: "tag", delta: delta(avg(cur, (x) => x.adr), avg(before, (x) => x.adr)), hint: "prix moyen par chambre vendue", trend: cur.map((x) => x.adr) })}
            ${stat({ label: "RevPAR moyen", value: money(avg(cur, (x) => x.revpar)), icon: "trend", delta: delta(avg(cur, (x) => x.revpar), avg(before, (x) => x.revpar)), hint: "par chambre disponible", trend: cur.map((x) => x.revpar) })}
            ${stat({ label: "Durée moyenne de séjour", value: (nights.length ? sumBy(nights, (x) => x) / nights.length : 0).toFixed(1).replace(".", ",") + " nuits", icon: "moon", hint: `${nights.length} réservations` })}
          </div><div class="dash" style="margin-top:16px">
            <div class="w8">${section("Taux d'occupation", lineChart(labels, [{ name: "Occupation (%)", values: cur.map((x) => x.occ) }], { fmt: (v) => Math.round(v) + " %", max: 100 }))}</div>
            <div class="w4">${section("Carnet à 14 jours", lineChart(onBooks().map((x) => fdLabel(x.d)), [{ name: "Occupation réservée (%)", values: onBooks().map((x) => x.occ) }], { fmt: (v) => Math.round(v) + " %", max: 100, height: 260 }))}</div>
            <div class="w6">${section("ADR et RevPAR", lineChart(labels, [{ name: "ADR", values: cur.map((x) => x.adr) }, { name: "RevPAR", values: cur.map((x) => x.revpar) }], { fmt: shortNum, area: false }))}</div>
            <div class="w6">${section("Nuitées par segment (mois)", seg.length ? donut(seg, { fmt: (v) => v + " nuitées", center: String(sumBy(seg, (x) => x.value)), sub: "nuitées" }) : `<p class="muted">—</p>`)}</div>
            <div class="w6">${section("Origine des réservations", bars(Object.entries(src).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value), (v) => v + " rés."))}</div>
            <div class="w6">${section("Durée des séjours", columns(["1 nuit", "2 nuits", "3 nuits", "4 nuits", "5 et +"], los, (v) => v))}</div>
          </div>`
      } else if (tab === "revenus") {
        const tot = (f) => sumBy(cur, f)
        const mix = [{ label: "Hébergement", value: tot((x) => x.room) }, { label: "Restauration", value: tot((x) => x.fnb) }, { label: "Spa et loisirs", value: tot((x) => x.spa) }, { label: "Autres", value: tot((x) => x.other) }]
        body = `<div class="grid g4">
            ${stat({ label: "Chiffre d'affaires", value: money(tot((x) => x.total)), icon: "coins", delta: delta(tot((x) => x.total), sumBy(before, (x) => x.total)), hint: `${days} jours`, trend: cur.map((x) => x.total) })}
            ${stat({ label: "Hébergement", value: money(tot((x) => x.room)), icon: "bed", delta: delta(tot((x) => x.room), sumBy(before, (x) => x.room)), hint: pct((tot((x) => x.room) / tot((x) => x.total)) * 100) + " du CA" })}
            ${stat({ label: "Restauration", value: money(tot((x) => x.fnb)), icon: "utensils", delta: delta(tot((x) => x.fnb), sumBy(before, (x) => x.fnb)), hint: pct((tot((x) => x.fnb) / tot((x) => x.total)) * 100) + " du CA" })}
            ${stat({ label: "CA par chambre dispo. (TRevPAR)", value: money(tot((x) => x.total) / (sellable() * days)), icon: "trend", hint: "toutes activités" })}
          </div><div class="dash" style="margin-top:16px">
            <div class="w8">${section("Chiffre d'affaires par jour", lineChart(labels, [{ name: "Hébergement", values: cur.map((x) => x.room) }, { name: "Restauration", values: cur.map((x) => x.fnb) }, { name: "Spa et autres", values: cur.map((x) => x.spa + x.other) }], { fmt: shortNum }))}</div>
            <div class="w4">${section("Répartition", donut(mix, { fmt: money, center: shortNum(tot((x) => x.total)), sub: "FCFA" }))}</div>
            <div class="w12">${section("Détail des 7 derniers jours", tbl(["Jour", "#Occupation", "#ADR", "#Hébergement", "#Restauration", "#Spa et autres", "#Total"], h.slice(-7).reverse().map((x) => [fdLabel(x.d), pct(x.occ), money(x.adr), money(x.room), money(x.fnb), money(x.spa + x.other), `<strong>${money(x.total)}</strong>`])))}</div>
          </div>`
      } else if (tab === "clients") {
        const nat = Object.entries(cnt(D.guests, (g) => g.nationality || "Non renseignée")).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value)
        const members = Object.values(D.crm?.accounts || {}), tiers = Object.entries(cnt(members, (m) => m.tier)).map(([label, value]) => ({ label, value }))
        const reviews = D.crm?.reviews || [], prom = reviews.filter((r) => r.nps >= 9).length, det = reviews.filter((r) => r.nps <= 6).length
        const nps = reviews.length ? Math.round(((prom - det) / reviews.length) * 100) : 0
        const repeat = D.guests.filter((g) => D.reservations.filter((r) => r.guest === g.id && r.status === "partie").length >= 1).length
        body = `<div class="grid g4">
            ${stat({ label: "Clients", value: String(D.guests.length), icon: "users", hint: `${D.guests.filter((g) => g.vip).length} VIP` })}
            ${stat({ label: "Clients revenus", value: pct((repeat / (D.guests.length || 1)) * 100), icon: "refresh", hint: `${repeat} avec un séjour passé` })}
            ${stat({ label: "Membres fidélité", value: String(members.length), icon: "heart", hint: `${sumBy(members, (m) => m.points).toLocaleString("fr-FR")} points en circulation` })}
            ${stat({ label: "NPS", value: String(nps), icon: "star", hint: `${prom} promoteurs · ${det} détracteurs` })}
          </div><div class="dash" style="margin-top:16px">
            <div class="w6">${section("Nationalités", donut(nat, { fmt: (v) => v + " client(s)", center: String(D.guests.length), sub: "clients" }))}</div>
            <div class="w6">${section("Niveaux de fidélité", tiers.length ? bars(tiers, (v) => v + " membre(s)") : `<p class="muted">—</p>`)}</div>
            <div class="w12">${section("Derniers avis", reviews.length ? tbl(["Client", "Source", "Date", "#Note", "Avis"], reviews.slice(0, 6).map((r) => [esc(G(r.guest)?.name || "—"), esc(r.source || ""), esc(r.date || ""), `${badge(String(r.nps), r.nps >= 9 ? "ok" : r.nps <= 6 ? "bad" : "warn")}`, esc((r.text || "").slice(0, 110))])) : `<p class="muted">Aucun avis.</p>`)}</div>
          </div>`
      } else if (tab === "operations") {
        const hk = cnt(D.rooms, (r) => (r.hk === "hs" ? "Hors commande" : occupant(r.no) ? "Occupées" : HK[r.hk][0]))
        const orders = D.mnt?.orders || [], byStatus = Object.entries(cnt(orders, (o) => o.status.replace("_", " "))).map(([label, value]) => ({ label, value }))
        const load = D.housekeepers.map((name) => ({ label: name, value: D.rooms.filter((r) => (D.assignments || {})[r.no] === name).length }))
        const prio = Object.entries(cnt(orders.filter((o) => o.status !== "clos"), (o) => o.prio)).map(([label, value]) => ({ label, value }))
        body = `<div class="grid g4">
            ${stat({ label: "Chambres prêtes", value: `${readyRooms().length}`, icon: "bed", hint: `sur ${D.rooms.filter((r) => !occupant(r.no) && r.hk !== "hs").length} libres` })}
            ${stat({ label: "Ordres de travail ouverts", value: String(orders.filter((o) => o.status !== "clos").length), icon: "wrench", hint: `${orders.filter((o) => o.blocking && o.status !== "clos").length} bloquant(s)` })}
            ${stat({ label: "Alarmes de sécurité", value: String((D.acc?.alarms || []).filter((a) => a.status === "ouverte").length), icon: "shield", hint: "ouvertes" })}
            ${stat({ label: "Pressing en cours", value: String((D.bln?.orders || []).filter((o) => !o.delivered).length), icon: "shirt", hint: "commandes à livrer" })}
          </div><div class="dash" style="margin-top:16px">
            <div class="w6">${section("Chambres", donut(Object.entries(hk).map(([label, value]) => ({ label, value })), { fmt: (v) => v, center: String(D.rooms.length), sub: "chambres" }))}</div>
            <div class="w6">${section("Charge des femmes de chambre", bars(load, (v) => v + " ch."))}</div>
            <div class="w6">${section("Ordres de travail par statut", bars(byStatus, (v) => v))}</div>
            <div class="w6">${section("Ordres ouverts par priorité", prio.length ? donut(prio, { fmt: (v) => v, center: String(sumBy(prio, (x) => x.value)), sub: "ouverts" }) : `<p class="muted">Aucun.</p>`)}</div>
          </div>`
      } else {
        const closed = D.fnb?.closed || [], outlets = D.fnb?.outlets || []
        const byOutlet = outlets.map((o) => ({ label: o.name, value: sumBy(closed.filter((c) => c.outlet === o.id), (c) => c.total) })).filter((x) => x.value)
        const spaB = D.spa?.bookings || [], evts = D.evt?.events || []
        body = `<div class="grid g4">
            ${stat({ label: "Ventes restauration", value: money(sumBy(closed, (c) => c.total)), icon: "utensils", hint: `${closed.length} tickets · ${sumBy(closed, (c) => c.covers)} couverts` })}
            ${stat({ label: "Ticket moyen", value: money(closed.length ? sumBy(closed, (c) => c.total) / closed.length : 0), icon: "receipt", hint: `${pct((closed.filter((c) => c.hotel).length / (closed.length || 1)) * 100)} imputés en chambre` })}
            ${stat({ label: "Rendez-vous spa", value: String(spaB.length), icon: "sparkle", hint: `${spaB.filter((b) => b.status === "termine").length} terminés` })}
            ${stat({ label: "Événements", value: String(evts.length), icon: "party", hint: `${evts.filter((e) => e.status === "definitif").length} confirmés` })}
          </div><div class="dash" style="margin-top:16px">
            <div class="w6">${section("Ventes par point de vente", byOutlet.length ? donut(byOutlet, { fmt: money, center: shortNum(sumBy(byOutlet, (x) => x.value)), sub: "FCFA" }) : `<p class="muted">Aucune vente.</p>`)}</div>
            <div class="w6">${section("Spa : rendez-vous par statut", bars(Object.entries(cnt(spaB, (b) => b.status)).map(([label, value]) => ({ label, value })), (v) => v))}</div>
            <div class="w12">${section("Événements par statut", bars(Object.entries(cnt(evts, (e) => e.status)).map(([label, value]) => ({ label, value })), (v) => v + " événement(s)"))}</div>
          </div>`
      }
      return head + body
    },
  }
  const nights_ = (r) => nights(r.from, r.to)

  HMS.module({
    code: "dash", group: "Vue d'ensemble", title: "Tableau de bord et analytique", phase: "—", spec: "§20 BIR",
    screens: [
      { id: "dashboard", label: "Tableau de bord", view: views.dashboard },
      { id: "analytique", label: "Analytique", view: views.analytique },
    ],
  })
})()
