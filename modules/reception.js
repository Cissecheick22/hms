// Écrans du cadrage initial : tableau de bord de la réception, réservations, check-in avec clé,
// check-out et facture, housekeeping (statut des chambres), fiche client.
// Spec : §8 Réservations, §9 Réception, §10 Contrôle d'accès, §11 Housekeeping, §12 Facturation, §7 CRM.
;(() => {
  const views = {
    // #1 Tableau de bord de la réception
    accueil() {
      const arr = arrivals(), pend = arr.filter((r) => r.status === "confirmee"), dep = departures(), ih = inHouse()
      const sellable = D.rooms.filter((r) => r.hk !== "hs").length
      const free = D.rooms.filter((r) => r.hk !== "hs" && !occupant(r.no)).length
      const special = [...ih, ...pend].filter((r) => G(r.guest).vip || r.request)
      return `<h1>Réception — ${esc(fdLong(today))}</h1><p class="lead">${esc(D.hotel)} · vue du jour (exemple).</p>
        <div class="grid">
          ${kpi("Arrivées", arr.length, `${pend.length} à enregistrer`)}
          ${kpi("Départs", dep.length, `${dep.filter((r) => r.status === "arrivee").length} à facturer`)}
          ${kpi("Clients présents", ih.length, `occupation ${Math.round((ih.length / sellable) * 100)} %`)}
          ${kpi("Chambres prêtes", readyRooms().length, `sur ${free} libres`)}
        </div>
        <div class="cols">
          <section><h2>Arrivées du jour</h2>${tbl(["Client", "Type", "#Nuits", ""], arr.map((r) => [
            guestLink(r.guest) + vip(G(r.guest)), esc(T(r.type).label), nights(r.from, r.to),
            r.status === "arrivee" ? `<span class="pill on">Ch. ${esc(r.room)}</span>` : `<button class="btn sm" onclick="go('checkin/${esc(r.id)}')">Check-in</button>`,
          ]), "Aucune arrivée prévue.")}</section>
          <section><h2>Départs du jour</h2>${tbl(["Client", "Chambre", "#Solde", ""], dep.map((r) => [
            guestLink(r.guest) + vip(G(r.guest)), esc(r.room), r.status === "partie" ? "—" : money(folio(r).balance),
            r.status === "partie" ? pill(STATUS, "partie") : `<button class="btn sm" onclick="go('checkout/${esc(r.id)}')">Check-out</button>`,
          ]), "Aucun départ prévu.")}</section>
        </div>
        <h2>VIP et demandes spéciales</h2>
        ${special.length ? `<div class="grid">${special.map((r) => `<div class="card">
            <div class="row between"><strong>${guestLink(r.guest)}</strong>${vip(G(r.guest))}</div>
            <div class="muted">${r.status === "arrivee" ? `En séjour · ch. ${esc(r.room)}` : `Arrive aujourd'hui · ${esc(T(r.type).label)}`}</div>
            ${r.request ? `<p style="margin:8px 0 0">${esc(r.request)}</p>` : ""}
            ${G(r.guest).prefs.length ? `<p class="muted" style="margin:6px 0 0">Préférences : ${esc(G(r.guest).prefs.join(", "))}</p>` : ""}
          </div>`).join("")}</div>` : `<p class="muted">Rien de particulier aujourd'hui.</p>`}`
    },

    // #2 Réservations
    reservations(p) {
      const editing = p[0] === "new" ? {} : p[0] === "edit" ? R(p[1]) : null
      const filters = { actives: ["confirmee", "arrivee"], toutes: Object.keys(STATUS), annulee: ["annulee"] }
      const list = D.reservations.filter((r) => filters[ui.resFilter].includes(r.status)).sort((a, b) => a.from.localeCompare(b.from))
      const days = Array.from({ length: 14 }, (_, i) => addDays(today, i))
      return `<div class="row between"><h1>Réservations</h1>${editing ? "" : `<button class="btn" onclick="go('reservations/new')">Nouvelle réservation</button>`}</div>
        <p class="lead">Créer, modifier ou annuler une réservation. La saisie est bloquée si le type de chambre est complet sur une des nuits.</p>
        ${editing ? resForm(editing) : ""}
        <div class="chips">${Object.entries({ actives: "À venir et en séjour", toutes: "Toutes", annulee: "Annulées" }).map(([k, l]) =>
          `<button aria-pressed="${ui.resFilter === k}" onclick="ui.resFilter='${k}';render()">${l}</button>`).join("")}</div>
        ${tbl(["Réf.", "Client", "Arrivée", "Départ", "#Nuits", "Type", "#Tarif/nuit", "Garantie", "Statut", ""], list.map((r) => [
          esc(r.id), guestLink(r.guest) + vip(G(r.guest)), fd(r.from), fd(r.to), nights(r.from, r.to), esc(T(r.type).label), money(r.rate), esc(r.guarantee), pill(STATUS, r.status),
          ["confirmee", "arrivee"].includes(r.status) ? `<span class="row" style="flex-wrap:nowrap">
            <button class="btn ghost sm" onclick="go('reservations/edit/${esc(r.id)}')">Modifier</button>
            ${r.status === "confirmee" ? `<button class="btn ghost sm" onclick="A.fof.cancelRes(${q(r.id)})">Annuler</button>` : ""}</span>` : "",
        ]), "Aucune réservation.")}
        <h2>Planning des disponibilités — 14 jours</h2>
        <p class="muted">Chambres libres par type et par nuit (hors chambres hors commande).</p>
        <div class="tablewrap"><table><thead><tr><th>Type</th>${days.map((d) => `<th class="num">${esc(wd(d))}<br>${fd(d)}</th>`).join("")}</tr></thead>
          <tbody>${D.roomTypes.map((t) => `<tr><td>${esc(t.label)}</td>${days.map((d) => { const n = available(t.code, d); return `<td class="num ${n <= 0 ? "cell0" : ""}">${n <= 0 ? "Complet" : n}</td>` }).join("")}</tr>`).join("")}</tbody></table></div>`
    },

    // #3 Check-in avec émission de clé
    checkin(p) {
      const pend = D.reservations.filter((r) => r.from === today && r.status === "confirmee")
      const r = p[0] ? R(p[0]) : pend[0]
      return `<h1>Check-in</h1><p class="lead">Attribuer une chambre, vérifier l'identité, encoder la carte : une seule action (encodeur simulé).</p>
        <div class="split">
          <div><h3>Arrivées à enregistrer</h3><div class="list">${pend.map((x) => `<button aria-current="${x === r}" onclick="go('checkin/${esc(x.id)}')">
            <strong>${esc(G(x.guest).name)}</strong>${vip(G(x.guest))}<div class="muted">${esc(x.id)} · ${esc(T(x.type).label)} · ${nights(x.from, x.to)} nuit(s)</div></button>`).join("") || `<p class="muted">Toutes les arrivées du jour sont enregistrées.</p>`}</div></div>
          <div>${r ? checkinPanel(r) : ""}</div>
        </div>`
    },

    // #4 Check-out et facture
    checkout(p) {
      const list = inHouse().sort((a, b) => a.to.localeCompare(b.to))
      const r = p[0] ? R(p[0]) : list[0]
      return `<h1>Check-out</h1><p class="lead">Contrôler le folio, encaisser, éditer la facture et révoquer la clé du client.</p>
        <div class="split">
          <div><h3>Clients en séjour</h3><div class="list">${list.map((x) => `<button aria-current="${x === r}" onclick="go('checkout/${esc(x.id)}')">
            <strong>Ch. ${esc(x.room)} · ${esc(G(x.guest).name)}</strong>
            <div class="muted">${x.to === today ? "Départ aujourd'hui" : `Départ prévu le ${fd(x.to)}`} · solde ${money(folio(x).balance)}</div></button>`).join("") || `<p class="muted">Aucun client en séjour.</p>`}</div></div>
          <div>${r && r.status === "arrivee" ? checkoutPanel(r) : ""}</div>
        </div>`
    },
    facture(p) {
      const r = R(p[0]), f = folio(r), g = G(r.guest)
      return `<div class="row between noprint"><h1>Facture ${esc(r.invoice)}</h1>
          <span class="row"><button class="btn ghost" onclick="go('checkout')">Check-out suivant</button><button class="btn" onclick="print()">Imprimer</button></span></div>
        <p class="lead noprint">Séjour clôturé. <span class="pill on">Clé révoquée</span> La carte de la chambre ${esc(r.room)} n'ouvre plus la porte (simulation). Chambre passée en « sale ».</p>
        <div class="card invoice">
          <div class="row between"><div><div class="big">${esc(D.hotel)}</div><div class="muted">Facture n° ${esc(r.invoice)} · ${fd(today)}/${today.slice(0, 4)} · document d'exemple</div></div>
            <div style="text-align:right"><strong>${esc(g.name)}</strong><div class="muted">${esc(g.email)}</div></div></div>
          <p class="muted">Réservation ${esc(r.id)} · chambre ${esc(r.room)} · du ${fd(r.from)} au ${fd(r.to)}</p>
          ${tbl(["Désignation", "#Montant"], f.lines.map((l) => [esc(l.label), money(l.amount)]), "", `<tfoot><tr><td>Total TTC</td><td class="num">${money(f.total)}</td></tr>
            <tr><td class="muted" style="font-weight:400">Réglé (${esc(r.payMode)})</td><td class="num" style="font-weight:400">${money(f.paid)}</td></tr></tfoot>`)}
        </div>`
    },

    // #5 Statut des chambres (housekeeping)
    chambres() {
      const counts = Object.fromEntries(Object.keys(HK).map((k) => [k, D.rooms.filter((r) => r.hk === k).length]))
      const rooms = D.rooms.filter((r) => ui.hkFilter === "toutes" || r.hk === ui.hkFilter)
      return `<div class="row between"><h1>Chambres</h1><button class="btn" onclick="A.fof.autoAssign()">Répartir les chambres sales</button></div>
        <p class="lead">État de chaque chambre et répartition des tâches entre les femmes de chambre.</p>
        <div class="grid">${D.housekeepers.map((h) => { const nos = D.rooms.filter((r) => D.assignments[r.no] === h).map((r) => r.no)
          return `<div class="card"><div class="muted">${esc(h)}</div><div class="kpi">${nos.length}</div><div class="muted">${nos.length ? "Chambres " + esc(nos.join(", ")) : "Aucune chambre attribuée"}</div></div>` }).join("")}</div>
        <h2>État des chambres</h2>
        <div class="chips"><button aria-pressed="${ui.hkFilter === "toutes"}" onclick="ui.hkFilter='toutes';render()">Toutes (${D.rooms.length})</button>
          ${Object.entries(HK).map(([k, [l]]) => `<button aria-pressed="${ui.hkFilter === k}" onclick="ui.hkFilter='${k}';render()">${l} (${counts[k]})</button>`).join("")}</div>
        <div class="grid">${rooms.map((r) => { const o = occupant(r.no)
          return `<div class="card">
            <div class="row between"><span class="roomno">${esc(r.no)}</span>${pill(HK, r.hk)}</div>
            <div class="muted">${esc(T(r.type).label)} · étage ${r.floor}</div>
            <div style="margin:6px 0 10px;font-size:14px">${o ? `Occupée · ${o.to === today ? "<strong>départ aujourd'hui</strong>" : "départ " + fd(o.to)}` : "Libre"}${r.note ? `<div class="muted">${esc(r.note)}</div>` : ""}</div>
            <label for="hk-${esc(r.no)}">Statut</label>
            <select id="hk-${esc(r.no)}" onchange="A.fof.setHk(${q(r.no)}, this.value)">${Object.entries(HK).map(([k, [l]]) => `<option value="${k}" ${r.hk === k ? "selected" : ""}>${l}</option>`).join("")}</select>
            <label for="as-${esc(r.no)}" style="margin-top:8px">Attribuée à</label>
            <select id="as-${esc(r.no)}" onchange="A.fof.assign(${q(r.no)}, this.value)"><option value="">— personne —</option>
              ${D.housekeepers.map((h) => `<option ${D.assignments[r.no] === h ? "selected" : ""}>${esc(h)}</option>`).join("")}</select>
          </div>` }).join("") || `<p class="muted">Aucune chambre dans cet état.</p>`}</div>`
    },

    // #6 Fiche client
    clients(p) {
      const g = G(p[0]) || D.guests[0]
      const stays = D.reservations.filter((r) => r.guest === g.id).sort((a, b) => b.from.localeCompare(a.from))
      const done = stays.filter((r) => r.status === "partie")
      return `<h1>Clients</h1><p class="lead">Coordonnées, historique des séjours et préférences.</p>
        <div class="split">
          <div><input placeholder="Rechercher un client" aria-label="Rechercher un client" oninput="A.fof.filterGuests(this.value)" style="margin-bottom:10px">
            <div class="list" id="glist">${D.guests.map((x) => `<button data-name="${esc(x.name.toLowerCase())}" aria-current="${x === g}" onclick="go('clients/${esc(x.id)}')">
              <strong>${esc(x.name)}</strong>${vip(x)}<div class="muted">${esc(x.phone)}</div></button>`).join("")}</div></div>
          <div class="card">
            <div class="row between"><span class="big">${esc(g.name)}</span>${vip(g)}</div>
            <div class="grid" style="margin:14px 0">${kpi("Séjours effectués", done.length, "historique")}${kpi("Nuitées", done.reduce((s, r) => s + nights(r.from, r.to), 0), "séjours effectués")}${kpi("Dépense hébergement", money(done.reduce((s, r) => s + nights(r.from, r.to) * r.rate, 0)), "exemple")}</div>
            <h3>Coordonnées</h3>
            <div class="form">
              <div><label for="c-name">Nom</label><input id="c-name" value="${esc(g.name)}"></div>
              <div><label for="c-phone">Téléphone</label><input id="c-phone" value="${esc(g.phone)}"></div>
              <div><label for="c-email">E-mail</label><input id="c-email" type="email" value="${esc(g.email)}"></div>
              <div><label for="c-nat">Nationalité</label><input id="c-nat" value="${esc(g.nationality)}"></div>
              <div><label>Pièce d'identité</label><input value="${esc(g.idDoc)}" disabled></div>
              <div style="align-self:end"><label class="row" style="color:var(--ink)"><input type="checkbox" id="c-vip" ${g.vip ? "checked" : ""}> Client VIP</label></div>
            </div>
            <h3>Préférences</h3>
            <div class="tags">${g.prefs.map((pr, i) => `<span class="pill">${esc(pr)}<button aria-label="Retirer" onclick="A.fof.delPref(${q(g.id)}, ${i})">×</button></span>`).join("") || `<span class="muted">Aucune préférence notée.</span>`}</div>
            <div class="row" style="margin-top:10px;flex-wrap:nowrap"><input id="c-pref" placeholder="Ajouter une préférence (ex. étage élevé)" onkeydown="if(event.key==='Enter')A.fof.addPref(${q(g.id)})"><button class="btn ghost" onclick="A.fof.addPref(${q(g.id)})">Ajouter</button></div>
            <div class="row" style="margin-top:16px"><button class="btn" onclick="A.fof.saveGuest(${q(g.id)})">Enregistrer</button><button class="btn ghost" onclick="go('reservations/new');setTimeout(()=>{$('#f-guest').value=${q(g.id)}})">Nouvelle réservation</button></div>
            <h3>Historique des séjours</h3>
            ${tbl(["Réf.", "Dates", "Type", "Chambre", "#Hébergement", "Statut"], stays.map((r) => [esc(r.id), `${fd(r.from)}/${r.from.slice(2, 4)} → ${fd(r.to)}`, esc(T(r.type).label), esc(r.room || "—"), money(nights(r.from, r.to) * r.rate), pill(STATUS, r.status)]), "Aucun séjour.")}
          </div>
        </div>`
    },
  }

  function resForm(r) {
    const isNew = !r.id, locked = r.status === "arrivee"
    const t = r.type || "STD"
    return `<div class="card" style="margin-bottom:20px"><h2 style="margin-top:0">${isNew ? "Nouvelle réservation" : `Modifier ${esc(r.id)}`}</h2>
      <div class="form">
        <div><label for="f-guest">Client</label><select id="f-guest">${D.guests.map((g) => `<option value="${esc(g.id)}" ${r.guest === g.id ? "selected" : ""}>${esc(g.name)}</option>`).join("")}</select></div>
        ${isNew ? `<div><label for="f-newname">ou nouveau client (nom)</label><input id="f-newname" placeholder="Laisser vide si client existant"></div>` : ""}
        <div><label for="f-from">Arrivée</label><input id="f-from" type="date" value="${esc(r.from || today)}" ${locked ? "disabled" : ""}></div>
        <div><label for="f-to">Départ</label><input id="f-to" type="date" value="${esc(r.to || addDays(today, 1))}"></div>
        <div><label for="f-type">Type de chambre</label><select id="f-type" ${locked ? "disabled" : ""} onchange="$('#f-rate').value=D.roomTypes.find(x=>x.code===this.value).rate">${D.roomTypes.map((x) => `<option value="${x.code}" ${t === x.code ? "selected" : ""}>${esc(x.label)} — ${money(x.rate)}</option>`).join("")}</select></div>
        <div><label for="f-rate">Tarif par nuit (${D.currency})</label><input id="f-rate" type="number" min="0" step="500" value="${r.rate ?? T(t).rate}"></div>
        <div><label for="f-guar">Garantie</label><select id="f-guar">${["Carte bancaire", "Acompte", "Aucune"].map((x) => `<option ${r.guarantee === x ? "selected" : ""}>${x}</option>`).join("")}</select></div>
        <div class="full"><label for="f-req">Demande spéciale</label><input id="f-req" value="${esc(r.request || "")}" placeholder="Ex. arrivée tardive, lit bébé…"></div>
        <div class="full" id="f-err"></div>
        <div class="full row"><button class="btn" onclick="A.fof.saveRes(${isNew ? "null" : q(r.id)})">${isNew ? "Créer la réservation" : "Enregistrer"}</button><button class="btn ghost" onclick="go('reservations')">Fermer</button></div>
      </div></div>`
  }

  function checkinPanel(r) {
    const g = G(r.guest)
    if (ui.done && ui.done.id === r.id) return `<div class="card"><span class="pill on">Clé encodée</span>
      <div class="big" style="margin:10px 0 4px">Chambre ${esc(r.room)} — ${esc(g.name)}</div>
      <p class="muted">Carte ${esc(ui.done.card)} valable jusqu'au ${fd(r.to)} à 12 h (simulation). Séjour ouvert, folio créé.</p>
      <div class="row"><button class="btn" onclick="ui.done=null;go('checkin')">Arrivée suivante</button><button class="btn ghost" onclick="go('accueil')">Tableau de bord</button></div></div>`
    if (r.status !== "confirmee") return `<div class="card"><p>${esc(r.id)} n'est pas une arrivée à enregistrer (${esc(STATUS[r.status][0])}).</p></div>`
    const candidates = D.rooms.filter((x) => x.type === r.type && !occupant(x.no))
    const enc = ui.encoding === r.id
    return `<div class="card">
      <div class="row between"><span class="big">${esc(g.name)}</span>${vip(g)}</div>
      <div class="muted">${esc(r.id)} · ${esc(T(r.type).label)} · du ${fd(r.from)} au ${fd(r.to)} · ${nights(r.from, r.to)} nuit(s) · ${money(r.rate)}/nuit · garantie : ${esc(r.guarantee)}</div>
      ${r.request ? `<p style="margin:8px 0 0"><strong>Demande :</strong> ${esc(r.request)}</p>` : ""}
      ${g.prefs.length ? `<p class="muted" style="margin:4px 0 0">Préférences : ${esc(g.prefs.join(", "))}</p>` : ""}
      <div class="step"><b class="n">1</b><div><strong>Chambre</strong><p class="muted" style="margin:2px 0 8px">Seules les chambres propres et libres peuvent être attribuées.</p>
        <div class="rooms">${candidates.map((x) => `<label class="${x.hk !== "propre" ? "dis" : ""}"><input type="radio" name="room" value="${esc(x.no)}" ${x.hk !== "propre" || enc ? "disabled" : ""} onchange="A.fof.ckReady()">
          <span><strong>${esc(x.no)}</strong><br>${pill(HK, x.hk)}</span></label>`).join("") || `<p class="muted">Aucune chambre libre de ce type.</p>`}</div></div></div>
      <div class="step"><b class="n">2</b><div><strong>Identité</strong><p class="muted" style="margin:2px 0 8px">Pièce enregistrée : ${esc(g.idDoc)} · ${esc(g.nationality)}</p>
        <label class="row" style="color:var(--ink)"><input type="checkbox" id="id-ok" onchange="A.fof.ckReady()" ${enc ? "disabled checked" : ""}> Pièce d'identité présentée et conforme</label></div></div>
      <div class="step"><b class="n">3</b><div><strong>Clé d'accès</strong><p class="muted" style="margin:2px 0 8px">Posez une carte vierge sur l'encodeur puis validez.</p>
        ${enc ? `<div>Encodage de la carte en cours…</div><div class="bar"><i></i></div>` : `<button class="btn accent" id="enc" disabled onclick="A.fof.encode(${q(r.id)})">Attribuer la chambre et encoder la clé</button>`}</div></div>
    </div>`
  }

  function checkoutPanel(r) {
    const g = G(r.guest), early = r.to > today
    // départ anticipé : le folio est calculé sur les nuits réellement passées
    const f = folio(early ? { ...r, to: nights(r.from, today) > 0 ? today : addDays(r.from, 1) } : r)
    return `<div class="card">
      <div class="row between"><span class="big">Ch. ${esc(r.room)} — ${esc(g.name)}</span>${vip(g)}</div>
      <div class="muted">${esc(r.id)} · du ${fd(r.from)} au ${fd(r.to)} · clé active</div>
      ${early ? `<p class="err">Départ anticipé : le séjour sera écourté au ${fd(today)} et les nuits restantes ne seront pas facturées.</p>` : ""}
      <h3>Folio</h3>
      ${tbl(["Désignation", "#Montant"], f.lines.map((l) => [esc(l.label), money(l.amount)]))}
      <div class="row" style="margin-top:10px;flex-wrap:nowrap"><input id="x-label" placeholder="Prestation (ex. minibar)"><input id="x-amount" type="number" min="0" step="500" placeholder="Montant" style="max-width:140px"><button class="btn ghost" onclick="A.fof.addExtra(${q(r.id)})">Ajouter</button></div>
      <table style="margin-top:14px"><tbody><tr><td>Total</td><td class="num">${money(f.total)}</td></tr><tr><td>Déjà réglé</td><td class="num">${money(f.paid)}</td></tr>
          <tr><td><strong>Reste à encaisser</strong></td><td class="num"><strong>${money(Math.max(0, f.balance))}</strong></td></tr></tbody></table>
        <div class="form" style="margin-top:14px"><div><label for="pay">Mode de paiement</label><select id="pay">${["Espèces", "Carte bancaire", "Mobile Money", "Virement"].map((m) => `<option>${m}</option>`).join("")}</select></div>
          <div style="align-self:end"><button class="btn accent" style="width:100%" onclick="A.fof.checkout(${q(r.id)})">Encaisser ${money(Math.max(0, f.balance))}, facturer et révoquer la clé</button></div></div>
    </div>`
  }

  // ---------- Actions ----------
  const actions = {
    saveRes(id) {
      const v = (s) => $(s)?.value.trim()
      const err = (m) => ($("#f-err").innerHTML = `<div class="err">${esc(m)}</div>`)
      const r = id ? R(id) : null
      const from = r && r.status === "arrivee" ? r.from : v("#f-from"), to = v("#f-to"), type = r && r.status === "arrivee" ? r.type : v("#f-type")
      const rate = Number(v("#f-rate"))
      if (!from || !to) return err("Indiquez les dates d'arrivée et de départ.")
      if (to <= from) return err("La date de départ doit être après la date d'arrivée.")
      if (!r && from < today) return err("La date d'arrivée ne peut pas être dans le passé.")
      if (!(rate > 0)) return err("Indiquez un tarif par nuit.")
      for (let d = from; d < to; d = addDays(d, 1))
        if (available(type, d, id) < 1) return err(`Aucune chambre ${T(type).label} disponible la nuit du ${fd(d)} : la réservation créerait une surréservation. Changez les dates ou le type.`)
      let guest = v("#f-guest")
      const newName = v("#f-newname")
      if (newName) {
        guest = "G" + (D.guests.length + 1)
        D.guests.push({ id: guest, name: newName, phone: "", email: "", nationality: "", idDoc: "À vérifier au check-in", vip: false, prefs: [] })
      }
      const fields = { guest, from, to, type, rate, guarantee: v("#f-guar"), request: v("#f-req") }
      if (r) Object.assign(r, fields)
      else D.reservations.push({ id: "R-" + ui.resSeq++, status: "confirmee", ...fields })
      toast(r ? `Réservation ${r.id} modifiée` : "Réservation créée")
      go("reservations")
    },
    cancelRes(id) {
      if (!confirm(`Annuler la réservation ${id} ?`)) return
      R(id).status = "annulee"
      toast(`Réservation ${id} annulée`)
      render()
    },
    ckReady() {
      const b = $("#enc")
      if (b) b.disabled = !(document.querySelector("input[name=room]:checked") && $("#id-ok").checked)
    },
    encode(id) {
      const room = document.querySelector("input[name=room]:checked").value
      ui.encoding = id
      render()
      document.querySelectorAll(`input[name=room][value="${room}"]`).forEach((i) => (i.checked = true))
      setTimeout(() => {
        Object.assign(R(id), { status: "arrivee", room, key: "active" })
        D.extras[id] = D.extras[id] || []
        ui.encoding = null
        ui.done = { id, card: "K-" + String(Math.floor(Math.random() * 9000) + 1000) }
        toast(`Check-in terminé — chambre ${room}`)
        render()
      }, 1400)
    },
    addExtra(id) {
      const label = $("#x-label").value.trim(), amount = Number($("#x-amount").value)
      if (!label || !(amount > 0)) return toast("Indiquez la prestation et son montant")
      ;(D.extras[id] = D.extras[id] || []).push({ label, amount })
      render()
    },
    checkout(id) {
      const r = R(id)
      if (r.to > today) r.to = nights(r.from, today) > 0 ? today : addDays(r.from, 1)
      r.payMode = $("#pay").value
      D.payments[id] = folio(r).total
      Object.assign(r, { status: "partie", key: "revoquee", invoice: "F-" + ui.invoiceSeq++ })
      D.rooms.find((x) => x.no === r.room).hk = "sale"
      toast(`Clé de la chambre ${r.room} révoquée`)
      go(`facture/${id}`)
    },
    setHk(no, v) {
      D.rooms.find((x) => x.no === no).hk = v
      toast(`Chambre ${no} : ${HK[v][0].toLowerCase()}`)
      render()
    },
    assign(no, h) {
      if (h) D.assignments[no] = h
      else delete D.assignments[no]
      render()
    },
    autoAssign() {
      const todo = D.rooms.filter((r) => r.hk === "sale" && !D.assignments[r.no])
      if (!todo.length) return toast("Toutes les chambres sales sont déjà attribuées")
      const load = (h) => Object.values(D.assignments).filter((x) => x === h).length
      todo.forEach((r) => (D.assignments[r.no] = [...D.housekeepers].sort((a, b) => load(a) - load(b))[0]))
      toast(`${todo.length} chambre(s) attribuée(s)`)
      render()
    },
    filterGuests(s) {
      s = s.toLowerCase()
      document.querySelectorAll("#glist button").forEach((b) => (b.style.display = b.dataset.name.includes(s) ? "" : "none"))
    },
    saveGuest(id, silent) {
      const g = G(id)
      const name = $("#c-name").value.trim()
      if (!name) return toast("Le nom est obligatoire")
      Object.assign(g, { name, phone: $("#c-phone").value.trim(), email: $("#c-email").value.trim(), nationality: $("#c-nat").value.trim(), vip: $("#c-vip").checked })
      if (!silent) toast("Fiche client enregistrée")
      render()
    },
    addPref(id) {
      const v = $("#c-pref").value.trim()
      if (!v) return
      G(id).prefs.push(v)
      A.fof.saveGuest(id, true)
    },
    delPref(id, i) {
      G(id).prefs.splice(i, 1)
      A.fof.saveGuest(id, true)
    },
  }

  const common = { code: "fof", phase: "4-10", actions }
  HMS.module({ ...common, group: "Réception & séjour", title: "Réception et séjour", spec: "§8 RES, §9 FOF, §10 ACC, §12 FOL", screens: [
    { id: "accueil", label: "Tableau de bord", spec: "FOF", view: views.accueil },
    { id: "reservations", label: "Réservations", spec: "RES", view: views.reservations },
    { id: "checkin", label: "Check-in et clé", spec: "FOF ACC", view: views.checkin },
    { id: "checkout", label: "Check-out et facture", spec: "FOF FOL ACC", view: views.checkout },
    { id: "facture", hidden: true, navAs: "checkout", view: views.facture, redirect: (p) => ((R(p[0]) || {}).invoice ? null : "checkout") },
  ] })
  HMS.module({ ...common, group: "Opérations", title: "Statut des chambres", spec: "§11 HKM", screens: [{ id: "chambres", label: "Statut des chambres", view: views.chambres }] })
  HMS.module({ ...common, group: "Ventes & clients", title: "Fiche client", spec: "§7 CRM", screens: [{ id: "clients", label: "Fiches clients", view: views.clients }] })
})()
