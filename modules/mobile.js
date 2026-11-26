// modules/mobile.js — Spec §21 Applications mobiles clients et personnel (MOB)
// Deux téléphones côte à côte : app client (réservation, check-in en ligne, clé mobile, services, concierge, folio)
// et app personnel (tâches housekeeping, inspection, signalement maintenance, alertes, pointage).
// Clé BLE/NFC, notifications push, paiement mobile money et géolocalisation sont simulés.
;(() => {
  D.mob = {
    brand: { appName: "Hôtel Exemple", welcome: "Bienvenue ! Votre séjour se gère ici, du check-in à la facture." },
    guest: "G1", res: "R-2051", staff: D.housekeepers[0],
    mci: { status: null, arrival: "15:00" },
    deviceChanged: false,
    keys: [
      { id: "MK-11", holder: G("G7").name, device: "Android (exemple)", room: "302", status: "active", shared: false },
      { id: "MK-12", holder: G("G6").name, device: "iPhone (exemple)", room: "202", status: "active", shared: false },
    ],
    doorLog: [],
    requests: [
      { id: "DS-31", kind: "housekeeping", label: "Could I have two extra pillows?", tr: "Traduit : Puis-je avoir deux oreillers supplémentaires ?", room: "302", status: "nouvelle", at: "09:12" },
    ],
    check: {},
    reports: [],
    alerts: [
      { at: "03:40", text: "Alarme de porte : 6 badges refusés ch. 304 (simulé)", kind: "Sécurité" },
    ],
    clock: null, leaves: [],
    offline: false, queue: [],
    nbo: true, consents: { marketing: true, profilage: true },
    loyalty: { level: "Or", points: 12400 },
    events: [],
    myRes: [],
    chat: [["ia", "Bonjour, je suis le concierge virtuel (assistant IA). Vous pouvez demander un membre de la réception à tout moment."]],
    devices: [
      { user: G("G1").name, platform: "iOS 18 (exemple)", registered: "2026-10-02", push: true, kind: "Client" },
      { user: G("G7").name, platform: "Android 15 (exemple)", registered: "2026-11-25", push: true, kind: "Client" },
      { user: G("G6").name, platform: "iOS 17 (exemple)", registered: "2026-11-25", push: false, kind: "Client" },
      { user: D.housekeepers[0], platform: "Android 15 (exemple)", registered: "2026-03-14", push: true, kind: "Personnel" },
      { user: "Seydou Bamba (technicien)", platform: "Android 14 (exemple)", registered: "2026-05-20", push: true, kind: "Personnel" },
    ],
    appRevenue: 1185000, // mois, exemple
  }
  const M = D.mob
  ui.mobC = ui.mobC || "home"
  ui.mobS = ui.mobS || "tasks"
  const res = () => R(M.res)
  const inStay = () => res() && res().status === "arrivee"
  const ev = (name, text) => M.events.unshift({ at: new Date().toTimeString().slice(0, 5), name, text })
  const go2 = (side, screen) => `A.mob.nav('${side}','${screen}')`
  const nav = (side, items, cur) => `<div class="row" style="margin-top:16px;border-top:1px solid var(--line);padding-top:10px;gap:4px">${items.map(([id, l]) =>
    `<button class="btn ${cur === id ? "sm" : "ghost sm"}" onclick="${go2(side, id)}">${esc(l)}</button>`).join("")}</div>`
  const back = (side, to = side === "c" ? "home" : "tasks") => `<button class="link muted" onclick="${go2(side, to)}">← Retour</button>`
  const h = (t) => `<div class="big" style="font-size:18px;margin:6px 0 10px">${esc(t)}</div>`

  // ---------- App client ----------
  const C = {
    home() {
      const r = res(), g = G(M.guest)
      return `<div class="muted">${esc(M.brand.welcome)}</div>${h("Bonjour " + g.name)}
        ${r ? `<div class="card" style="padding:12px"><div class="row between"><strong>Séjour ${esc(r.id)}</strong>${inStay() ? badge("En séjour", "on") : badge(M.mci.status === "soumis" ? "Check-in envoyé" : "À venir", "outline")}</div>
          <div class="muted">${esc(T(r.type).label)} · du ${fd(r.from)} au ${fd(r.to)}${r.room ? " · ch. " + esc(r.room) : ""}</div>
          <div class="row" style="margin-top:8px">${!inStay() && M.mci.status !== "soumis" ? btn("Check-in en ligne", go2("c", "checkin"), "sm") : ""}${btn("Ma clé", go2("c", "key"), inStay() ? "sm" : "ghost sm")}</div></div>` : ""}
        ${M.nbo && M.consents.profilage ? `<div class="card ai" style="padding:12px;margin-top:10px"><div class="row between"><strong>Pour vous</strong>${badge("IA · simulé", "outline")}</div>
          <p style="margin:6px 0">Transfert retour vers l'aéroport le ${fd(r.to)} — 15 000 FCFA.</p><div class="muted">Recommandé car vous séjournez en suite et êtes arrivé par avion lors de votre dernier séjour.</div>
          <div class="row" style="margin-top:8px">${btn("Ajouter", "A.mob.nboAccept()", "sm")}${btn("Non merci", "A.mob.nboDecline()", "ghost sm")}</div></div>` : ""}
        <div class="list" style="margin-top:10px">
          <button onclick="${go2("c", "chat")}"><strong>Concierge</strong><div class="muted">Une question ? Réponse 24 h/24</div></button>
          <button onclick="${go2("c", "services")}"><strong>Services</strong><div class="muted">Room service, spa, ménage, réveil</div></button>
          <button onclick="${go2("c", "account")}"><strong>Compte fidélité</strong><div class="muted">Niveau ${esc(M.loyalty.level)} · ${M.loyalty.points.toLocaleString("fr-FR")} points</div></button>
        </div>${nav("c", CNAV, "home")}`
    },
    search() {
      const from = ui.mobFrom || addDays(today, 7), to = ui.mobTo || addDays(today, 9)
      const n = nights(from, to)
      return `${h("Réserver un séjour")}
        <div class="form" style="grid-template-columns:1fr 1fr">${field("mob-from", "Arrivée", input("mob-from", from, `type="date" onchange="ui.mobFrom=this.value;render()"`))}${field("mob-to", "Départ", input("mob-to", to, `type="date" onchange="ui.mobTo=this.value;render()"`))}</div>
        ${n <= 0 ? `<p class="err">La date de départ doit suivre la date d'arrivée.</p>` : `<div class="stack" style="margin-top:12px">${D.roomTypes.map((t) => {
          let free = Infinity; for (let d = from; d < to; d = addDays(d, 1)) free = Math.min(free, available(t.code, d))
          return `<div class="card" style="padding:12px"><div class="row between"><strong>${esc(t.label)}</strong><span>${money(t.rate)}<span class="muted"> /nuit</span></span></div>
            <div class="muted">${free > 0 ? `${free} disponible(s) · ${n} nuit(s) : ${money(t.rate * n)}` : "Complet sur ces dates"}</div>
            ${free > 0 ? `<div style="margin-top:8px">${btn("Réserver", `A.mob.book('${t.code}')`, "sm")}</div>` : ""}</div>` }).join("")}</div>`}
        ${M.myRes.length ? `<h3>Mes réservations</h3><div class="stack">${M.myRes.map((id) => { const r = R(id); return `<div class="card" style="padding:10px"><strong>${esc(r.id)}</strong> ${pill(STATUS, r.status)}
          <div class="muted">${esc(T(r.type).label)} · ${fd(r.from)} → ${fd(r.to)}</div>${r.status === "confirmee" ? `<div style="margin-top:6px">${btn("Annuler", `A.mob.cancel(${q(r.id)})`, "ghost sm")}</div>` : ""}</div>` }).join("")}</div>` : ""}
        ${nav("c", CNAV, "search")}`
    },
    checkin() {
      const r = res(), g = G(M.guest)
      if (inStay()) return `${back("c")}${h("Check-in")}<p>Votre check-in est validé, chambre ${esc(r.room)}.</p>${btn("Ouvrir ma clé", go2("c", "key"), "sm")}`
      if (M.mci.status === "soumis") return `${back("c")}${h("Check-in envoyé")}<p>La réception vérifie votre dossier. Votre clé mobile sera activée dès la validation (notification push).</p><p class="muted">Arrivée prévue : ${esc(M.mci.arrival)}</p>`
      return `${back("c")}${h("Check-in en ligne")}<div class="muted">${esc(r.id)} · ${esc(T(r.type).label)} · ${fd(r.from)} → ${fd(r.to)}</div>
        <div class="stack" style="margin-top:12px">
          ${field("mob-arr", "Heure d'arrivée", select("mob-arr", ["12:00", "14:00", "15:00", "18:00", "21:00", "23:00"], M.mci.arrival))}
          <label class="row" style="color:var(--ink)"><input type="checkbox" id="mob-id"> Pièce d'identité photographiée (${esc(g.idDoc)}, simulé)</label>
          <label class="row" style="color:var(--ink)"><input type="checkbox" id="mob-sign"> Je signe la fiche de police et les conditions</label>
          <label class="row" style="color:var(--ink)"><input type="checkbox" id="mob-guar"> Garantie : ${esc(r.guarantee)} (empreinte simulée)</label>
          <div id="mob-ci-err"></div>
          ${btn("Envoyer mon check-in", "A.mob.submitCheckin()", "accent")}
        </div>`
    },
    key() {
      const r = res()
      if (!inStay()) return `${back("c")}${h("Clé mobile")}<p class="err">Clé indisponible : elle s'active uniquement après un check-in validé par l'hôtel et la vérification d'identité (RG-MOB-01).</p>
        ${M.mci.status !== "soumis" ? btn("Faire mon check-in", go2("c", "checkin"), "sm") : `<p class="muted">Check-in en attente de validation.</p>`}`
      if (M.deviceChanged) return `${back("c")}${h("Clé mobile")}<p class="err">Nouvel appareil détecté : ré-authentifiez-vous pour réactiver la clé (RG-MOB-02).</p>${btn("Me ré-authentifier (code SMS simulé)", "A.mob.reauth()", "sm")}`
      const mine = M.keys.find((k) => k.room === r.room && !k.shared)
      const shared = M.keys.filter((k) => k.room === r.room && k.shared)
      return `${back("c")}${h("Chambre " + r.room)}
        <div class="card" style="text-align:center;padding:18px"><div class="muted">Clé ${esc(mine?.id || "")} · valable jusqu'au ${fd(r.to)} 12 h</div>
          <div style="margin:12px 0">${btn("Ouvrir la porte", `A.mob.open(${q(r.room)})`, "accent")}</div>
          <div class="muted">Approchez le téléphone de la serrure (BLE simulé). Fonctionne sans connexion Internet.</div>
          ${M.doorLog[0] ? `<p style="margin:8px 0 0">${badge("Ouvert", "on")} ${esc(M.doorLog[0])}</p>` : ""}</div>
        <div class="muted" style="margin-top:8px">Accès autorisés : chambre ${esc(r.room)}, piscine, salle de sport.</div>
        <h3>Partager avec un accompagnant</h3>
        <div class="row" style="flex-wrap:nowrap">${input("mob-share", "", `placeholder="Nom de l'accompagnant"`)}${btn("Partager", "A.mob.share()", "sm")}</div>
        <div class="stack" style="margin-top:8px">${shared.map((k) => `<div class="row between"><span>${esc(k.holder)} ${badge(k.status === "active" ? "Active" : "Révoquée", k.status === "active" ? "on" : "outline")}</span>${k.status === "active" ? btn("Révoquer", `A.mob.revoke(${q(k.id)})`, "ghost sm") : ""}</div>`).join("")}</div>
        ${nav("c", CNAV, "key")}`
    },
    services() {
      const mine = M.requests.filter((x) => x.room === res()?.room && x.app)
      return `${h("Services")}${!inStay() ? `<p class="err">Les commandes sont disponibles après le check-in.</p>` : ""}
        <div class="stack">${SERVICES.map((s) => `<div class="card" style="padding:10px"><div class="row between"><strong>${esc(s.label)}</strong><span>${s.price ? money(s.price) : "Offert"}</span></div>
          <div class="muted">${esc(s.sub)}</div><div style="margin-top:6px">${btn("Commander", `A.mob.order('${s.id}')`, inStay() ? "sm" : "ghost sm")}</div></div>`).join("")}</div>
        ${mine.length ? `<h3>Mes demandes</h3>${mine.map((x) => `<div class="row between" style="margin-bottom:4px"><span>${esc(x.label)}</span>${badge(x.status === "terminee" ? "Terminée" : x.status === "encours" ? "En cours" : "Reçue", x.status === "terminee" ? "on" : "outline")}</div>`).join("")}` : ""}
        ${nav("c", CNAV, "services")}`
    },
    chat() {
      return `${back("c")}${h("Concierge")}<div class="stack">${M.chat.map(([w, t]) => `<div style="${w === "client" ? "text-align:right" : ""}"><span class="pill ${w === "ia" ? "outline" : w === "humain" ? "dark" : ""}" style="white-space:normal;text-align:left">${esc(t)}</span></div>`).join("")}</div>
        <div class="stack" style="margin-top:12px">${CHAT.map((c, i) => btn(c.q, `A.mob.ask(${i})`, "ghost sm")).join("")}</div>
        <p class="muted">Assistant IA simulé, réponses pré-écrites.</p>`
    },
    folio() {
      const r = res()
      if (!inStay()) return `${h("Ma facture")}<p class="muted">Le folio s'affiche en temps réel dès le check-in. Estimation : ${money(nights(r.from, r.to) * r.rate)} d'hébergement.</p>${nav("c", CNAV, "folio")}`
      const f = folio(r)
      return `${h("Ma facture")}${f.lines.map((l) => `<div class="row between" style="flex-wrap:nowrap;font-size:13px;margin-bottom:4px"><span>${esc(l.label)}</span><span class="num">${money(l.amount)}</span></div>`).join("")}
        <div class="row between" style="border-top:1px solid var(--line);margin-top:8px;padding-top:8px"><strong>Solde</strong><strong>${money(Math.max(0, f.balance))}</strong></div>
        <div class="stack" style="margin-top:12px">${f.balance > 0 ? btn("Payer par Mobile Money (simulé)", "A.mob.pay()", "accent") : badge("Soldé", "on")}
          ${r.to === today ? btn("Express check-out", "A.mob.express()", "sm") : `<div class="muted">Express check-out disponible le jour du départ (${fd(r.to)}).</div>`}</div>
        ${nav("c", CNAV, "folio")}`
    },
    account() {
      return `${back("c")}${h("Mon compte")}<div class="card" style="padding:12px"><div class="muted">Programme de fidélité (exemple)</div><div class="kpi">${M.loyalty.points.toLocaleString("fr-FR")} pts</div><div class="muted">Niveau ${esc(M.loyalty.level)} · 2 600 pts avant Platine</div></div>
        <h3>Consentements</h3>
        <label class="row" style="color:var(--ink)"><input type="checkbox" ${M.consents.marketing ? "checked" : ""} onchange="A.mob.consent('marketing',this.checked)"> Offres par e-mail et push</label>
        <label class="row" style="color:var(--ink)"><input type="checkbox" ${M.consents.profilage ? "checked" : ""} onchange="A.mob.consent('profilage',this.checked)"> Offres personnalisées (profilage)</label>
        <p class="muted">Connexion : e-mail ${esc(G(M.guest).email)} (connexion sociale simulée).</p>`
    },
  }
  const CNAV = [["home", "Accueil"], ["search", "Réserver"], ["key", "Clé"], ["services", "Services"], ["folio", "Facture"]]
  const SERVICES = [
    { id: "rs", label: "Room service — club sandwich", sub: "Livré en 25 min environ", price: 9000, kind: "room service" },
    { id: "spa", label: "Spa — massage 60 min", sub: "Prochain créneau : 17 h", price: 35000, kind: "spa" },
    { id: "hk", label: "Serviettes supplémentaires", sub: "Housekeeping", price: 0, kind: "housekeeping" },
    { id: "wake", label: "Réveil demain 6 h", sub: "Appel automatique", price: 0, kind: "réception" },
  ]
  const CHAT = [
    { q: "Horaires du petit-déjeuner ?", a: "Le petit-déjeuner est servi de 6 h 30 à 10 h 30 au restaurant, rez-de-chaussée. (Source : FAQ établissement)" },
    { q: "Un taxi pour l'aéroport demain ?", a: "Je peux demander un transfert à 15 000 FCFA. Confirmez-vous pour demain 10 h ? Je l'imputerai à votre séjour après votre accord." },
    { q: "Parler à un humain", a: "Je vous transfère à la réception." },
  ]

  // ---------- App personnel ----------
  const mineRooms = () => D.rooms.filter((r) => D.assignments[r.no] === M.staff && r.hk === "sale")
  const CHECK = ["Lit refait et linge changé", "Salle de bain désinfectée", "Minibar contrôlé", "Produits d'accueil réassortis"]
  const SNAV = [["tasks", "Tâches"], ["inspect", "Inspection"], ["report", "Signaler"], ["alerts", "Alertes"], ["clock", "Pointage"]]
  const S = {
    tasks() {
      const reqs = M.requests.filter((x) => x.kind === "housekeeping" && x.status !== "terminee")
      return `<div class="row between"><span class="muted">${esc(M.staff)}</span>${M.offline ? badge("Hors ligne", "dark") : badge("En ligne", "outline")}</div>${h("Mes tâches")}
        <div class="list">${mineRooms().map((r) => { const o = occupant(r.no)
          return `<button onclick="${go2("s", "task:" + r.no)}"><strong>Ch. ${esc(r.no)}</strong> ${o && G(o.guest).vip ? badge("VIP", "on") : ""}<div class="muted">${o ? "Recouche" : "Nettoyage départ"} · ${esc(T(r.type).label)}</div></button>` }).join("") || `<p class="muted">Aucune chambre sale attribuée.</p>`}
          ${reqs.map((x) => `<button onclick="A.mob.doneReq(${q(x.id)})"><strong>Demande ch. ${esc(x.room)}</strong> ${badge("Client", "outline")}<div>${esc(x.label)}</div>${x.tr ? `<div class="muted">${esc(x.tr)} (traduction IA simulée)</div>` : ""}<div class="muted">Toucher pour marquer livrée · ${esc(x.at)}</div></button>`).join("")}</div>
        <div style="margin-top:10px">${btn(M.offline ? "Revenir en ligne" : "Simuler la perte de réseau", "A.mob.toggleOffline()", "ghost sm")}${M.queue.length ? ` <span class="muted">${M.queue.length} action(s) en attente de synchronisation</span>` : ""}</div>
        ${nav("s", SNAV, "tasks")}`
    },
    task(no) {
      const r = D.rooms.find((x) => x.no === no), ck = M.check[no] || [], o = occupant(no)
      return `${back("s")}${h("Chambre " + no)}<div class="muted">${esc(T(r.type).label)} · ${o ? "occupée, recouche" : "départ, à blanc"} · statut : ${esc(HK[r.hk][0])}</div>
        ${o && G(o.guest).prefs.length ? `<p class="muted">Préférences client : ${esc(G(o.guest).prefs.join(", "))}</p>` : ""}
        <h3>Check-list</h3>${CHECK.map((c, i) => `<label class="row" style="color:var(--ink)"><input type="checkbox" ${ck[i] ? "checked" : ""} onchange="A.mob.tick(${q(no)},${i},this.checked)"> ${esc(c)}</label>`).join("")}
        <div class="row" style="margin-top:10px">${btn("Ajouter une photo (simulé)", `A.mob.photo(${q(no)})`, "ghost sm")}${M.photos?.[no] ? badge(M.photos[no] + " photo(s)", "outline") : ""}</div>
        <div style="margin-top:12px">${btn("Terminer : envoyer en inspection", `A.mob.finish(${q(no)})`, "accent")}</div>`
    },
    inspect() {
      const list = D.rooms.filter((r) => r.hk === "inspection")
      return `${h("Inspection")}<div class="muted">Vue gouvernante : valider les chambres nettoyées.</div>
        <div class="stack" style="margin-top:10px">${list.map((r) => `<div class="card" style="padding:10px"><div class="row between"><strong>Ch. ${esc(r.no)}</strong>${pill(HK, r.hk)}</div>
          <div class="row" style="margin-top:6px">${btn("Valider : propre", `A.mob.validate(${q(r.no)},true)`, "sm")}${btn("Refuser", `A.mob.validate(${q(r.no)},false)`, "ghost sm")}</div></div>`).join("") || `<p class="muted">Aucune chambre en attente d'inspection.</p>`}</div>
        ${nav("s", SNAV, "inspect")}`
    },
    report() {
      return `${h("Signaler un problème")}<div class="stack">
        ${field("mob-r-room", "Lieu", select("mob-r-room", [...D.rooms.map((r) => [r.no, "Chambre " + r.no]), ["Couloir", "Parties communes"]], "202"))}
        ${field("mob-r-cat", "Catégorie", select("mob-r-cat", ["Climatisation", "Plomberie", "Électricité", "Serrure", "Mobilier"], "Climatisation"))}
        ${field("mob-r-txt", "Description", input("mob-r-txt", "", `placeholder="Ex. bruit anormal"`))}
        <label class="row" style="color:var(--ink)"><input type="checkbox" id="mob-r-photo"> Photo jointe (simulé)</label>
        <label class="row" style="color:var(--ink)"><input type="checkbox" id="mob-r-urg"> Urgent</label>
        <div id="mob-r-err"></div>${btn("Envoyer à la maintenance", "A.mob.report()", "accent")}</div>
        ${M.reports.length ? `<h3>Mes signalements</h3>${M.reports.map((x) => `<div class="muted">${esc(x.id)} · ${esc(x.room)} · ${esc(x.cat)}${x.urgent ? " · urgent" : ""} · ${x.synced ? "transmis" : "en attente de réseau"}</div>`).join("")}` : ""}
        ${nav("s", SNAV, "report")}`
    },
    alerts() {
      const vip = arrivals().filter((r) => G(r.guest).vip && r.status === "confirmee")
      return `${h("Alertes")}<div class="stack">
        ${vip.map((r) => `<div class="card" style="padding:10px">${badge("VIP", "on")} <strong>Arrivée ${esc(G(r.guest).name)}</strong><div class="muted">${esc(T(r.type).label)}${r.request ? " · " + esc(r.request) : ""}</div></div>`).join("")}
        ${M.alerts.map((a) => `<div class="card" style="padding:10px">${badge(a.kind, a.kind === "Chambre prête" ? "on" : a.kind === "Urgent" || a.kind === "Sécurité" ? "dark" : "outline")} <span class="muted">${esc(a.at)}</span><div>${esc(a.text)}</div></div>`).join("")}</div>
        <p class="muted">Notifications push simulées.</p>${nav("s", SNAV, "alerts")}`
    },
    clock() {
      return `${h("Pointage et planning")}
        <div class="card" style="padding:12px">${M.clock ? `${badge("Présent", "on")} depuis ${esc(M.clock)}<div class="muted">Position : dans le périmètre de l'hôtel (géolocalisation simulée)</div><div style="margin-top:8px">${btn("Pointer la sortie", "A.mob.clockOut()", "ghost sm")}</div>`
          : `<div class="muted">Non pointé</div><div style="margin-top:8px">${btn("Pointer l'arrivée", "A.mob.clockIn()", "accent")}</div>`}</div>
        <h3>Mon planning</h3>${[["Jeu 26/11", "8 h – 15 h"], ["Ven 27/11", "8 h – 15 h"], ["Sam 28/11", "Repos"], ["Dim 29/11", "Repos"], ["Lun 30/11", "13 h – 20 h"]].map(([d, s]) => `<div class="row between" style="font-size:13px"><span>${d}</span><span>${s}</span></div>`).join("")}
        <h3>Congés</h3>${M.leaves.map((l) => `<div class="muted">${esc(l)} · en attente du responsable</div>`).join("")}
        <div style="margin-top:6px">${btn("Demander un congé le 14/12", "A.mob.leave()", "ghost sm")}</div>
        <p class="muted">Badge mobile du personnel : selon le fabricant de serrures (non supporté par la serrure simulée).</p>
        ${nav("s", SNAV, "clock")}`
    },
  }
  const clientScreen = () => (C[ui.mobC] || C.home)()
  const staffScreen = () => ui.mobS.startsWith("task:") ? S.task(ui.mobS.slice(5)) : (S[ui.mobS] || S.tasks)()

  // ---------- Écran back-office ----------
  const views = {
    mob(p) {
      const tab = p[0] || "apps"
      return pageHead("Applications mobiles", "Aperçu cliquable de l'app client et de l'app personnel, et de leurs effets dans l'hôtel. Clé BLE/NFC, push, paiement et géolocalisation simulés.")
        + subtabs("mob-apps", [["apps", "Aperçu des apps"], ["appareils", "Appareils et clés"], ["pilotage", "Indicateurs et marque"]], tab)
        + ({ apps, appareils, pilotage }[tab] || apps)()
    },
  }
  function apps() {
    const r = res()
    return `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:24px;align-items:start;justify-items:center">
        <div><div class="muted" style="text-align:center;margin-bottom:6px">App client · ${esc(G(M.guest).name)}</div>${phone(clientScreen(), M.brand.appName + " · client")}</div>
        <div><div class="muted" style="text-align:center;margin-bottom:6px">App personnel · ${esc(M.staff)}</div>${phone(staffScreen(), M.brand.appName + " · équipe")}</div>
        <div style="width:100%" class="stack">
          ${card("Côté réception", M.mci.status === "soumis" && !inStay()
            ? `<p style="margin:0">Check-in mobile reçu pour ${esc(r.id)} (arrivée ${esc(M.mci.arrival)}). Identité et signature fournies.</p><div id="mob-v-err"></div><div style="margin-top:10px">${btn("Valider le check-in et activer la clé", "A.mob.frontValidate()", "accent")}</div>`
            : `<p class="muted" style="margin:0">${inStay() ? `${esc(r.id)} en séjour, chambre ${esc(r.room)}, clé mobile active.` : "Aucun check-in mobile en attente. Faites le check-in dans l'app client."}</p>`)}
          ${card("Événements transmis", M.events.length ? M.events.slice(0, 10).map((e) => `<div style="font-size:13px;margin-bottom:6px"><code>${esc(e.name)}</code> <span class="muted">${esc(e.at)}</span><div>${esc(e.text)}</div></div>`).join("") : `<p class="muted" style="margin:0">Les actions faites dans les apps apparaissent ici.</p>`)}
          ${aiBox("Traduction instantanée", "Les messages entre clients et personnel sont traduits automatiquement : la demande en anglais de la chambre 302 s'affiche en français dans l'app personnel.")}
          <p class="muted">EF-MOB-002 à 010 · RG-MOB-01 à 03. L'app personnel fonctionne hors ligne : les actions sont synchronisées au retour du réseau.</p>
        </div>
      </div>`
  }
  function appareils() {
    return `<h2>Clés mobiles</h2>
      ${tbl(["Clé", "Titulaire", "Appareil", "Chambre", "Type", "Statut", ""], M.keys.map((k) => [esc(k.id), esc(k.holder), esc(k.device), esc(k.room), k.shared ? "Partagée" : "Principale",
        badge(k.status === "active" ? "Active" : k.status === "suspendue" ? "Suspendue" : "Révoquée", k.status === "active" ? "on" : "outline"),
        k.status === "active" ? btn("Révoquer", `A.mob.revoke(${q(k.id)})`, "ghost sm") : ""]), "Aucune clé mobile.")}
      <div class="row" style="margin-top:10px">${btn(`Simuler un changement d'appareil (${G(M.guest).name})`, "A.mob.changeDevice()", "ghost")}</div>
      <p class="muted">Clé liée à un appareil enregistré, stockée de façon sécurisée ; révocation automatique au départ. Détection root/jailbreak simulée.</p>
      <h2>Appareils enregistrés</h2>
      ${tbl(["Utilisateur", "Type", "Plateforme", "Enregistré le", "Push"], M.devices.map((d) => [esc(d.user), esc(d.kind), esc(d.platform), fd(d.registered), d.push ? badge("Activé", "on") : badge("Refusé", "outline")]))}`
  }
  function pilotage() {
    const appRev = M.appRevenue + M.requests.filter((x) => x.app).reduce((s, x) => s + (x.price || 0), 0)
    return `<div class="grid">
        ${kpi("Téléchargements", "1 240", "depuis le lancement (exemple)")}
        ${kpi("Utilisateurs actifs", "410", "30 derniers jours (exemple)")}
        ${kpi("Taux de check-in mobile", "34 %", "des arrivées du mois (exemple)")}
        ${kpi("Revenus via l'app", money(appRev), "mois, services commandés inclus")}
        ${kpi("Note des stores", "4,5 / 5", "moyenne iOS et Android (exemple)")}
      </div>
      <h2>Marque blanche</h2>
      <div class="card">${form([
        field("mob-b-name", "Nom de l'application", input("mob-b-name", M.brand.appName)),
        field("mob-b-wel", "Message d'accueil", input("mob-b-wel", M.brand.welcome), "full"),
        `<div class="full">${btn("Appliquer à l'app", "A.mob.brand()")}</div>`])}
        <p class="muted">Couleurs, logo et contenus par marque à partir d'un code unique (EF-MOB-012). La charte de la maquette reste celle du socle.</p></div>
      ${aiBox("Offres personnalisées dans l'app", `Next-best-offer : ${M.nbo ? `1 offre active pour ${G(M.guest).name} (transfert aéroport)` : "aucune offre en cours"}. Offres limitées au catalogue validé, uniquement avec le consentement de profilage.`)}`
  }

  // ---------- Actions ----------
  // Opérations de l'app personnel rejouables (file hors ligne sérialisable : nom + argument, relu dans D à l'exécution)
  const SYNC = {
    reqDone(id) { const x = M.requests.find((y) => y.id === id); if (!x) return; x.status = "terminee"; ev("hkm.request.completed", `Demande ch. ${x.room} livrée`) },
    roomDone(no) { D.rooms.find((r) => r.no === no).hk = "inspection"; ev("hkm.room.status-changed", `Ch. ${no} nettoyée, en attente d'inspection`) },
    report(id) { const x = M.reports.find((y) => y.id === id); if (!x) return; x.synced = true; ev("hkm.maintenance.reported", `${x.cat} — ${x.room} : ${x.txt}${x.urgent ? " (urgent)" : ""}`); if (x.urgent) M.alerts.unshift({ at: new Date().toTimeString().slice(0, 5), text: `Ordre urgent : ${x.cat} ${x.room}`, kind: "Urgent" }) },
  }
  const offlineGuard = (op, arg, label) => { if (M.offline) { M.queue.push({ op, arg, label }); toast(`Hors ligne : « ${label} » sera synchronisé`); render(); return true } SYNC[op](arg); return false }
  const actions = {
    nav(side, screen) { if (side === "c") ui.mobC = screen; else ui.mobS = screen; render() },
    book(type) {
      const from = val("mob-from"), to = val("mob-to")
      if (from < today) return toast("La date d'arrivée est passée")
      const id = "R-" + ui.resSeq++
      D.reservations.push({ id, guest: M.guest, type, from, to, rate: T(type).rate, guarantee: "Carte bancaire", status: "confirmee", request: "Réservée via l'app" })
      M.myRes.unshift(id)
      ev("res.reservation.created", `${id} créée depuis l'app (${T(type).label}, ${fd(from)} → ${fd(to)})`)
      toast(`Réservation ${id} confirmée`); render()
    },
    cancel(id) { R(id).status = "annulee"; ev("res.reservation.cancelled", `${id} annulée depuis l'app`); toast(`${id} annulée`); render() },
    submitCheckin() {
      if (!($("#mob-id").checked && $("#mob-sign").checked && $("#mob-guar").checked)) return ($("#mob-ci-err").innerHTML = `<p class="err">Complétez l'identité, la signature et la garantie.</p>`)
      M.mci = { status: "soumis", arrival: val("mob-arr") }
      ev("mob.check-in.submitted", `${M.res} : check-in mobile, arrivée prévue ${M.mci.arrival}`)
      toast("Check-in envoyé à la réception"); render()
    },
    frontValidate() {
      const r = res()
      const room = D.rooms.find((x) => x.type === r.type && x.hk === "propre" && !occupant(x.no))
      if (!room) return ($("#mob-v-err").innerHTML = `<p class="err">Aucune chambre ${esc(T(r.type).label)} propre et libre : validation impossible pour l'instant.</p>`)
      Object.assign(r, { status: "arrivee", room: room.no, key: "active" })
      D.extras[r.id] = D.extras[r.id] || []
      M.keys.unshift({ id: uid("MK"), holder: G(M.guest).name, device: "iOS 18 (exemple)", room: room.no, status: "active", shared: false })
      M.mci.status = "valide"
      ev("acc.credential.issued", `Clé mobile émise pour la chambre ${room.no}`)
      toast(`Check-in validé, chambre ${room.no}, clé mobile activée (push simulé)`); render()
    },
    open(room) { const s = `${new Date().toTimeString().slice(0, 5)} · porte ${room} ouverte en 0,8 s (simulé)`; M.doorLog.unshift(s); ev("acc.door.opened", `Ouverture chambre ${room} par clé mobile`); render() },
    share() {
      const n = val("mob-share")
      if (!n) return toast("Indiquez le nom de l'accompagnant")
      M.keys.push({ id: uid("MK"), holder: n, device: "Invitation par lien (simulé)", room: res().room, status: "active", shared: true })
      ev("mob.key.shared", `Clé de la chambre ${res().room} partagée avec ${n}`)
      toast(`Clé partagée avec ${n}`); render()
    },
    revoke(id) { const k = M.keys.find((x) => x.id === id); k.status = "revoquee"; ev("acc.credential.revoked", `Clé ${id} révoquée (${k.holder})`); toast(`Clé ${id} révoquée`); render() },
    changeDevice() {
      M.deviceChanged = true
      M.keys.filter((k) => k.holder === G(M.guest).name && !k.shared && k.status === "active").forEach((k) => (k.status = "suspendue"))
      ui.mobC = "key"; toast("Nouvel appareil : clé suspendue jusqu'à ré-authentification"); go("mob-apps/apps")
    },
    reauth() { M.deviceChanged = false; M.keys.filter((k) => k.status === "suspendue").forEach((k) => (k.status = "active")); toast("Ré-authentification réussie, clé réactivée"); render() },
    order(id) {
      if (!inStay()) return toast("Disponible après votre check-in")
      const s = SERVICES.find((x) => x.id === id), r = res()
      M.requests.push({ id: uid("DS"), kind: s.kind, label: s.label, room: r.room, status: "nouvelle", at: new Date().toTimeString().slice(0, 5), app: true, price: s.price })
      if (s.price) (D.extras[r.id] = D.extras[r.id] || []).push({ label: s.label + " (app)", amount: s.price })
      ev(s.kind === "housekeeping" ? "hkm.request.created" : "mob.service.ordered", `${s.label} — ch. ${r.room}${s.price ? ", imputé au folio" : ""}`)
      toast(s.price ? `Commandé, ${money(s.price)} ajouté à votre facture` : "Demande envoyée"); render()
    },
    ask(i) {
      const c = CHAT[i]
      M.chat.push(["client", c.q], [i === 2 ? "humain" : "ia", i === 2 ? "Réception : bonjour, je suis là. Que puis-je faire pour vous ?" : c.a])
      if (i === 2) ev("aip.conversation.escalated", "Conversation de l'app transférée à la réception")
      render()
    },
    pay() { const r = res(); D.payments[r.id] = folio(r).total; ev("fol.payment.received", `${r.id} : paiement Mobile Money (simulé)`); toast("Paiement accepté (Mobile Money simulé)"); render() },
    express() { toast("Express check-out : facture envoyée par e-mail, clé révoquée à 12 h (simulé)") },
    nboAccept() {
      const r = res()
      M.nbo = false
      if (r) (D.extras[r.id] = D.extras[r.id] || []).push({ label: "Transfert aéroport (offre app)", amount: 15000 })
      M.requests.push({ id: uid("DS"), kind: "conciergerie", label: "Transfert aéroport", room: r?.room || "—", status: "nouvelle", at: new Date().toTimeString().slice(0, 5), app: true, price: 15000 })
      ev("crm.offer.accepted", "Offre personnalisée acceptée : transfert aéroport")
      toast("Transfert ajouté à votre séjour"); render()
    },
    nboDecline() { M.nbo = false; toast("Offre masquée"); render() },
    consent(k, v) { M.consents[k] = v; toast(v ? "Consentement enregistré" : "Consentement retiré"); render() },
    toggleOffline() {
      M.offline = !M.offline
      if (!M.offline) { const n = M.queue.length; M.queue.forEach((x) => SYNC[x.op]?.(x.arg)); M.queue.splice(0); toast(n ? `${n} action(s) synchronisée(s)` : "De retour en ligne") }
      else toast("Mode hors ligne : les tâches restent consultables")
      render()
    },
    doneReq(id) {
      if (offlineGuard("reqDone", id, "demande livrée")) return
      toast("Demande marquée livrée"); render()
    },
    tick(no, i, v) { (M.check[no] = M.check[no] || [])[i] = v },
    photo(no) { M.photos = M.photos || {}; M.photos[no] = (M.photos[no] || 0) + 1; render() },
    finish(no) {
      const ck = M.check[no] || []
      if (CHECK.some((_, i) => !ck[i])) return toast("Complétez la check-list avant de terminer")
      ui.mobS = "tasks"
      if (offlineGuard("roomDone", no, `ch. ${no} terminée`)) return
      toast(`Chambre ${no} envoyée en inspection`); render()
    },
    validate(no, ok) {
      const r = D.rooms.find((x) => x.no === no)
      r.hk = ok ? "propre" : "sale"
      if (ok) { M.alerts.unshift({ at: new Date().toTimeString().slice(0, 5), text: `Chambre ${no} prête`, kind: "Chambre prête" }); ev("hkm.room.status-changed", `Ch. ${no} propre : notification « chambre prête »`) }
      else delete M.check[no]
      toast(ok ? `Chambre ${no} propre` : `Chambre ${no} renvoyée en nettoyage`); render()
    },
    report() {
      const txt = val("mob-r-txt")
      if (!txt) return ($("#mob-r-err").innerHTML = `<p class="err">Décrivez le problème.</p>`)
      const x = { id: uid("SG"), room: val("mob-r-room"), cat: val("mob-r-cat"), txt, urgent: $("#mob-r-urg").checked, photo: $("#mob-r-photo").checked, synced: false }
      M.reports.unshift(x)
      if (offlineGuard("report", x.id, "signalement")) return
      toast("Signalement transmis à la maintenance"); render()
    },
    clockIn() { M.clock = new Date().toTimeString().slice(0, 5); ev("hrm.clock.in", `${M.staff} pointé (géolocalisation simulée)`); toast("Arrivée pointée"); render() },
    clockOut() { M.clock = null; ev("hrm.clock.out", `${M.staff} sortie`); toast("Sortie pointée"); render() },
    leave() { M.leaves.push("14/12"); toast("Demande de congé envoyée"); render() },
    brand() { M.brand.appName = val("mob-b-name") || M.brand.appName; M.brand.welcome = val("mob-b-wel"); toast("Marque appliquée aux deux apps"); go("mob-apps/apps") },
  }

  HMS.module({
    code: "mob", group: "Plateforme", title: "Applications mobiles", phase: "—", spec: "§21 MOB",
    screens: [{ id: "mob-apps", label: "Applications mobiles", view: views.mob }],
    actions,
  })
})()
