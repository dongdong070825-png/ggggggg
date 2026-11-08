function solveCpm(activities) {
  const nodes = new Set();
  activities.forEach((a) => {
    nodes.add(a.from);
    nodes.add(a.to);
  });
  const ids = [...nodes].sort((a, b) => a - b);
  const outgoing = Object.fromEntries(ids.map((n) => [n, []]));
  const incoming = Object.fromEntries(ids.map((n) => [n, []]));
  activities.forEach((a) => {
    outgoing[a.from].push(a);
    incoming[a.to].push(a);
  });

  const indeg = Object.fromEntries(ids.map((n) => [n, incoming[n].length]));
  const queue = ids.filter((n) => indeg[n] === 0);
  const order = [];
  const TE = Object.fromEntries(ids.map((n) => [n, indeg[n] === 0 ? 0 : -Infinity]));

  while (queue.length) {
    const n = queue.shift();
    order.push(n);
    outgoing[n].forEach((a) => {
      TE[a.to] = Math.max(TE[a.to], TE[n] + a.duration);
      indeg[a.to] -= 1;
      if (indeg[a.to] === 0) queue.push(a.to);
    });
  }

  if (order.length !== ids.length) {
    throw new Error("cycle");
  }

  const project = Math.max(...ids.map((n) => TE[n]));
  const TL = Object.fromEntries(
    ids.map((n) => [n, outgoing[n].length === 0 ? project : Infinity])
  );
  [...order].reverse().forEach((n) => {
    outgoing[n].forEach((a) => {
      TL[n] = Math.min(TL[n], TL[a.to] - a.duration);
    });
  });

  const rows = activities.map((a) => {
    const es = TE[a.from];
    const ef = es + a.duration;
    const lf = TL[a.to];
    const ls = lf - a.duration;
    const tf = lf - es - a.duration;
    const ff = TE[a.to] - es - a.duration;
    const indep = TE[a.to] - TL[a.from] - a.duration;
    return {
      ...a,
      es,
      ef,
      ls,
      lf,
      tf,
      ff,
      indep,
      critical: tf === 0,
    };
  });

  return { ids, TE, TL, rows, project, outgoing, incoming, order };
}

function cpmRanks(solved) {
  const { ids, outgoing } = solved;
  const rank = {};
  ids.forEach((n) => {
    rank[n] = 0;
  });
  let changed = true;
  let guard = 0;
  while (changed && guard < ids.length * ids.length + 4) {
    changed = false;
    guard += 1;
    ids.forEach((n) => {
      outgoing[n].forEach((a) => {
        const next = rank[n] + 1;
        if (next > rank[a.to]) {
          rank[a.to] = next;
          changed = true;
        }
      });
    });
  }
  return rank;
}

function layoutCpm(solved) {
  const { ids, outgoing, incoming } = solved;
  const rank = cpmRanks(solved);
  const buckets = {};
  ids.forEach((n) => {
    (buckets[rank[n]] ||= []).push(n);
  });
  const cols = Object.keys(buckets)
    .map(Number)
    .sort((a, b) => a - b);
  for (let pass = 0; pass < 4; pass++) {
    const order = pass % 2 === 0 ? cols : [...cols].reverse();
    order.forEach((col) => {
      const list = buckets[col];
      const score = (n) => {
        const rel = (pass % 2 === 0 ? incoming[n] : outgoing[n])
          .map((a) => (pass % 2 === 0 ? a.from : a.to))
          .filter((id) => rank[id] !== col);
        if (!rel.length) return n;
        const avg =
          rel.reduce((sum, id) => {
            const i = (buckets[rank[id]] || []).indexOf(id);
            return sum + (i < 0 ? 0 : i);
          }, 0) / rel.length;
        return avg;
      };
      list.sort((a, b) => score(a) - score(b) || a - b);
    });
  }
  const pos = {};
  const rowH = 156;
  const yMid = 168;
  cols.forEach((col) => {
    const list = buckets[col];
    list.forEach((n, i) => {
      pos[n] = {
        x: 108 + col * 220,
        y: yMid + (i - (list.length - 1) / 2) * rowH,
      };
    });
  });
  return { pos, rank };
}

function shown(set, n) {
  if (set === "all") return true;
  if (!set || set === "none") return false;
  return set.includes(n);
}

let cpmSvgSeq = 0;

function labelClear(x, y, obstacles) {
  let min = 999;
  for (const o of obstacles) {
    const dx = Math.abs(x - o.x) - 42;
    const dy = Math.abs(y - o.y) - 34;
    min = Math.min(min, Math.hypot(Math.max(dx, 0), Math.max(dy, 0)));
  }
  return min;
}

function placeLabel(mx, my, px, py, dist, obstacles) {
  const sides = [1, -1].map((sign) => ({
    x: mx + px * dist * sign,
    y: my + py * dist * sign,
    sign,
  }));
  sides.sort((a, b) => labelClear(b.x, b.y, obstacles) - labelClear(a.x, a.y, obstacles));
  let pick = sides[0];
  let d = dist;
  while (labelClear(pick.x, pick.y, obstacles) < 8 && d < 72) {
    d += 12;
    pick = { x: mx + px * d * pick.sign, y: my + py * d * pick.sign, sign: pick.sign };
  }
  return pick;
}

function edgeDraw(p1, p2, bend, obstacles) {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const x1 = p1.x + ux * 36;
  const y1 = p1.y + uy * 36;
  const x2 = p2.x - ux * 36;
  const y2 = p2.y - uy * 36;
  const px = -uy;
  const py = ux;
  if (!bend) {
    const label = placeLabel((x1 + x2) / 2, (y1 + y2) / 2, px, py, 16, obstacles);
    return {
      shape: `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"`,
      lx: label.x,
      ly: label.y,
      extra: [
        [x1, y1],
        [x2, y2],
        [label.x, label.y],
      ],
    };
  }
  const cx = (x1 + x2) / 2 + px * bend;
  const cy = (y1 + y2) / 2 + py * bend;
  const label = placeLabel((x1 + 2 * cx + x2) / 4, (y1 + 2 * cy + y2) / 4, px, py, 22, obstacles);
  return {
    shape: `<path d="M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}"`,
    lx: label.x,
    ly: label.y,
    extra: [
      [x1, y1],
      [x2, y2],
      [cx, cy],
      [label.x, label.y],
    ],
  };
}

function cpmSvg(solved, opt = {}) {
  const { pos, rank } = layoutCpm(solved);
  const revealTE = opt.revealTE ?? "all";
  const revealTL = opt.revealTL ?? "all";
  cpmSvgSeq += 1;
  const mark = `mk${cpmSvgSeq}`;
  const points = Object.values(pos).flatMap((p) => [
    [p.x, p.y],
  ]);
  let skip = 0;
  const arrows = solved.rows
    .map((a) => {
      const p1 = pos[a.from];
      const p2 = pos[a.to];
      const span = (rank[a.to] ?? 0) - (rank[a.from] ?? 0);
      const sameBand = Math.abs(p1.y - p2.y) < 40;
      let bend = 0;
      if (span > 1 && sameBand) {
        const side = skip % 2 === 0 ? -1 : 1;
        skip += 1;
        bend = side * (156 + (span - 2) * 40);
      }
      const drawn = edgeDraw(p1, p2, bend, Object.values(pos));
      points.push(...drawn.extra);
      const critOn = a.critical && opt.showCrit !== false;
      const selected = opt.hlFrom === a.from && opt.hlTo === a.to;
      const dash = a.dummy ? "6 5" : "0";
      const color = selected ? "#2c332b" : critOn ? "#8d1d2c" : "#6b7a63";
      const width = selected || critOn ? 2.8 : 1.6;
      const label = a.dummy ? "Dummy" : `${a.name} (${a.duration})`;
      const marker = critOn ? `${mark}g` : `${mark}b`;
      return `${drawn.shape} fill="none" stroke="${color}" stroke-width="${width}" stroke-dasharray="${dash}" marker-end="url(#${marker})"/>
        <text x="${drawn.lx}" y="${drawn.ly}" text-anchor="middle" fill="${color}" font-size="12">${label}</text>`;
    })
    .join("");
  const minX = Math.min(...points.map((p) => p[0])) - 78;
  const minY = Math.min(...points.map((p) => p[1])) - 70;
  const maxX = Math.max(...points.map((p) => p[0])) + 78;
  const maxY = Math.max(...points.map((p) => p[1])) + 64;
  const nodes = solved.ids
    .map((n) => {
      const p = pos[n];
      const on = opt.hlNode === n;
      const te = shown(revealTE, n) ? solved.TE[n] : "?";
      const tl = shown(revealTL, n) ? solved.TL[n] : "?";
      return `<g${opt.popNode === n ? ' class="pop"' : ""} transform="translate(${p.x},${p.y})">
        <rect x="-32" y="-28" width="64" height="56" rx="8" fill="${on ? "#e6dfd5" : "#ffffff"}" stroke="${on ? "#6b7a63" : "#efeae1"}" stroke-width="${on ? 2.4 : 1}"/>
        <line x1="-32" y1="0" x2="32" y2="0" stroke="#efeae1"/>
        <line x1="0" y1="-28" x2="0" y2="0" stroke="#efeae1"/>
        <text x="-16" y="-10" text-anchor="middle" fill="#52796f" font-size="11">${te}</text>
        <text x="16" y="-10" text-anchor="middle" fill="#e07a5f" font-size="11">${tl}</text>
        <text x="0" y="18" text-anchor="middle" fill="#2a241c" font-size="14" font-weight="700">${n}</text>
      </g>`;
    })
    .join("");
  return `<svg class="cpm-svg" viewBox="${minX} ${minY} ${maxX - minX} ${maxY - minY}" role="img" aria-label="CPM 네트워크">
    <defs>
      <marker id="${mark}b" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
        <path d="M0,0 L8,4 L0,8" fill="#6b7a63"/>
      </marker>
      <marker id="${mark}g" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
        <path d="M0,0 L8,4 L0,8" fill="#8d1d2c"/>
      </marker>
    </defs>
    ${arrows}${nodes}
  </svg>
  ${
    opt.caption === ""
      ? ""
      : `<p class="caption">${
          opt.caption ||
          `결합점 위칸: 왼쪽 TE(최초, 초록) · 오른쪽 TL(최지, 적색) · 아래 번호. ${opt.showCrit === false ? "물음표는 아직 계산 전입니다. 점선은 더미." : "짙은 붉은 화살표는 주공정, 점선은 더미."}`
        }</p>`
  }`;
}

function buildWalkthrough(problem) {
  const solved = solveCpm(problem.activities);
  const { ids, TE, TL, rows, project, incoming, outgoing, order } = solved;
  const steps = [];
  const teSeen = [];
  const tlSeen = [];

  steps.push({
    title: "네트워크 읽기",
    html: `<p>화살선식에서 <strong>상자 = 결합점</strong>, <strong>화살표 = 작업</strong>입니다. 숫자 D는 그 작업의 기간입니다.</p>
      <p>작업 목록: ${rows.map((r) => `<code>${r.name}</code> ${r.from}→${r.to} (${r.duration}일)`).join(" · ")}</p>
      <p>먼저 왼쪽에서 오른쪽으로 <strong>TE</strong>를 채우고, 끝에서 되돌아와 <strong>TL</strong>을 채웁니다.</p>`,
    revealTE: [],
    revealTL: [],
    showCrit: false,
  });

  order.forEach((n) => {
    const inc = incoming[n];
    let html;
    if (inc.length === 0) {
      html = `<p>시작 결합점 <strong>${n}</strong>에는 선행 작업이 없습니다.</p>
        <p>따라서 <strong>TE(${n}) = 0</strong> 으로 둡니다.</p>`;
    } else {
      const parts = inc.map(
        (a) => `작업 ${a.name}: TE(${a.from}) + ${a.duration} = ${TE[a.from] + a.duration}`
      );
      html = `<p>결합점 <strong>${n}</strong>의 TE는 들어오는 작업 EF의 <strong>최댓값</strong>입니다. 가장 늦게 도착하는 선<wbr>행이 그 점의 최초 시각입니다.</p>
        <ul>${parts.map((p) => `<li>${p}</li>`).join("")}</ul>
        <p>→ <strong>TE(${n}) = ${TE[n]}</strong></p>`;
    }
    teSeen.push(n);
    steps.push({
      title: `전진계산 TE(${n})`,
      html,
      revealTE: [...teSeen],
      revealTL: [],
      hlNode: n,
      showCrit: false,
    });
  });

  steps.push({
    title: "프로젝트 공기",
    html: `<p>끝 결합점의 TE가 전체 공기입니다. 모든 작업 기간을 더하면 안 됩니다.</p>
      <p><strong>공기 = ${project}일</strong></p>
      <p>이제 공기를 지키도록, 오른쪽에서 왼쪽으로 TL을 채웁니다. 끝점 TL은 공기와 같습니다.</p>`,
    revealTE: [...ids],
    revealTL: [],
    showCrit: false,
  });

  [...order].reverse().forEach((n) => {
    const out = outgoing[n];
    let html;
    if (out.length === 0) {
      html = `<p>끝 결합점 <strong>${n}</strong>의 최지 시각은 공기와 같습니다.</p>
        <p><strong>TL(${n}) = ${project}</strong></p>`;
    } else {
      const parts = out.map(
        (a) => `작업 ${a.name}: TL(${a.to}) − ${a.duration} = ${TL[a.to] - a.duration}`
      );
      html = `<p>결합점 <strong>${n}</strong>의 TL은 나가는 작업 (TL(j) − D)의 <strong>최솟값</strong>입니다. 가장 급하게 출발해야 하는 후행이 그 점의 한계입니다.</p>
        <ul>${parts.map((p) => `<li>${p}</li>`).join("")}</ul>
        <p>→ <strong>TL(${n}) = ${TL[n]}</strong></p>`;
    }
    tlSeen.push(n);
    steps.push({
      title: `후진계산 TL(${n})`,
      html,
      revealTE: [...ids],
      revealTL: [...tlSeen],
      hlNode: n,
      showCrit: false,
    });
  });

  rows.forEach((r) => {
    steps.push({
      title: `작업 ${r.name} (${r.from}-${r.to})`,
      html: `<p>ES = TE(${r.from}) = <strong>${r.es}</strong> · EF = ES + D = <strong>${r.ef}</strong><br/>
        LS = TL(${r.to}) − D = <strong>${r.ls}</strong> · LF = TL(${r.to}) = <strong>${r.lf}</strong></p>
        <p>총여유 TF = TL(j) − TE(i) − D = ${TL[r.to]} − ${TE[r.from]} − ${r.duration} = <strong>${r.tf}</strong><br/>
        자유여유 FF = TE(j) − TE(i) − D = ${TE[r.to]} − ${TE[r.from]} − ${r.duration} = <strong>${r.ff}</strong></p>
        <p>${r.tf === 0 ? "TF = 0 → <strong>주공정 작업</strong>입니다. 하루만 늦어도 공기가 늘어납니다." : `TF = ${r.tf} → 비주공정입니다. 최대 ${r.tf}일까지 늦춰도 공기는 그대로입니다.`}</p>`,
      revealTE: [...ids],
      revealTL: [...ids],
      hlFrom: r.from,
      hlTo: r.to,
      showCrit: false,
    });
  });

  const path = criticalPathLabels(solved);
  steps.push({
    title: "주공정선 확정",
    html: `<p>TF = 0 인 작업만 이으면 주공정선(Critical Path)입니다. 여러 갈래일 수도 있습니다.</p>
      <p><strong>${path}</strong></p>
      <p>공기 <strong>${project}일</strong>. 다음은 숫자를 가리고 한 칸씩 직접 넣는 도전입니다.</p>`,
    revealTE: [...ids],
    revealTL: [...ids],
    showCrit: true,
  });

  return { solved, steps };
}

function criticalPathLabels(solved, withSpan = false) {
  const crit = solved.rows.filter((r) => r.critical);
  const label = (r) => {
    const name = r.dummy ? "Dummy" : r.name;
    return withSpan ? `${name}(${r.from}-${r.to})` : name;
  };
  if (!crit.length) return "없음";
  const byFrom = {};
  crit.forEach((r) => {
    (byFrom[r.from] ||= []).push(r);
  });
  const starts = solved.ids.filter((n) => solved.incoming[n].length === 0);
  const paths = [];
  const walk = (node, acc, seen) => {
    const next = (byFrom[node] || []).filter((r) => !seen.has(r));
    if (!next.length) {
      if (acc.length) paths.push(acc);
      return;
    }
    next.forEach((r) => {
      const ns = new Set(seen);
      ns.add(r);
      walk(r.to, acc.concat(r), ns);
    });
  };
  starts.forEach((n) => walk(n, [], new Set()));
  if (!paths.length) return crit.map(label).join(" → ");
  return paths.map((p) => p.map(label).join(" → ")).join(" / ");
}

function buildChallenge(problem) {
  const solved = solveCpm(problem.activities);
  const { ids, TE, TL, rows, project, incoming, outgoing, order } = solved;
  const steps = [];
  const path = criticalPathLabels(solved);

  order.forEach((n, i) => {
    const inc = incoming[n];
    const efs = inc.map((a) => ({
      name: a.dummy ? "Dummy" : a.name,
      value: TE[a.from] + a.duration,
      from: a.from,
      duration: a.duration,
    }));
    const start = inc.length === 0;
    steps.push({
      kind: "number",
      field: "te",
      node: n,
      title: `전진계산 · 결합점 ${n}`,
      prompt: `결합점 ${n}의 최초시각 TE는 며칠인가요?`,
      rule: start
        ? "시작 결합점에는 선행 작업이 없습니다. TE는 0일입니다."
        : "각 선행 작업의 EF = TE(i) + D 이고, TE(j)는 그 EF의 최댓값입니다.",
      answer: TE[n],
      hint: start
        ? "네트워크의 왼쪽 끝은 항상 0에서 시작합니다."
        : efs.length === 1
          ? `${efs[0].name}: TE(${efs[0].from}) + ${efs[0].duration}을 계산하면 됩니다.`
          : `${efs.map((e) => e.name).join(", ")}의 EF를 구한 뒤 더 늦은 값을 고릅니다.`,
      miss: start
        ? [
            "공사가 시작되는 시각입니다. 선행이 없으면 0일입니다.",
            "정답은 0일입니다. 시작 결합점의 TE는 항상 0입니다.",
          ]
        : efs.length === 1
          ? [
              `선행이 ${efs[0].name} 하나뿐입니다. EF = TE(${efs[0].from}) + ${efs[0].duration} 입니다.`,
              `정답은 ${TE[n]}일입니다. 선행이 하나면 그 EF가 그대로 TE입니다.`,
            ]
          : [
              `들어온 EF는 ${efs.map((e) => `${e.name} ${e.value}`).join(", ")}일입니다. 가장 늦은 시각이 TE입니다.`,
              `정답은 ${TE[n]}일입니다. ${efs.map((e) => `${e.name} ${e.value}`).join(", ")} 중 최댓값입니다.`,
            ],
      success: start
        ? `TE(${n}) = 0. 다음 결합점은 들어오는 종료 시각 중 가장 늦은 값입니다.`
        : efs.length === 1
          ? `TE(${n}) = ${TE[n]}. 선행 ${efs[0].name}의 EF가 그대로 TE입니다.`
          : `TE(${n}) = ${TE[n]}. ${efs.map((e) => `${e.name} ${e.value}`).join(", ")} 중 최댓값입니다.`,
      revealTE: order.slice(0, i),
      revealTL: [],
    });
  });

  const endNode = ids.reduce((best, n) => (TE[n] >= TE[best] ? n : best));
  steps.push({
    kind: "number",
    field: "project",
    title: "프로젝트 공기",
    prompt: "이 네트워크의 공기는 며칠인가요?",
    rule: "공기는 끝 결합점 TE의 최댓값입니다. 모든 작업 기간을 더하지 않습니다.",
    answer: project,
    hint: `결합점 ${endNode}의 초록 숫자(TE)가 가장 늦습니다.`,
    miss: [
      "가장 긴 경로의 끝 시각입니다. 갈래가 있으면 더 늦게 끝나는 쪽입니다.",
      `정답은 ${project}일입니다. 끝 결합점 TE의 최댓값이 전체 공기입니다.`,
    ],
    success: `공기 ${project}일. 이제 이 공기를 지키도록 오른쪽에서 왼쪽으로 TL을 채웁니다.`,
    revealTE: [...ids],
    revealTL: [],
    hlNode: endNode,
  });

  const rev = [...order].reverse();
  rev.forEach((n, i) => {
    const out = outgoing[n];
    const lss = out.map((a) => ({
      name: a.dummy ? "Dummy" : a.name,
      value: TL[a.to] - a.duration,
      to: a.to,
      duration: a.duration,
    }));
    const sink = out.length === 0;
    steps.push({
      kind: "number",
      field: "tl",
      node: n,
      title: `후진계산 · 결합점 ${n}`,
      prompt: `결합점 ${n}의 최지시각 TL은 며칠인가요?`,
      rule: sink
        ? "끝 결합점의 TL은 프로젝트 공기와 같습니다."
        : "TL(i)는 나가는 작업마다 TL(j) − D 를 구한 뒤, 그 최솟값입니다.",
      answer: TL[n],
      hint: sink
        ? "방금 구한 공기와 같은 숫자입니다. 끝점의 적색 칸입니다."
        : lss.length === 1
          ? `${lss[0].name}: TL(${lss[0].to}) − ${lss[0].duration} 입니다.`
          : `${lss.map((e) => e.name).join(", ")}에 대해 TL(j) − D 를 구한 뒤 더 이른 값을 고릅니다.`,
      miss: sink
        ? [
            "끝점의 최지시각은 공기입니다. 왼쪽에 있는 TE와 숫자가 다를 수 있습니다.",
            `정답은 ${project}일입니다. 끝 결합점 TL은 공기와 같습니다.`,
          ]
        : lss.length === 1
          ? [
              `후행이 ${lss[0].name} 하나뿐입니다. TL(${lss[0].to}) − ${lss[0].duration} 을 계산하세요.`,
              `정답은 ${TL[n]}일입니다. 후행이 하나면 그 값이 곧 TL입니다.`,
            ]
          : [
              `나가는 한계는 ${lss.map((e) => `${e.name} ${e.value}`).join(", ")}일입니다. 가장 이른 시각이 TL입니다.`,
              `정답은 ${TL[n]}일입니다. 가장 급하게 출발해야 하는 후행이 그 점의 한계입니다.`,
            ],
      success: sink
        ? `TL(${n}) = ${project}. 공기와 같은 값입니다.`
        : lss.length === 1
          ? `TL(${n}) = ${TL[n]}. 후행 ${lss[0].name}의 한계가 그대로 TL입니다.`
          : `TL(${n}) = ${TL[n]}. ${lss.map((e) => `${e.name} ${e.value}`).join(", ")} 중 최솟값입니다.`,
      revealTE: [...ids],
      revealTL: rev.slice(0, i),
    });
  });

  const critRow = rows.find((r) => r.critical && !r.dummy) || rows.find((r) => r.critical);
  const slackRow = rows.find((r) => !r.critical && !r.dummy) || rows.find((r) => !r.critical);
  [critRow, slackRow].filter(Boolean).forEach((r) => {
    const name = r.dummy ? "Dummy" : r.name;
    steps.push({
      kind: "number",
      field: "tf",
      title: `총여유 · 작업 ${name}`,
      prompt: `작업 ${name} (${r.from}→${r.to}, ${r.duration}일)의 총여유 TF는 며칠인가요?`,
      rule: "TF = TL(j) − TE(i) − D. 0이면 주공정 작업입니다.",
      answer: r.tf,
      hint: `TF = TL(${r.to}) − TE(${r.from}) − D = ${TL[r.to]} − ${TE[r.from]} − ${r.duration}`,
      miss: [
        "시작 결합점의 초록 TE와 끝 결합점의 적색 TL을 읽어 기간을 빼세요.",
        `정답은 ${r.tf}일입니다. ${TL[r.to]} − ${TE[r.from]} − ${r.duration} = ${r.tf}. ${r.tf === 0 ? "주공정 작업입니다." : "비주공정입니다."}`,
      ],
      success: `TF = ${r.tf}일. ${r.tf === 0 ? "여유가 없어 주공정입니다." : `${r.tf}일까지 늦춰도 전체 공기는 그대로입니다.`} 자유여유 FF는 ${r.ff}일입니다.`,
      revealTE: [...ids],
      revealTL: [...ids],
      hlFrom: r.from,
      hlTo: r.to,
    });
  });

  const critNames = rows.filter((r) => r.critical).map((r) => r.name);
  steps.push({
    kind: "multi",
    field: "crit",
    title: "주공정선",
    prompt: "주공정 작업을 모두 고르세요.",
    rule: "총여유 TF가 0인 작업만 주공정입니다. 여러 개일 수 있습니다.",
    answer: critNames,
    choices: rows.map((r) => ({
      id: r.name,
      label: `${r.dummy ? "Dummy" : r.name} · ${r.from}→${r.to} · ${r.duration}일`,
    })),
    hint: rows.map((r) => `${r.dummy ? "Dummy" : r.name} TF=${r.tf}`).join(" · "),
    miss: [
      "TF가 0이 아닌 작업이 섞였거나, 0인 작업이 빠졌습니다.",
      `정답은 ${critNames.join(", ")} 입니다. 주공정선은 ${path} 입니다.`,
    ],
    success: `주공정선은 ${path} 입니다. 이 경로를 하루 늦추면 공기도 하루 늘어납니다.`,
    revealTE: [...ids],
    revealTL: [...ids],
  });

  return { solved, steps };
}

const CPM_THEORY = [
  {
    id: "schedule",
    title: "1. 공정표가 필요한 이유",
    body: [
      "건물은 한 사람이 하루 만에 짓지 않습니다. 땅을 파고, 기초를 치고, 기둥을 세우고, 벽을 쌓습니다. 어떤 일은 같이 할 수 있고, 어떤 일은 앞의 일이 끝나야 시작할 수 있습니다.",
      "공정표는 ‘무슨 일을, 며칠 동안, 어떤 순서로 하는가’를 적어 둔 일정표입니다. 식당에서 주문을 받으면 재료 손질과 불 켜기를 같이 할 수 있지만, 그릇에 담기는 요리가 끝난 뒤입니다. 공사도 같습니다.",
      "CPM은 Critical Path Method, 우리말로 주공정법입니다. 여러 길 가운데 가장 오래 걸리는 길을 찾아서, 그 길이 늦어지면 건물 전체가 늦어진다는 것을 계산하는 방법입니다. 이 강의는 그 계산을 처음 보는 사람 기준으로 한 걸음씩 갑니다.",
    ],
  },
  {
    id: "job",
    title: "2. 작업과 기간",
    body: [
      "작업은 현장에서 실제로 하는 일입니다. 기초, 골조, 미장처럼 이름이 붙습니다. 시험에서는 A, B, C처럼 짧게 부릅니다.",
      "기간은 그 일에 걸리는 날수입니다. 기호는 D입니다. ‘기초 D=3’이면 기초는 3일입니다. 하루를 1로 셉니다. 0일은 ‘하는 일이 없다’는 뜻이고, 이건 나중에 더미에서 다시 봅니다.",
      "중요한 실수 하나: 작업이 다섯 개라고 기간을 전부 더하면 공기가 되지 않습니다. 같이 진행되는 일이 있기 때문입니다. 더하는 것이 아니라, 가장 오래 걸리는 길을 찾습니다.",
    ],
    points: [
      ["작업", "현장에서 하는 일 하나. A, B 또는 기초, 골조."],
      ["D", "그 일에 걸리는 날수. Duration, 기간."],
    ],
  },
  {
    id: "arrow",
    title: "3. 화살표와 결합점",
    body: [
      "이 프로그램의 그림은 화살선식입니다. 화살표가 작업이고, 상자가 결합점입니다. 결합점은 일이 시작되거나, 끝나서 다음 일로 넘어가는 시점입니다. 일 자체가 아닙니다.",
      "화살표는 왼쪽 결합점에서 오른쪽 결합점으로 갑니다. ‘1에서 2로 가는 기초 3일’이라고 읽습니다. 시험에서는 작업 1-2, 기간 3이라고도 씁니다.",
      "아래 그림에는 일이 하나뿐입니다. 상자의 아래 숫자가 결합점 번호입니다. 위칸의 날짜는 다음 강의에서 채웁니다. 지금은 ‘화살표 = 일, 상자 = 시점’만 기억하면 됩니다.",
    ],
    example: {
      reveal: false,
      showCrit: false,
      caption: "화살표가 작업입니다. 괄호 안은 걸리는 날수, 상자 아래 숫자는 결합점 번호입니다.",
      activities: [{ name: "기초", from: 1, to: 2, duration: 3 }],
    },
  },
  {
    id: "esef",
    title: "4. ES와 EF, 가장 빠른 날",
    body: [
      "ES는 Earliest Start, 최초시작일입니다. 이 일을 가장 빨리 시작할 수 있는 날입니다. 앞에 해야 할 일이 없으면, 현장이 여는 날인 0일에 시작할 수 있습니다. 그래서 첫 작업의 ES는 0입니다.",
      "EF는 Earliest Finish, 최초종료일입니다. 가장 빨리 시작해서, 그 일의 기간만큼 일하면 끝나는 날입니다. 계산은 더하기 하나뿐입니다. EF = ES + D.",
      "기초가 3일이고 0일에 시작하면, ES = 0, EF = 0 + 3 = 3입니다. ‘3일짜리 일을 월요일 아침(0일)에 시작하면 3일째에 끝난다’와 같습니다. 달력의 날짜가 아니라, 시작점에서 센 경과일이라고 보면 됩니다.",
    ],
    points: [
      ["ES", "가장 빨리 시작할 수 있는 날. 첫 작업은 0."],
      ["EF", "가장 빨리 끝나는 날. EF = ES + D."],
      ["TE", "결합점에 가장 빨리 도착하는 시각. 그 점에서 나가는 작업의 ES가 됩니다."],
    ],
    formula: "ES = TE(시작 결합점)\nEF = ES + D",
    example: {
      showCrit: false,
      table: "es",
      caption: "기초는 0일에 시작해 3일에 끝납니다. 초록 0과 3이 그 시각입니다.",
      talk: "표의 ES 0, EF 3이 방금 말한 계산입니다. LS, LF, 여유는 아직 몰라도 됩니다.",
      activities: [{ name: "기초", from: 1, to: 2, duration: 3 }],
    },
  },
  {
    id: "meet",
    title: "5. 길이 갈라지고 다시 만날 때",
    body: [
      "일이 두 갈래면, 만나는 결합점은 더 늦게 끝나는 갈래를 기다립니다. 먼저 도착한 사람은 현장에서 기다려야 하고, 시각은 늦은 쪽에 맞춥니다.",
      "아래 그림에서 자재는 1에서 3으로 곧장 4일이 걸립니다. 다른 갈래는 터파기 2일 뒤에 골조 3일이라 2 + 3 = 5일입니다. 결합점 3은 자재(4)와 골조(5) 중 늦은 5일에야 둘 다 준비됩니다.",
      "그래서 결합점의 최초시각 TE는 ‘들어온 EF 중 최댓값’입니다. 평균도 아니고, 합도 아닙니다. 가장 늦은 도착입니다.",
    ],
    points: [
      ["TE(j)", "결합점 j로 들어오는 EF 가운데 가장 큰 값."],
      ["기다리는 이유", "다음 일은 앞의 일이 모두 끝나야 시작할 수 있습니다."],
    ],
    formula: "EF = TE(i) + D\nTE(j) = max(들어온 EF)",
    example: {
      showCrit: false,
      table: "es",
      caption: "결합점 3의 초록 5는 4와 5 중 늦은 값입니다.",
      talk: "터파기 EF = 0+2 = 2, 골조 EF = 2+3 = 5, 자재 EF = 0+4 = 4. 결합점 3의 TE는 max(5, 4) = 5입니다.",
      activities: [
        { name: "터파기", from: 1, to: 2, duration: 2 },
        { name: "자재", from: 1, to: 3, duration: 4 },
        { name: "골조", from: 2, to: 3, duration: 3 },
      ],
    },
  },
  {
    id: "air",
    title: "6. 공기, 전체 공사 기간",
    body: [
      "공기는 프로젝트 전체의 기간입니다. ‘모든 작업 일수를 더한 값’이 아닙니다. 같이 진행된 날은 한 번만 세야 하기 때문입니다.",
      "그림에서 오른쪽 끝 결합점의 초록 숫자, 즉 마지막 TE가 공기입니다. 앞의 예에서 끝 결합점이 5이면 공기는 5일입니다. 2+4+3=9로 더하면 틀린 답이 됩니다.",
      "시험은 거의 항상 이 숫자를 묻습니다. 순서는 왼쪽부터 TE를 채우고, 맨 오른쪽 TE를 읽는 것입니다.",
    ],
    points: [["공기", "끝 결합점의 TE. 작업 기간의 총합이 아닙니다."]],
    example: {
      showCrit: false,
      table: "es",
      caption: "끝 결합점의 5가 공기입니다.",
      talk: "자재 4일과 터파기+골조 5일 중 긴 쪽이 전체 공기입니다.",
      activities: [
        { name: "터파기", from: 1, to: 2, duration: 2 },
        { name: "자재", from: 1, to: 3, duration: 4 },
        { name: "골조", from: 2, to: 3, duration: 3 },
      ],
    },
  },
  {
    id: "backward",
    title: "7. LS, LF, 늦어도 되는 날",
    body: [
      "앞에서는 ‘얼마나 빨리 할 수 있는가’만 봤습니다. 이제는 ‘준공일을 안 미루려면 언제까지는 시작해야 하는가’를 봅니다. 오른쪽 끝에서 왼쪽으로 되돌아옵니다.",
      "LF는 Latest Finish, 최지종료일입니다. 이 일이 늦어도 이 날에는 끝나야 전체가 안 밀립니다. LS는 Latest Start, 최지시작일입니다. LS = LF − D. 기간만큼 앞에서 시작해야 그 날에 끝납니다.",
      "끝 결합점의 빨간 숫자 TL은 공기와 같습니다. 거기가 마감일이기 때문입니다. 갈래가 왼쪽으로 여러 개 나가면, 결합점 TL은 (다음 TL − D) 중 가장 작은 값입니다. 가장 급한 후행 작업에 맞추는 것입니다.",
    ],
    points: [
      ["LF", "늦어도 끝나야 하는 날. 끝 결합점의 TL."],
      ["LS", "늦어도 시작해야 하는 날. LS = LF − D."],
      ["TL", "결합점에서 늦어도 떠나야 하는 시각. 나가는 값 중 최솟값."],
    ],
    formula: "LF = TL(끝 결합점)\nLS = LF − D\nTL(i) = min( TL(j) − D )",
    example: {
      showCrit: false,
      table: "all",
      caption: "오른쪽 빨간 숫자가 TL입니다. 끝점은 공기 5와 같습니다.",
      talk: "골조의 LF는 5, LS는 5−3=2입니다. 자재의 LF도 5, LS는 5−4=1입니다. 자재는 0일에 시작할 수 있지만, 1일에 시작해도 5일에 끝납니다.",
      activities: [
        { name: "터파기", from: 1, to: 2, duration: 2 },
        { name: "자재", from: 1, to: 3, duration: 4 },
        { name: "골조", from: 2, to: 3, duration: 3 },
      ],
    },
  },
  {
    id: "tf",
    title: "8. 총여유 TF",
    body: [
      "총여유 TF는 Total Float입니다. 이 일을 며칠까지 늦춰도 전체 공기가 그대로인지 나타내는 날수입니다. ‘나만 천천히 해도 준공일이 안 밀리는 여유’라고 생각하면 됩니다.",
      "계산은 TF = LF − EF 입니다. 같은 말로 LS − ES, 또 TL(끝) − TE(시작) − D 입니다. 세 식은 같은 값입니다.",
      "TF가 0이면 여유가 없습니다. 하루만 늦어도 공기가 하루 늘어납니다. 이런 작업을 주공정 작업이라고 합니다. 위 예에서 터파기와 골조는 TF 0, 자재는 TF 1이라 자재만 하루 늦출 수 있습니다.",
    ],
    points: [
      ["TF", "전체 공기를 밀지 않고 늦출 수 있는 날수."],
      ["TF = 0", "주공정 작업. 늦추면 건물이 늦어집니다."],
    ],
    formula: "TF = LF − EF = LS − ES = TL(j) − TE(i) − D",
    example: {
      table: "all",
      caption: "짙은 붉은 화살표가 주공정입니다. 자재만 여유 1일입니다.",
      talk: "자재 TF = 5 − 0 − 4 = 1. 골조 TF = 5 − 2 − 3 = 0.",
      activities: [
        { name: "터파기", from: 1, to: 2, duration: 2 },
        { name: "자재", from: 1, to: 3, duration: 4 },
        { name: "골조", from: 2, to: 3, duration: 3 },
      ],
    },
  },
  {
    id: "ff",
    title: "9. 자유여유 FF",
    body: [
      "자유여유 FF는 Free Float입니다. 총여유와 질문이 다릅니다. ‘다음 작업의 가장 빠른 시작(ES)을 밀지 않고, 이 일만 늦출 수 있는 날’입니다.",
      "FF = TE(끝 결합점) − TE(시작 결합점) − D. 다음 일의 ES는 끝 결합점의 TE이므로, 그 TE를 넘지 않는 범위입니다.",
      "FF는 TF보다 크지 않습니다. 전체를 안 미루는 여유(TF) 안에, 바로 다음 일도 안 미루는 더 짧은 여유(FF)가 들어 있기 때문입니다. 음수가 나오면 계산을 다시 보세요. 정상적인 네트워크에서 FF는 0 이상입니다.",
    ],
    points: [
      ["FF", "다음 작업의 ES를 밀지 않는 여유."],
      ["TF와 차이", "TF는 준공일 기준, FF는 바로 다음 일 기준. FF ≤ TF."],
    ],
    formula: "FF = TE(j) − TE(i) − D",
    example: {
      table: "all",
      caption: "자재의 FF도 1일입니다. 하루 늦춰도 결합점 3의 최초시각 5는 그대로입니다.",
      talk: "자재 FF = TE(3) − TE(1) − 4 = 5 − 0 − 4 = 1. 골조 FF = 5 − 2 − 3 = 0.",
      activities: [
        { name: "터파기", from: 1, to: 2, duration: 2 },
        { name: "자재", from: 1, to: 3, duration: 4 },
        { name: "골조", from: 2, to: 3, duration: 3 },
      ],
    },
  },
  {
    id: "path",
    title: "10. 주공정선",
    body: [
      "주공정선은 TF가 0인 작업을 시작부터 끝까지 이은 길입니다. 영어로는 Critical Path입니다. 이 길의 기간을 더하면 공기와 같습니다. 다른 길은 그보다 짧습니다.",
      "주공정 위의 작업 하나를 하루 줄이면 공기가 줄어들 수 있습니다. 주공정이 아닌 일만 줄이면 여유만 늘고, 준공일은 그대로입니다. 공기를 당기려면 짙은 붉은색 길을 줄입니다.",
      "길이 두 개 모두 TF 0이면 주공정이 두 갈래입니다. 그때는 둘 다 늦추면 안 됩니다.",
    ],
    points: [["주공정", "TF = 0인 작업만 이은 가장 긴 길."]],
    example: {
      table: "all",
      caption: "짙은 붉은색 터파기 → 골조가 주공정이고, 공기 5일과 같습니다.",
      talk: "자재 길은 4일로 더 짧아서 주공정이 아닙니다.",
      activities: [
        { name: "터파기", from: 1, to: 2, duration: 2 },
        { name: "자재", from: 1, to: 3, duration: 4 },
        { name: "골조", from: 2, to: 3, duration: 3 },
      ],
    },
  },
  {
    id: "dummy",
    title: "11. 더미, 일 없는 화살표",
    body: [
      "더미는 점선 화살표이고 기간이 0입니다. 사람을 쓰거나 재료를 쓰는 일이 아닙니다. ‘이쪽이 끝나야 저쪽을 시작할 수 있다’는 순서만 이어 줍니다.",
      "예를 들어 벽 공사는 철근이 끝난 뒤에 시작해야 하는데, 그림에서 그 두 일을 직접 잇기 어려울 때 점선으로 순서를 표시합니다. 기간이 0이라 공기를 스스로 늘리지는 않지만, 계산에는 넣습니다. 최댓값을 고를 때 0을 더한 시각도 후보입니다.",
      "더미도 TF가 0이면 주공정에 포함됩니다. ‘점선이라서 주공정이 아니다’는 틀린 말입니다.",
    ],
    points: [
      ["더미", "기간 0인 점선. 실제 작업이 아니라 선후 관계만 표시합니다."],
    ],
    example: {
      table: "all",
      caption: "점선 Dummy는 0일입니다. 이 그림에서는 주공정에 들어갑니다.",
      talk: "결합점 3의 TE는 작업 B의 3과, 작업 A 5일에 더미 0일을 더한 5 가운데 큰 값인 5입니다.",
      activities: [
        { name: "A", from: 1, to: 2, duration: 5 },
        { name: "B", from: 1, to: 3, duration: 3 },
        { name: "C", from: 2, to: 4, duration: 4 },
        { name: "D", from: 3, to: 4, duration: 6 },
        { name: "Dummy", from: 2, to: 3, duration: 0, dummy: true },
      ],
    },
  },
  {
    id: "order",
    title: "12. 문제를 푸는 순서",
    body: [
      "그림이 커져도 순서는 같습니다. 외울 공식보다 이 순서가 먼저입니다.",
      "첫째, 왼쪽 끝 TE를 0으로 둡니다. 둘째, 오른쪽으로 가며 결합점마다 들어온 EF의 최댓값을 적습니다. 셋째, 맨 오른쪽 TE를 공기로 읽습니다. 넷째, 그 공기를 끝 TL로 두고 왼쪽으로 오며 최솟값을 적습니다. 다섯째, 각 작업의 ES, EF, LS, LF, TF, FF를 표로 씁니다. 여섯째, TF가 0인 작업을 이어 주공정이라고 답합니다.",
      "이제 숫자만 가린 그림에서 같은 순서를 직접 해 봅니다. 틀린 칸은 오답노트에 모이니, 나중에 그 칸만 다시 풀면 됩니다.",
    ],
    points: [
      ["전진", "TE, ES, EF. 왼쪽 → 오른쪽. 늦으면 최댓값."],
      ["후진", "TL, LF, LS. 오른쪽 → 왼쪽. 급하면 최솟값."],
      ["여유", "TF가 0인 작업이 주공정."],
    ],
  },
];

const CPM_GLOSSARY = [
  {
    term: "공정표",
    def: "공사에서 무슨 일을 며칠 동안 어떤 순서로 할지 적은 일정표입니다. CPM은 그 일정에서 가장 오래 걸리는 길을 계산하는 방법입니다.",
  },
  {
    term: "작업",
    def: "현장에서 실제로 하는 일 하나입니다. 기초, 골조처럼 부르거나 시험에서는 A, B로 부릅니다. 그림에서는 화살표입니다.",
  },
  {
    term: "기간 D",
    def: "그 작업에 걸리는 날수입니다. Duration의 머리글자입니다. 기초가 3일이면 D=3입니다.",
  },
  {
    term: "결합점",
    def: "일이 시작되거나 끝나 다음 일로 넘어가는 시점입니다. 일 자체가 아니라, 화살표와 화살표가 만나는 상자(또는 원)입니다. 번호가 붙어 있습니다.",
  },
  {
    term: "화살선식",
    def: "화살표 = 작업, 상자 = 결합점인 그리는 방법입니다. 국내 기사 문제의 대부분이 이 형태입니다. 노드식은 상자가 작업이고 화살표는 순서만 나타내며, 계산 원리는 같습니다.",
  },
  {
    term: "선행 작업 · 후행 작업",
    def: "선행은 이 일보다 먼저 끝나야 하는 일입니다. 후행은 이 일이 끝나야 시작할 수 있는 다음 일입니다.",
  },
  {
    term: "TE 최초결합점시각",
    def: "그 결합점에 가장 빨리 도착할 수 있는 날입니다. 시작점은 0이고, 다른 점은 들어온 작업 EF 중 가장 늦은 값(최댓값)입니다. 그림의 왼쪽 초록 숫자입니다.",
  },
  {
    term: "TL 최지결합점시각",
    def: "전체 공기를 지키려면 그 결합점을 늦어도 떠나야 하는 날입니다. 끝점은 공기와 같고, 다른 점은 나가는 (TL − D) 중 가장 급한 값(최솟값)입니다. 그림의 오른쪽 빨간 숫자입니다.",
  },
  {
    term: "ES 최초시작일",
    def: "Earliest Start. 그 작업을 가장 빨리 시작할 수 있는 날입니다. 시작 결합점의 TE와 같습니다. 앞에 할 일이 없으면 0입니다.",
  },
  {
    term: "EF 최초종료일",
    def: "Earliest Finish. 가장 빨리 시작해서 기간만큼 일하면 끝나는 날입니다. EF = ES + D. 예를 들어 ES가 0이고 기간이 3이면 EF는 3입니다.",
  },
  {
    term: "LS 최지시작일",
    def: "Latest Start. 공기를 안 밀고 가장 늦게 시작해도 되는 날입니다. LS = LF − D 입니다.",
  },
  {
    term: "LF 최지종료일",
    def: "Latest Finish. 공기를 안 밀고 가장 늦게 끝나도 되는 날입니다. 끝 결합점의 TL과 같습니다.",
  },
  {
    term: "공기",
    def: "프로젝트 전체 기간입니다. 끝 결합점의 TE이며, 주공정 기간의 합과 같습니다. 모든 작업 일수를 더한 값은 아닙니다.",
  },
  {
    term: "TF 총여유",
    def: "Total Float. 그 작업을 늦춰도 전체 공기가 그대로인 날수입니다. TF = LF − EF = TL(j) − TE(i) − D. 0이면 주공정 작업입니다.",
  },
  {
    term: "FF 자유여유",
    def: "Free Float. 바로 다음 작업의 최초시작을 밀지 않고 늦출 수 있는 날수입니다. FF = TE(j) − TE(i) − D. 항상 TF보다 작거나 같습니다.",
  },
  {
    term: "주공정선",
    def: "TF가 0인 작업을 시작부터 끝까지 이은 길입니다. 이 길이 가장 길고, 하루만 늦어도 준공일이 밀립니다.",
  },
  {
    term: "더미",
    def: "기간이 0인 점선 화살표입니다. 실제 공사는 없고, 일의 순서만 연결합니다. 주공정에 들어갈 수도 있습니다.",
  },
  {
    term: "전진계산",
    def: "왼쪽에서 오른쪽으로 TE, ES, EF를 채우는 계산입니다. 갈래가 모이면 최댓값을 고릅니다.",
  },
  {
    term: "후진계산",
    def: "오른쪽에서 왼쪽으로 TL, LF, LS를 채우는 계산입니다. 갈래가 갈라지면 최솟값을 고릅니다. 끝 TL은 공기와 같습니다.",
  },
];

const CPM_PROBLEMS = [
  {
    id: "basic",
    title: "기본 네트워크",
    level: "입문",
    brief: "더미 없이 전진·후진과 여유시간을 계산합니다.",
    activities: [
      { name: "A", from: 1, to: 2, duration: 3 },
      { name: "B", from: 1, to: 3, duration: 2 },
      { name: "C", from: 2, to: 3, duration: 4 },
      { name: "D", from: 2, to: 4, duration: 5 },
      { name: "E", from: 3, to: 4, duration: 2 },
    ],
  },
  {
    id: "dummy",
    title: "더미가 있는 네트워크",
    level: "핵심",
    brief: "점선 더미는 기간 0입니다. 선후 제약만 잇고, 주공정에 포함될 수 있습니다.",
    activities: [
      { name: "A", from: 1, to: 2, duration: 5 },
      { name: "B", from: 1, to: 3, duration: 3 },
      { name: "C", from: 2, to: 4, duration: 4 },
      { name: "D", from: 3, to: 4, duration: 6 },
      { name: "Dummy", from: 2, to: 3, duration: 0, dummy: true },
    ],
  },
  {
    id: "exam",
    title: "기사형 네트워크",
    level: "실전",
    brief: "작업이 늘어난 기사형 네트워크입니다. 갈래마다 최댓값과 최솟값을 비교합니다.",
    activities: [
      { name: "A", from: 1, to: 2, duration: 4 },
      { name: "B", from: 1, to: 3, duration: 2 },
      { name: "C", from: 2, to: 3, duration: 3 },
      { name: "D", from: 2, to: 4, duration: 5 },
      { name: "E", from: 3, to: 5, duration: 4 },
      { name: "F", from: 4, to: 5, duration: 2 },
      { name: "G", from: 4, to: 6, duration: 6 },
      { name: "H", from: 5, to: 6, duration: 3 },
    ],
  },
];

const NET_SHAPES = [
  {
    name: "갈래",
    level: "입문",
    arrows: [
      { name: "A", from: 1, to: 2 },
      { name: "B", from: 1, to: 3 },
      { name: "C", from: 2, to: 3 },
      { name: "D", from: 2, to: 4 },
      { name: "E", from: 3, to: 4 },
    ],
  },
  {
    name: "더미",
    level: "핵심",
    arrows: [
      { name: "A", from: 1, to: 2 },
      { name: "B", from: 1, to: 3 },
      { name: "C", from: 2, to: 4 },
      { name: "D", from: 3, to: 4 },
      { name: "Dummy", from: 2, to: 3, dummy: true },
    ],
  },
  {
    name: "나란한 두 길",
    level: "입문",
    arrows: [
      { name: "A", from: 1, to: 2 },
      { name: "B", from: 1, to: 3 },
      { name: "C", from: 2, to: 4 },
      { name: "D", from: 3, to: 4 },
    ],
  },
  {
    name: "세 갈래",
    level: "입문",
    arrows: [
      { name: "A", from: 1, to: 2 },
      { name: "B", from: 1, to: 3 },
      { name: "C", from: 1, to: 4 },
      { name: "D", from: 2, to: 5 },
      { name: "E", from: 3, to: 5 },
      { name: "F", from: 4, to: 5 },
    ],
  },
  {
    name: "건너뛰는 화살",
    level: "입문",
    arrows: [
      { name: "A", from: 1, to: 2 },
      { name: "B", from: 2, to: 3 },
      { name: "C", from: 3, to: 4 },
      { name: "D", from: 2, to: 4 },
      { name: "E", from: 1, to: 3 },
    ],
  },
  {
    name: "두 번 만나기",
    level: "핵심",
    arrows: [
      { name: "A", from: 1, to: 2 },
      { name: "B", from: 1, to: 3 },
      { name: "C", from: 2, to: 4 },
      { name: "D", from: 3, to: 4 },
      { name: "E", from: 4, to: 5 },
      { name: "F", from: 2, to: 5 },
    ],
  },
  {
    name: "기사형",
    level: "실전",
    arrows: [
      { name: "A", from: 1, to: 2 },
      { name: "B", from: 1, to: 3 },
      { name: "C", from: 2, to: 3 },
      { name: "D", from: 2, to: 4 },
      { name: "E", from: 3, to: 5 },
      { name: "F", from: 4, to: 5 },
      { name: "G", from: 4, to: 6 },
      { name: "H", from: 5, to: 6 },
    ],
  },
  {
    name: "더미로 잇기",
    level: "핵심",
    arrows: [
      { name: "A", from: 1, to: 2 },
      { name: "B", from: 1, to: 3 },
      { name: "C", from: 2, to: 4 },
      { name: "D", from: 3, to: 4 },
      { name: "E", from: 4, to: 5 },
      { name: "Dummy", from: 2, to: 3, dummy: true },
    ],
  },
  {
    name: "뒤쪽 갈래",
    level: "핵심",
    arrows: [
      { name: "A", from: 1, to: 2 },
      { name: "B", from: 2, to: 3 },
      { name: "C", from: 2, to: 4 },
      { name: "D", from: 3, to: 5 },
      { name: "E", from: 4, to: 5 },
      { name: "F", from: 5, to: 6 },
      { name: "G", from: 3, to: 6 },
    ],
  },
  {
    name: "더미와 합류",
    level: "실전",
    arrows: [
      { name: "A", from: 1, to: 2 },
      { name: "B", from: 2, to: 3 },
      { name: "C", from: 1, to: 4 },
      { name: "D", from: 4, to: 5 },
      { name: "E", from: 3, to: 5 },
      { name: "Dummy", from: 2, to: 4, dummy: true },
    ],
  },
  {
    name: "짧은 우회로",
    level: "핵심",
    arrows: [
      { name: "A", from: 1, to: 2 },
      { name: "B", from: 2, to: 3 },
      { name: "C", from: 3, to: 4 },
      { name: "D", from: 4, to: 5 },
      { name: "E", from: 3, to: 5 },
      { name: "F", from: 1, to: 4 },
    ],
  },
  {
    name: "넓게 모으기",
    level: "실전",
    arrows: [
      { name: "A", from: 1, to: 2 },
      { name: "B", from: 1, to: 3 },
      { name: "C", from: 2, to: 4 },
      { name: "D", from: 3, to: 4 },
      { name: "E", from: 2, to: 5 },
      { name: "F", from: 4, to: 6 },
      { name: "G", from: 5, to: 6 },
      { name: "Dummy", from: 3, to: 5, dummy: true },
    ],
  },
];

function netRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function precedenceOf(activities) {
  const dummyOut = {};
  activities.forEach((a) => {
    if (!a.dummy) return;
    (dummyOut[a.from] ||= []).push(a.to);
  });
  const reachable = (start) => {
    const seen = new Set([start]);
    const queue = [start];
    while (queue.length) {
      const n = queue.shift();
      (dummyOut[n] || []).forEach((m) => {
        if (seen.has(m)) return;
        seen.add(m);
        queue.push(m);
      });
    }
    return seen;
  };
  const reals = activities.filter((a) => !a.dummy);
  return reals.map((b) => ({
    name: b.name,
    duration: b.duration,
    preds: reals
      .filter((a) => a.name !== b.name && reachable(a.to).has(b.from))
      .map((a) => a.name)
      .sort(),
  }));
}

function transitivePreds(jobs) {
  const map = Object.fromEntries(jobs.map((j) => [j.name, new Set(j.preds)]));
  let changed = true;
  while (changed) {
    changed = false;
    jobs.forEach((j) => {
      [...map[j.name]].forEach((p) => {
        map[p].forEach((q) => {
          if (map[j.name].has(q)) return;
          map[j.name].add(q);
          changed = true;
        });
      });
    });
  }
  return map;
}

function rollNetwork(seed) {
  const rng = netRng(seed);
  const shape = NET_SHAPES[Math.floor(rng() * NET_SHAPES.length)];
  let activities = [];
  for (let attempt = 0; attempt < 16; attempt += 1) {
    activities = shape.arrows.map((a) => ({
      name: a.name,
      from: a.from,
      to: a.to,
      duration: a.dummy ? 0 : 2 + Math.floor(rng() * 7),
      dummy: !!a.dummy,
    }));
    const solved = solveCpm(activities);
    const real = solved.rows.filter((r) => !r.dummy);
    if (real.some((r) => r.critical) && real.some((r) => !r.critical)) break;
  }
  activities = singleRealHeads(activities);
  return {
    id: "roll",
    key: String(seed),
    title: `새 문제 · ${shape.name}`,
    level: shape.level,
    brief: "연결과 기간이 이번 문제용으로 새로 만들어졌습니다.",
    activities,
    jobs: precedenceOf(activities),
  };
}

function gradeDiagram(jobs, arrows) {
  const checks = [];
  const lines = [];
  const uniq = (items) => [...new Set(items)];
  const note = (name, ok, detail) => {
    checks.push({ name, ok, detail });
  };
  const finish = (ok) => ({
    ok,
    checks,
    lines: ok
      ? ["다섯 기준이 모두 맞습니다. 아래 표에 ES, EF, LS, LF, TF, FF를 채워 보세요."]
      : uniq(lines),
  });

  if (!arrows.length) {
    const empty = "결합점을 놓고, 작업마다 화살표를 하나씩 이으세요.";
    note("작업 화살표", false, empty);
    note("결합점 번호", false, "화살표를 이은 뒤에, 같은 시작과 끝을 쓰는 화살이 있는지를 확인합니다.");
    note("더미", false, "화살표를 이은 뒤에, 한 결합점에 작업 화살이 여러 개 들어가는지를 확인합니다.");
    note("시작과 끝", false, "화살표를 이은 뒤에 시작 결합점과 끝 결합점을 확인합니다.");
    note("선행공정", false, "화살표를 이은 뒤에, 각 작업의 바로 앞 작업이 목록과 같은지를 확인합니다.");
    lines.push(empty);
    return finish(false);
  }

  const expected = Object.fromEntries(jobs.map((j) => [j.name, j]));
  const seen = {};
  const pair = new Set();
  const jobProblems = [];
  const pairProblems = [];
  arrows.forEach((a) => {
    if (a.from === a.to) pairProblems.push("화살표의 시작과 끝이 같습니다. 다른 결합점으로 잇세요.");
    const key = `${a.from}>${a.to}`;
    if (pair.has(key)) {
      pairProblems.push(
        `결합점 ${a.from}에서 ${a.to}로 화살이 두 개입니다. 같은 쌍에는 화살표를 하나만 두고, 순서가 더 필요하면 더미로 다른 점을 거치세요.`
      );
    }
    pair.add(key);
    if (a.dummy && !expected[a.name]) return;
    const job = expected[a.name];
    if (!job) jobProblems.push(`${a.name}는 이번 목록에 없는 작업입니다.`);
    else if (seen[a.name]) jobProblems.push(`${a.name} 화살표가 두 개입니다. 작업 하나당 화살표 하나입니다.`);
    else if (Number(a.duration) !== Number(job.duration)) {
      jobProblems.push(`${a.name}의 기간은 ${job.duration}일입니다.`);
      seen[a.name] = a;
    } else seen[a.name] = a;
  });
  jobs.forEach((j) => {
    if (!seen[j.name]) jobProblems.push(`${j.name}(${j.duration}일) 화살표가 아직 없습니다.`);
  });

  const dummyProblems = [];
  arrows.forEach((a) => {
    if (a.dummy && !expected[a.name] && Number(a.duration) !== 0) {
      dummyProblems.push("순서만 잇는 더미의 기간은 0일입니다. 작업 일수는 그 작업 이름에 적습니다.");
    }
  });
  const incoming = {};
  arrows.forEach((a) => {
    (incoming[a.to] ||= []).push(a);
  });
  Object.keys(incoming).forEach((node) => {
    const reals = incoming[node].filter((a) => !a.dummy);
    if (reals.length < 2) return;
    dummyProblems.push(
      `결합점 ${node}에 작업 화살 ${reals.map((a) => a.name).join(", ")}가 함께 들어갑니다. 작업 화살은 한 점에 하나만 두고, 나머지는 새 결합점에서 끝낸 뒤 점선 더미로 이으세요.`
    );
  });

  note(
    "작업 화살표",
    jobProblems.length === 0,
    jobProblems.length
      ? uniq(jobProblems).join(" ")
      : "목록의 작업이 화살표 하나씩, 적힌 기간으로 있습니다."
  );
  note(
    "결합점 번호",
    pairProblems.length === 0,
    pairProblems.length
      ? uniq(pairProblems).join(" ")
      : "같은 두 결합점을 잇는 화살은 하나뿐이고, 시작과 끝이 같은 화살은 없습니다."
  );
  note(
    "더미",
    dummyProblems.length === 0,
    dummyProblems.length
      ? uniq(dummyProblems).join(" ")
      : "작업 화살은 한 결합점에 하나만 들어갑니다. 점선에 고른 작업은 그 이름과 일수로 인정되고, 순서만은 기간 0입니다."
  );
  lines.push(...jobProblems, ...pairProblems, ...dummyProblems);

  if (jobProblems.length || pairProblems.length) {
    note("시작과 끝", false, "작업 화살과 결합점 번호를 고친 뒤에 시작점과 끝점을 확인합니다.");
    note("선행공정", false, "화살표를 목록대로 이은 뒤에 바로 앞 작업을 확인합니다.");
    lines.push("작업 화살과 결합점 번호를 고친 뒤에 시작점과 끝점을 확인합니다.");
    return finish(false);
  }

  let solved;
  try {
    solved = solveCpm(arrows);
  } catch (e) {
    const cycle = "화살표가 한 바퀴 돌고 있습니다. 이미 지난 결합점으로 다시 잇지 마세요.";
    note("시작과 끝", false, cycle);
    note("선행공정", false, "순환을 없앤 뒤에 바로 앞 작업을 확인합니다.");
    lines.push(cycle);
    return finish(false);
  }

  const starts = solved.ids.filter((n) => solved.incoming[n].length === 0);
  const ends = solved.ids.filter((n) => solved.outgoing[n].length === 0);
  const endProblems = [];
  if (starts.length !== 1) {
    endProblems.push("시작 결합점은 하나만 두세요. 바로 앞 일이 없는 작업은 모두 그 점에서 출발합니다.");
  }
  if (ends.length !== 1) {
    endProblems.push("끝나는 결합점도 하나로 모으세요. 뒤에 일이 없는 화살표는 같은 점에서 끝납니다.");
  }
  note(
    "시작과 끝",
    endProblems.length === 0,
    endProblems.length ? endProblems.join(" ") : "출발하는 결합점과 끝나는 결합점이 각각 하나입니다."
  );
  lines.push(...endProblems);

  const out = {};
  arrows.forEach((a) => {
    (out[a.from] ||= []).push(a.to);
  });
  const canReach = (from, to) => {
    if (from === to) return true;
    const been = new Set([from]);
    const queue = [from];
    while (queue.length) {
      const n = queue.shift();
      for (const m of out[n] || []) {
        if (m === to) return true;
        if (been.has(m)) continue;
        been.add(m);
        queue.push(m);
      }
    }
    return false;
  };
  const need = transitivePreds(jobs);
  const predProblems = [];
  jobs.forEach((j) => {
    const arrow = seen[j.name];
    if (!arrow) return;
    const got = new Set();
    jobs.forEach((other) => {
      if (other.name === j.name || !seen[other.name]) return;
      if (canReach(seen[other.name].to, arrow.from)) got.add(other.name);
    });
    const missing = [...need[j.name]].filter((n) => !got.has(n));
    const extra = [...got].filter((n) => !need[j.name].has(n));
    if (missing.length) {
      predProblems.push(
        `${j.name}는 ${missing.join(", ")}가 끝난 뒤에 시작해야 합니다. 그 화살 끝에서 ${j.name}의 시작 결합점까지 이어 주세요.`
      );
    }
    if (extra.length) {
      predProblems.push(
        `${j.name}는 ${extra.join(", ")}를 기다리지 않아도 됩니다. 결합점을 나누고, 순서만 이을 때는 더미를 쓰세요.`
      );
    }
  });
  note(
    "선행공정",
    predProblems.length === 0,
    predProblems.length
      ? uniq(predProblems).join(" ")
      : "각 작업은 목록에 적힌 바로 앞 일이 끝난 뒤에만 시작합니다. 목록에 없는 일은 기다리지 않습니다."
  );
  lines.push(...predProblems);
  return finish(checks.every((item) => item.ok));
}

function singleRealHeads(activities) {
  const copy = (activities || []).map((arrow) => ({
    name: arrow.name,
    from: arrow.from,
    to: arrow.to,
    duration: arrow.dummy ? 0 : arrow.duration,
    dummy: !!arrow.dummy,
  }));
  splitCrowdedHeads(copy);
  let solved;
  try {
    solved = solveCpm(copy);
  } catch (e) {
    return copy;
  }
  const rank = cpmRanks(solved);
  const order = [...solved.ids].sort((a, b) => rank[a] - rank[b] || a - b);
  const nodeMap = {};
  order.forEach((id, index) => {
    nodeMap[id] = index + 1;
  });
  return copy.map((arrow) => ({
    ...arrow,
    from: nodeMap[arrow.from],
    to: nodeMap[arrow.to],
  }));
}

function splitCrowdedHeads(activities) {
  const incoming = {};
  activities.forEach((arrow) => {
    (incoming[arrow.to] ||= []).push(arrow);
  });
  let next = activities.reduce((max, arrow) => Math.max(max, arrow.from, arrow.to), 0) + 1;
  Object.keys(incoming).forEach((key) => {
    const reals = incoming[key].filter((arrow) => !arrow.dummy);
    if (reals.length < 2) return;
    const keep = reals
      .slice()
      .sort((a, b) => b.duration - a.duration || String(a.name).localeCompare(String(b.name), "ko"))[0];
    reals.forEach((arrow) => {
      if (arrow === keep) return;
      const mid = next;
      next += 1;
      const node = Number(key);
      arrow.to = mid;
      activities.push({
        name: "Dummy",
        from: mid,
        to: node,
        duration: 0,
        dummy: true,
      });
    });
  });
}

function explainNetwork(jobs, activities) {
  const byName = Object.fromEntries(jobs.map((job) => [job.name, job]));
  return activities.map((arrow) => {
    if (arrow.dummy) {
      return `결합점 ${arrow.from}에서 결합점 ${arrow.to}까지 점선 더미입니다. 한 결합점에 작업 화살이 여러 개 들어가지 않도록, 기간 0으로 순서만 잇습니다.`;
    }
    const preds = (byName[arrow.name] && byName[arrow.name].preds) || [];
    return preds.length
      ? `${arrow.name}는 ${preds.join(", ")} 다음에 시작합니다. 결합점 ${arrow.from}에서 결합점 ${arrow.to}로 가고, 기간은 ${arrow.duration}일입니다.`
      : `${arrow.name}는 바로 앞 작업이 없습니다. 시작 결합점 ${arrow.from}에서 결합점 ${arrow.to}로 가고, 기간은 ${arrow.duration}일입니다.`;
  });
}

function jobsToNetwork(jobs) {
  const clean = jobs.map((j) => ({
    name: String(j.name || "").trim(),
    duration: Number(j.duration),
    preds: [...new Set((j.preds || []).map((p) => String(p).trim()).filter(Boolean))],
  }));
  if (!clean.length) throw new Error("표에 작업을 한 줄 이상 적어 주세요.");
  const seen = new Set();
  clean.forEach((j) => {
    if (!j.name) throw new Error("작업 이름이 비어 있는 줄이 있습니다.");
    if (j.name === "Dummy" || j.name === "더미") {
      throw new Error("더미는 작업 이름으로 쓰지 않습니다. 실제 작업 이름을 적어 주세요.");
    }
    if (seen.has(j.name)) throw new Error(`${j.name} 작업이 두 번 있습니다. 이름은 한 번씩만 적습니다.`);
    seen.add(j.name);
    if (!Number.isInteger(j.duration) || j.duration < 1) {
      throw new Error(`${j.name}의 기간은 1 이상의 정수로 적어 주세요.`);
    }
    if (j.preds.includes(j.name)) throw new Error(`${j.name}는 자기 자신을 기다릴 수 없습니다.`);
  });
  clean.forEach((j) => {
    j.preds.forEach((p) => {
      if (!seen.has(p)) throw new Error(`${j.name}의 바로 앞 작업 ${p}가 표에 없습니다.`);
    });
  });

  const succ = Object.fromEntries(clean.map((j) => [j.name, []]));
  clean.forEach((j) => j.preds.forEach((p) => succ[p].push(j.name)));
  const indeg = Object.fromEntries(clean.map((j) => [j.name, j.preds.length]));
  const queue = clean.filter((j) => indeg[j.name] === 0).map((j) => j.name);
  const topo = [];
  while (queue.length) {
    const name = queue.shift();
    topo.push(name);
    succ[name].forEach((s) => {
      indeg[s] -= 1;
      if (indeg[s] === 0) queue.push(s);
    });
  }
  if (topo.length !== clean.length) {
    throw new Error("작업 순서가 한 바퀴를 돕니다. 바로 앞 작업을 다시 확인해 주세요.");
  }

  const byName = Object.fromEntries(clean.map((j) => [j.name, j]));
  const activities = [];
  const notes = [];
  const used = new Set();
  const startOfSet = new Map();
  const predKeyOfNode = new Map();
  let next = 2;
  startOfSet.set("", 1);
  predKeyOfNode.set(1, "");

  const setKey = (preds) => [...preds].sort().join("\0");
  const startNodeFor = (preds) => {
    const key = setKey(preds);
    if (!startOfSet.has(key)) {
      const node = next;
      next += 1;
      startOfSet.set(key, node);
      predKeyOfNode.set(node, key);
    }
    return startOfSet.get(key);
  };
  clean.forEach((job) => startNodeFor(job.preds));

  const arrowNote = (name, from, to, duration, preds) =>
    preds.length
      ? `${name}는 ${preds.join(", ")} 다음에 시작합니다. 결합점 ${from}에서 결합점 ${to}로 가고, 기간은 ${duration}일입니다.`
      : `${name}는 바로 앞 작업이 없습니다. 시작 결합점 ${from}에서 결합점 ${to}로 가고, 기간은 ${duration}일입니다.`;

  const addDummy = (from, to, sentence) => {
    if (from === to) return;
    const pair = `${from}>${to}`;
    if (used.has(pair)) return;
    used.add(pair);
    activities.push({ name: "Dummy", from, to, duration: 0, dummy: true });
    notes.push(sentence);
  };

  const succStarts = (name) => [
    ...new Set(succ[name].map((other) => startNodeFor(byName[other].preds))),
  ];

  const tails = [];
  topo.forEach((name) => {
    const job = byName[name];
    const from = startNodeFor(job.preds);
    const targets = succStarts(name);
    if (!targets.length) {
      tails.push(job);
      return;
    }
    const owned = targets.find((node) => predKeyOfNode.get(node) === name);
    const head = owned || (targets.length === 1 ? targets[0] : null);
    const collided = head != null && head !== from && used.has(`${from}>${head}`);
    if (head != null && head !== from && !collided) {
      used.add(`${from}>${head}`);
      activities.push({ name, from, to: head, duration: job.duration, dummy: false });
      notes.push(arrowNote(name, from, head, job.duration, job.preds));
      targets.forEach((target) => {
        if (target === head) return;
        addDummy(
          head,
          target,
          `${name}가 끝난 점 ${head}에서 결합점 ${target}까지 점선 더미를 잇습니다. 다음 작업이 그 점에서 따로 시작하기 때문입니다.`
        );
      });
      return;
    }
    if (collided) {
      const sitting = activities.find((arrow) => !arrow.dummy && arrow.from === from && arrow.to === head);
      if (sitting && job.duration > sitting.duration) {
        const park = next;
        next += 1;
        sitting.to = park;
        used.add(`${from}>${park}`);
        addDummy(
          park,
          head,
          `결합점 ${park}에서 결합점 ${head}까지 점선 더미입니다. 시작과 끝이 같은 화살이 겹치지 않게, 기간이 짧은 작업을 나눈 것입니다.`
        );
        activities.push({ name, from, to: head, duration: job.duration, dummy: false });
        notes.push(arrowNote(name, from, head, job.duration, job.preds));
        targets.forEach((target) => {
          if (target === head) return;
          addDummy(
            head,
            target,
            `${name}가 끝난 점 ${head}에서 결합점 ${target}까지 점선 더미를 잇습니다. 다음 작업이 그 점에서 따로 시작하기 때문입니다.`
          );
        });
        return;
      }
    }
    const mid = next;
    next += 1;
    used.add(`${from}>${mid}`);
    activities.push({ name, from, to: mid, duration: job.duration, dummy: false });
    if (collided) {
      notes.push(
        `${name}는 다른 작업과 시작 결합점 ${from}, 끝 결합점 ${head}가 같습니다. 같은 번호를 두 작업이 쓸 수 없어서 ${name}는 결합점 ${from}에서 결합점 ${mid}로 가고, 결합점 ${mid}에서 결합점 ${head}까지 점선 더미로 결합점을 나눕니다.`
      );
    } else {
      notes.push(
        `${name} 뒤에는 서로 다른 결합점에서 시작하는 작업이 있습니다. ${name}는 결합점 ${from}에서 결합점 ${mid}로 가고, 기간은 ${job.duration}일입니다.`
      );
    }
    targets.forEach((target) => {
      addDummy(
        mid,
        target,
        collided
          ? `결합점 ${mid}에서 결합점 ${target}까지 점선 더미입니다. 시작과 끝이 같은 화살이 겹치지 않게 번호를 나눈 것입니다.`
          : `${name}가 끝난 점 ${mid}에서 결합점 ${target}까지 점선 더미를 잇습니다. 순서만 맞추고 기간은 0입니다.`
      );
    });
  });

  tails.sort((a, b) => b.duration - a.duration || a.name.localeCompare(b.name, "ko"));
  if (tails.length === 1) {
    const job = tails[0];
    const from = startNodeFor(job.preds);
    const to = next;
    next += 1;
    used.add(`${from}>${to}`);
    activities.push({ name: job.name, from, to, duration: job.duration, dummy: false });
    notes.push(arrowNote(job.name, from, to, job.duration, job.preds));
  } else if (tails.length > 1) {
    const finish = next;
    next += 1;
    tails.forEach((job) => {
      const from = startNodeFor(job.preds);
      if (!used.has(`${from}>${finish}`)) {
        used.add(`${from}>${finish}`);
        activities.push({ name: job.name, from, to: finish, duration: job.duration, dummy: false });
        notes.push(arrowNote(job.name, from, finish, job.duration, job.preds));
        return;
      }
      const mid = next;
      next += 1;
      used.add(`${from}>${mid}`);
      activities.push({ name: job.name, from, to: mid, duration: job.duration, dummy: false });
      notes.push(
        `${job.name}는 다른 작업과 시작 결합점 ${from}, 끝 결합점 ${finish}가 같습니다. 같은 번호를 쓸 수 없어서 ${job.name}는 결합점 ${from}에서 결합점 ${mid}로 가고, 결합점 ${mid}에서 결합점 ${finish}까지 점선 더미로 결합점을 나눕니다.`
      );
      addDummy(
        mid,
        finish,
        `결합점 ${mid}에서 결합점 ${finish}까지 점선 더미입니다. 시작과 끝이 같은 화살이 겹치지 않게 번호를 나눈 것입니다.`
      );
    });
  }

  const canReach = (from, to) => {
    if (from === to) return true;
    const out = {};
    activities.forEach((arrow) => {
      (out[arrow.from] ||= []).push(arrow.to);
    });
    const seen = new Set([from]);
    const queue = [from];
    while (queue.length) {
      const node = queue.shift();
      for (const nextNode of out[node] || []) {
        if (nextNode === to) return true;
        if (seen.has(nextNode)) continue;
        seen.add(nextNode);
        queue.push(nextNode);
      }
    }
    return false;
  };
  topo.forEach((name) => {
    const arrow = activities.find((item) => !item.dummy && item.name === name);
    succ[name].forEach((other) => {
      const target = startNodeFor(byName[other].preds);
      if (canReach(arrow.to, target)) return;
      addDummy(
        arrow.to,
        target,
        `${name} 다음에 ${other}가 시작하도록 결합점 ${arrow.to}에서 결합점 ${target}까지 점선 더미를 잇습니다.`
      );
    });
  });

  splitCrowdedHeads(activities);

  const pairCount = {};
  activities.forEach((arrow) => {
    const pair = `${arrow.from}>${arrow.to}`;
    pairCount[pair] = (pairCount[pair] || 0) + 1;
  });
  const doubled = Object.entries(pairCount).find((entry) => entry[1] > 1);
  if (doubled) throw new Error("같은 시작·끝 결합점을 쓰는 화살이 겹칩니다. 더미로 나누지 못했습니다.");

  let solved;
  try {
    solved = solveCpm(activities);
  } catch (e) {
    throw new Error("화살표가 한 바퀴를 돕니다. 바로 앞 작업을 다시 확인해 주세요.");
  }
  const rank = cpmRanks(solved);
  const order = [...solved.ids].sort((a, b) => rank[a] - rank[b] || a - b);
  const nodeMap = {};
  order.forEach((id, index) => {
    nodeMap[id] = index + 1;
  });
  const numbered = activities.map((arrow) => ({
    ...arrow,
    from: nodeMap[arrow.from],
    to: nodeMap[arrow.to],
  }));
  const numberedNotes = explainNetwork(clean, numbered);

  const graded = gradeDiagram(
    clean.map((j) => ({ name: j.name, duration: j.duration, preds: j.preds })),
    numbered
  );
  const problems = graded.lines.filter((line) => !line.startsWith("끝나는 결합점도"));
  if (!graded.ok && problems.length) throw new Error(problems[0]);
  return { activities: numbered, notes: numberedNotes, jobs: clean };
}

function aoa(rows) {
  return rows.map(([name, from, to, duration]) =>
    duration === 0
      ? { name: name === "Dummy" ? "Dummy" : name, duration: 0, from, to, dummy: true }
      : { name, duration, from, to }
  );
}

const EXAM_BANK = [
  {
    id: "y2021-2-21",
    year: 2021,
    level: "상",
    tag: "2021 · 2회",
    title: "네트워크 공정표",
    source: "2021년 2회 건축기사 실기 · 문제 21",
    ask: "다음 작업리스트에서 네트워크 공정표를 작성하고 각 작업의 여유시간을 구하시오.",
    problemImage: "exams/2021-2-21-q.png",
    answerImage: "exams/2021-2-21-a.png",
    jobs: [
      { name: "A", duration: 5, preds: [] },
      { name: "B", duration: 6, preds: ["A"] },
      { name: "C", duration: 5, preds: ["A"] },
      { name: "D", duration: 4, preds: ["A"] },
      { name: "E", duration: 3, preds: ["B"] },
      { name: "F", duration: 7, preds: ["B", "C", "D"] },
      { name: "G", duration: 8, preds: ["D"] },
      { name: "H", duration: 6, preds: ["E"] },
      { name: "I", duration: 5, preds: ["E", "F"] },
      { name: "J", duration: 8, preds: ["E", "F", "G"] },
      { name: "K", duration: 7, preds: ["H", "I", "J"] },
    ],
    activities: [
      { name: "A", duration: 5, from: 1, to: 2 },
      { name: "B", duration: 6, from: 2, to: 3 },
      { name: "C", duration: 5, from: 2, to: 5 },
      { name: "D", duration: 4, from: 2, to: 4 },
      { name: "Dummy", duration: 0, from: 3, to: 5, dummy: true },
      { name: "Dummy", duration: 0, from: 4, to: 5, dummy: true },
      { name: "E", duration: 3, from: 3, to: 6 },
      { name: "F", duration: 7, from: 5, to: 7 },
      { name: "Dummy", duration: 0, from: 6, to: 7, dummy: true },
      { name: "G", duration: 8, from: 4, to: 8 },
      { name: "Dummy", duration: 0, from: 7, to: 8, dummy: true },
      { name: "H", duration: 6, from: 6, to: 9 },
      { name: "I", duration: 5, from: 7, to: 9 },
      { name: "J", duration: 8, from: 8, to: 9 },
      { name: "K", duration: 7, from: 9, to: 10 },
    ],
  },
  {
    id: "y2016-4-26",
    year: 2016,
    level: "상",
    tag: "2016 · 4회",
    title: "3일 단축 공정표",
    source: "2016년 4회 건축기사 실기 · 문제 26",
    solution: "crash",
    ask: "표준공기가 지정공기보다 3일 지연되었다. 3일을 단축한 네트워크 공정표를 작성하고 총공사금액을 산출하시오.",
    problemImage: "exams/2016-4-26-q.png",
    costs: [
      { name: "A", preds: [], normal: 3, normalCost: 7000, crash: 3, crashCost: 7000 },
      { name: "B", preds: ["A"], normal: 5, normalCost: 5000, crash: 3, crashCost: 7000 },
      { name: "C", preds: ["A"], normal: 6, normalCost: 9000, crash: 4, crashCost: 12000 },
      { name: "D", preds: ["A"], normal: 7, normalCost: 6000, crash: 4, crashCost: 15000 },
      { name: "E", preds: ["B"], normal: 4, normalCost: 8000, crash: 3, crashCost: 8500 },
      { name: "F", preds: ["B"], normal: 10, normalCost: 15000, crash: 6, crashCost: 19000 },
      { name: "G", preds: ["C", "E"], normal: 8, normalCost: 6000, crash: 5, crashCost: 12000 },
      { name: "H", preds: ["D"], normal: 9, normalCost: 10000, crash: 7, crashCost: 18000 },
      { name: "I", preds: ["F", "G", "H"], normal: 2, normalCost: 3000, crash: 2, crashCost: 3000 },
    ],
    jobs: [
      { name: "A", duration: 3, preds: [] },
      { name: "B", duration: 5, preds: ["A"] },
      { name: "C", duration: 6, preds: ["A"] },
      { name: "D", duration: 7, preds: ["A"] },
      { name: "E", duration: 4, preds: ["B"] },
      { name: "F", duration: 10, preds: ["B"] },
      { name: "G", duration: 8, preds: ["C", "E"] },
      { name: "H", duration: 9, preds: ["D"] },
      { name: "I", duration: 2, preds: ["F", "G", "H"] },
    ],
    normalActivities: [
      { name: "A", duration: 3, from: 1, to: 2 },
      { name: "B", duration: 5, from: 2, to: 3 },
      { name: "C", duration: 6, from: 2, to: 6 },
      { name: "D", duration: 7, from: 2, to: 5 },
      { name: "E", duration: 4, from: 3, to: 6 },
      { name: "F", duration: 10, from: 3, to: 8 },
      { name: "G", duration: 8, from: 6, to: 8 },
      { name: "H", duration: 9, from: 5, to: 8 },
      { name: "I", duration: 2, from: 8, to: 9 },
    ],
    activities: [
      { name: "A", duration: 3, from: 1, to: 2 },
      { name: "B", duration: 3, from: 2, to: 3 },
      { name: "C", duration: 6, from: 2, to: 6 },
      { name: "D", duration: 5, from: 2, to: 5 },
      { name: "E", duration: 3, from: 3, to: 6 },
      { name: "F", duration: 10, from: 3, to: 8 },
      { name: "G", duration: 8, from: 6, to: 8 },
      { name: "H", duration: 9, from: 5, to: 8 },
      { name: "I", duration: 2, from: 8, to: 9 },
    ],
    crashed: { B: 2, E: 1, D: 2 },
  },
  {
    id: "y2016-1-27",
    year: 2016,
    level: "상",
    tag: "2016 · 1회",
    title: "7일 단축 공정표",
    source: "2016년 1회 건축기사 실기 · 문제 27",
    solution: "half",
    ask: "표준 네트워크 공정표를 작성하고, 7일 단축한 네트워크 공정표를 작성하시오. 공기단축은 작업일수의 1/2을 넘길 수 없다.",
    problemImage: "exams/2016-1-27-q.png",
    answerImage: "exams/2016-1-27-a.png",
    jobs: [
      { name: "A", duration: 2, preds: [], from: 1, to: 2, slope: 50, cut: 0 },
      { name: "B", duration: 3, preds: [], from: 1, to: 3, slope: 40, cut: 1 },
      { name: "C", duration: 4, preds: [], from: 1, to: 4, slope: 30, cut: 2 },
      { name: "D", duration: 5, preds: ["A", "B", "C"], from: 2, to: 5, slope: 20, cut: 2 },
      { name: "E", duration: 6, preds: ["A", "B", "C"], from: 2, to: 6, slope: 10, cut: 3 },
      { name: "F", duration: 4, preds: ["B", "C"], from: 3, to: 6, slope: 15, cut: 1 },
      { name: "G", duration: 3, preds: ["C"], from: 4, to: 6, slope: 23, cut: 0 },
      { name: "H", duration: 6, preds: ["D", "F"], from: 5, to: 7, slope: 37, cut: 1 },
      { name: "I", duration: 7, preds: ["E", "G"], from: 6, to: 7, slope: 45, cut: 2 },
    ],
  },
  {
    id: "y2016-2-27",
    year: 2016,
    level: "상",
    tag: "2016 · 2회",
    title: "4일 단축 공정표",
    source: "2016년 2회 건축기사 실기 · 문제 27",
    solution: "cut4",
    ask: "표준 네트워크 공정표를 작성하고, 표준공기의 총공사비와 4일 단축한 총공사비를 구하시오.",
    problemImage: "exams/2016-2-27-q.png",
    answerImage: "exams/2016-2-27-a.png",
    costs: [
      { name: "A", preds: [], normal: 5, normalCost: 170000, crash: 4, crashCost: 210000 },
      { name: "B", preds: [], normal: 18, normalCost: 300000, crash: 13, crashCost: 450000 },
      { name: "C", preds: [], normal: 16, normalCost: 320000, crash: 12, crashCost: 480000 },
      { name: "D", preds: ["A"], normal: 8, normalCost: 200000, crash: 6, crashCost: 260000 },
      { name: "E", preds: ["A"], normal: 7, normalCost: 110000, crash: 6, crashCost: 140000 },
      { name: "F", preds: ["A"], normal: 6, normalCost: 120000, crash: 4, crashCost: 200000 },
      { name: "G", preds: ["D", "E", "F"], normal: 7, normalCost: 150000, crash: 5, crashCost: 220000 },
    ],
    jobs: [
      { name: "A", duration: 5, preds: [] },
      { name: "B", duration: 18, preds: [] },
      { name: "C", duration: 16, preds: [] },
      { name: "D", duration: 8, preds: ["A"] },
      { name: "E", duration: 7, preds: ["A"] },
      { name: "F", duration: 6, preds: ["A"] },
      { name: "G", duration: 7, preds: ["D", "E", "F"] },
    ],
    activities: [
      { name: "A", duration: 5, from: 0, to: 1 },
      { name: "B", duration: 18, from: 0, to: 6 },
      { name: "C", duration: 16, from: 0, to: 5 },
      { name: "Dummy", duration: 0, from: 5, to: 6, dummy: true },
      { name: "E", duration: 7, from: 1, to: 2 },
      { name: "F", duration: 6, from: 1, to: 3 },
      { name: "D", duration: 8, from: 1, to: 4 },
      { name: "Dummy", duration: 0, from: 2, to: 4, dummy: true },
      { name: "Dummy", duration: 0, from: 3, to: 4, dummy: true },
      { name: "G", duration: 7, from: 4, to: 6 },
    ],
    crashed: { A: 1, B: 2, D: 1, G: 2 },
  },
  {
    id: "y2017-1-26",
    year: 2017,
    level: "상",
    tag: "2017 · 1회",
    title: "네트워크 공정표",
    source: "2017년 1회 건축기사 실기 · 문제 26",
    solution: "sheet",
    path: "A → D → H",
    ask: "네트워크 공정표를 작성하시오. 결합점에는 EST·LST를 표기하고 주공정선은 굵은 선으로 표시한다.",
    problemImage: "exams/2017-1-26-q.png",
    answerImage: "exams/2017-1-26-a.png",
    jobs: [
      { name: "A", duration: 5, preds: [] },
      { name: "B", duration: 2, preds: [] },
      { name: "C", duration: 4, preds: [] },
      { name: "D", duration: 5, preds: ["A", "B", "C"] },
      { name: "E", duration: 3, preds: ["A", "B", "C"] },
      { name: "F", duration: 2, preds: ["A", "B", "C"] },
      { name: "G", duration: 2, preds: ["D", "E"] },
      { name: "H", duration: 5, preds: ["D", "E", "F"] },
      { name: "I", duration: 4, preds: ["D", "F"] },
    ],
    activities: aoa([
      ["A", 0, 1, 5], ["B", 0, 3, 2], ["Dummy", 1, 3, 0], ["C", 0, 2, 4], ["Dummy", 2, 3, 0],
      ["D", 3, 4, 5], ["E", 3, 5, 3], ["Dummy", 4, 5, 0], ["F", 3, 6, 2], ["Dummy", 4, 6, 0],
      ["Dummy", 4, 7, 0], ["Dummy", 5, 7, 0], ["Dummy", 6, 7, 0], ["G", 5, 8, 2], ["H", 7, 8, 5], ["I", 6, 8, 4],
    ]),
  },
  {
    id: "y2017-2-26",
    year: 2017,
    level: "상",
    tag: "2017 · 2회",
    title: "10일 단축 공정표",
    source: "2017년 2회 건축기사 실기 · 문제 26",
    solution: "sheet",
    path: "C → H → I → K",
    project: 31,
    ask: "표준 네트워크 공정표를 작성하고, 공기를 10일 단축한 공정표와 그때의 총공사비를 구하시오.",
    problemImage: "exams/2017-2-26-q.png",
    answerImage: "exams/2017-2-26-a.png",
    answerImage2: "exams/2017-2-26-a2.png",
    normalCost: 1000000,
    jobs: [
      { name: "A", duration: 5, preds: [], slope: 10000 },
      { name: "B", duration: 8, preds: [], slope: 15000 },
      { name: "C", duration: 15, preds: [], slope: 9000, limit: 5 },
      { name: "D", duration: 3, preds: ["A"] },
      { name: "E", duration: 6, preds: ["A"], slope: 25000 },
      { name: "F", duration: 7, preds: ["B", "D"], slope: 30000 },
      { name: "G", duration: 9, preds: ["B", "D"], slope: 21000 },
      { name: "H", duration: 10, preds: ["C", "E"], slope: 8500, limit: 3 },
      { name: "I", duration: 4, preds: ["H", "F"], slope: 9500, limit: 2 },
      { name: "J", duration: 3, preds: ["G"] },
      { name: "K", duration: 2, preds: ["I", "J"] },
    ],
    crashSteps: [
      { day: 30, names: ["H"], cost: 8500 },
      { day: 29, names: ["H"], cost: 8500 },
      { day: 28, names: ["H"], cost: 8500 },
      { day: 27, names: ["C"], cost: 9000 },
      { day: 26, names: ["C"], cost: 9000 },
      { day: 25, names: ["C"], cost: 9000 },
      { day: 24, names: ["C"], cost: 9000 },
      { day: 23, names: ["I"], cost: 9500 },
      { day: 22, names: ["I"], cost: 9500 },
      { day: 21, names: ["A", "B", "C"], cost: 34000 },
    ],
  },
  {
    id: "y2017-4-26",
    year: 2017,
    level: "상",
    tag: "2017 · 4회",
    title: "일정과 여유시간",
    source: "2017년 4회 건축기사 실기 · 문제 26",
    solution: "sheet",
    path: "B → D → G → K → N → Q",
    ask: "각 작업의 EST·EFT·LST·LFT와 TF·FF·DF를 구하고, 주공정 작업에 *를 하시오. D는 소요일수 0인 더미입니다.",
    problemImage: "exams/2017-4-26-q.png",
    answerImage: "exams/2017-4-26-a.png",
    jobs: [
      { name: "A", duration: 5, preds: [] },
      { name: "B", duration: 16, preds: [] },
      { name: "C", duration: 2, preds: ["A"] },
      { name: "E", duration: 10, preds: ["A"] },
      { name: "F", duration: 6, preds: ["B"] },
      { name: "G", duration: 10, preds: ["B", "C"] },
      { name: "H", duration: 8, preds: ["E"] },
      { name: "I", duration: 2, preds: ["F"] },
      { name: "J", duration: 6, preds: ["F"] },
      { name: "K", duration: 7, preds: ["G"] },
      { name: "L", duration: 3, preds: ["G"] },
      { name: "M", duration: 2, preds: ["I"] },
      { name: "N", duration: 5, preds: ["J", "K", "M"] },
      { name: "P", duration: 4, preds: ["H", "L"] },
      { name: "Q", duration: 3, preds: ["N", "P"] },
    ],
    activities: aoa([
      ["A", 1, 2, 5], ["B", 1, 3, 16], ["C", 2, 4, 2], ["D", 3, 4, 0], ["E", 2, 5, 10],
      ["F", 3, 6, 6], ["G", 4, 7, 10], ["H", 5, 10, 8], ["I", 6, 8, 2], ["J", 6, 9, 6],
      ["K", 7, 9, 7], ["L", 7, 10, 3], ["M", 8, 9, 2], ["N", 9, 11, 5], ["P", 10, 11, 4], ["Q", 11, 12, 3],
    ]),
  },
  {
    id: "y2018-1-26",
    year: 2018,
    level: "상",
    tag: "2018 · 1회",
    title: "여유시간과 주공정",
    source: "2018년 1회 건축기사 실기 · 문제 26",
    solution: "sheet",
    path: "A → B → F → J → K",
    ask: "네트워크 공정표를 작성하고, 각 작업의 TF·FF·DF와 주공정을 구하시오.",
    problemImage: "exams/2018-1-26-q.png",
    answerImage: "exams/2018-1-26-a.png",
    answerImage2: "exams/2018-1-26-a2.png",
    jobs: [
      { name: "A", duration: 5, preds: [] },
      { name: "B", duration: 8, preds: ["A"] },
      { name: "C", duration: 4, preds: ["A"] },
      { name: "D", duration: 6, preds: ["A"] },
      { name: "E", duration: 7, preds: ["B"] },
      { name: "F", duration: 8, preds: ["B", "C", "D"] },
      { name: "G", duration: 4, preds: ["D"] },
      { name: "H", duration: 6, preds: ["E"] },
      { name: "I", duration: 4, preds: ["E", "F"] },
      { name: "J", duration: 8, preds: ["E", "F", "G"] },
      { name: "K", duration: 4, preds: ["H", "I", "J"] },
    ],
    activities: aoa([
      ["A", 0, 1, 5], ["B", 1, 2, 8], ["C", 1, 4, 4], ["D", 1, 3, 6], ["Dummy", 2, 4, 0], ["Dummy", 3, 4, 0],
      ["E", 2, 5, 7], ["F", 4, 6, 8], ["Dummy", 5, 6, 0], ["G", 3, 7, 4], ["Dummy", 6, 7, 0],
      ["H", 5, 8, 6], ["I", 6, 8, 4], ["J", 7, 8, 8], ["K", 8, 9, 4],
    ]),
  },
  {
    id: "y2018-2-26",
    year: 2018,
    level: "상",
    tag: "2018 · 2회",
    title: "주공정선 표시",
    source: "2018년 2회 건축기사 실기 · 문제 26",
    solution: "sheet",
    path: "B → D → F",
    ask: "네트워크 공정표를 작성하고 주공정선을 표시하시오.",
    problemImage: "exams/2018-2-26-q.png",
    answerImage: "exams/2018-2-26-a.png",
    jobs: [
      { name: "A", duration: 2, preds: [] },
      { name: "B", duration: 3, preds: [] },
      { name: "C", duration: 5, preds: ["A"] },
      { name: "D", duration: 5, preds: ["A", "B"] },
      { name: "E", duration: 2, preds: ["A", "B"] },
      { name: "F", duration: 3, preds: ["C", "D", "E"] },
      { name: "G", duration: 5, preds: ["E"] },
    ],
    activities: aoa([
      ["A", 0, 1, 2], ["B", 0, 2, 3], ["Dummy", 1, 2, 0], ["C", 1, 4, 5], ["D", 2, 4, 5],
      ["E", 2, 3, 2], ["Dummy", 3, 4, 0], ["F", 4, 5, 3], ["G", 3, 5, 5],
    ]),
  },
  {
    id: "y2018-4-26",
    year: 2018,
    level: "상",
    tag: "2018 · 4회",
    title: "여유시간",
    source: "2018년 4회 건축기사 실기 · 문제 26",
    solution: "sheet",
    path: "C → E",
    ask: "네트워크 공정표를 작성하고, 각 작업의 TF·FF·DF와 주공정을 구하시오.",
    problemImage: "exams/2018-4-26-q.png",
    answerImage: "exams/2018-4-26-a.png",
    answerImage2: "exams/2018-4-26-a2.png",
    jobs: [
      { name: "A", duration: 2, preds: [] },
      { name: "B", duration: 3, preds: [] },
      { name: "C", duration: 5, preds: [] },
      { name: "D", duration: 4, preds: [] },
      { name: "E", duration: 7, preds: ["A", "B", "C"] },
      { name: "F", duration: 4, preds: ["B", "C", "D"] },
    ],
    activities: aoa([
      ["C", 0, 1, 5], ["B", 0, 2, 3], ["Dummy", 1, 2, 0], ["A", 0, 3, 2], ["Dummy", 1, 3, 0], ["Dummy", 2, 3, 0],
      ["E", 3, 5, 7], ["D", 0, 4, 4], ["Dummy", 1, 4, 0], ["Dummy", 2, 4, 0], ["F", 4, 5, 4],
    ]),
  },
  {
    id: "y2019-1-26",
    year: 2019,
    level: "상",
    tag: "2019 · 1회",
    title: "여유시간과 주공정",
    source: "2019년 1회 건축기사 실기 · 문제 26",
    solution: "sheet",
    path: "C → D → H",
    ask: "네트워크 공정표를 작성하고, 각 작업의 TF·FF·DF와 주공정을 구하시오.",
    problemImage: "exams/2019-1-26-q.png",
    answerImage: "exams/2019-1-26-a.png",
    answerImage2: "exams/2019-1-26-a2.png",
    jobs: [
      { name: "A", duration: 3, preds: [] },
      { name: "B", duration: 2, preds: [] },
      { name: "C", duration: 4, preds: [] },
      { name: "D", duration: 5, preds: ["C"] },
      { name: "E", duration: 2, preds: ["B"] },
      { name: "F", duration: 3, preds: ["A"] },
      { name: "G", duration: 3, preds: ["A", "C", "E"] },
      { name: "H", duration: 4, preds: ["D", "F", "G"] },
    ],
    activities: aoa([
      ["A", 0, 1, 3], ["B", 0, 2, 2], ["C", 0, 3, 4], ["Dummy", 1, 4, 0], ["E", 2, 4, 2], ["Dummy", 3, 4, 0],
      ["D", 3, 5, 5], ["F", 1, 5, 3], ["G", 4, 5, 3], ["H", 5, 6, 4],
    ]),
  },
  {
    id: "y2019-2-26",
    year: 2019,
    level: "상",
    tag: "2019 · 2회",
    title: "여유시간과 주공정",
    source: "2019년 2회 건축기사 실기 · 문제 26",
    solution: "sheet",
    path: "A → C → F → H",
    ask: "네트워크 공정표를 작성하고, 각 작업의 TF·FF·DF와 주공정을 구하시오.",
    problemImage: "exams/2019-2-26-q.png",
    answerImage: "exams/2019-2-26-a.png",
    answerImage2: "exams/2019-2-26-a2.png",
    jobs: [
      { name: "A", duration: 5, preds: [] },
      { name: "B", duration: 6, preds: [] },
      { name: "C", duration: 5, preds: ["A"] },
      { name: "D", duration: 2, preds: ["A", "B"] },
      { name: "E", duration: 3, preds: ["A"] },
      { name: "F", duration: 4, preds: ["C", "E"] },
      { name: "G", duration: 2, preds: ["D"] },
      { name: "H", duration: 3, preds: ["F", "G"] },
    ],
    activities: aoa([
      ["A", 0, 1, 5], ["B", 0, 2, 6], ["Dummy", 1, 2, 0], ["E", 1, 3, 3], ["C", 1, 4, 5], ["Dummy", 3, 4, 0],
      ["D", 2, 5, 2], ["F", 4, 6, 4], ["G", 5, 6, 2], ["H", 6, 7, 3],
    ]),
  },
  {
    id: "y2019-4-26",
    year: 2019,
    level: "상",
    tag: "2019 · 4회",
    title: "여유시간",
    source: "2019년 4회 건축기사 실기 · 문제 26",
    solution: "sheet",
    path: "A → E",
    ask: "네트워크 공정표를 작성하고, 각 작업의 TF·FF·DF를 구하시오.",
    problemImage: "exams/2019-4-26-q.png",
    answerImage: "exams/2019-4-26-a.png",
    answerImage2: "exams/2019-4-26-a2.png",
    jobs: [
      { name: "A", duration: 5, preds: [] },
      { name: "B", duration: 3, preds: [] },
      { name: "C", duration: 2, preds: [] },
      { name: "D", duration: 2, preds: ["A", "B"] },
      { name: "E", duration: 5, preds: ["A", "B", "C"] },
      { name: "F", duration: 4, preds: ["A", "C"] },
    ],
    activities: aoa([
      ["A", 0, 1, 5], ["B", 0, 2, 3], ["Dummy", 1, 2, 0], ["C", 0, 3, 2], ["Dummy", 1, 3, 0],
      ["Dummy", 1, 4, 0], ["Dummy", 2, 4, 0], ["Dummy", 3, 4, 0], ["D", 2, 5, 2], ["E", 4, 5, 5], ["F", 3, 5, 4],
    ]),
  },
  {
    id: "y2020-1-25",
    year: 2020,
    level: "상",
    tag: "2020 · 1회",
    title: "여유시간과 주공정",
    source: "2020년 1회 건축기사 실기 · 문제 25",
    solution: "sheet",
    path: "A → D",
    ask: "네트워크 공정표를 작성하고, 각 작업의 TF·FF·DF와 주공정을 구하시오.",
    problemImage: "exams/2020-1-25-q.png",
    answerImage: "exams/2020-1-25-a.png",
    jobs: [
      { name: "A", duration: 5, preds: [] },
      { name: "B", duration: 2, preds: [] },
      { name: "C", duration: 4, preds: [] },
      { name: "D", duration: 4, preds: ["A", "B", "C"] },
      { name: "E", duration: 3, preds: ["A", "B", "C"] },
      { name: "F", duration: 2, preds: ["A", "B", "C"] },
    ],
    activities: aoa([
      ["A", 0, 1, 5], ["B", 0, 3, 2], ["Dummy", 1, 3, 0], ["C", 0, 3, 4],
      ["D", 3, 4, 4], ["E", 3, 4, 3], ["F", 3, 4, 2],
    ]),
  },
  {
    id: "y2020-2-26",
    year: 2020,
    level: "상",
    tag: "2020 · 2회",
    title: "여유시간과 주공정",
    source: "2020년 2회 건축기사 실기 · 문제 26",
    solution: "sheet",
    path: "A → D",
    ask: "네트워크 공정표를 작성하고, 각 작업의 TF·FF·DF와 주공정을 구하시오.",
    problemImage: "exams/2020-2-26-q.png",
    answerImage: "exams/2020-2-26-a.png",
    jobs: [
      { name: "A", duration: 5, preds: [] },
      { name: "B", duration: 2, preds: [] },
      { name: "C", duration: 4, preds: [] },
      { name: "D", duration: 4, preds: ["A", "B", "C"] },
      { name: "E", duration: 3, preds: ["A", "B", "C"] },
      { name: "F", duration: 2, preds: ["A", "B", "C"] },
    ],
    activities: aoa([
      ["A", 0, 1, 5], ["B", 0, 3, 2], ["Dummy", 1, 3, 0], ["C", 0, 3, 4],
      ["D", 3, 4, 4], ["E", 3, 4, 3], ["F", 3, 4, 2],
    ]),
  },
  {
    id: "y2020-3-26",
    year: 2020,
    level: "상",
    tag: "2020 · 3회",
    title: "네트워크 공정표",
    source: "2020년 3회 건축기사 실기 · 문제 26",
    solution: "sheet",
    path: "A → B",
    ask: "네트워크 공정표를 작성하시오. 결합점에는 EST·LST를 표기하고 주공정선은 굵은 선으로 표시한다.",
    problemImage: "exams/2020-3-26-q.png",
    answerImage: "exams/2020-3-26-a.png",
    jobs: [
      { name: "A", duration: 5, preds: [] },
      { name: "B", duration: 4, preds: ["A"] },
      { name: "C", duration: 2, preds: [] },
      { name: "D", duration: 4, preds: [] },
      { name: "E", duration: 3, preds: ["C", "D"] },
    ],
    activities: aoa([
      ["A", 0, 1, 5], ["B", 1, 4, 4], ["D", 0, 2, 4], ["C", 0, 3, 2], ["Dummy", 2, 3, 0], ["E", 3, 4, 3],
    ]),
  },
  {
    id: "y2020-4-26",
    year: 2020,
    level: "상",
    tag: "2020 · 4회",
    title: "3일 단축 공정표",
    source: "2020년 4회 건축기사 실기 · 문제 26",
    solution: "crash",
    ask: "표준공기가 지정공기보다 3일 지연되었다. 3일을 단축한 네트워크 공정표를 작성하고 총공사금액을 산출하시오.",
    problemImage: "exams/2020-4-26-q.png",
    answerImage: "exams/2020-4-26-a.png",
    costs: [
      { name: "A", preds: [], normal: 3, normalCost: 7000, crash: 3, crashCost: 7000 },
      { name: "B", preds: ["A"], normal: 5, normalCost: 5000, crash: 3, crashCost: 7000 },
      { name: "C", preds: ["A"], normal: 6, normalCost: 9000, crash: 4, crashCost: 12000 },
      { name: "D", preds: ["A"], normal: 7, normalCost: 6000, crash: 4, crashCost: 15000 },
      { name: "E", preds: ["B"], normal: 4, normalCost: 8000, crash: 3, crashCost: 8500 },
      { name: "F", preds: ["B"], normal: 10, normalCost: 15000, crash: 6, crashCost: 19000 },
      { name: "G", preds: ["C", "E"], normal: 8, normalCost: 6000, crash: 4, crashCost: 12000 },
      { name: "H", preds: ["D"], normal: 9, normalCost: 10000, crash: 7, crashCost: 18000 },
      { name: "I", preds: ["F", "G", "H"], normal: 2, normalCost: 3000, crash: 2, crashCost: 3000 },
    ],
    jobs: [
      { name: "A", duration: 3, preds: [] },
      { name: "B", duration: 5, preds: ["A"] },
      { name: "C", duration: 6, preds: ["A"] },
      { name: "D", duration: 7, preds: ["A"] },
      { name: "E", duration: 4, preds: ["B"] },
      { name: "F", duration: 10, preds: ["B"] },
      { name: "G", duration: 8, preds: ["C", "E"] },
      { name: "H", duration: 9, preds: ["D"] },
      { name: "I", duration: 2, preds: ["F", "G", "H"] },
    ],
    normalActivities: [
      { name: "A", duration: 3, from: 1, to: 2 },
      { name: "B", duration: 5, from: 2, to: 3 },
      { name: "C", duration: 6, from: 2, to: 6 },
      { name: "D", duration: 7, from: 2, to: 5 },
      { name: "E", duration: 4, from: 3, to: 6 },
      { name: "F", duration: 10, from: 3, to: 8 },
      { name: "G", duration: 8, from: 6, to: 8 },
      { name: "H", duration: 9, from: 5, to: 8 },
      { name: "I", duration: 2, from: 8, to: 9 },
    ],
    activities: [
      { name: "A", duration: 3, from: 1, to: 2 },
      { name: "B", duration: 3, from: 2, to: 3 },
      { name: "C", duration: 6, from: 2, to: 6 },
      { name: "D", duration: 5, from: 2, to: 5 },
      { name: "E", duration: 3, from: 3, to: 6 },
      { name: "F", duration: 10, from: 3, to: 8 },
      { name: "G", duration: 8, from: 6, to: 8 },
      { name: "H", duration: 9, from: 5, to: 8 },
      { name: "I", duration: 2, from: 8, to: 9 },
    ],
    crashed: { B: 2, E: 1, D: 2 },
  },
  {
    id: "y2020-5-25",
    year: 2020,
    level: "상",
    tag: "2020 · 5회",
    title: "네트워크 공정표",
    source: "2020년 5회 건축기사 실기 · 문제 25",
    solution: "sheet",
    path: "A → D → H",
    ask: "네트워크 공정표를 작성하시오. 결합점에는 EST·LST를 표기하고 주공정선은 굵은 선으로 표시한다.",
    problemImage: "exams/2020-5-25-q.png",
    answerImage: "exams/2020-5-25-a.png",
    jobs: [
      { name: "A", duration: 5, preds: [] },
      { name: "B", duration: 2, preds: [] },
      { name: "C", duration: 4, preds: [] },
      { name: "D", duration: 5, preds: ["A", "B", "C"] },
      { name: "E", duration: 3, preds: ["A", "B", "C"] },
      { name: "F", duration: 2, preds: ["A", "B", "C"] },
      { name: "G", duration: 2, preds: ["D", "E"] },
      { name: "H", duration: 5, preds: ["D", "E", "F"] },
      { name: "I", duration: 4, preds: ["D", "F"] },
    ],
    activities: aoa([
      ["A", 0, 1, 5], ["B", 0, 3, 2], ["Dummy", 1, 3, 0], ["C", 0, 2, 4], ["Dummy", 2, 3, 0],
      ["D", 3, 4, 5], ["E", 3, 5, 3], ["Dummy", 4, 5, 0], ["F", 3, 6, 2], ["Dummy", 4, 6, 0],
      ["Dummy", 4, 7, 0], ["Dummy", 5, 7, 0], ["Dummy", 6, 7, 0], ["G", 5, 8, 2], ["H", 7, 8, 5], ["I", 6, 8, 4],
    ]),
  },
  {
    id: "y2021-1-26",
    year: 2021,
    level: "상",
    tag: "2021 · 1회",
    title: "여유시간과 주공정",
    source: "2021년 1회 건축기사 실기 · 문제 26",
    solution: "sheet",
    path: "B → E → G → I",
    ask: "네트워크 공정표를 작성하고, 각 작업의 TF·FF·DF와 주공정을 구하시오.",
    problemImage: "exams/2021-1-26-q.png",
    answerImage: "exams/2021-1-26-a.png",
    jobs: [
      { name: "A", duration: 3, preds: [] },
      { name: "B", duration: 4, preds: [] },
      { name: "C", duration: 5, preds: [] },
      { name: "D", duration: 6, preds: ["A", "B"] },
      { name: "E", duration: 7, preds: ["B"] },
      { name: "F", duration: 4, preds: ["D"] },
      { name: "G", duration: 5, preds: ["D", "E"] },
      { name: "H", duration: 6, preds: ["C", "F", "G"] },
      { name: "I", duration: 7, preds: ["F", "G"] },
    ],
    activities: aoa([
      ["A", 0, 2, 3], ["B", 0, 1, 4], ["Dummy", 1, 2, 0], ["D", 2, 3, 6], ["E", 1, 4, 7], ["Dummy", 3, 4, 0],
      ["F", 3, 5, 4], ["G", 4, 5, 5], ["Dummy", 5, 6, 0], ["C", 0, 6, 5], ["H", 6, 7, 6], ["I", 5, 7, 7],
    ]),
  },
  {
    id: "y2021-2-26",
    year: 2021,
    level: "상",
    tag: "2021 · 2회",
    title: "네트워크 공정표",
    source: "2021년 2회 건축기사 실기 · 문제 26",
    solution: "sheet",
    path: "A → B → F → J → K",
    ask: "다음 작업리스트에서 네트워크 공정표를 작성하고 각 작업의 여유시간을 구하시오.",
    problemImage: "exams/2021-2-26-q.png",
    answerImage: "exams/2021-2-26-a.png",
    jobs: [
      { name: "A", duration: 5, preds: [] },
      { name: "B", duration: 6, preds: ["A"] },
      { name: "C", duration: 5, preds: ["A"] },
      { name: "D", duration: 4, preds: ["A"] },
      { name: "E", duration: 3, preds: ["B"] },
      { name: "F", duration: 7, preds: ["B", "C", "D"] },
      { name: "G", duration: 8, preds: ["D"] },
      { name: "H", duration: 6, preds: ["E"] },
      { name: "I", duration: 5, preds: ["E", "F"] },
      { name: "J", duration: 8, preds: ["E", "F", "G"] },
      { name: "K", duration: 7, preds: ["H", "I", "J"] },
    ],
    activities: aoa([
      ["A", 1, 2, 5], ["B", 2, 3, 6], ["C", 2, 5, 5], ["D", 2, 4, 4],
      ["Dummy", 3, 5, 0], ["Dummy", 4, 5, 0], ["E", 3, 6, 3], ["F", 5, 7, 7], ["Dummy", 6, 7, 0],
      ["G", 4, 8, 8], ["Dummy", 7, 8, 0], ["H", 6, 9, 6], ["I", 7, 9, 5], ["J", 8, 9, 8], ["K", 9, 10, 7],
    ]),
  },
  {
    id: "y2021-4-26",
    year: 2021,
    level: "상",
    tag: "2021 · 4회",
    title: "10일 단축 공정표",
    source: "2021년 4회 건축기사 실기 · 문제 26",
    solution: "sheet",
    path: "C → H → I → K",
    project: 31,
    ask: "표준 네트워크 공정표를 작성하고, 공기를 10일 단축한 공정표와 그때의 총공사비를 구하시오.",
    problemImage: "exams/2021-4-26-q.png",
    answerImage: "exams/2021-4-26-a.png",
    answerImage2: "exams/2021-4-26-a2.png",
    normalCost: 1000000,
    jobs: [
      { name: "A", duration: 5, preds: [], slope: 10000 },
      { name: "B", duration: 8, preds: [], slope: 15000 },
      { name: "C", duration: 15, preds: [], slope: 9000, limit: 5 },
      { name: "D", duration: 3, preds: ["A"] },
      { name: "E", duration: 6, preds: ["A"], slope: 25000 },
      { name: "F", duration: 7, preds: ["B", "D"], slope: 30000 },
      { name: "G", duration: 9, preds: ["B", "D"], slope: 21000 },
      { name: "H", duration: 10, preds: ["C", "E"], slope: 8500, limit: 3 },
      { name: "I", duration: 4, preds: ["H", "F"], slope: 9500, limit: 2 },
      { name: "J", duration: 3, preds: ["G"] },
      { name: "K", duration: 2, preds: ["I", "J"] },
    ],
    crashSteps: [
      { day: 30, names: ["H"], cost: 8500 },
      { day: 29, names: ["H"], cost: 8500 },
      { day: 28, names: ["H"], cost: 8500 },
      { day: 27, names: ["C"], cost: 9000 },
      { day: 26, names: ["C"], cost: 9000 },
      { day: 25, names: ["C"], cost: 9000 },
      { day: 24, names: ["C"], cost: 9000 },
      { day: 23, names: ["I"], cost: 9500 },
      { day: 22, names: ["I"], cost: 9500 },
      { day: 21, names: ["A", "B", "C"], cost: 34000 },
    ],
  },
  {
    id: "y2022-1-26",
    year: 2022,
    level: "상",
    tag: "2022 · 1회",
    title: "여유시간과 주공정",
    source: "2022년 1회 건축기사 실기 · 문제 26",
    solution: "sheet",
    path: "C → D → H",
    ask: "네트워크 공정표를 작성하고, 각 작업의 TF·FF·DF와 주공정을 구하시오.",
    problemImage: "exams/2022-1-26-q.png",
    answerImage: "exams/2022-1-26-a.png",
    jobs: [
      { name: "A", duration: 3, preds: [] },
      { name: "B", duration: 2, preds: [] },
      { name: "C", duration: 4, preds: [] },
      { name: "D", duration: 5, preds: ["C"] },
      { name: "E", duration: 2, preds: ["B"] },
      { name: "F", duration: 3, preds: ["A"] },
      { name: "G", duration: 3, preds: ["A", "C", "E"] },
      { name: "H", duration: 4, preds: ["D", "F", "G"] },
    ],
    activities: aoa([
      ["A", 0, 1, 3], ["B", 0, 2, 2], ["C", 0, 3, 4], ["Dummy", 1, 4, 0], ["E", 2, 4, 2], ["Dummy", 3, 4, 0],
      ["D", 3, 5, 5], ["F", 1, 5, 3], ["G", 4, 5, 3], ["H", 5, 6, 4],
    ]),
  },
  {
    id: "y2022-2-26",
    year: 2022,
    level: "상",
    tag: "2022 · 2회",
    title: "일정과 여유시간",
    source: "2022년 2회 건축기사 실기 · 문제 26",
    solution: "sheet",
    path: "B → D → G → K → N → Q",
    ask: "각 작업의 EST·EFT·LST·LFT와 TF·FF·DF를 구하고, 주공정 작업에 *를 하시오. D는 소요일수 0인 더미입니다.",
    problemImage: "exams/2022-2-26-q.png",
    answerImage: "exams/2022-2-26-a.png",
    answerImage2: "exams/2022-2-26-a2.png",
    jobs: [
      { name: "A", duration: 5, preds: [] },
      { name: "B", duration: 16, preds: [] },
      { name: "C", duration: 2, preds: ["A"] },
      { name: "E", duration: 10, preds: ["A"] },
      { name: "F", duration: 6, preds: ["B"] },
      { name: "G", duration: 10, preds: ["B", "C"] },
      { name: "H", duration: 8, preds: ["E"] },
      { name: "I", duration: 2, preds: ["F"] },
      { name: "J", duration: 6, preds: ["F"] },
      { name: "K", duration: 7, preds: ["G"] },
      { name: "L", duration: 3, preds: ["G"] },
      { name: "M", duration: 2, preds: ["I"] },
      { name: "N", duration: 5, preds: ["J", "K", "M"] },
      { name: "P", duration: 4, preds: ["H", "L"] },
      { name: "Q", duration: 3, preds: ["N", "P"] },
    ],
    activities: aoa([
      ["A", 1, 2, 5], ["B", 1, 3, 16], ["C", 2, 4, 2], ["D", 3, 4, 0], ["E", 2, 5, 10],
      ["F", 3, 6, 6], ["G", 4, 7, 10], ["H", 5, 10, 8], ["I", 6, 8, 2], ["J", 6, 9, 6],
      ["K", 7, 9, 7], ["L", 7, 10, 3], ["M", 8, 9, 2], ["N", 9, 11, 5], ["P", 10, 11, 4], ["Q", 11, 12, 3],
    ]),
  },
  {
    id: "y2022-4-12",
    year: 2022,
    level: "상",
    tag: "2022 · 4회",
    title: "여유시간과 주공정",
    source: "2022년 4회 건축기사 실기 · 문제 12",
    solution: "sheet",
    path: "B → D → H",
    ask: "네트워크 공정표를 작성하고, 각 작업의 TF·FF·DF와 주공정을 구하시오.",
    problemImage: "exams/2022-4-12-q.png",
    answerImage: "exams/2022-4-12-a.png",
    jobs: [
      { name: "A", duration: 5, preds: [] },
      { name: "B", duration: 6, preds: [] },
      { name: "C", duration: 5, preds: ["A", "B"] },
      { name: "D", duration: 7, preds: ["A", "B"] },
      { name: "E", duration: 3, preds: ["B"] },
      { name: "F", duration: 4, preds: ["B"] },
      { name: "G", duration: 2, preds: ["C", "E"] },
      { name: "H", duration: 4, preds: ["C", "D", "E", "F"] },
    ],
    activities: aoa([
      ["A", 0, 2, 5], ["B", 0, 1, 6], ["Dummy", 1, 2, 0], ["D", 2, 4, 7], ["C", 2, 3, 5],
      ["E", 1, 3, 3], ["F", 1, 4, 4], ["Dummy", 3, 4, 0], ["G", 3, 5, 2], ["H", 4, 5, 4],
    ]),
  },
  {
    id: "y2023-1-12",
    year: 2023,
    level: "상",
    tag: "2023 · 1회",
    title: "3일 단축 공정표",
    source: "2023년 1회 건축기사 실기 · 문제 12",
    solution: "sheet",
    path: "A → C → F → H",
    project: 19,
    ask: "네트워크 공정표를 작성하고 공기를 3일 단축하시오. 3일 단축 시 총공사비를 산출하시오.",
    problemImage: "exams/2023-1-12-q.png",
    answerImage: "exams/2023-1-12-a.png",
    normalCost: 280000,
    jobs: [
      { name: "A", duration: 3, preds: [], slope: 6000, limit: 1 },
      { name: "B", duration: 7, preds: [], slope: 5000, limit: 2 },
      { name: "C", duration: 5, preds: ["A"], slope: 7000, limit: 2 },
      { name: "D", duration: 8, preds: ["A"], slope: 10000, limit: 1 },
      { name: "E", duration: 5, preds: ["B", "C"], slope: 9000, limit: 1 },
      { name: "F", duration: 4, preds: ["B", "C"], slope: 5000, limit: 1 },
      { name: "G", duration: 3, preds: ["E"] },
      { name: "H", duration: 7, preds: ["D", "F"] },
    ],
    activities: aoa([
      ["A", 0, 1, 3], ["B", 0, 2, 7], ["C", 1, 2, 5], ["D", 1, 4, 8],
      ["E", 2, 3, 5], ["F", 2, 4, 4], ["G", 3, 5, 3], ["H", 4, 5, 7],
    ]),
    crashSteps: [
      { day: 18, names: ["F"], cost: 5000 },
      { day: 17, names: ["A"], cost: 6000 },
      { day: 16, names: ["B", "C", "D"], cost: 22000 },
    ],
  },
  {
    id: "y2023-2-12",
    year: 2023,
    level: "상",
    tag: "2023 · 2회",
    title: "3일 단축 공정표",
    source: "2023년 2회 건축기사 실기 · 문제 12",
    solution: "crash",
    ask: "표준공기가 지정공기보다 3일 지연되었다. 3일을 단축한 네트워크 공정표를 작성하고 총공사금액을 산출하시오.",
    problemImage: "exams/2023-2-12-q.png",
    answerImage: "exams/2023-2-12-a.png",
    costs: [
      { name: "A", preds: [], normal: 3, normalCost: 7000, crash: 3, crashCost: 7000 },
      { name: "B", preds: ["A"], normal: 5, normalCost: 5000, crash: 3, crashCost: 7000 },
      { name: "C", preds: ["A"], normal: 6, normalCost: 9000, crash: 4, crashCost: 12000 },
      { name: "D", preds: ["A"], normal: 7, normalCost: 6000, crash: 4, crashCost: 15000 },
      { name: "E", preds: ["B"], normal: 4, normalCost: 8000, crash: 3, crashCost: 8500 },
      { name: "F", preds: ["B"], normal: 10, normalCost: 15000, crash: 6, crashCost: 19000 },
      { name: "G", preds: ["C", "E"], normal: 8, normalCost: 6000, crash: 5, crashCost: 12000 },
      { name: "H", preds: ["D"], normal: 9, normalCost: 10000, crash: 7, crashCost: 18000 },
      { name: "I", preds: ["F", "G", "H"], normal: 2, normalCost: 3000, crash: 2, crashCost: 3000 },
    ],
    jobs: [
      { name: "A", duration: 3, preds: [] },
      { name: "B", duration: 5, preds: ["A"] },
      { name: "C", duration: 6, preds: ["A"] },
      { name: "D", duration: 7, preds: ["A"] },
      { name: "E", duration: 4, preds: ["B"] },
      { name: "F", duration: 10, preds: ["B"] },
      { name: "G", duration: 8, preds: ["C", "E"] },
      { name: "H", duration: 9, preds: ["D"] },
      { name: "I", duration: 2, preds: ["F", "G", "H"] },
    ],
    normalActivities: [
      { name: "A", duration: 3, from: 1, to: 2 },
      { name: "B", duration: 5, from: 2, to: 3 },
      { name: "C", duration: 6, from: 2, to: 6 },
      { name: "D", duration: 7, from: 2, to: 5 },
      { name: "E", duration: 4, from: 3, to: 6 },
      { name: "F", duration: 10, from: 3, to: 8 },
      { name: "G", duration: 8, from: 6, to: 8 },
      { name: "H", duration: 9, from: 5, to: 8 },
      { name: "I", duration: 2, from: 8, to: 9 },
    ],
    activities: [
      { name: "A", duration: 3, from: 1, to: 2 },
      { name: "B", duration: 3, from: 2, to: 3 },
      { name: "C", duration: 6, from: 2, to: 6 },
      { name: "D", duration: 5, from: 2, to: 5 },
      { name: "E", duration: 3, from: 3, to: 6 },
      { name: "F", duration: 10, from: 3, to: 8 },
      { name: "G", duration: 8, from: 6, to: 8 },
      { name: "H", duration: 9, from: 5, to: 8 },
      { name: "I", duration: 2, from: 8, to: 9 },
    ],
    crashed: { B: 2, E: 1, D: 2 },
  },
  {
    id: "y2023-4-12",
    year: 2023,
    level: "상",
    tag: "2023 · 4회",
    title: "4일 단축 공정표",
    source: "2023년 4회 건축기사 실기 · 문제 12",
    solution: "cut4",
    ask: "표준 네트워크 공정표를 작성하고, 표준공기의 총공사비와 4일 단축한 총공사비를 구하시오.",
    problemImage: "exams/2023-4-12-q.png",
    answerImage: "exams/2023-4-12-a.png",
    costs: [
      { name: "A", preds: [], normal: 5, normalCost: 170000, crash: 4, crashCost: 210000 },
      { name: "B", preds: [], normal: 18, normalCost: 300000, crash: 13, crashCost: 450000 },
      { name: "C", preds: [], normal: 16, normalCost: 320000, crash: 12, crashCost: 480000 },
      { name: "D", preds: ["A"], normal: 8, normalCost: 200000, crash: 6, crashCost: 260000 },
      { name: "E", preds: ["A"], normal: 7, normalCost: 110000, crash: 6, crashCost: 140000 },
      { name: "F", preds: ["A"], normal: 6, normalCost: 120000, crash: 4, crashCost: 200000 },
      { name: "G", preds: ["D", "E", "F"], normal: 7, normalCost: 150000, crash: 5, crashCost: 220000 },
    ],
    jobs: [
      { name: "A", duration: 5, preds: [] },
      { name: "B", duration: 18, preds: [] },
      { name: "C", duration: 16, preds: [] },
      { name: "D", duration: 8, preds: ["A"] },
      { name: "E", duration: 7, preds: ["A"] },
      { name: "F", duration: 6, preds: ["A"] },
      { name: "G", duration: 7, preds: ["D", "E", "F"] },
    ],
    activities: [
      { name: "A", duration: 5, from: 0, to: 1 },
      { name: "B", duration: 18, from: 0, to: 6 },
      { name: "C", duration: 16, from: 0, to: 5 },
      { name: "Dummy", duration: 0, from: 5, to: 6, dummy: true },
      { name: "E", duration: 7, from: 1, to: 2 },
      { name: "F", duration: 6, from: 1, to: 3 },
      { name: "D", duration: 8, from: 1, to: 4 },
      { name: "Dummy", duration: 0, from: 2, to: 4, dummy: true },
      { name: "Dummy", duration: 0, from: 3, to: 4, dummy: true },
      { name: "G", duration: 7, from: 4, to: 6 },
    ],
    crashed: { A: 1, B: 2, D: 1, G: 2 },
  },
  {
    id: "y2024-1-12",
    year: 2024,
    level: "상",
    tag: "2024 · 1회",
    title: "네트워크 공정표",
    source: "2024년 1회 건축기사 실기 · 문제 12",
    solution: "sheet",
    path: "A → D → F",
    ask: "네트워크 공정표를 작성하시오. 결합점에는 EST·LST를 표기하고 주공정선은 굵은 선으로 표시한다.",
    problemImage: "exams/2024-1-12-q.png",
    answerImage: "exams/2024-1-12-a.png",
    jobs: [
      { name: "A", duration: 3, preds: [] },
      { name: "B", duration: 4, preds: [] },
      { name: "C", duration: 4, preds: ["A"] },
      { name: "D", duration: 6, preds: ["A"] },
      { name: "E", duration: 5, preds: ["A"] },
      { name: "F", duration: 3, preds: ["B", "C", "D"] },
    ],
    activities: aoa([
      ["A", 0, 1, 3], ["B", 0, 3, 4], ["C", 1, 3, 4], ["D", 1, 2, 6], ["Dummy", 2, 3, 0], ["E", 1, 4, 5], ["F", 3, 4, 3],
    ]),
  },
  {
    id: "y2024-2-12",
    year: 2024,
    level: "상",
    tag: "2024 · 2회",
    title: "7일 단축 공정표",
    source: "2024년 2회 건축기사 실기 · 문제 12",
    solution: "half",
    ask: "표준 네트워크 공정표를 작성하고, 7일 단축한 네트워크 공정표를 작성하시오. 공기단축은 작업일수의 1/2을 넘길 수 없다.",
    problemImage: "exams/2024-2-12-q.png",
    answerImage: "exams/2024-2-12-a.png",
    jobs: [
      { name: "A", duration: 2, preds: [], from: 1, to: 2, slope: 50, cut: 0 },
      { name: "B", duration: 3, preds: [], from: 1, to: 3, slope: 40, cut: 1 },
      { name: "C", duration: 4, preds: [], from: 1, to: 4, slope: 30, cut: 2 },
      { name: "D", duration: 5, preds: ["A", "B", "C"], from: 2, to: 5, slope: 20, cut: 2 },
      { name: "E", duration: 6, preds: ["A", "B", "C"], from: 2, to: 6, slope: 10, cut: 3 },
      { name: "F", duration: 4, preds: ["B", "C"], from: 3, to: 6, slope: 15, cut: 1 },
      { name: "G", duration: 3, preds: ["C"], from: 4, to: 6, slope: 23, cut: 0 },
      { name: "H", duration: 6, preds: ["D", "F"], from: 5, to: 7, slope: 37, cut: 1 },
      { name: "I", duration: 7, preds: ["E", "G"], from: 6, to: 7, slope: 45, cut: 2 },
    ],
  },
  {
    id: "y2024-3-12",
    year: 2024,
    level: "상",
    tag: "2024 · 3회",
    title: "여유시간과 주공정",
    source: "2024년 3회 건축기사 실기 · 문제 12",
    solution: "sheet",
    path: "B → D",
    ask: "표준 네트워크 공정표를 작성하고 각 작업의 여유시간을 구하시오.",
    problemImage: "exams/2024-3-12-q.png",
    answerImage: "exams/2024-3-12-a.png",
    jobs: [
      { name: "A", duration: 2, preds: [] },
      { name: "B", duration: 5, preds: [] },
      { name: "C", duration: 3, preds: [] },
      { name: "D", duration: 4, preds: ["A", "B"] },
      { name: "E", duration: 3, preds: ["B", "C"] },
    ],
    activities: aoa([
      ["B", 0, 1, 5], ["A", 0, 2, 2], ["Dummy", 1, 2, 0], ["D", 2, 4, 4], ["C", 0, 3, 3], ["Dummy", 1, 3, 0], ["E", 3, 4, 3],
    ]),
  },
  {
    id: "y2025-1-10",
    year: 2025,
    level: "상",
    tag: "2025 · 1회",
    title: "주공정선 표시",
    source: "2025년 1회 건축기사 실기 · 문제 10",
    solution: "sheet",
    path: "B → D → F",
    ask: "네트워크 공정표를 작성하고 주공정선을 표시하시오.",
    problemImage: "exams/2025-1-10-q.png",
    answerImage: "exams/2025-1-10-a.png",
    jobs: [
      { name: "A", duration: 2, preds: [] },
      { name: "B", duration: 3, preds: [] },
      { name: "C", duration: 5, preds: ["A"] },
      { name: "D", duration: 5, preds: ["A", "B"] },
      { name: "E", duration: 2, preds: ["A", "B"] },
      { name: "F", duration: 3, preds: ["C", "D", "E"] },
      { name: "G", duration: 5, preds: ["E"] },
    ],
    activities: aoa([
      ["A", 0, 1, 2], ["B", 0, 2, 3], ["Dummy", 1, 2, 0], ["C", 1, 4, 5], ["D", 2, 4, 5],
      ["E", 2, 3, 2], ["Dummy", 3, 4, 0], ["F", 4, 5, 3], ["G", 3, 5, 5],
    ]),
  },
  {
    id: "y2025-2-23",
    year: 2025,
    level: "상",
    tag: "2025 · 2회",
    title: "여유시간",
    source: "2025년 2회 건축기사 실기 · 문제 23",
    solution: "sheet",
    path: "C → E",
    ask: "네트워크 공정표를 작성하고, 각 작업의 TF·FF·DF와 주공정을 구하시오.",
    problemImage: "exams/2025-2-23-q.png",
    answerImage: "exams/2025-2-23-a.png",
    jobs: [
      { name: "A", duration: 2, preds: [] },
      { name: "B", duration: 3, preds: [] },
      { name: "C", duration: 5, preds: [] },
      { name: "D", duration: 4, preds: [] },
      { name: "E", duration: 7, preds: ["A", "B", "C"] },
      { name: "F", duration: 4, preds: ["B", "C", "D"] },
    ],
    activities: aoa([
      ["C", 0, 1, 5], ["B", 0, 2, 3], ["Dummy", 1, 2, 0], ["A", 0, 3, 2], ["Dummy", 1, 3, 0], ["Dummy", 2, 3, 0],
      ["E", 3, 5, 7], ["D", 0, 4, 4], ["Dummy", 1, 4, 0], ["Dummy", 2, 4, 0], ["F", 4, 5, 4],
    ]),
  },
  {
    id: "y2025-3-12",
    year: 2025,
    level: "상",
    tag: "2025 · 3회",
    title: "10일 단축 공정표",
    source: "2025년 3회 건축기사 실기 · 문제 12",
    solution: "sheet",
    path: "C → H → I → K",
    project: 31,
    ask: "표준 네트워크 공정표를 작성하고, 공기를 10일 단축한 공정표와 그때의 총공사비를 구하시오.",
    problemImage: "exams/2025-3-12-q.png",
    answerImage: "exams/2025-3-12-a.png",
    normalCost: 1000000,
    jobs: [
      { name: "A", duration: 5, preds: [], slope: 10000 },
      { name: "B", duration: 8, preds: [], slope: 15000 },
      { name: "C", duration: 15, preds: [], slope: 9000, limit: 5 },
      { name: "D", duration: 3, preds: ["A"] },
      { name: "E", duration: 6, preds: ["A"], slope: 25000 },
      { name: "F", duration: 7, preds: ["B", "D"], slope: 30000 },
      { name: "G", duration: 9, preds: ["B", "D"], slope: 21000 },
      { name: "H", duration: 10, preds: ["C", "E"], slope: 8500, limit: 3 },
      { name: "I", duration: 4, preds: ["H", "F"], slope: 9500, limit: 2 },
      { name: "J", duration: 3, preds: ["G"] },
      { name: "K", duration: 2, preds: ["I", "J"] },
    ],
    crashSteps: [
      { day: 30, names: ["H"], cost: 8500 },
      { day: 29, names: ["H"], cost: 8500 },
      { day: 28, names: ["H"], cost: 8500 },
      { day: 27, names: ["C"], cost: 9000 },
      { day: 26, names: ["C"], cost: 9000 },
      { day: 25, names: ["C"], cost: 9000 },
      { day: 24, names: ["C"], cost: 9000 },
      { day: 23, names: ["I"], cost: 9500 },
      { day: 22, names: ["I"], cost: 9500 },
      { day: 21, names: ["A", "B", "C"], cost: 34000 },
    ],
  },
];

const CPM_QUIZ = [
  {
    level: "하",
    q: "화살선식에서 화살표가 나타내는 것은?",
    choices: ["결합점", "작업", "여유시간", "공기"],
    answer: 1,
    why: "결합점은 점이고, 화살표가 작업입니다. 화살표 위의 숫자가 그 작업의 기간입니다.",
  },
  {
    level: "하",
    q: "선행 작업이 없는 시작 결합점의 TE는?",
    choices: ["공기와 같다", "1이다", "0이다", "작업 개수와 같다"],
    answer: 2,
    why: "공사가 시작되는 시각입니다. 앞에 일이 없으면 TE는 0일입니다.",
  },
  {
    level: "하",
    q: "CPM에서 프로젝트 공기는 무엇으로 정하는가?",
    choices: [
      "모든 작업 기간의 합",
      "최단 경로의 기간 합",
      "마지막 결합점의 최초시각 TE(끝)",
      "더미 작업 개수",
    ],
    answer: 2,
    why: "같이 진행되는 일이 있으므로 기간을 모두 더하지 않습니다. 맨 오른쪽 결합점의 TE가 공기입니다.",
  },
  {
    level: "하",
    q: "주공정 작업의 총여유시간 TF는?",
    choices: ["항상 1", "0", "자유여유보다 반드시 작다", "음수"],
    answer: 1,
    why: "TF가 0이면 하루만 늦어도 전체 공기가 늘어납니다. 그래서 주공정입니다.",
  },
  {
    level: "중",
    q: "작업 i-j의 총여유 TF 공식으로 옳은 것은?",
    choices: ["TE(i) + D", "TL(j) − TE(i) − D", "TE(j) + TL(i)", "LS + LF"],
    answer: 1,
    why: "끝 결합점의 늦은 시각에서 시작 결합점의 빠른 시각과 기간을 빼면, 밀어도 되는 날이 남습니다.",
  },
  {
    level: "중",
    q: "자유여유 FF의 의미로 가장 가까운 것은?",
    choices: [
      "공기를 밀지 않는 최대 지연",
      "후행 작업의 최초시작을 밀지 않는 여유",
      "비용 단축량",
      "더미의 기간",
    ],
    answer: 1,
    why: "FF는 바로 다음 일의 ES를 밀지 않는 여유입니다. 공기 전체를 안 미루는 여유는 TF입니다.",
  },
  {
    level: "하",
    q: "더미(가상작업)에 대한 설명으로 옳은 것은?",
    choices: [
      "기간을 임의로 정한다",
      "실제 작업이며 노무비가 든다",
      "기간 0으로 선후관계만 표시한다",
      "항상 주공정에 들어간다",
    ],
    answer: 2,
    why: "더미는 점선이고 기간이 0입니다. 하는 일이 아니라 순서만 잇습니다. 주공정에 들어갈 수도, 안 들어갈 수도 있습니다.",
  },
  {
    level: "중",
    q: "전진계산에서 한 결합점의 TE는?",
    choices: [
      "들어오는 작업 EF의 최댓값",
      "나가는 작업 LS의 최솟값",
      "모든 TF의 합",
      "항상 0",
    ],
    answer: 0,
    why: "만나는 점에서는 더 늦게 도착하는 작업을 기다립니다. 그래서 들어온 EF의 최댓값입니다.",
  },
  {
    level: "중",
    q: "후진계산에서 한 결합점의 TL은?",
    choices: [
      "들어오는 EF의 최댓값",
      "나가는 작업 (TL(j) − D)의 최솟값",
      "TE와 항상 같다",
      "작업 개수",
    ],
    answer: 1,
    why: "왼쪽으로 돌아올 때는 가장 급한 후행 작업에 맞춥니다. 그래서 최솟값입니다.",
  },
  {
    level: "중",
    q: "공기를 줄이려면 우선 무엇을 단축해야 하는가?",
    choices: ["여유 있는 비주공정", "주공정 작업의 기간", "더미만", "후진계산만"],
    answer: 1,
    why: "주공정이 아닌 일만 줄이면 여유만 늘고 준공일은 그대로입니다. 공기와 같은 길을 줄여야 합니다.",
  },
  {
    level: "상",
    q: "기본 네트워크(A3, B2, C4, D5, E2)의 공기와 주공정은?",
    choices: ["7일, B-E", "8일, A-D", "9일, A-C-E", "11일, A-C-D"],
    answer: 2,
    why: "A+C+E = 3+4+2 = 9일이 가장 긴 길입니다. A+D = 8일로 더 짧습니다.",
  },
  {
    level: "중",
    q: "FF ≤ TF 가 항상 성립하는 이유로 가장 가까운 것은?",
    choices: [
      "TE(j) ≤ TL(j) 이므로 FF = TE(j)−TE(i)−D ≤ TL(j)−TE(i)−D = TF",
      "더미가 없어서",
      "주공정만 계산하므로",
      "LS가 항상 0이므로",
    ],
    answer: 0,
    why: "끝 결합점의 빠른 시각 TE는 늦은 시각 TL보다 늦을 수 없습니다. 그래서 FF가 TF를 넘지 않습니다.",
  },
  {
    level: "중",
    q: "간섭여유 DF를 바르게 나타낸 것은?",
    choices: ["TF + FF", "TF − FF", "FF − TF", "ES + D"],
    answer: 1,
    why: "DF는 총여유에서 자유여유를 뺀 날입니다. 이 날을 쓰면 뒤 작업의 여유도 함께 줄어듭니다.",
  },
  {
    level: "중",
    q: "작업 A와 B가 모두 결합점 1에서 결합점 2로 출발하면 ADM에서 어떻게 해야 하는가?",
    choices: [
      "두 화살표를 그대로 겹쳐 둔다",
      "기간이 긴 작업만 남긴다",
      "하나를 다른 결합점으로 빼고 점선 더미로 잇는다",
      "결합점 번호를 둘 다 0으로 한다",
    ],
    answer: 2,
    why: "두 작업이 똑같은 시작 번호와 끝 번호를 가질 수 없습니다. 더미로 결합점을 나눠 번호가 겹치지 않게 합니다.",
  },
  {
    level: "상",
    q: "A는 4일, B는 6일이고 둘 다 선행이 없습니다. C는 A와 B가 끝난 뒤 3일입니다. 공기와 주공정은?",
    choices: ["7일, A-C", "9일, B-C", "13일, A-B-C", "6일, B"],
    answer: 1,
    why: "C는 더 늦게 끝나는 B를 기다립니다. 6+3=9일이 공기이고, 주공정은 B-C입니다. A-C는 7일로 더 짧습니다.",
  },
  {
    level: "상",
    q: "A는 4일, B는 6일이고 둘 다 선행이 없습니다. C는 A와 B가 끝난 뒤 3일입니다. A의 TF는?",
    choices: ["0일", "2일", "4일", "6일"],
    answer: 1,
    why: "C는 6일에 시작합니다. A는 4일에 끝나므로 2일을 더 써도 C의 시작이 그대로입니다. TF = 2일입니다.",
  },
  {
    level: "상",
    q: "어떤 작업의 TF가 5일, FF가 2일입니다. DF는?",
    choices: ["7일", "3일", "2.5일", "0일"],
    answer: 1,
    why: "DF = TF − FF = 5 − 2 = 3일입니다. 이 3일을 쓰면 뒤 작업의 여유가 줄어듭니다.",
  },
  {
    level: "상",
    q: "A 5일, B 3일, C 4일이고 B와 C의 선행은 A뿐입니다. 공기는?",
    choices: ["8일", "9일", "12일", "7일"],
    answer: 1,
    why: "A 다음에 B를 하면 5+3=8일, A 다음에 C를 하면 5+4=9일입니다. 같이 진행되므로 공기 9일, 주공정은 A-C입니다.",
  },
];
