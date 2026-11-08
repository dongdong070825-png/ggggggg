const app = document.getElementById("app");

function parseHash() {
  const raw = location.hash.replace(/^#/, "") || "/";
  const parts = raw.split("/").filter(Boolean).map((part) => {
    try {
      return decodeURIComponent(part);
    } catch (e) {
      return part;
    }
  });
  return { parts, path: "/" + parts.join("/") };
}

function loadNotes() {
  try {
    const raw = JSON.parse(localStorage.getItem("cpm-wrong-notes") || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch (e) {
    return [];
  }
}

function saveNotes(list) {
  try {
    localStorage.setItem("cpm-wrong-notes", JSON.stringify(list.slice(0, 80)));
  } catch (e) {
    /* ignore quota */
  }
}

function forgetNote(id) {
  saveNotes(loadNotes().filter((n) => n.id !== id));
}

function rememberNote(note) {
  const rest = loadNotes().filter((n) => n.id !== note.id);
  saveNotes([{ ...note, at: Date.now() }, ...rest]);
  refreshNoteCount();
}

function refreshNoteCount() {
  const n = loadNotes().length;
  const badge = document.getElementById("note-count");
  if (!badge) return;
  badge.hidden = n === 0;
  badge.textContent = String(n);
}

function navActive() {
  const { parts } = parseHash();
  const [a, b] = parts;
  const current = !a
    ? "home"
    : a === "gantt"
      ? "gantt"
      : a === "glossary"
        ? "glossary"
        : a === "solve"
        ? "solve"
        : a === "cpm" && b === "learn"
          ? "learn"
          : a === "cpm" || a === "notes"
            ? "practice"
            : "";
  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.classList.toggle("active", el.dataset.nav === current);
  });
  const back = document.getElementById("nav-back");
  if (back) back.hidden = current === "home";
  refreshNoteCount();
}

function homeView() {
  const notes = loadNotes().length;
  return `
    <section class="sheet-hero">
      <div class="kicker">건축 공정 · 도면실</div>
      <h1>공정표를 그리는 곳</h1>
      <p class="lead">
        공사 일정을 결합점과 화살표로 익힙니다. 처음이면 기초부터, 계산이 필요하면 실습으로 들어가면 됩니다.
      </p>
      <nav class="gate-nav" aria-label="첫 화면 메뉴">
        <a class="gate-btn" href="#/cpm/learn/schedule" data-nav="learn" data-link><span class="step-no">1</span><span class="mark mark-learn" aria-hidden="true"></span><b>기초</b><small>개념을 순서대로</small></a>
        <a class="gate-btn" href="#/gantt" data-nav="gantt" data-link><span class="step-no">2</span><span class="mark mark-gantt" aria-hidden="true"></span><b>간트차트</b><small>저장한 공정표를 막대로</small></a>
        <a class="gate-btn" href="#/cpm" data-nav="practice" data-link><span class="step-no">3</span><span class="mark mark-practice" aria-hidden="true"></span><b>실습</b><small>${notes ? `연습 다섯 가지 · 오답 ${notes}` : "그리기, 계산, 연습"}</small></a>
        <a class="gate-btn" href="#/solve" data-nav="solve" data-link><span class="step-no">4</span><span class="mark mark-solve" aria-hidden="true"></span><b>문제풀이</b><small>문제은행 · 사진 해설</small></a>
      </nav>
    </section>
  `;
}

function glossaryView() {
  return `
    <div class="kicker">WORDS</div>
    <h1>용어사전</h1>
    <p class="lead">공정표를 처음 볼 때 나오는 말입니다. 강의에서 한 번씩 나온 뒤, 여기서 짧게 다시 볼 수 있습니다.</p>
    ${CPM_GLOSSARY.map(
      (g) => `<div class="term" id="term-${encodeURIComponent(g.term)}"><h3>${g.term}</h3><p>${g.def}</p></div>`
    ).join("")}
  `;
}
function problemCard(p) {
  const best = loadBest()[p.id];
  return `
    <a class="card" href="#/cpm/walk/${p.id}" data-link>
      <span class="badge">${p.level}</span>
      ${best == null ? "" : `<span class="badge best">도전 ${best}점</span>`}
      <h3>${p.title}</h3>
      <p>${p.brief}</p>
    </a>
  `;
}

const quizUi = { level: "", order: [], at: 0, choice: null, round: 1 };

function startQuiz(level, keepRound) {
  const order = CPM_QUIZ.map((item, index) => ({ item, index })).filter((row) => row.item.level === level);
  for (let i = order.length - 1; i > 0; i -= 1) {
    const swap = Math.floor(Math.random() * (i + 1));
    const hold = order[i];
    order[i] = order[swap];
    order[swap] = hold;
  }
  quizUi.level = level;
  quizUi.order = order;
  quizUi.at = 0;
  quizUi.choice = null;
  if (!keepRound) quizUi.round = 1;
}

function cpmQuizView(level) {
    const bands = [
      ["하", "뜻을 고릅니다.", "용어와 기호의 뜻", "mark-low"],
      ["중", "공식과 순서를 고릅니다.", "계산 순서와 공식", "mark-mid"],
      ["상", "공기와 여유를 계산합니다.", "공기, TF, FF, DF", "mark-high"],
    ];
  if (level !== "하" && level !== "중" && level !== "상") {
    return `
      <div class="kicker">객관식</div>
      <h1>난이도를 골라 풀기</h1>
      <p class="lead">상, 중, 하 중에서 하나를 고르면 그 난이도 문제가 하나씩 나옵니다. 채점한 뒤 다음 문제로 이어집니다.</p>
      <nav class="hub-menu" aria-label="난이도">
        ${bands
          .map(
            ([name, desc, detail, mark]) =>
              `<a class="gate-btn" href="#/cpm/quiz/${name}" data-link><span class="mark ${mark}" aria-hidden="true"></span><b>${name}</b><small>${desc}</small><small>${detail}</small></a>`
          )
          .join("")}
      </nav>
    `;
  }
  if (quizUi.level !== level || !quizUi.order.length) startQuiz(level);
  const current = quizUi.order[quizUi.at];
  const item = current.item;
  const picked = quizUi.choice;
  const done = picked != null;
  return `
    <div class="kicker">객관식 · ${level} · ${quizUi.at + 1} / ${quizUi.order.length}</div>
    <h1>${quizUi.round > 1 && quizUi.at === 0 && !done ? "같은 난이도를 다시 이어 갑니다" : "한 문제씩 풀기"}</h1>
    <p class="lead">${level === "하" ? "뜻을 확인하는 문제입니다." : level === "중" ? "공식과 순서를 고르는 문제입니다." : "공기와 여유를 계산하는 문제입니다."} 답을 고르면 채점되고, 다음 문제로 이어집니다.</p>
    <p><a class="btn ghost" href="#/cpm/quiz" data-link>난이도 다시 고르기</a></p>
    <div class="quiz-item" data-cpm-quiz="${current.index}">
      <strong>${quizUi.at + 1}. ${item.q}</strong>
      <div class="options">
        ${item.choices
          .map((choice, choiceIndex) => {
            const mark = done && choiceIndex === item.answer ? "correct" : done && choiceIndex === picked && picked !== item.answer ? "wrong" : "";
            return `<button type="button" data-quiz-choice="${choiceIndex}" class="${mark}" ${done ? "disabled" : ""}>${choice}</button>`;
          })
          .join("")}
      </div>
      ${
        done
          ? `<p class="quiz-why">${picked === item.answer ? item.why : `오답노트에 넣어 두었습니다. ${item.why}`}</p>
             <p><button type="button" class="btn next" data-quiz-next>다음 문제</button></p>
             ${reactFigure(picked === item.answer ? "ok" : "bad", "react-quiz")}`
          : ""
      }
    </div>
  `;
}

function cpmHub() {
  const notes = loadNotes().length;
  return `
    <div class="kicker">실습</div>
    <h1>문제로 익히기</h1>
    <p class="lead">계산 문제만 모아 두었습니다. 개념 설명은 기초 강의에 있습니다.</p>
    <nav class="hub-menu" aria-label="실습 메뉴">
      <a class="gate-btn" href="#/cpm/draw" data-link><span class="mark mark-draw" aria-hidden="true"></span><b>공정표 그리기</b><small>결합점과 화살표로 작성</small></a>
      <a class="gate-btn" href="#/cpm/walk/roll" data-link><span class="mark mark-walk" aria-hidden="true"></span><b>따라 계산하기</b><small>들어올 때마다 다른 공정표를 한 단계씩</small></a>
      <a class="gate-btn" href="#/cpm/play/roll" data-link><span class="mark mark-play" aria-hidden="true"></span><b>한 칸 연습</b><small>숫자를 직접 넣고 바로 확인</small></a>
      <a class="gate-btn" href="#/notes" data-link><span class="mark mark-notes" aria-hidden="true"></span><b>오답노트</b><small>${notes ? `틀린 문제 ${notes}개` : "틀린 문제만 다시"}</small></a>
      <a class="gate-btn" href="#/cpm/quiz" data-link><span class="mark mark-quiz" aria-hidden="true"></span><b>객관식</b><small>난이도를 고르고 이어서 풀기</small></a>
    </nav>
  `;
}

function lessonPoints(points) {
  if (!points || !points.length) return "";
  return `<div class="term-grid">${points
    .map(([name, text]) => `<div><b>${name}</b><span>${text}</span></div>`)
    .join("")}</div>`;
}

function lessonFigure(example) {
  if (!example) return "";
  const solved = solveCpm(example.activities);
  const opt = {
    showCrit: example.showCrit !== false,
    caption: example.caption || "",
  };
  if (example.reveal === false) {
    opt.revealTE = [];
    opt.revealTL = [];
  }
  const cols = example.table === "all" ? ["es", "ef", "ls", "lf", "tf", "ff"] : example.table === "es" ? ["es", "ef"] : [];
  const table = cols.length
    ? `<div class="table-wrap"><table class="cpm-table"><thead><tr><th>작업</th><th>D</th>${cols
        .map((k) => `<th>${k.toUpperCase()}</th>`)
        .join("")}</tr></thead><tbody>${solved.rows
        .map(
          (r) =>
            `<tr class="${example.showCrit !== false && r.critical ? "is-crit" : ""}"><td>${r.name}</td><td>${r.duration}</td>${cols
              .map((k) => `<td>${r[k]}</td>`)
              .join("")}</tr>`
        )
        .join("")}</tbody></table></div>`
    : "";
  const summary =
    example.reveal === false
      ? ""
      : example.showCrit === false
        ? `<p>끝 결합점의 최초시각은 <strong>${solved.project}일</strong>입니다.</p>`
        : `<p>공기 <strong>${solved.project}일</strong> · 주공정 ${criticalPathLabels(solved)}</p>`;
  return `<div class="net-panel">${cpmSvg(solved, opt)}</div>${summary}${table}${example.talk ? `<p>${example.talk}</p>` : ""}`;
}

function cpmLearn(id) {
  const lesson = CPM_THEORY.find((t) => t.id === id) || CPM_THEORY[0];
  const idx = CPM_THEORY.findIndex((t) => t.id === lesson.id);
  const prev = CPM_THEORY[idx - 1];
  const next = CPM_THEORY[idx + 1];
  return `
    <div class="lesson-layout">
      <aside class="side">
        <div class="kicker">CPM</div>
        <h3>개념 강의</h3>
        ${CPM_THEORY.map(
          (t) =>
            `<a href="#/cpm/learn/${t.id}" data-link class="${t.id === lesson.id ? "active" : ""}">${t.title}</a>`
        ).join("")}
        <a href="#/cpm" data-link><span class="mark mark-practice" aria-hidden="true"></span>실습으로</a>
      </aside>
      <article class="article">
        <div class="kicker">${idx + 1} / ${CPM_THEORY.length}</div>
        <h1>${lesson.title}</h1>
        ${lesson.body.map((p) => `<p>${p}</p>`).join("")}
        ${lessonPoints(lesson.points)}
        ${lesson.formula ? `<div class="formula">${lesson.formula.replace(/\n/g, "<br/>")}</div>` : ""}
        ${lessonFigure(lesson.example)}
        <p style="margin-top:28px; display:flex; gap:10px; flex-wrap:wrap">
          ${prev ? `<a class="btn ghost prev" href="#/cpm/learn/${prev.id}" data-link>이전</a>` : ""}
          ${next ? `<a class="btn next" href="#/cpm/learn/${next.id}" data-link>다음: ${next.title}</a>` : `<a class="btn next" href="#/cpm/walk/basic" data-link>따라 계산하기</a>`}
        </p>
      </article>
    </div>
  `;
}

const walkUi = { id: null, key: null, step: 0 };
const practiceUi = { id: null, key: null, reveal: false };
const sessionNets = { roll: null };
const drawUi = {
  problem: null,
  nodes: [],
  arrows: [],
  nextNode: 2,
  nextArrow: 1,
  tool: "node",
  arm: null,
  pending: null,
  lines: [],
  checks: [],
  ok: false,
  showAnswer: false,
  tableMsg: "",
  tableHint: false,
  panel: "table",
  answers: [],
  bankFor: "",
};
const ganttUi = { source: "draw", selected: "" };
const ganttStore = { draw: null, solve: null };
const crashUi = { id: null, cuts: {} };
const playUi = {
  id: null,
  step: 0,
  score: 0,
  streak: 0,
  bestStreak: 0,
  attempts: 0,
  hinted: false,
  status: "ask",
  feedback: null,
  done: false,
  draft: "",
  picked: [],
  first: 0,
  later: 0,
  zero: 0,
  recorded: false,
  percent: 0,
  beat: false,
  prevBest: null,
};

function problemKey(problem) {
  return problem.key || problem.id;
}

function freshSeed() {
  freshSeed.n = (freshSeed.n || 0) + 1;
  return (Date.now() + freshSeed.n * 997) >>> 0;
}

function problemBy(id) {
  if (id === "roll") {
    if (!sessionNets.roll) sessionNets.roll = rollNetwork(freshSeed());
    return sessionNets.roll;
  }
  return CPM_PROBLEMS.find((p) => p.id === id) || CPM_PROBLEMS[0];
}

function cpmWalk(id) {
  const problem = problemBy(id);
  if (walkUi.id !== problem.id || walkUi.key !== problemKey(problem)) {
    walkUi.id = problem.id;
    walkUi.key = problemKey(problem);
    walkUi.step = 0;
  }
  const { solved, steps } = buildWalkthrough(problem);
  const last = steps.length - 1;
  walkUi.step = Math.max(0, Math.min(last, walkUi.step));
  const s = steps[walkUi.step];
  const pct = Math.round(((walkUi.step + 1) / steps.length) * 100);
  const idx = CPM_PROBLEMS.findIndex((p) => p.id === problem.id);
  const nextP = CPM_PROBLEMS[idx + 1];
  return `
    <div id="cpm-walk" data-id="${problem.id}">
      <div class="kicker">${problem.level} · 따라 계산하기</div>
      <h1>${problem.title}</h1>
      <p class="lead">한 단계씩 전진 → 공기 → 후진 → 작업 여유 → 주공정 순입니다. 결합점 숫자는 해당 단계가 되어야 열립니다.</p>
      <div class="walk-meta">
        <span>${walkUi.step + 1} / ${steps.length} · ${s.title}</span>
        ${
          problem.id === "roll"
            ? ""
            : `<span>${CPM_PROBLEMS.map(
                (p) =>
                  `<a href="#/cpm/walk/${p.id}" data-link class="${p.id === problem.id ? "active" : ""}">${p.title}</a>`
              ).join(" · ")}</span>`
        }
      </div>
      <div class="progress"><span style="width:${pct}%"></span></div>
      <div class="net-panel">${cpmSvg(solved, s)}</div>
      <div class="walk-card">${s.html}</div>
      <p style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
        <button type="button" class="btn ghost prev" id="walk-prev">이전 단계</button>
        <button type="button" class="btn next" id="walk-next">${walkUi.step === last ? "한 칸 도전" : "다음 단계"}</button>
        ${nextP && walkUi.step === last ? `<a class="btn ghost" href="#/cpm/walk/${nextP.id}" data-link>다음 네트워크</a>` : ""}
      </p>
    </div>
  `;
}

function cpmPractice(id) {
  const problem = problemBy(id === "roll" || !id ? "roll" : id);
  const key = problemKey(problem);
  if (practiceUi.id !== problem.id || practiceUi.key !== key) {
    practiceUi.id = problem.id;
    practiceUi.key = key;
    practiceUi.reveal = false;
  }
  const solved = solveCpm(problem.activities);
  const idx = CPM_PROBLEMS.findIndex((p) => p.id === problem.id);
  const next = CPM_PROBLEMS[idx + 1];
  const prev = CPM_PROBLEMS[idx - 1];
  const shown = practiceUi.reveal ? "all" : [];
  return `
    <div class="kicker">${problem.level}</div>
    <h1>${problem.title}</h1>
    <p class="lead">${problem.brief} 공기와 주공정선을 구한 뒤, 표에 ES·EF·LS·LF·TF·FF를 넣고 채점하세요. 기본은 결합점 숫자를 가립니다.</p>
    <div class="net-panel">${cpmSvg(solved, { revealTE: shown, revealTL: shown, showCrit: practiceUi.reveal })}</div>
    <div class="hint-bar">
      <span>끝 결합점 개수 ${solved.ids.length}개 · 작업 ${solved.rows.length}개</span>
      <button type="button" class="btn ghost" id="cpm-toggle-nodes">${practiceUi.reveal ? "결합점 숨기기" : "결합점 TE/TL 보기"}</button>
      <button type="button" class="btn ghost" id="cpm-reveal">정답 채우기</button>
      <button type="button" class="btn" id="cpm-check">채점</button>
      <button type="button" class="btn" id="cpm-new">다른 공정표</button>
      <a class="btn ghost" href="#/cpm/play/${problem.id}" data-link>한 칸 도전</a>
      <a class="btn ghost" href="#/cpm/walk/${problem.id}" data-link>따라 계산</a>
    </div>
    <div class="table-wrap">
      <table class="cpm-table" id="cpm-sheet" data-problem="${problem.id}">
        <thead>
          <tr>
            <th>작업</th><th>i-j</th><th>D</th>
            <th>ES</th><th>EF</th><th>LS</th><th>LF</th><th>TF</th><th>FF</th>
          </tr>
        </thead>
        <tbody>
          ${solved.rows
            .map(
              (r, i) => `
            <tr data-row="${i}" class="${r.critical && practiceUi.reveal ? "is-crit" : ""}">
              <td>${r.name}</td>
              <td>${r.from}-${r.to}</td>
              <td>${r.duration}</td>
              ${["es", "ef", "ls", "lf", "tf", "ff"]
                .map(
                  (k) =>
                    `<td><input inputmode="numeric" data-k="${k}" data-ans="${r[k]}" aria-label="${r.name} ${k}"></td>`
                )
                .join("")}
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
    <p id="cpm-result" class="lead"></p>
    <p style="display:flex;gap:10px;flex-wrap:wrap">
      ${
        problem.id === "roll"
          ? `<a class="btn ghost" href="#/cpm/draw" data-link>직접 그리기</a>`
          : `${prev ? `<a class="btn ghost" href="#/cpm/practice/${prev.id}" data-link>이전 예시</a>` : `<a class="btn ghost" href="#/cpm/learn/tf" data-link>총여유 강의</a>`}
      ${next ? `<a class="btn" href="#/cpm/practice/${next.id}" data-link>다음 예시</a>` : `<a class="btn" href="#/cpm/practice/roll" data-link>새 공정표</a>`}`
      }
    </p>
  `;
}

function crashedActivities(problem) {
  return problem.activities.map((a) => {
    const cut = crashUi.cuts[a.name] || 0;
    const duration = Math.max(a.dummy ? 0 : 1, a.duration - cut);
    return { ...a, duration };
  });
}

function cpmCrash(id) {
  const problem = problemBy(id);
  if (crashUi.id !== problem.id) {
    crashUi.id = problem.id;
    crashUi.cuts = {};
  }
  const base = solveCpm(problem.activities);
  const now = solveCpm(crashedActivities(problem));
  const saved = base.project - now.project;
  return `
    <div id="cpm-crash" data-id="${problem.id}">
      <div class="kicker">CRASH</div>
      <h1>공기 단축 실험 · ${problem.title}</h1>
      <p class="lead">주공정 작업을 하루 줄이면 공기가 줄어듭니다. 비주공정만 줄이면 공기는 그대로입니다. 최소 기간은 1일(더미는 0)입니다.</p>
      <p><strong>원래 공기 ${base.project}일</strong> → 지금 <strong>${now.project}일</strong> (${saved > 0 ? `${saved}일 단축` : "단축 없음"})</p>
      <div class="crash-btns">
        ${problem.activities
          .map((a) => {
            const cut = crashUi.cuts[a.name] || 0;
            return `<button type="button" class="btn ghost" data-crash="${a.name}">${a.name} −1일 (현재 −${cut})</button>`;
          })
          .join("")}
        <button type="button" class="btn" id="crash-reset">원위치</button>
      </div>
      <div class="net-panel">${cpmSvg(now)}</div>
      ${renderLab(crashedActivities(problem), false)}
    </div>
  `;
}

function cpmLab() {
  return `
    <div class="kicker">CALCULATOR</div>
    <h1>네트워크 계산기</h1>
    <p class="lead">화살선식 작업을 입력하면 TE·TL과 여유시간, 주공정선을 계산합니다. 더미는 기간 0으로 넣으세요.</p>
    <form id="cpm-lab" class="lab-form">
      <div class="table-wrap">
        <table class="cpm-table">
          <thead><tr><th>작업명</th><th>시작 i</th><th>종료 j</th><th>기간 D</th></tr></thead>
          <tbody id="lab-rows">
            <tr><td><input name="name" value="A" required></td><td><input name="from" value="1" required></td><td><input name="to" value="2" required></td><td><input name="dur" value="3" required></td></tr>
            <tr><td><input name="name" value="B"></td><td><input name="from" value="1"></td><td><input name="to" value="3"></td><td><input name="dur" value="2"></td></tr>
            <tr><td><input name="name" value="C"></td><td><input name="from" value="2"></td><td><input name="to" value="3"></td><td><input name="dur" value="4"></td></tr>
            <tr><td><input name="name" value="D"></td><td><input name="from" value="2"></td><td><input name="to" value="4"></td><td><input name="dur" value="5"></td></tr>
            <tr><td><input name="name" value="E"></td><td><input name="from" value="3"></td><td><input name="to" value="4"></td><td><input name="dur" value="2"></td></tr>
          </tbody>
        </table>
      </div>
      <p>
        <button type="button" class="btn ghost" id="lab-add">작업 추가</button>
        <button type="submit" class="btn">계산</button>
      </p>
    </form>
    <div id="lab-out"></div>
  `;
}

function renderLab(activities, withSvg = true) {
  const solved = solveCpm(activities);
  const path = criticalPathLabels(solved, true);
  return `
    ${withSvg ? cpmSvg(solved) : ""}
    <p><strong>공기 ${solved.project}</strong> · 주공정: ${path || "없음"}</p>
    <div class="table-wrap">
      <table class="cpm-table">
        <thead><tr><th>작업</th><th>i-j</th><th>D</th><th>ES</th><th>EF</th><th>LS</th><th>LF</th><th>TF</th><th>FF</th></tr></thead>
        <tbody>
          ${solved.rows
            .map(
              (r) =>
                `<tr class="${r.critical ? "is-crit" : ""}"><td>${r.name}</td><td>${r.from}-${r.to}</td><td>${r.duration}</td><td>${r.es}</td><td>${r.ef}</td><td>${r.ls}</td><td>${r.lf}</td><td>${r.tf}</td><td>${r.ff}</td></tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function bindCpmWalk() {
  const root = document.getElementById("cpm-walk");
  if (!root) return;
  const id = root.dataset.id;
  const { steps } = buildWalkthrough(problemBy(id));
  const paint = () => {
    app.innerHTML = cpmWalk(id);
    bindCpmWalk();
  };
  document.getElementById("walk-prev")?.addEventListener("click", () => {
    walkUi.step = Math.max(0, walkUi.step - 1);
    paint();
  });
  document.getElementById("walk-next")?.addEventListener("click", () => {
    if (walkUi.step >= steps.length - 1) {
      location.hash = `#/cpm/play/${id}`;
      return;
    }
    walkUi.step += 1;
    paint();
  });
}

function bindCpmCrash() {
  const root = document.getElementById("cpm-crash");
  if (!root) return;
  const id = root.dataset.id;
  const paint = () => {
    app.innerHTML = cpmCrash(id);
    bindCpmCrash();
  };
  document.getElementById("crash-reset")?.addEventListener("click", () => {
    crashUi.cuts = {};
    paint();
  });
  root.querySelectorAll("[data-crash]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-crash");
      crashUi.cuts[name] = (crashUi.cuts[name] || 0) + 1;
      paint();
    });
  });
}

function bindCpmPractice() {
  const sheet = document.getElementById("cpm-sheet");
  if (!sheet) return;
  const result = document.getElementById("cpm-result");
  document.getElementById("cpm-toggle-nodes")?.addEventListener("click", () => {
    practiceUi.reveal = !practiceUi.reveal;
    const values = [...sheet.querySelectorAll("input")].map((i) => i.value);
    app.innerHTML = cpmPractice(sheet.dataset.problem);
    bindCpmPractice();
    document.querySelectorAll("#cpm-sheet input").forEach((inp, i) => {
      inp.value = values[i] || "";
    });
  });
  document.getElementById("cpm-reveal")?.addEventListener("click", () => {
    sheet.querySelectorAll("input[data-ans]").forEach((inp) => {
      inp.value = inp.dataset.ans;
      inp.classList.remove("bad", "ok");
    });
    sheet.querySelectorAll("tr[data-row]").forEach((tr) => {
      const tf = tr.querySelector('input[data-k="tf"]');
      if (tf && Number(tf.dataset.ans) === 0) tr.classList.add("is-crit");
    });
    result.textContent = "정답을 채웠습니다. TF가 0인 행이 주공정입니다.";
  });
  document.getElementById("cpm-new")?.addEventListener("click", () => {
    const onRoll = location.hash === "#/cpm/practice/roll" || location.hash === "#/cpm/practice";
    if (!onRoll) {
      location.hash = "#/cpm/practice/roll";
      return;
    }
    sessionNets.roll = rollNetwork(freshSeed());
    practiceUi.id = null;
    practiceUi.key = null;
    app.innerHTML = cpmPractice("roll");
    bindCpmPractice();
  });
  document.getElementById("cpm-check")?.addEventListener("click", () => {
    let ok = 0;
    let total = 0;
    sheet.querySelectorAll("input[data-ans]").forEach((inp) => {
      total += 1;
      const v = Number(String(inp.value).trim());
      const ans = Number(inp.dataset.ans);
      const good = inp.value !== "" && v === ans;
      inp.classList.toggle("ok", good);
      inp.classList.toggle("bad", !good);
      if (good) ok += 1;
    });
    sheet.querySelectorAll("tr[data-row]").forEach((tr) => {
      const tf = tr.querySelector('input[data-k="tf"]');
      if (tf && Number(tf.dataset.ans) === 0) tr.classList.add("is-crit");
    });
    result.innerHTML = `${ok} / ${total} 칸 정답. 주공정은 TF = 0 인 작업입니다.${reactFigure(total && ok === total ? "ok" : "bad")}`;
  });
}

function bindCpmLab() {
  const form = document.getElementById("cpm-lab");
  if (!form) return;
  const tbody = document.getElementById("lab-rows");
  document.getElementById("lab-add")?.addEventListener("click", () => {
    const tr = document.createElement("tr");
    tr.innerHTML =
      `<td><input name="name" placeholder="F"></td><td><input name="from"></td><td><input name="to"></td><td><input name="dur"></td>`;
    tbody.appendChild(tr);
  });
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const rows = [...tbody.querySelectorAll("tr")];
    const activities = rows
      .map((tr) => {
        const [name, from, to, dur] = [...tr.querySelectorAll("input")].map((i) => i.value.trim());
        if (!from || !to || dur === "") return null;
        const duration = Number(dur);
        return {
          name: name || `${from}-${to}`,
          from: Number(from),
          to: Number(to),
          duration,
          dummy: duration === 0,
        };
      })
      .filter(Boolean);
    const out = document.getElementById("lab-out");
    if (activities.length === 0) {
      out.innerHTML = "<p>작업을 한 줄 이상 입력하세요.</p>";
      return;
    }
    try {
      out.innerHTML = renderLab(activities);
    } catch (err) {
      out.innerHTML = `<p>계산할 수 없습니다. 결합점 번호와 선후를 확인하세요.</p>`;
    }
  });
}

function loadBest() {
  try {
    return JSON.parse(localStorage.getItem("cpm-play-best") || "{}");
  } catch (e) {
    return {};
  }
}

function saveBest(id, percent) {
  const all = loadBest();
  const prev = all[id];
  const beat = prev == null || percent > prev;
  if (beat) {
    all[id] = percent;
    try {
      localStorage.setItem("cpm-play-best", JSON.stringify(all));
    } catch (e) {
      /* ignore quota */
    }
  }
  return { prev, beat };
}

function resetPlay(id) {
  playUi.id = id;
  playUi.step = 0;
  playUi.score = 0;
  playUi.streak = 0;
  playUi.bestStreak = 0;
  playUi.attempts = 0;
  playUi.hinted = false;
  playUi.status = "ask";
  playUi.feedback = null;
  playUi.done = false;
  playUi.draft = "";
  playUi.picked = [];
  playUi.first = 0;
  playUi.later = 0;
  playUi.zero = 0;
  playUi.recorded = false;
  playUi.percent = 0;
  playUi.beat = false;
  playUi.prevBest = null;
}

function playRank(percent) {
  if (percent === 100) return ["현장소장", "공기 감각이 정확합니다. 기사 문제도 이 순서면 됩니다."];
  if (percent >= 80) return ["기사", "시험장에서도 전진, 공기, 후진, 여유 순서로 풀 수 있습니다."];
  if (percent >= 50) return ["실습생", "최댓값과 최솟값을 다시 한 번 구분하면 주공정이 보입니다."];
  return ["입문", "따라 계산하기에서 전진과 후진을 한 바퀴 보고 다시 도전해 보세요."];
}

function mascotSrc(file) {
  const rel = String(file).replace(/^\/+/, "");
  const path = location.pathname;
  const dir = path.endsWith("/")
    ? path
    : /\.[^/]+$/.test(path)
      ? path.replace(/[^/]*$/, "")
      : path + "/";
  return new URL(rel, location.origin + dir).href;
}

function reactFigure(kind, extra) {
  if (kind !== "ok" && kind !== "bad") return "";
  const src = mascotSrc(kind === "ok" ? "mascots/b03.png" : "mascots/b07.png");
  return `<img class="react-fig${extra ? ` ${extra}` : ""}" src="${src}" alt="">`;
}

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function playOpt(step) {
  const showAnswer = playUi.status === "ok" || playUi.status === "revealed";
  const revealTE = [...(step.revealTE || [])];
  const revealTL = [...(step.revealTL || [])];
  let popNode = null;
  if (showAnswer && step.field === "te") {
    revealTE.push(step.node);
    popNode = step.node;
  }
  if (showAnswer && step.field === "tl") {
    revealTL.push(step.node);
    popNode = step.node;
  }
  return {
    revealTE,
    revealTL,
    hlNode: step.hlNode ?? step.node,
    hlFrom: step.hlFrom,
    hlTo: step.hlTo,
    showCrit: showAnswer && step.field === "crit",
    popNode,
  };
}

function memoChips(solved, opt) {
  const chips = [];
  solved.ids.forEach((n) => {
    if (shown(opt.revealTE, n)) chips.push(`<span>TE(${n}) ${solved.TE[n]}</span>`);
  });
  solved.ids.forEach((n) => {
    if (shown(opt.revealTL, n)) chips.push(`<span class="tl">TL(${n}) ${solved.TL[n]}</span>`);
  });
  if (!chips.length) return "";
  return `<div class="memo">${chips.join("")}</div>`;
}

function playResult(problem, solved, steps) {
  const max = steps.length * 100;
  const [rank, line] = playRank(playUi.percent);
  const idx = CPM_PROBLEMS.findIndex((p) => p.id === problem.id);
  const next = CPM_PROBLEMS[idx + 1];
  const record = playUi.beat
    ? playUi.prevBest == null
      ? "첫 기록이 남았습니다."
      : "최고 기록을 바꿨습니다."
    : `최고 기록은 ${playUi.prevBest}점입니다.`;
  return `
    <div id="cpm-play" data-id="${problem.id}">
      <div class="kicker">도전 결과 · ${problem.level}</div>
      <div class="play-top">
        <h1>${rank}</h1>
        <div class="play-stats"><span>점수 <b>${playUi.percent}</b> / 100</span></div>
      </div>
      <p class="lead">${line} ${record}</p>
      <div class="stat-row">
        <div class="stat"><b>${playUi.score}</b><span>${max}점 만점</span></div>
        <div class="stat"><b>${playUi.first}</b><span>첫 시도 정답</span></div>
        <div class="stat"><b>${playUi.bestStreak}</b><span>최장 연속</span></div>
      </div>
      ${playUi.zero ? `<p>해설을 보고 넘긴 칸이 ${playUi.zero}개 있습니다. 그 결합점만 다시 계산해 보세요.</p>` : ""}
      <p>주공정선 <strong>${esc(criticalPathLabels(solved))}</strong> · 공기 ${solved.project}일</p>
      <div class="net-panel">${cpmSvg(solved, { showCrit: true })}</div>
      <p class="play-actions">
        <button type="button" class="btn" id="play-restart">다시 도전</button>
        <a class="btn ghost" href="#/cpm/walk/${problem.id}" data-link>따라 계산</a>
        <a class="btn ghost" href="#/cpm" data-link>실습 목록</a>
        ${
          problem.id === "roll"
            ? ""
            : next
              ? `<a class="btn" href="#/cpm/play/${next.id}" data-link>다음 네트워크</a>`
              : `<a class="btn" href="#/cpm/quiz" data-link>객관식</a>`
        }
      </p>
    </div>
  `;
}

function cpmPlay(id) {
  const problem = problemBy(id);
  if (playUi.id !== problem.id || playUi.key !== problemKey(problem)) {
    resetPlay(problem.id);
    playUi.key = problemKey(problem);
  }
  const { solved, steps } = buildChallenge(problem);
  if (playUi.done) return playResult(problem, solved, steps);
  playUi.step = Math.max(0, Math.min(steps.length - 1, playUi.step));
  const step = steps[playUi.step];
  const opt = playOpt(step);
  const pct = Math.round(((playUi.step + 1) / steps.length) * 100);
  const max = steps.length * 100;
  const asking = playUi.status === "ask";
  const choices =
    step.kind === "multi"
      ? `<div class="choice-grid">${step.choices
          .map((c) => {
            const picked = playUi.picked.includes(c.id);
            const right = step.answer.includes(c.id);
            let cls = "";
            if (!asking && right) cls = " correct";
            else if (!asking && picked) cls = " wrong";
            else if (picked) cls = " on";
            return `<button type="button" class="choice-btn${cls}" ${asking ? `data-pick="${esc(c.id)}" aria-pressed="${picked}"` : "disabled"}>${esc(c.label)}</button>`;
          })
          .join("")}</div>`
      : "";
  const feedback = playUi.feedback
    ? `<div class="play-feedback ${playUi.feedback.tone}" role="status"><span>${esc(playUi.feedback.text)}</span>${reactFigure(playUi.feedback.tone === "ok" ? "ok" : playUi.feedback.tone === "bad" ? "bad" : "")}</div>`
    : "";
  const actions = asking
    ? `<form id="play-form" class="play-actions">
        ${
          step.kind === "number"
            ? `<input id="play-answer" class="play-input${playUi.feedback && playUi.feedback.tone === "bad" ? " bad" : ""}" inputmode="numeric" autocomplete="off" aria-label="답" placeholder="일" value="${esc(playUi.draft)}">`
            : ""
        }
        <button type="submit" class="btn">확인</button>
        <button type="button" class="btn ghost" id="play-hint">힌트</button>
        <button type="button" class="btn ghost" id="play-restart">처음부터</button>
        ${playUi.hinted ? `<span class="hint-note">힌트를 봤습니다. 맞혀도 40점입니다.</span>` : ""}
      </form>`
    : `<div class="play-actions">
        <button type="button" class="btn next" id="play-next">${playUi.step === steps.length - 1 ? "결과 보기" : "다음"}</button>
        <button type="button" class="btn ghost" id="play-restart">처음부터</button>
      </div>`;
  return `
    <div id="cpm-play" data-id="${problem.id}">
      <div class="kicker">${problem.level} · 한 칸 도전</div>
      <div class="play-top">
        <h1>${problem.title}</h1>
        <div class="play-stats">
          <span>점수 <b id="play-score">${playUi.score}</b> / ${max}</span>
          <span>연속 <b id="play-streak">${playUi.streak}</b></span>
        </div>
      </div>
      <p class="lead">빈칸에 숫자를 직접 넣습니다. 순서가 낯설면 <a href="#/cpm/walk/${problem.id}" data-link>따라 계산하기</a>를 먼저 보세요.</p>
      <div class="walk-meta">
        <span>${playUi.step + 1} / ${steps.length} · ${step.title}</span>
        ${
          problem.id === "roll"
            ? ""
            : `<span>${CPM_PROBLEMS.map(
                (p) =>
                  `<a href="#/cpm/play/${p.id}" data-link class="${p.id === problem.id ? "active" : ""}">${p.title}</a>`
              ).join(" · ")}</span>`
        }
      </div>
      <div class="progress"><span style="width:${pct}%"></span></div>
      <p class="hint-note">첫 시도 100점 · 힌트나 다시 입력 40점 · 두 번 틀리면 해설 후 0점</p>
      <div class="play-layout">
        <div class="walk-card" id="play-card">
          <p class="play-q">${step.prompt}</p>
          <p class="play-rule">${step.rule}</p>
          ${choices}
          ${actions}
          ${feedback}
        </div>
        <div>
          ${memoChips(solved, opt)}
          <div class="net-panel">${cpmSvg(solved, opt)}</div>
        </div>
      </div>
    </div>
  `;
}

function award(step) {
  const first = playUi.attempts === 0 && !playUi.hinted;
  const pts = first ? 100 : 40;
  if (first) {
    playUi.streak += 1;
    playUi.bestStreak = Math.max(playUi.bestStreak, playUi.streak);
    playUi.first += 1;
  } else {
    playUi.streak = 0;
    playUi.later += 1;
  }
  playUi.score += pts;
  playUi.status = "ok";
  let text = `+${pts} · ${step.success}`;
  if (playUi.streak >= 2) text += ` ${playUi.streak}연속.`;
  playUi.feedback = { tone: "ok", text };
  playUi.draft = "";
}

function miss(step, yours) {
  playUi.attempts += 1;
  playUi.streak = 0;
  if (playUi.attempts >= 2) {
    playUi.zero += 1;
    playUi.status = "revealed";
    playUi.feedback = { tone: "bad", text: `${step.miss[1]} 오답노트에 넣어 두었습니다.` };
    playUi.draft = "";
    rememberNote({
      id: noteKey(playUi.id, step),
      kind: "play",
      problemId: playUi.id,
      field: step.field,
      node: step.node ?? null,
      hlFrom: step.hlFrom ?? null,
      hlTo: step.hlTo ?? null,
      title: step.title,
      prompt: step.prompt,
      yours: yours == null ? "" : String(yours),
      why: step.miss[1],
    });
    return;
  }
  playUi.feedback = { tone: "bad", text: step.miss[0] };
}

function sameNames(a, b) {
  return [...a].sort().join("|") === [...b].sort().join("|");
}

function gradeCurrent(steps) {
  const step = steps[playUi.step];
  if (!step || playUi.status !== "ask") return;
  if (step.kind === "multi") {
    if (!playUi.picked.length) {
      playUi.feedback = { tone: "bad", text: "주공정이라고 생각하는 작업을 하나 이상 고르세요." };
      return;
    }
    if (sameNames(playUi.picked, step.answer)) award(step);
    else miss(step, playUi.picked.join(", "));
    return;
  }
  const input = document.getElementById("play-answer");
  const raw = (input ? input.value : playUi.draft).trim().replace(/일$/, "");
  playUi.draft = input ? input.value : playUi.draft;
  if (!/^-?\d+$/.test(raw)) {
    playUi.feedback = { tone: "bad", text: "정수로 입력하세요." };
    return;
  }
  if (Number(raw) === step.answer) award(step);
  else miss(step, raw);
}

function advancePlay(steps, id) {
  if (playUi.done || playUi.status === "ask") return;
  playUi.step += 1;
  playUi.attempts = 0;
  playUi.hinted = false;
  playUi.status = "ask";
  playUi.feedback = null;
  playUi.draft = "";
  playUi.picked = [];
  if (playUi.step >= steps.length) {
    playUi.done = true;
    playUi.percent = Math.round((playUi.score / (steps.length * 100)) * 100);
    if (!playUi.recorded) {
      playUi.recorded = true;
      const saved = saveBest(id, playUi.percent);
      playUi.beat = saved.beat;
      playUi.prevBest = saved.prev;
    }
  }
}

function bindCpmPlay() {
  const root = document.getElementById("cpm-play");
  if (!root) return;
  const id = root.dataset.id;
  const { steps } = buildChallenge(problemBy(id));
  const paint = () => {
    app.innerHTML = cpmPlay(id);
    bindCpmPlay();
    if (!playUi.done) {
      document.getElementById("play-card")?.scrollIntoView({ block: "nearest" });
      const el =
        document.getElementById("play-answer") ||
        document.getElementById("play-next") ||
        document.querySelector("#play-form button[type=submit]");
      el?.focus();
      if (el && el.select) el.select();
    }
  };
  root.querySelectorAll("[data-pick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.getAttribute("data-pick");
      const i = playUi.picked.indexOf(name);
      if (i >= 0) playUi.picked.splice(i, 1);
      else playUi.picked.push(name);
      const on = playUi.picked.includes(name);
      btn.classList.toggle("on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  });
  document.getElementById("play-hint")?.addEventListener("click", () => {
    const step = steps[playUi.step];
    if (!step || playUi.status !== "ask") return;
    playUi.hinted = true;
    playUi.feedback = { tone: "neutral", text: step.hint };
    const input = document.getElementById("play-answer");
    if (input) playUi.draft = input.value;
    paint();
  });
  document.getElementById("play-form")?.addEventListener("submit", (e) => {
    e.preventDefault();
    gradeCurrent(steps);
    paint();
  });
  document.getElementById("play-next")?.addEventListener("click", () => {
    advancePlay(steps, id);
    paint();
  });
  document.getElementById("play-restart")?.addEventListener("click", () => {
    resetPlay(id);
    paint();
  });
}

function noteKey(problemId, step) {
  const node = step.node == null ? "" : step.node;
  const span = step.hlFrom == null ? "" : `${step.hlFrom}-${step.hlTo}`;
  return `play:${problemId}:${step.field}:${node}:${span}`;
}

function noteWhen(at) {
  const d = new Date(at);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${hh}:${mm}`;
}

const noteUi = { id: null, text: "", cheer: "" };

function noteBundle(note) {
  if (note.kind !== "play") return null;
  const problem = CPM_PROBLEMS.find((p) => p.id === note.problemId);
  if (!problem) return null;
  const built = buildChallenge(problem);
  const step = built.steps.find((s) => noteKey(note.problemId, s) === note.id);
  if (!step) return null;
  return { problem, solved: built.solved, step };
}

function notesView() {
  const notes = loadNotes();
  if (!notes.length) {
    return `
      <div class="kicker">REVIEW</div>
      <h1>오답노트</h1>
      <p class="lead">아직 비어 있습니다. 한 칸 도전에서 해설을 보고 넘어간 칸과, 객관식에서 틀린 문제가 여기에 모입니다.</p>
      <p>
        <a class="btn" href="#/cpm/play/roll" data-link>한 칸 연습</a>
        <a class="btn ghost" href="#/cpm/quiz" data-link>객관식</a>
      </p>
      ${reactFigure(noteUi.cheer)}
    `;
  }
  return `
    <div class="kicker">REVIEW</div>
    <h1>오답노트</h1>
    <p class="lead">틀린 문제 ${notes.length}개입니다. 다시 맞히면 노트에서 빠집니다.</p>
    ${notes.map(noteCard).join("")}
    ${noteUi.cheer === "ok" ? reactFigure("ok") : ""}
  `;
}

function noteCard(note) {
  const feedback =
    noteUi.id === note.id && noteUi.text
      ? `<div class="play-feedback bad" role="status"><span>${esc(noteUi.text)}</span>${reactFigure("bad")}</div>`
      : "";
  if (note.kind === "quiz") {
    return `
      <article class="note-card">
        <p class="hint-note">${noteWhen(note.at)} · 객관식</p>
        <h3>${esc(note.q)}</h3>
        <p>지난번 선택: ${esc(note.choices[note.yours] || "")}</p>
        <div class="options">
          ${note.choices
            .map(
              (c, j) =>
                `<button type="button" data-note-quiz="${esc(note.id)}" data-choice="${j}">${esc(c)}</button>`
            )
            .join("")}
        </div>
        ${feedback}
      </article>
    `;
  }
  const bundle = noteBundle(note);
  if (!bundle) {
    return `<article class="note-card"><p>이 문제는 더 이상 연습 목록에 없습니다.</p><button type="button" class="btn ghost" data-note-drop="${esc(note.id)}">노트에서 빼기</button></article>`;
  }
  const { solved, step } = bundle;
  const choices =
    step.kind === "multi"
      ? `<div class="choice-grid">${step.choices
          .map(
            (c) =>
              `<button type="button" class="choice-btn" data-note-pick="${esc(c.id)}">${esc(c.label)}</button>`
          )
          .join("")}</div>`
      : `<input class="play-input" name="answer" inputmode="numeric" autocomplete="off" aria-label="답" placeholder="일">`;
  return `
    <article class="note-card">
      <p class="hint-note">${noteWhen(note.at)} · ${esc(bundle.problem.title)}</p>
      <h3>${esc(step.title)}</h3>
      <p class="play-q">${esc(step.prompt)}</p>
      <p class="play-rule">${esc(step.rule)}</p>
      <p>지난번 답: ${esc(note.yours || "(없음)")}</p>
      <div class="net-panel">${cpmSvg(solved, {
        revealTE: step.revealTE,
        revealTL: step.revealTL,
        hlNode: step.hlNode ?? step.node,
        hlFrom: step.hlFrom,
        hlTo: step.hlTo,
        showCrit: false,
      })}</div>
      <form class="play-actions" data-note-form="${esc(note.id)}">
        ${choices}
        <button type="submit" class="btn">다시 채점</button>
      </form>
      ${feedback}
    </article>
  `;
}

const DRAW_HELP = {
  node: "빈 곳을 누르면 결합점이 생깁니다. 점을 끌면 자리를 옮길 수 있습니다.",
  arrow: "시작 결합점을 누르고, 끝 결합점을 누른 뒤, 그 화살에 올릴 작업을 고르세요.",
  dummy: "시작 결합점과 끝 결합점을 누른 뒤, 그 점선에 올릴 작업을 고르세요. 이미 그린 작업의 순서만 이을 때는 순서만을 고르세요.",
  erase: "지울 화살표나 결합점을 누르세요. 결합점을 지우면 붙은 화살표도 함께 지워집니다.",
};

function resetDraw(keepChart) {
  drawUi.bankFor = "";
  drawUi.problem = rollNetwork(freshSeed());
  drawUi.nodes = [{ id: 1, x: 88, y: 220 }];
  drawUi.arrows = [];
  drawUi.nextNode = 2;
  drawUi.nextArrow = 1;
  drawUi.tool = "node";
  drawUi.arm = null;
  drawUi.pending = null;
  drawUi.lines = [];
  drawUi.checks = [];
  drawUi.ok = false;
  drawUi.showAnswer = false;
  drawUi.tableMsg = "";
  drawUi.tableHint = false;
  drawUi.panel = "table";
  drawUi.answers = [];
  if (!keepChart) ganttStore.draw = null;
}

function answerActivities(problem) {
  try {
    return singleRealHeads(jobsToNetwork(problem.jobs).activities);
  } catch (e) {
    return singleRealHeads(problem.activities || []);
  }
}

function drawTableGuide(solved) {
  const starts = new Set(solved.ids.filter((id) => solved.incoming[id].length === 0));
  const ends = new Set(solved.ids.filter((id) => solved.outgoing[id].length === 0));
  const rows = solved.rows
    .map((row) => {
      const name = row.name === "Dummy" || row.name === "더미" ? "더미" : row.name;
      const es = starts.has(row.from)
        ? `${row.from}번 결합점은 시작점입니다. 앞에 일이 없으면 ES는 0으로 둡니다.`
        : `ES는 ${row.from}번 결합점의 TE입니다. 그 점으로 들어온 작업의 EF 가운데 가장 늦은 값입니다. 평균도 합도 아닙니다.`;
      const lf = ends.has(row.to)
        ? `${row.to}번 결합점은 끝점입니다. LF는 공기와 같습니다. 공기는 끝 결합점의 TE이고, 작업 일수를 모두 더한 값이 아닙니다.`
        : `LF는 ${row.to}번 결합점의 TL입니다. 그 점에서 나가는 (TL − D) 가운데 가장 작은 값입니다.`;
      return `<li><b>${esc(name)}</b> ${row.from}-${row.to}<span>${es} EF는 ES에 이 행의 D를 더합니다. ${lf} LS는 LF에서 D를 뺍니다. TF는 LF − EF이고, 0이면 주공정입니다. FF는 ${row.to}번 결합점의 TE에서 ${row.from}번 결합점의 TE와 D를 뺀 값입니다.</span></li>`;
    })
    .join("");
  return `<div class="table-hint">
    <h3>표 힌트</h3>
    <p>칸의 숫자는 적지 않습니다. 어느 공식으로 구하는지와, 그 칸을 채울 때 볼 점만 알려 줍니다.</p>
    <div class="formula">ES = 시작 결합점 TE<br/>EF = ES + D<br/>LF = 끝 결합점 TL<br/>LS = LF − D<br/>TF = LF − EF<br/>FF = 끝 TE − 시작 TE − D</div>
    <ol>
      <li>ES와 EF는 왼쪽 결합점부터 오른쪽으로 채웁니다.</li>
      <li>LS와 LF는 오른쪽 끝에서 왼쪽으로 돌아옵니다. 끝 결합점의 TL은 공기입니다.</li>
      <li>TF와 FF는 ES, EF, LS, LF를 구한 뒤에 채웁니다.</li>
    </ol>
    <ul>${rows}</ul>
  </div>`;
}

function diagramArrows() {
  return drawUi.arrows.map((a) => ({
    name: a.job || "Dummy",
    from: a.from,
    to: a.to,
    duration: a.job ? a.duration : 0,
    dummy: !!a.dummy,
  }));
}

function drawBoard() {
  const arrows = drawUi.arrows
    .map((a) => {
      const p1 = drawUi.nodes.find((n) => n.id === a.from);
      const p2 = drawUi.nodes.find((n) => n.id === a.to);
      if (!p1 || !p2) return "";
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const x1 = p1.x + ux * 28;
      const y1 = p1.y + uy * 28;
      const x2 = p2.x - ux * 28;
      const y2 = p2.y - uy * 28;
      const color = a.dummy ? "#545f52" : "#6b7a63";
      const label = a.dummy ? (a.job ? `${a.job} (${a.duration}) · 더미` : "더미") : `${a.job} (${a.duration})`;
      const dash = a.dummy ? ' stroke-dasharray="6 5"' : "";
      return `<line data-arrow="${a.id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="transparent" stroke-width="16"/>
        <line data-arrow="${a.id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2.2"${dash} marker-end="url(#draw-head)"/>
        <text data-arrow="${a.id}" x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2 - 10}" text-anchor="middle" fill="${color}" font-size="13">${esc(label)}</text>`;
    })
    .join("");
  const nodes = drawUi.nodes
    .map((n) => {
      const on = drawUi.arm === n.id;
      return `<g data-node="${n.id}" transform="translate(${n.x},${n.y})">
        <circle r="26" fill="${on ? "#e6dfd5" : "#ffffff"}" stroke="${on ? "#e07a5f" : "#6b7a63"}" stroke-width="2"/>
        <text y="6" text-anchor="middle" fill="#2a241c" font-size="16" font-weight="700">${n.id}</text>
      </g>`;
    })
    .join("");
  return `<svg id="draw-board" class="draw-board" viewBox="0 0 980 440" role="img" aria-label="공정표 그리는 판">
    <defs>
      <marker id="draw-head" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
        <path d="M0,0 L8,4 L0,8" fill="#6b7a63"/>
      </marker>
    </defs>
    <rect class="draw-bg" x="0" y="0" width="980" height="440" fill="#fbf6ec"/>
    ${arrows}${nodes}
  </svg>`;
}

function drawView(embedded) {
  if (!embedded && !drawUi.problem) resetDraw();
  if (!drawUi.problem) return "";
  const jobs = drawUi.problem.jobs;
  const used = new Set(drawUi.arrows.filter((a) => a.job).map((a) => a.job));
  const pendingJobs = jobs.filter((j) => !used.has(j.name));
  const pendingKind = drawUi.pending && drawUi.pending.kind === "dummy" ? "dummy" : "arrow";
  const picker = drawUi.pending
    ? `<div class="draw-pick" role="group" aria-label="${pendingKind === "dummy" ? "이 더미의 작업" : "이 화살표의 작업"}">
        <span>결합점 ${drawUi.pending.from} → ${drawUi.pending.to} ${pendingKind === "dummy" ? "점선에 올릴 작업" : "에 올릴 작업"}</span>
        ${
          pendingJobs.length
            ? pendingJobs
                .map(
                  (j) =>
                    `<button type="button" class="btn" data-pick-job="${esc(j.name)}">${esc(j.name)} · ${j.duration}일</button>`
                )
                .join("")
            : `<span>남은 작업이 없습니다.</span>`
        }
        ${pendingKind === "dummy" ? `<button type="button" class="btn ghost" data-pick-link>순서만</button>` : ""}
        <button type="button" class="btn ghost" id="draw-cancel">취소</button>
      </div>`
    : "";
  const grade = embedded
    ? ""
    : drawUi.checks.length
      ? `<div class="grade-row"><div><ul class="grade-list${drawUi.ok ? " ok" : ""}">${drawUi.checks
          .map(
            (item) =>
              `<li class="${item.ok ? "pass" : "fail"}"><b>${esc(item.name)}</b><small>${esc(item.detail)}</small></li>`
          )
          .join("")}</ul>${drawUi.ok ? `<p class="lead">${esc(drawUi.lines[0] || "")}</p>` : ""}</div>${reactFigure(drawUi.ok ? "ok" : "bad", "react-draw")}</div>`
      : drawUi.lines.length
        ? `<ul class="grade-list">${drawUi.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul>`
        : "";
  const table = embedded || !drawUi.ok
    ? ""
    : drawUi.ok
    ? (() => {
        let solved;
        try {
          solved = solveCpm(diagramArrows());
        } catch (e) {
          return "";
        }
        return `<div class="table-wrap">
          <table class="cpm-table" id="draw-sheet">
            <thead><tr><th>작업</th><th>i-j</th><th>D</th><th>ES</th><th>EF</th><th>LS</th><th>LF</th><th>TF</th><th>FF</th></tr></thead>
            <tbody>
              ${solved.rows
                .map(
                  (r) => `<tr data-row>
                    <td>${esc(r.name === "Dummy" || r.name === "더미" ? "더미" : r.name)}</td>
                    <td>${r.from}-${r.to}</td>
                    <td>${r.duration}</td>
                    ${["es", "ef", "ls", "lf", "tf", "ff"]
                      .map(
                        (k) =>
                          `<td><input inputmode="numeric" data-k="${k}" data-ans="${r[k]}" aria-label="${esc(r.name === "Dummy" || r.name === "더미" ? "더미" : r.name)} ${k}"></td>`
                      )
                      .join("")}
                  </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
        <p style="display:flex;gap:10px;flex-wrap:wrap">
          <button type="button" class="btn" id="draw-grade-table">표 채점</button>
          <button type="button" class="btn ghost" id="draw-table-hint" aria-pressed="${drawUi.tableHint}">${drawUi.tableHint ? "힌트 닫기" : "힌트"}</button>
        </p>
        ${drawUi.tableHint ? drawTableGuide(solved) : ""}
        <p id="draw-table-msg" class="lead">${esc(drawUi.tableMsg)}</p>`;
      })()
    : "";
  const answer = drawUi.showAnswer
    ? `<div class="net-panel">${cpmSvg(solveCpm(answerActivities(drawUi.problem)), {
        revealTE: [],
        revealTL: [],
        showCrit: false,
        caption:
          "작업 화살은 한 결합점에 하나만 들어갑니다. 순서를 더 이을 때는 점선 더미를 씁니다. 모양은 달라도, 바로 앞 작업이 목록과 같으면 맞습니다.",
      })}</div>`
    : "";
  const intro = embedded
    ? ""
    : `<div class="kicker">${drawUi.problem.level} · 직접 그리기</div>
    <h1>${esc(drawUi.problem.title)}</h1>
    <p class="lead">작업 목록만 보고 공정표를 만듭니다. 바로 앞에 적힌 일이 모두 끝난 결합점에서 그 작업의 화살이 출발해야 합니다. 한 결합점에 작업 화살이 이미 있으면, 그 작업은 점선 더미로 잇고 어떤 작업인지 고르세요. 점선에도 작업 이름과 일수가 표시됩니다.</p>`;
  return `
    ${intro}
    <div class="draw-layout">
      <div>
        <div class="draw-tools">
          ${[
            ["node", "결합점", "mark-node"],
            ["arrow", "작업 화살표", "mark-arrow"],
            ["dummy", "더미", "mark-dummy"],
            ["erase", "지우기", "mark-erase"],
          ]
            .map(
              ([id, label, mark]) =>
                `<button type="button" class="btn ghost${drawUi.tool === id ? " on" : ""}" data-tool="${id}" aria-pressed="${drawUi.tool === id}"><span class="mark ${mark}" aria-hidden="true"></span>${label}</button>`
            )
            .join("")}
        </div>
        <p class="draw-help">${DRAW_HELP[drawUi.tool]}</p>
        ${drawBoard()}
        ${picker}
        <p style="display:flex;gap:10px;flex-wrap:wrap">
          ${embedded ? "" : `<button type="button" class="btn" id="draw-grade">공정표 채점</button>`}
          <button type="button" class="btn ghost" id="draw-answer">${drawUi.showAnswer ? "정답 숨기기" : "정답 공정표"}</button>
          <button type="button" class="btn ghost" id="draw-clear">판 비우기</button>
          ${embedded ? "" : `<button type="button" class="btn ghost" id="draw-new">다른 문제</button>`}
        </p>
        ${grade}
        ${table}
        ${answer}
      </div>
      <aside class="draw-jobs">
        <h3>해야 할 일</h3>
        <p>바로 앞 일이 끝나면 시작할 수 있습니다. 목록에 없는 일은 기다리지 않습니다.</p>
        <ul class="job-list">
          ${jobs
            .map((j) => {
              const preds = j.preds.length ? j.preds.join(", ") : "없음";
              return `<li class="${used.has(j.name) ? "used" : ""}"><b>${esc(j.name)}</b> ${j.duration}일<small>바로 앞: ${esc(preds)}</small></li>`;
            })
            .join("")}
        </ul>
      </aside>
    </div>
  `;
}

function paintDraw() {
  const onDraw = location.hash.startsWith("#/cpm/draw");
  const onBank = /^#\/solve\/bank\/.+/.test(location.hash);
  if (!onDraw && !onBank) return;
  const values = [...document.querySelectorAll("#draw-sheet input")].map((i) => i.value);
  if (values.length) drawUi.answers = values;
  const y = window.scrollY;
  if (onDraw) app.innerHTML = drawView();
  else {
    const id = decodeURIComponent(location.hash.split("/")[3] || "");
    app.innerHTML = bankProblem(id);
    bindBank();
  }
  bindDraw();
  document.querySelectorAll("#draw-sheet input").forEach((inp, i) => {
    inp.value = (drawUi.answers && drawUi.answers[i]) || "";
  });
  if (onBank) window.scrollTo(0, y);
}

function bindDraw() {
  bindResultViews(paintDraw);
  const svg = document.getElementById("draw-board");
  if (!svg || !drawUi.problem) return;
  const pointOf = (event) => {
    const pt = svg.createSVGPoint();
    pt.x = event.clientX;
    pt.y = event.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 80, y: 80 };
    const p = pt.matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };
  document.querySelectorAll("[data-tool]").forEach((btn) => {
    btn.addEventListener("click", () => {
      drawUi.tool = btn.getAttribute("data-tool");
      drawUi.arm = null;
      drawUi.pending = null;
      paintDraw();
    });
  });
  document.getElementById("draw-cancel")?.addEventListener("click", () => {
    drawUi.pending = null;
    drawUi.arm = null;
    paintDraw();
  });
  document.querySelectorAll("[data-pick-job], [data-pick-link]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!drawUi.pending) return;
      const asDummy = drawUi.pending.kind === "dummy";
      const linkOnly = btn.hasAttribute("data-pick-link");
      const name = btn.getAttribute("data-pick-job");
      const job = linkOnly ? null : drawUi.problem.jobs.find((j) => j.name === name);
      if (!linkOnly && !job) return;
      drawUi.arrows.push({
        id: drawUi.nextArrow,
        from: drawUi.pending.from,
        to: drawUi.pending.to,
        dummy: asDummy,
        job: job ? job.name : null,
        duration: job ? job.duration : 0,
      });
      drawUi.nextArrow += 1;
      drawUi.pending = null;
      drawUi.arm = null;
      drawUi.ok = false;
      drawUi.lines = [];
      drawUi.checks = [];
      drawUi.tableMsg = "";
      ganttStore.draw = null;
      paintDraw();
    });
  });
  document.getElementById("draw-grade")?.addEventListener("click", () => {
    const graded = gradeDiagram(drawUi.problem.jobs, diagramArrows());
    drawUi.ok = graded.ok;
    drawUi.lines = graded.lines;
    drawUi.checks = graded.checks || [];
    drawUi.tableMsg = "";
    if (graded.ok) {
      try {
        rememberGantt("draw", solveCpm(diagramArrows()), drawUi.problem.title);
      } catch (e) {
        ganttStore.draw = null;
      }
    } else ganttStore.draw = null;
    if (drawUi.bankFor) {
      const saved = recordStudy(drawUi.bankFor, graded.ok);
      if (!saved) drawUi.lines.push("로그인하면 이 채점이 맞춘 문제와 오답노트에 남습니다.");
    }
    paintDraw();
  });
  document.getElementById("draw-answer")?.addEventListener("click", () => {
    drawUi.showAnswer = !drawUi.showAnswer;
    paintDraw();
  });
  document.getElementById("draw-clear")?.addEventListener("click", () => {
    const problem = drawUi.problem;
    const bankFor = drawUi.bankFor;
    resetDraw();
    drawUi.problem = problem;
    drawUi.bankFor = bankFor;
    paintDraw();
  });
  document.getElementById("draw-new")?.addEventListener("click", () => {
    resetDraw();
    paintDraw();
  });
  document.getElementById("draw-table-hint")?.addEventListener("click", () => {
    drawUi.tableHint = !drawUi.tableHint;
    paintDraw();
  });
  document.getElementById("draw-grade-table")?.addEventListener("click", () => {
    const sheet = document.getElementById("draw-sheet");
    const msg = document.getElementById("draw-table-msg");
    if (!sheet || !msg) return;
    let ok = 0;
    let total = 0;
    sheet.querySelectorAll("input[data-ans]").forEach((inp) => {
      total += 1;
      const good = inp.value !== "" && Number(inp.value) === Number(inp.dataset.ans);
      inp.classList.toggle("ok", good);
      inp.classList.toggle("bad", !good);
      if (good) ok += 1;
    });
    sheet.querySelectorAll("tr[data-row]").forEach((tr) => {
      const tf = tr.querySelector('input[data-k="tf"]');
      if (tf && Number(tf.dataset.ans) === 0) tr.classList.add("is-crit");
    });
    drawUi.tableMsg = `${ok} / ${total} 칸 정답. TF가 0인 작업이 주공정입니다.`;
    msg.innerHTML = `${esc(drawUi.tableMsg)}${reactFigure(total && ok === total ? "ok" : "bad")}`;
  });

  let dragging = null;
  svg.addEventListener("pointerdown", (event) => {
    const nodeEl = event.target.closest("[data-node]");
    const arrowEl = event.target.closest("[data-arrow]");
    if (drawUi.tool === "erase") {
      if (arrowEl) {
        const id = Number(arrowEl.getAttribute("data-arrow"));
        drawUi.arrows = drawUi.arrows.filter((a) => a.id !== id);
      } else if (nodeEl) {
        const id = Number(nodeEl.getAttribute("data-node"));
        drawUi.nodes = drawUi.nodes.filter((n) => n.id !== id);
        drawUi.arrows = drawUi.arrows.filter((a) => a.from !== id && a.to !== id);
      } else return;
      drawUi.arm = null;
      drawUi.pending = null;
      drawUi.ok = false;
      drawUi.lines = [];
      drawUi.checks = [];
      drawUi.tableMsg = "";
      ganttStore.draw = null;
      paintDraw();
      return;
    }
    if (nodeEl && drawUi.tool === "node") {
      dragging = Number(nodeEl.getAttribute("data-node"));
      svg.setPointerCapture(event.pointerId);
      return;
    }
    if (nodeEl && (drawUi.tool === "arrow" || drawUi.tool === "dummy")) {
      const id = Number(nodeEl.getAttribute("data-node"));
      if (drawUi.arm == null) {
        drawUi.arm = id;
        drawUi.pending = null;
        paintDraw();
        return;
      }
      if (drawUi.arm === id) {
        drawUi.arm = null;
        paintDraw();
        return;
      }
      const from = drawUi.arm;
      const to = id;
      drawUi.arm = null;
      if (drawUi.arrows.some((a) => a.from === from && a.to === to)) {
        drawUi.lines = [`결합점 ${from}에서 ${to}로는 이미 화살이 있습니다. 다른 결합점을 거쳐 가세요.`];
        drawUi.checks = [];
        drawUi.ok = false;
        paintDraw();
        return;
      }
      drawUi.pending = { from, to, kind: drawUi.tool === "dummy" ? "dummy" : "arrow" };
      paintDraw();
      return;
    }
    if (!nodeEl && !arrowEl && drawUi.tool === "node") {
      const pt = pointOf(event);
      const x = Math.max(40, Math.min(940, pt.x));
      const y = Math.max(40, Math.min(400, pt.y));
      if (drawUi.nodes.some((n) => Math.hypot(n.x - x, n.y - y) < 52)) return;
      drawUi.nodes.push({ id: drawUi.nextNode, x, y });
      drawUi.nextNode += 1;
      paintDraw();
    }
  });
  svg.addEventListener("pointermove", (event) => {
    if (dragging == null) return;
    const node = drawUi.nodes.find((n) => n.id === dragging);
    if (!node) return;
    const pt = pointOf(event);
    node.x = Math.max(40, Math.min(940, pt.x));
    node.y = Math.max(40, Math.min(400, pt.y));
    const group = svg.querySelector(`[data-node="${node.id}"]`);
    if (group) group.setAttribute("transform", `translate(${node.x},${node.y})`);
  });
  svg.addEventListener("pointerup", () => {
    if (dragging == null) return;
    dragging = null;
    paintDraw();
  });
}

let lastHash = "";

const solveUi = {
  imageUrl: "",
  status: "",
  error: "",
  built: null,
  draft: null,
  draftError: "",
  step: 0,
  panel: "table",
  readId: 0,
  worker: null,
};

const EXAM_HEADER = /^(작업명|작업|선행작업|선행|소요일수|소요시간|작업시간|작업일수|소요일|기간|일수|정상|일|데이터|활동|activity|duration|pred|name)$/i;

function normExamToken(token) {
  return String(token || "")
    .trim()
    .replace(/[.:;]+$/g, "")
    .replace(/^작업/, "")
    .toUpperCase();
}

function examDuration(token) {
  const matched = String(token || "").match(/^(\d{1,3})일?$/);
  if (!matched) return null;
  const value = Number(matched[1]);
  if (value < 1 || value > 999) return null;
  return value;
}

function emptyPred(token) {
  return /^[-–—~.~×xX없음무없다|ㅣ]+$/.test(String(token || "").trim());
}

function repairGlyph(token) {
  return String(token || "").trim();
}

function isDashToken(token) {
  return emptyPred(token);
}

function examName(token) {
  const name = normExamToken(token);
  if (!name || emptyPred(name) || EXAM_HEADER.test(name)) return "";
  if (/^[A-Z]$/.test(name)) return name;
  if (/^[가-힣]{1,8}$/.test(name)) return name;
  return "";
}

function explodeExamToken(token) {
  const text = String(token || "").trim();
  const stuck = text.match(/^([A-Za-z가-힣]{1,8})[-–—](\d{1,3}일?)$/);
  if (stuck) return [stuck[1], stuck[2]];
  const letterDuration = text.match(/^([A-Za-z])(\d{1,3})$/);
  if (letterDuration) return [letterDuration[1], letterDuration[2]];
  return text.split(/[,，、·∙•/]/).filter(Boolean);
}

function jobsFromText(text) {
  const jobs = [];
  const seen = new Set();
  String(text || "")
    .split(/\n/)
    .forEach((line) => {
      const tokens = line
        .replace(/([A-Za-z])\1+/gi, "$1")
        .replace(/([A-Za-z])\.(?=[A-Za-z])/g, "$1,")
        .replace(/[|]/g, " ")
        .replace(/[()（）[\]{}]/g, " ")
        .split(/\s+/)
        .flatMap(explodeExamToken)
        .map((token) => token.trim())
        .filter(Boolean)
        .filter((token) => !EXAM_HEADER.test(token) && !EXAM_HEADER.test(normExamToken(token)));
      if (tokens.length < 2 || tokens.length > 8) return;
      let durIndex = -1;
      let duration = null;
      for (let index = tokens.length - 1; index >= 0; index -= 1) {
        const value = examDuration(fixDigits(tokens[index]));
        if (value != null) {
          duration = value;
          durIndex = index;
          break;
        }
      }
      if (duration == null) return;
      const head = tokens.filter((_, index) => index !== durIndex);
      if (!head.length) return;
      const name = examName(repairGlyph(head[0]));
      if (!name || seen.has(name)) return;
      const preds = [];
      for (const token of head.slice(1)) {
        const repaired = repairGlyph(token);
        if (isDashToken(repaired) || isDashToken(token)) continue;
        const activity = examName(repaired);
        if (activity && activity !== name) {
          preds.push(activity);
          continue;
        }
        const packed = normExamToken(repaired);
        if (/^[A-Z]{2,4}$/.test(packed)) preds.push(packed);
      }
      seen.add(name);
      jobs.push({ name, duration, preds: [...new Set(preds)] });
    });
  return jobs;
}

function refineExamJobs(jobs) {
  const names = new Set(jobs.map((job) => job.name));
  let dropped = 0;
  const refined = jobs.map((job) => ({
    name: job.name,
    duration: job.duration,
    preds: [...new Set(job.preds.flatMap((pred) => {
      if (names.has(pred)) return [pred];
      if (/^[A-Z]{2,4}$/.test(pred) && [...pred].every((letter) => names.has(letter))) return [...pred];
      dropped += 1;
      return [];
    }))].filter((pred) => pred !== job.name),
  }));
  refined.dropped = dropped;
  return refined;
}

function fixDigits(token) {
  return String(token || "").replace(/\s/g, "");
}

function wordTable(words) {
  const items = (words || []).filter((word) => word.text && String(word.text).trim() && word.bbox && (word.confidence == null || word.confidence >= 0));
  if (items.length < 4) return [];
  const heights = items.map((word) => Math.max(8, word.bbox.y1 - word.bbox.y0)).sort((a, b) => a - b);
  const rowGap = heights[Math.floor(heights.length / 2)] * 0.7;
  const rows = [];
  items
    .slice()
    .sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0)
    .forEach((word) => {
      const y = (word.bbox.y0 + word.bbox.y1) / 2;
      const row = rows.find((item) => Math.abs(item.y - y) < rowGap);
      if (row) row.words.push(word);
      else rows.push({ y, words: [word] });
    });
  const centers = items.map((word) => (word.bbox.x0 + word.bbox.x1) / 2).sort((a, b) => a - b);
  const span = Math.max(1, centers[centers.length - 1] - centers[0]);
  const splitAt = Math.max(36, span * 0.12);
  const groups = [];
  centers.forEach((x) => {
    const last = groups[groups.length - 1];
    if (!last || x - last[last.length - 1] > splitAt) groups.push([x]);
    else last.push(x);
  });
  const columns = groups.map((group) => group.reduce((sum, x) => sum + x, 0) / group.length);
  if (columns.length < 2) return [];
  return rows.map((row) => {
    const cells = columns.map(() => []);
    row.words
      .slice()
      .sort((a, b) => a.bbox.x0 - b.bbox.x0)
      .forEach((word) => {
        const x = (word.bbox.x0 + word.bbox.x1) / 2;
        let best = 0;
        let dist = Infinity;
        columns.forEach((center, index) => {
          const gap = Math.abs(center - x);
          if (gap < dist) {
            dist = gap;
            best = index;
          }
        });
        cells[best].push(String(word.text).trim());
      });
    return cells.map((cell) => cell.join(""));
  });
}

function jobsFromWordGrid(words) {
  const table = wordTable(words);
  if (table.length < 2) return [];
  const headerAt = table.findIndex((row) => row.some((cell) => /작업|선행|기간|일수|시간|pred|day|dur|activity/i.test(cell)));
  let nameCol = 0;
  let predCol = -1;
  let durCol = -1;
  if (headerAt >= 0) {
    table[headerAt].forEach((cell, index) => {
      if (/선행|pred/i.test(cell)) predCol = index;
      else if (/기간|일수|시간|day|dur/i.test(cell)) durCol = index;
      else if (/작업|activity|name|명/i.test(cell)) nameCol = index;
    });
  }
  if (durCol < 0) {
    let best = -1;
    let score = -1;
    const width = Math.max(...table.map((row) => row.length));
    for (let index = 0; index < width; index += 1) {
      const count = table.filter((row) => examDuration(fixDigits(row[index] || "")) != null).length;
      if (count > score) {
        score = count;
        best = index;
      }
    }
    durCol = best;
  }
  if (nameCol < 0 || nameCol === durCol) {
    nameCol = table[0].findIndex((_, index) => index !== durCol);
  }
  if (predCol < 0) {
    predCol = table[0].findIndex((_, index) => index !== durCol && index !== nameCol);
  }
  const jobs = [];
  const seen = new Set();
  table.forEach((row, index) => {
    if (index === headerAt) return;
    const name = examName(repairGlyph(String(row[nameCol] || "").replace(/([A-Za-z])\1+/gi, "$1")));
    const duration = examDuration(fixDigits(row[durCol] || ""));
    if (!name || duration == null || seen.has(name)) return;
    seen.add(name);
    const predText = predCol >= 0 ? row[predCol] || "" : "";
    const preds = predText
      .replace(/([A-Za-z])\1+/gi, "$1")
      .replace(/([A-Za-z])\.(?=[A-Za-z])/g, "$1,")
      .split(/[,，、·∙•/\s]+/)
      .filter((part) => !isDashToken(part))
      .map((part) => examName(repairGlyph(part)))
      .filter((pred) => pred && pred !== name);
    jobs.push({ name, duration, preds });
  });
  return jobs;
}

function linesFromOcrWords(words) {
  const items = (words || []).filter((word) => word.text && String(word.text).trim() && (word.confidence == null || word.confidence >= 0));
  const rows = [];
  items
    .slice()
    .sort((a, b) => a.bbox.y0 - b.bbox.y0 || a.bbox.x0 - b.bbox.x0)
    .forEach((word) => {
      const y = (word.bbox.y0 + word.bbox.y1) / 2;
      const height = Math.max(8, word.bbox.y1 - word.bbox.y0);
      const row = rows.find((item) => Math.abs(item.y - y) < height * 0.8);
      if (row) row.words.push(word);
      else rows.push({ y, words: [word] });
    });
  return rows
    .map((row) =>
      row.words
        .sort((a, b) => a.bbox.x0 - b.bbox.x0)
        .map((word) => String(word.text).trim())
        .join(" ")
    )
    .join("\n");
}

function readingScore(jobs) {
  return examScore(refineExamJobs((jobs || []).map((job) => ({ name: job.name, duration: job.duration, preds: [...(job.preds || [])] }))));
}

function jobsFromOcr(data) {
  const texts = [data && data.text, data && data.lines ? data.lines.map((line) => line.text).join("\n") : "", linesFromOcrWords(data && data.words)];
  let best = jobsFromWordGrid(data && data.words);
  texts.forEach((text) => {
    const jobs = jobsFromText(text);
    if (readingScore(jobs) > readingScore(best)) best = jobs;
  });
  return best;
}

function modeValue(values) {
  const tally = new Map();
  values.forEach((value) => tally.set(value, (tally.get(value) || 0) + 1));
  let best = values[0];
  let count = -1;
  tally.forEach((n, value) => {
    if (n > count) {
      count = n;
      best = value;
    }
  });
  return best;
}

function assembleExamJobs(lists) {
  const usable = (lists || []).filter((jobs) => jobs && jobs.length);
  if (!usable.length) return [];
  const counts = {};
  usable.forEach((jobs) => {
    const seen = new Set();
    jobs.forEach((job) => {
      if (seen.has(job.name)) return;
      seen.add(job.name);
      counts[job.name] = (counts[job.name] || 0) + 1;
    });
  });
  const ranked = usable
    .map((jobs) => ({ jobs, score: readingScore(jobs) }))
    .sort((a, b) => b.score - a.score);
  const chosen = new Map();
  const consider = (job) => {
    if (!job || !job.name) return;
    if (!chosen.has(job.name)) chosen.set(job.name, { name: job.name, durations: [], preds: [] });
    const slot = chosen.get(job.name);
    slot.durations.push(job.duration);
    slot.preds.push([...(job.preds || [])]);
  };
  const keepName = (name) => counts[name] >= 2 || ranked[0].jobs.some((job) => job.name === name);
  usable.forEach((jobs) => {
    jobs.forEach((job) => {
      if (keepName(job.name)) consider(job);
    });
  });
  const remember = (name) => {
    if (chosen.has(name)) return false;
    return usable.some((jobs) => {
      const found = jobs.find((job) => job.name === name);
      if (!found) return false;
      consider(found);
      return true;
    });
  };
  let grew = true;
  while (grew) {
    grew = false;
    const known = new Set(chosen.keys());
    chosen.forEach((slot) => {
      slot.preds.flat().forEach((pred) => {
        const parts = /^[A-Z]{2,4}$/.test(pred) ? [...pred] : [pred];
        parts.forEach((name) => {
          if (known.has(name)) return;
          if (remember(name)) grew = true;
        });
      });
    });
  }
  const jobs = [...chosen.values()].map((slot) => {
    const nonEmpty = slot.preds.filter((list) => list.length);
    const predKey =
      nonEmpty.length && nonEmpty.length >= slot.preds.length - nonEmpty.length
        ? modeValue(nonEmpty.map((list) => [...list].sort().join("+")))
        : modeValue(slot.preds.map((list) => [...list].sort().join("+")));
    return {
      name: slot.name,
      duration: modeValue(slot.durations),
      preds: predKey ? String(predKey).split("+") : [],
    };
  });
  jobs.sort((a, b) => a.name.localeCompare(b.name, "ko"));
  return refineExamJobs(jobs);
}

function plainPath(solved) {
  return criticalPathLabels(solved)
    .split(" / ")
    .map((path) =>
      path
        .split(" → ")
        .filter((name) => name !== "Dummy")
        .join(" → ")
    )
    .filter(Boolean)
    .join(" / ");
}

function realRows(solved) {
  return solved.rows.filter((row) => !row.dummy);
}

function rowDf(row) {
  return row.tf - row.ff;
}

function ganttRowsOf(solved) {
  return realRows(solved).map((row) => ({
    name: row.name,
    duration: row.duration,
    es: row.es,
    ef: row.ef,
    ls: row.ls,
    lf: row.lf,
    tf: row.tf,
    ff: row.ff,
    critical: row.tf === 0,
  }));
}

function ganttSignature(rows) {
  return (rows || []).map((row) => [row.name, row.duration, row.es, row.ef, row.tf].join(":")).join("|");
}

function loadGanttLibrary() {
  try {
    const data = JSON.parse(localStorage.getItem("cpm-gantt-library") || "[]");
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function ganttWhen(stamp) {
  const date = new Date(stamp);
  if (Number.isNaN(date.getTime())) return "";
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${month}월 ${day}일 ${hour}:${minute}`;
}

function rememberGantt(source, solved, title) {
  const rows = ganttRowsOf(solved);
  const entry = {
    id: `${source}-${Date.now()}`,
    source,
    title: title || (source === "draw" ? "공정표 그리기" : "문제풀이"),
    savedAt: Date.now(),
    project: solved.project,
    path: plainPath(solved),
    rows,
  };
  ganttStore[source] = entry;
  ganttUi.selected = entry.id;
  try {
    const sign = ganttSignature(rows);
    const list = loadGanttLibrary().filter(
      (item) => !(item.source === source && item.title === entry.title && ganttSignature(item.rows) === sign)
    );
    list.unshift(entry);
    localStorage.setItem("cpm-gantt-library", JSON.stringify(list.slice(0, 30)));
  } catch (e) {
    /* 목록 저장이 막혀도 이번 화면의 차트는 남습니다. */
  }
}

function resultTabs(page, panel) {
  const tableOn = panel !== "gantt";
  return `<div class="view-tabs" role="tablist" aria-label="결과 보기">
    <button type="button" class="btn ghost${tableOn ? " on" : ""}" data-result-view="table" data-result-page="${page}" aria-pressed="${tableOn}"><span class="mark mark-table" aria-hidden="true"></span>표로 보기</button>
    <button type="button" class="btn ghost${tableOn ? "" : " on"}" data-result-view="gantt" data-result-page="${page}" aria-pressed="${!tableOn}"><span class="mark mark-gantt" aria-hidden="true"></span>간트차트로 보기</button>
  </div>`;
}

function ganttChart(data) {
  const project = Math.max(1, Number(data.project) || 0);
  const dayW = project > 24 ? 22 : 28;
  const trackW = Math.max(280, project * dayW);
  const ticks = [];
  const step = project <= 20 ? 1 : project <= 40 ? 2 : 5;
  for (let day = 0; day <= project; day += step) ticks.push(day);
  if (ticks[ticks.length - 1] !== project) ticks.push(project);
  const rows = data.rows
    .map((row) => {
      const left = (row.es / project) * 100;
      const width = (Math.max(0, row.duration) / project) * 100;
      const floatLeft = (row.ef / project) * 100;
      const floatWidth = (Math.max(0, row.tf) / project) * 100;
      const crit = row.critical || row.tf === 0;
      return `<div class="gantt-row${crit ? " is-crit" : ""}">
        <div class="gantt-label"><b>${esc(row.name)}</b><small>${row.duration}일</small></div>
        <div class="gantt-track" style="width:${trackW}px">
          ${
            floatWidth > 0
              ? `<span class="gantt-float" style="left:${floatLeft}%;width:${floatWidth}%" title="총여유 TF ${row.tf}일"></span>`
              : ""
          }
          <span class="gantt-bar${crit ? " is-crit" : ""}" style="left:${left}%;width:${Math.max(width, 1.2)}%" title="ES ${row.es}일, EF ${row.ef}일">${width >= 8 ? row.duration : ""}</span>
        </div>
        <div class="gantt-meta">ES ${row.es} · EF ${row.ef}${crit ? " · 주공정" : ` · TF ${row.tf}`}</div>
      </div>`;
    })
    .join("");
  const axis = ticks
    .map((day) => `<span style="left:${(day / project) * 100}%">${day}</span>`)
    .join("");
  return `<div class="gantt">
    <header class="gantt-spec">
      <div>
        <p class="gantt-spec-kicker">SPECIFICATION · 공사 개요</p>
        <h2>${esc(data.title || "공정표")}</h2>
      </div>
      <dl>
        <div><dt>공기</dt><dd>${project}일</dd></div>
        <div><dt>주공정</dt><dd>${esc(data.path || "없음")}</dd></div>
      </dl>
    </header>
    <p class="gantt-legend"><span class="gantt-swatch is-crit"></span> 주공정 <span class="gantt-swatch"></span> 다른 작업 <span class="gantt-swatch is-float"></span> 총여유 TF</p>
    <div class="gantt-scroll">
      <div class="gantt-sheet">
        ${rows}
        <div class="gantt-row gantt-scale">
          <div></div>
          <div class="gantt-axis" style="width:${trackW}px">${axis}</div>
        </div>
      </div>
    </div>
    <p class="caption">막대는 ES에서 EF까지입니다. 막대 뒤의 빗금은 총여유 TF이고, LF까지 늘릴 수 있는 날입니다. 기간이 0인 더미는 막대로 그리지 않습니다.</p>
  </div>`;
}

function ganttView() {
  const source = ganttUi.source === "solve" ? "solve" : "draw";
  const list = loadGanttLibrary().filter((item) => item.source === source);
  const picked = list.find((item) => item.id === ganttUi.selected) || list[0] || null;
  if (picked) ganttUi.selected = picked.id;
  const empty =
    source === "draw"
      ? "공정표 그리기에서 채점이 맞으면 그 공정표가 이 목록에 저장됩니다."
      : "문제풀이에서 계산하기를 누르면 그 공정표가 이 목록에 저장됩니다.";
  return `
    <div class="kicker">간트차트</div>
    <h1>저장한 공정표를 막대로 보기</h1>
    <p class="lead">공정표 그리기에서 맞춘 표와, 문제풀이에서 계산한 표가 각각 목록으로 남습니다. 보고 싶은 표를 고르면 그 작업의 ES와 EF로 막대를 그립니다.</p>
    <div class="gantt-sources" role="group" aria-label="간트차트에 쓸 공정표 종류">
      <button type="button" class="btn ghost${source === "draw" ? " on" : ""}" data-lib-source="draw" aria-pressed="${source === "draw"}"><span class="mark mark-draw" aria-hidden="true"></span>공정표 그리기</button>
      <button type="button" class="btn ghost${source === "solve" ? " on" : ""}" data-lib-source="solve" aria-pressed="${source === "solve"}"><span class="mark mark-solve" aria-hidden="true"></span>문제풀이</button>
    </div>
    ${
      list.length
        ? `<div class="gantt-library">${list
            .map(
              (item) => `<button type="button" class="gantt-pick${picked && picked.id === item.id ? " on" : ""}" data-gantt-id="${esc(item.id)}">
                <b>${esc(item.title || "공정표")}</b>
                <small>${esc(ganttWhen(item.savedAt))} · 공기 ${item.project}일 · 주공정 ${esc(item.path || "없음")}</small>
              </button>`
            )
            .join("")}</div>`
        : `<p class="lead">${empty}</p>`
    }
    ${picked ? ganttChart(picked) : ""}
  `;
}

function bindGantt() {
  document.querySelectorAll("[data-lib-source]").forEach((btn) => {
    btn.addEventListener("click", () => {
      ganttUi.source = btn.getAttribute("data-lib-source") === "solve" ? "solve" : "draw";
      ganttUi.selected = "";
      render();
    });
  });
  document.querySelectorAll("[data-gantt-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      ganttUi.selected = btn.getAttribute("data-gantt-id");
      render();
    });
  });
}

function ganttPanel(host) {
  const source = ganttUi.source === "draw" ? "draw" : "solve";
  const data = ganttStore[source];
  const empty =
    source === "draw"
      ? "공정표 그리기에서 공정표 채점이 맞으면, 그 표의 ES와 EF로 막대를 그립니다."
      : "사진 문제풀이에서 계산하기를 누르면, 그 표의 ES와 EF로 막대를 그립니다.";
  const note =
    host && source !== host
      ? `<p class="caption">이 막대는 ${source === "draw" ? "공정표 그리기" : "사진 문제풀이"}에서 가져온 표입니다.</p>`
      : "";
  return `<div class="gantt-sources" role="group" aria-label="간트차트에 쓸 공정표">
      <button type="button" class="btn ghost${source === "draw" ? " on" : ""}" data-gantt-source="draw" aria-pressed="${source === "draw"}">공정표 그리기</button>
      <button type="button" class="btn ghost${source === "solve" ? " on" : ""}" data-gantt-source="solve" aria-pressed="${source === "solve"}">사진 문제풀이</button>
    </div>
    ${note}
    ${data ? ganttChart(data) : `<p class="lead">${empty}</p>`}`;
}

function bindResultViews(repaint) {
  document.querySelectorAll("[data-result-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.getAttribute("data-result-view") === "gantt" ? "gantt" : "table";
      const page = btn.getAttribute("data-result-page");
      if (page === "draw") {
        if (view === "gantt" && drawUi.panel !== "gantt") ganttUi.source = "draw";
        drawUi.panel = view;
      } else {
        if (view === "gantt" && solveUi.panel !== "gantt") ganttUi.source = "solve";
        solveUi.panel = view;
      }
      repaint();
    });
  });
  document.querySelectorAll("[data-gantt-source]").forEach((btn) => {
    btn.addEventListener("click", () => {
      ganttUi.source = btn.getAttribute("data-gantt-source") === "draw" ? "draw" : "solve";
      repaint();
    });
  });
}

function examTable(solved, mode) {
  const rows = realRows(solved);
  const headers = {
    read: ["작업", "기간", "바로 앞"],
    times: ["작업", "기간", "ES", "EF", "LS", "LF"],
    tf: ["작업", "ES", "LS", "TF"],
    ff: ["작업", "EF", "FF"],
    df: ["작업", "TF", "FF", "DF"],
    cp: ["작업", "기간", "TF", "FF", "DF", "CP"],
  }[mode];
  const cells = (row) => {
    if (mode === "times") return [row.name, row.duration, row.es, row.ef, row.ls, row.lf];
    if (mode === "tf") return [row.name, row.es, row.ls, row.tf];
    if (mode === "ff") return [row.name, row.ef, row.ff];
    if (mode === "df") return [row.name, row.tf, row.ff, rowDf(row)];
    return [row.name, row.duration, row.tf, row.ff, rowDf(row), row.tf === 0 ? "CP" : ""];
  };
  return `<div class="table-wrap"><table class="cpm-table"><thead><tr>${headers
    .map((header) => `<th>${header}</th>`)
    .join("")}</tr></thead><tbody>${rows
    .map((row) => `<tr class="${row.tf === 0 ? "is-crit" : ""}">${cells(row).map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("")}</tbody></table></div>`;
}

function solveSteps(built) {
  const walk = buildWalkthrough({ activities: built.activities });
  const solved = walk.solved;
  const rows = realRows(solved);
  const blank = { revealTE: [], revealTL: [], showCrit: false };
  const open = { revealTE: [...solved.ids], revealTL: [...solved.ids], showCrit: false };
  const calc = walk.steps.filter(
    (step) => step.title.startsWith("전진") || step.title.startsWith("후진") || step.title === "프로젝트 공기"
  );
  const steps = [
    {
      title: "사진에서 읽은 작업",
      html: `<p>확인한 작업 이름, 일수, 바로 앞 작업으로 공정표를 계산했습니다. 빈칸은 바로 앞 작업이 없는 것입니다.</p>
        <div class="table-wrap"><table class="cpm-table"><thead><tr><th>작업</th><th>기간</th><th>바로 앞</th></tr></thead><tbody>${built.jobs
          .map((job) => `<tr><td>${esc(job.name)}</td><td>${job.duration}</td><td>${job.preds.length ? esc(job.preds.join(", ")) : "없음"}</td></tr>`)
          .join("")}</tbody></table></div>
        <p>이어서 그린 공정표의 계산입니다. TF는 총여유, FF는 자유여유, DF는 간섭여유, CP는 주공정입니다.</p>
        <p>주공정선 <strong>${esc(plainPath(solved))}</strong> · 공기 ${solved.project}일</p>
        ${examTable(solved, "cp")}`,
      revealTE: [...solved.ids],
      revealTL: [...solved.ids],
      showCrit: true,
    },
    {
      title: "공정표를 그리는 이유",
      html: `<p>화살표는 작업이고, 점선은 더미입니다. 더미의 기간은 0이고 순서만 나타냅니다. 한 결합점에 작업 화살이 두 개 이상 들어가면, 기간이 가장 긴 작업만 그 점으로 직접 가고 나머지는 점선 더미로 번호를 나눠 잇습니다. 시작과 끝이 같은 화살도 더미로 분리합니다.</p>
        <ul>${built.notes.map((line) => `<li>${line}</li>`).join("")}</ul>`,
      ...blank,
    },
    ...calc,
    {
      title: "작업의 네 시각",
      html: `<p>ES는 출발 결합점의 TE, EF는 ES에 기간을 더한 날입니다. LF는 도착 결합점의 TL, LS는 LF에서 기간을 뺀 날입니다.</p>
        ${examTable(solved, "times")}
        <ul>${rows
          .map((row) => `<li>${row.name}: ES ${row.es}, EF ${row.es}+${row.duration}=${row.ef}, LF ${row.lf}, LS ${row.lf}−${row.duration}=${row.ls}</li>`)
          .join("")}</ul>`,
      ...open,
    },
    {
      title: "총여유 TF",
      html: `<p>TF는 총여유입니다. LS에서 ES를 뺀 날수이고, 이 작업만 늦춰도 전체 공기가 그대로인 날입니다. 0이면 하루도 밀 수 없습니다.</p>
        ${examTable(solved, "tf")}
        <ul>${rows.map((row) => `<li>${row.name}: LS ${row.ls} − ES ${row.es} = <strong>TF ${row.tf}</strong></li>`).join("")}</ul>`,
      ...open,
    },
    {
      title: "자유여유 FF",
      html: `<p>FF는 자유여유입니다. 도착 결합점의 빠른 시각에서 이 작업의 EF를 뺀 날수입니다. 바로 다음 작업의 빠른 시작을 밀지 않고 늦출 수 있는 날입니다.</p>
        ${examTable(solved, "ff")}
        <ul>${rows
          .map((row) => `<li>${row.name}: TE(${row.to}) ${solved.TE[row.to]} − EF ${row.ef} = <strong>FF ${row.ff}</strong></li>`)
          .join("")}</ul>`,
      ...open,
    },
    {
      title: "간섭여유 DF",
      html: `<p>DF는 간섭여유입니다. 총여유 TF에서 자유여유 FF를 뺀 날수입니다. 이 날만큼 늦추면 내 여유뿐 아니라 뒤 작업의 여유도 함께 줄어듭니다.</p>
        ${examTable(solved, "df")}
        <ul>${rows.map((row) => `<li>${row.name}: TF ${row.tf} − FF ${row.ff} = <strong>DF ${rowDf(row)}</strong></li>`).join("")}</ul>`,
      ...open,
    },
    {
      title: "주공정 CP",
      html: `<p>CP는 주공정입니다. TF가 0인 작업만 해당하고, 그 작업을 하루 늦추면 전체 공기도 하루 늘어납니다.</p>
        <p>주공정선 <strong>${esc(plainPath(solved))}</strong> · 공기 ${solved.project}일</p>
        ${examTable(solved, "cp")}
        <p>왼쪽 사진의 작업 목록과 이 표의 CP 칸을 나란히 확인해 보세요. 짙은 붉은 화살표가 주공정입니다.</p>`,
      revealTE: [...solved.ids],
      revealTL: [...solved.ids],
      showCrit: true,
    },
  ];
  return { solved, steps };
}

function solveUpload() {
  return `
    <div class="kicker">기출 해설</div>
    <h1>문제 사진으로 풀기</h1>
    <p class="lead">작업 이름, 기간, 바로 앞 작업이 적힌 기출 사진을 올리면 읽은 값을 표로 먼저 보여 줍니다. 사진과 다르면 칸을 고친 뒤 계산하기를 누르세요.</p>
    <div class="solve-layout">
      <aside class="solve-photo">
        ${solveUi.imageUrl ? `<img src="${solveUi.imageUrl}" alt="올린 문제 사진">` : `<p>아직 사진이 없습니다.</p>`}
        <p><input id="solve-file" type="file" accept="image/*" aria-label="문제 사진" ${solveUi.status ? "disabled" : ""}></p>
      </aside>
      <div>
        ${solveUi.status ? `<p class="solve-status" id="solve-status" role="status">${esc(solveUi.status)}</p>` : `<p class="lead">글자가 또렷한 표 사진을 올리면 읽은 값을 먼저 확인합니다.</p>`}
        ${solveUi.error ? `<p class="solve-error" role="alert">${esc(solveUi.error)}</p>` : ""}
      </div>
    </div>
  `;
}

function blankDraftRow() {
  return { name: "", duration: "", preds: "" };
}

function draftFromJobs(jobs) {
  return (jobs || []).map((job) => ({
    name: job.name || "",
    duration: job.duration == null || job.duration === "" ? "" : String(job.duration),
    preds: (job.preds || []).join(", "),
  }));
}

function collectDraft() {
  const table = document.getElementById("solve-draft");
  if (!table) return (solveUi.draft || []).map((row) => ({ ...row }));
  return [...table.querySelectorAll("tbody tr")].map((tr) => ({
    name: tr.querySelector("[data-draft=name]").value,
    duration: tr.querySelector("[data-draft=duration]").value,
    preds: tr.querySelector("[data-draft=preds]").value,
  }));
}

function tidyDraftName(text) {
  const name = String(text || "").trim();
  if (/^[A-Za-z]$/.test(name)) return name.toUpperCase();
  return name;
}

function parsePredField(text) {
  const raw = String(text || "").trim();
  if (!raw || emptyPred(raw)) return [];
  return [
    ...new Set(
      raw
        .split(/[,，、·∙•/+]+|\s+/)
        .map(tidyDraftName)
        .filter((name) => name && !emptyPred(name))
    ),
  ];
}

function jobsFromDraft(rows) {
  return rows
    .map((row) => {
      const name = tidyDraftName(row.name);
      const durationText = String(row.duration || "").replace(/\s/g, "");
      const predText = String(row.preds || "").trim();
      if (!name && !durationText && !predText) return null;
      const duration = examDuration(durationText);
      return {
        name,
        duration: duration == null ? Number.NaN : duration,
        preds: parsePredField(predText),
      };
    })
    .filter(Boolean);
}

function solveDraft() {
  const rows = solveUi.draft && solveUi.draft.length ? solveUi.draft : [blankDraftRow(), blankDraftRow(), blankDraftRow(), blankDraftRow()];
  return `
    <div class="kicker">기출 해설</div>
    <h1>읽은 작업을 확인</h1>
    <p class="lead">사진에서 읽은 작업명, 작업일수, 선행작업을 표에 올려 두었습니다. 사진과 다르면 칸을 고치고, 빠진 줄은 추가한 뒤 계산하기를 누르세요. 바로 앞 작업이 없으면 그 칸은 비워 둡니다.</p>
    <div class="solve-layout">
      <aside class="solve-photo">
        ${solveUi.imageUrl ? `<img src="${solveUi.imageUrl}" alt="올린 문제 사진">` : `<p>아직 사진이 없습니다.</p>`}
        <p><input id="solve-file" type="file" accept="image/*" aria-label="문제 사진"></p>
      </aside>
      <div>
        ${solveUi.draftError ? `<p class="solve-error" role="alert">${esc(solveUi.draftError)}</p>` : ""}
        <div class="table-wrap">
          <table class="cpm-table solve-table" id="solve-draft">
            <thead><tr><th>작업명</th><th>작업일수</th><th>선행작업</th><th></th></tr></thead>
            <tbody>
              ${rows
                .map(
                  (row) => `<tr>
                    <td><input data-draft="name" aria-label="작업명" value="${esc(row.name)}"></td>
                    <td><input data-draft="duration" inputmode="numeric" aria-label="작업일수" value="${esc(row.duration)}"></td>
                    <td><input data-draft="preds" aria-label="선행작업" value="${esc(row.preds)}" placeholder="없으면 비움"></td>
                    <td><button type="button" class="btn ghost" data-draft-remove>삭제</button></td>
                  </tr>`
                )
                .join("")}
            </tbody>
          </table>
        </div>
        <p style="display:flex;gap:10px;flex-wrap:wrap">
          <button type="button" class="btn ghost" id="solve-add-row">줄 추가</button>
          <button type="button" class="btn" id="solve-calc">계산하기</button>
          <button type="button" class="btn ghost" id="solve-back">다른 사진</button>
        </p>
      </div>
    </div>
  `;
}

function solveLesson() {
  const { solved, steps } = solveSteps(solveUi.built);
  const last = steps.length - 1;
  solveUi.step = Math.max(0, Math.min(last, solveUi.step));
  const s = steps[solveUi.step];
  const pct = Math.round(((solveUi.step + 1) / steps.length) * 100);
  return `
    <div id="solve-lesson">
      <div class="kicker">기출 해설 · ${solveUi.step + 1} / ${steps.length}</div>
      <h1>${s.title}</h1>
      <div class="progress"><span style="width:${pct}%"></span></div>
      <div class="solve-layout">
        <aside class="solve-photo">
          <img src="${solveUi.imageUrl}" alt="올린 문제 사진">
          <p>해설하는 동안 사진을 옆에 둡니다.</p>
        </aside>
        <div>
          <div class="net-panel">${cpmSvg(solved, solveUi.panel === "gantt" ? { revealTE: [...solved.ids], revealTL: [...solved.ids], showCrit: true, caption: "" } : s)}</div>
          ${resultTabs("solve", solveUi.panel)}
          ${solveUi.panel === "gantt" ? ganttPanel("solve") : `<div class="walk-card">${s.html}</div>`}
          <p style="display:flex;gap:10px;flex-wrap:wrap;margin-top:16px">
            <button type="button" class="btn ghost prev" id="solve-prev">이전</button>
            <button type="button" class="btn next" id="solve-next">${solveUi.step === last ? "해설 끝" : "다음 설명"}</button>
            <button type="button" class="btn ghost" id="solve-edit">표 고치기</button>
            <button type="button" class="btn ghost" id="solve-back">다른 사진</button>
          </p>
        </div>
      </div>
    </div>
  `;
}

function solveView() {
  if (solveUi.built) return solveLesson();
  if (solveUi.draft) return solveDraft();
  return solveUpload();
}

const bankUi = { year: "전체", kind: "전체", seen: "", step: 0, all: false, flash: "" };
const BANK_KINDS = ["네트워크 공정표", "단축 공정표", "여유시간과 주공정", "여유시간", "주공정선 표시", "일정과 여유시간"];
const LEVEL_NAME = { 하: "초급", 중: "중급", 상: "고급" };

function examGate() {
  return `
    <div class="kicker">문제풀이</div>
    <h1>기출을 푸는 곳</h1>
    <p class="lead">공정표 문제은행은 건축기사와 건설회사 공정관리 시험에서 반복되는 작성 유형입니다. 작업표만 보고 공기와 주공정을 구한 뒤 해설을 여세요. 사진이 있으면 사진 해설로 그 표를 계산합니다.</p>
    <nav class="hub-menu" aria-label="문제풀이 메뉴">
      <a class="gate-btn" href="#/solve/bank" data-link><span class="mark mark-quiz" aria-hidden="true"></span><b>공정표 문제은행</b><small>${EXAM_BANK.length}문제 · 연도 · 유형</small></a>
      <a class="gate-btn" href="#/solve/photo" data-link><span class="mark mark-solve" aria-hidden="true"></span><b>기출 사진 해설</b><small>사진을 읽고 단계로 해설</small></a>
    </nav>
  `;
}

function bankNo(item) {
  return String(EXAM_BANK.indexOf(item) + 1).padStart(2, "0");
}

function bankSource(item) {
  if (item.source) return item.source;
  const kind = item.level === "하" ? "기초 공정표" : item.level === "중" ? "기사 공정표" : "종합 공정표";
  return `공정표 문제은행 ${bankNo(item)} · ${kind}`;
}

function examSheet(item) {
  if (item.problemImage) {
    return `
      <figure class="exam-photo">
        <img src="${esc(item.problemImage)}" alt="${esc(item.source || item.title)} 문제">
      </figure>
      <div class="table-wrap">
        ${
          item.costs
            ? costTable(item.costs)
            : item.jobs.some((job) => job.slope != null)
              ? gradientTable(item.jobs)
              : `<table class="cpm-table">
          <thead><tr><th>작업</th><th>일수</th><th>바로 앞</th></tr></thead>
          <tbody>${item.jobs
            .map(
              (job) =>
                `<tr><td>${esc(job.name)}</td><td>${job.duration}</td><td>${job.preds.length ? esc(job.preds.join(", ")) : "없음"}</td></tr>`
            )
            .join("")}</tbody>
        </table>`}
      </div>
    `;
  }
  return `
    <figure class="exam-photo">
      <div class="exam-paper">
        <header><span>공정관리 · 주공정법</span><b>${esc(bankNo(item))}</b></header>
        <p>${esc(item.ask)}</p>
        <table>
          <thead><tr><th>작업</th><th>일수</th><th>바로 앞 작업</th></tr></thead>
          <tbody>${item.jobs
            .map(
              (job) =>
                `<tr><td>${esc(job.name)}</td><td>${job.duration}</td><td>${job.preds.length ? esc(job.preds.join(", ")) : "—"}</td></tr>`
            )
            .join("")}</tbody>
        </table>
        <footer>${esc(bankSource(item))}</footer>
      </div>
    </figure>
  `;
}

const AUTH_USERS = "cpm-users";
const AUTH_SESSION = "cpm-session";
const AUTH_STUDY = "cpm-study";

const authApi = {
  users() {
    try {
      return JSON.parse(localStorage.getItem(AUTH_USERS) || "{}");
    } catch (e) {
      return {};
    }
  },
  saveUsers(users) {
    localStorage.setItem(AUTH_USERS, JSON.stringify(users));
  },
  session() {
    return localStorage.getItem(AUTH_SESSION) || "";
  },
  setSession(name) {
    if (name) localStorage.setItem(AUTH_SESSION, name);
    else localStorage.removeItem(AUTH_SESSION);
  },
  study() {
    try {
      return JSON.parse(localStorage.getItem(AUTH_STUDY) || "{}");
    } catch (e) {
      return {};
    }
  },
  saveStudy(data) {
    localStorage.setItem(AUTH_STUDY, JSON.stringify(data));
  },
};

function recordStudy(id, correct) {
  const name = authApi.session();
  if (!name) return false;
  const data = authApi.study();
  data[name] = data[name] || {};
  data[name][id] = { correct: !!correct, at: Date.now() };
  authApi.saveStudy(data);
  paintAccount();
  return true;
}

function studyOf(name) {
  const user = name || authApi.session();
  if (!user) return {};
  return authApi.study()[user] || {};
}

function studyStats(name) {
  const book = studyOf(name);
  const ids = Object.keys(book);
  const correct = ids.filter((id) => book[id].correct).length;
  return {
    tried: ids.length,
    correct,
    wrong: ids.length - correct,
    rate: ids.length ? Math.round((correct / ids.length) * 100) : 0,
  };
}

function paintAccount() {
  const box = document.getElementById("account");
  if (!box) return;
  const name = authApi.session();
  if (!name) {
    box.innerHTML = `<a class="btn ghost account-btn" href="#/login">로그인</a>`;
    return;
  }
  const stat = studyStats(name);
  box.innerHTML = `<a class="account-chip" href="#/me"><b>${esc(name)}</b><small>${stat.tried ? `정답률 ${stat.rate}%` : "내 학습"}</small></a>`;
}

function bankYears() {
  return [...new Set(EXAM_BANK.map((item) => item.year).filter(Boolean))].sort((a, b) => b - a);
}

function bankKind(item) {
  if (String(item.title).includes("단축")) return "단축 공정표";
  return item.title;
}

function bankItems() {
  const years = bankYears();
  if (bankUi.year !== "전체" && !years.includes(Number(bankUi.year))) bankUi.year = "전체";
  if (bankUi.kind !== "전체" && !BANK_KINDS.includes(bankUi.kind)) bankUi.kind = "전체";
  return EXAM_BANK.filter((item) => {
    const yearOk = bankUi.year === "전체" || item.year === Number(bankUi.year);
    const kindOk = bankUi.kind === "전체" || bankKind(item) === bankUi.kind;
    return yearOk && kindOk;
  });
}

function chipRow(label, values, current, attr) {
  return `<div class="bank-filters" role="group" aria-label="${label}">
    <span>${label}</span>
    ${values
      .map(
        (value) =>
          `<button type="button" class="btn ghost${String(current) === String(value) ? " on" : ""}" ${attr}="${value}" aria-pressed="${String(current) === String(value)}">${value}</button>`
      )
      .join("")}
  </div>`;
}

function bankList() {
  const items = bankItems();
  const stat = authApi.session() ? studyStats() : null;
  const book = studyOf();
  return `
    <div class="kicker">문제은행</div>
    <h1>공정표 문제은행</h1>
    <p class="lead">연도와 유형을 고르면 그 조건의 기출만 남습니다.</p>
    ${stat ? `<p class="study-summary">푼 문제 ${stat.tried}개 · 맞춤 ${stat.correct} · 오답 ${stat.wrong} · 정답률 ${stat.rate}%</p>` : ""}
    ${chipRow("연도", ["전체", ...bankYears()], bankUi.year, "data-bank-year")}
    ${chipRow("유형", ["전체", ...BANK_KINDS], bankUi.kind, "data-bank-kind")}
    <div class="bank-list">
      ${items
        .map((item) => {
          const rec = book[item.id];
          const badge = rec ? `<em class="tile-state ${rec.correct ? "ok" : "bad"}">${rec.correct ? "맞춤" : "오답"}</em>` : "";
          return `<a class="bank-tile" data-level="${item.level}" href="#/solve/bank/${item.id}">
            <span class="bank-no">${bankNo(item)}</span>
            ${badge}
            <b>${esc(item.title)}</b>
            <small>${esc(item.tag || LEVEL_NAME[item.level] || item.level)}</small>
          </a>`;
        })
        .join("")}
    </div>
    <p class="actions"><a class="btn prev" href="#/solve" data-link>문제풀이</a></p>
  `;
}

function won(value) {
  return `${Number(value).toLocaleString("ko-KR")}원`;
}

function gradientTable(jobs) {
  return `<table class="cpm-table">
    <thead><tr><th>작업</th><th>결합점</th><th>일수</th><th>바로 앞</th><th>비용구배(천원)</th></tr></thead>
    <tbody>${jobs
      .map(
        (job) =>
          `<tr><td>${esc(job.name)}</td><td>${job.from} → ${job.to}</td><td>${job.duration}</td><td>${job.preds.length ? esc(job.preds.join(", ")) : "없음"}</td><td>${job.slope}</td></tr>`
      )
      .join("")}</tbody>
  </table>`;
}

function linkActivities(jobs, useCut) {
  const work = jobs.map((job) => ({
    name: job.name,
    from: job.from,
    to: job.to,
    duration: job.duration - (useCut ? job.cut || 0 : 0),
  }));
  return work.concat([
    { name: "Dummy", duration: 0, from: 4, to: 3, dummy: true },
    { name: "Dummy", duration: 0, from: 3, to: 2, dummy: true },
  ]);
}

function eventLine(solved) {
  return solved.ids.map((id) => `${id}번 ${solved.TE[id]}/${solved.TL[id]}`).join(", ");
}

function halfCrashSolution(item) {
  const normal = solveCpm(linkActivities(item.jobs, false));
  const crashed = solveCpm(linkActivities(item.jobs, true));
  const extra = item.jobs.reduce((sum, job) => sum + (job.cut || 0) * job.slope, 0);
  const maxCut = (job) => Math.floor(job.duration / 2);
  return `
    <h2>해설</h2>
    <p>표준공기 ${normal.project}일 · 7일 단축한 공기 ${crashed.project}일 · 추가 비용 ${extra}천원</p>
    <p>주공정은 ${esc(plainPath(normal))}입니다. 아래 그림의 위가 표준 공정표이고, 아래가 7일을 줄인 공정표입니다. 삼각형 왼쪽이 EST, 오른쪽이 LST이며, 굵은 선이 주공정입니다.</p>
    ${item.answerImage ? `<figure class="exam-photo"><img src="${esc(item.answerImage)}" alt="${esc(item.source)} 답안 공정표"></figure>` : ""}
    <h3>1. 표준 공정표를 잇는 방법</h3>
    <ul>
      <li>A는 1→2, B는 1→3, C는 1→4입니다. C가 4일로 가장 길어서 2번, 3번, 4번의 최초시각은 모두 4일입니다.</li>
      <li>D와 E는 A, B, C가 모두 끝난 뒤에 시작합니다. C가 끝난 4번에서 3번으로, 3번에서 2번으로 기간 0인 점선을 올려 그 소식을 전합니다.</li>
      <li>F는 B와 C 다음이라 3번에서 6번으로 갑니다. G는 C 다음이라 4번에서 6번으로 갑니다. E는 2번에서 6번으로 갑니다.</li>
      <li>H는 D와 F 다음이라 5번에서 7번, I는 E와 G 다음이라 6번에서 7번입니다.</li>
    </ul>
    <p>결합점 EST/LST는 ${esc(eventLine(normal))}입니다. 공기는 ${normal.project}일이고, 주공정 ${esc(plainPath(normal))}의 길이가 4+6+7일입니다.</p>
    <h3>2. 7일을 줄이는 순서</h3>
    <p>비용구배는 하루를 줄일 때 늘어나는 돈입니다. 단위는 천원입니다. 한 작업은 자기 일수의 1/2을 넘겨 줄일 수 없습니다. 주공정이 여러 갈래면, 그 갈래를 모두 하루씩 줄이는 짝 가운데 가장 싼 것을 고릅니다.</p>
    <ul>
      <li>17일. 주공정은 C, E, I입니다. 하루 10천원인 E를 하루 줄입니다. 공기 16일.</li>
      <li>E를 한 번 더 줄입니다. 공기 15일. 이때 D와 H도 주공정이 됩니다.</li>
      <li>두 갈래를 함께 줄이는 값 중 C 하루, 30천원이 가장 쌉니다. 공기 14일.</li>
      <li>다음은 D와 E를 같이 하루씩, 30천원입니다. 공기 13일. E는 6일의 절반인 3일까지 다 줄었습니다.</li>
      <li>다음은 B와 C를 같이 하루씩, 70천원입니다. 공기 12일. C는 2일, B는 3일의 절반을 넘기지 않는 1일까지 줄었습니다.</li>
      <li>다음은 D, F, I를 같이 하루씩, 80천원입니다. 공기 11일.</li>
      <li>마지막은 H와 I를 같이 하루씩, 82천원입니다. 공기 10일.</li>
    </ul>
    <h3>3. 단축한 뒤의 일수</h3>
    <div class="table-wrap"><table class="cpm-table">
      <thead><tr><th>작업</th><th>정상</th><th>단축 한도</th><th>줄인 날</th><th>단축 후</th><th>추가 비용</th></tr></thead>
      <tbody>${item.jobs
        .map(
          (job) =>
            `<tr><td>${esc(job.name)}</td><td>${job.duration}</td><td>${maxCut(job)}일</td><td>${job.cut || 0}</td><td>${job.duration - (job.cut || 0)}</td><td>${(job.cut || 0) * job.slope}천원</td></tr>`
        )
        .join("")}</tbody>
    </table></div>
    <p>결합점 EST/LST는 ${esc(eventLine(crashed))}입니다. 공기 ${crashed.project}일이고, 작업 화살표의 여유가 모두 0이라 굵은 주공정이 됩니다.</p>
    <p>추가 비용은 ${extra}천원입니다. 10+10+30+30+70+80+82로 더합니다.</p>
  `;
}

function costTable(costs) {
  return `<table class="cpm-table">
    <thead><tr><th>작업</th><th>바로 앞</th><th>정상 공기</th><th>정상 경비</th><th>특급 공기</th><th>특급 경비</th></tr></thead>
    <tbody>${costs
      .map(
        (row) =>
          `<tr><td>${esc(row.name)}</td><td>${row.preds.length ? esc(row.preds.join(", ")) : "없음"}</td><td>${row.normal}</td><td>${won(row.normalCost)}</td><td>${row.crash}</td><td>${won(row.crashCost)}</td></tr>`
      )
      .join("")}</tbody>
  </table>`;
}

function crashExamSolution(item) {
  const normal = solveCpm(item.normalActivities);
  const crashed = solveCpm(item.activities);
  const target = normal.project - 3;
  const slopes = item.costs.map((row) => {
    const days = row.normal - row.crash;
    const slope = days > 0 ? (row.crashCost - row.normalCost) / days : null;
    return { ...row, days, slope };
  });
  const normalCost = item.costs.reduce((sum, row) => sum + row.normalCost, 0);
  const extra = slopes.reduce((sum, row) => sum + (item.crashed[row.name] || 0) * (row.slope || 0), 0);
  const used = (name) => item.crashed[name] || 0;
  const after = (row) => row.normal - used(row.name);
  return `
    <h2>해설</h2>
    <p>표준공기 ${normal.project}일 · 3일 단축한 공기 ${crashed.project}일 · 총공사금액 ${won(normalCost + extra)}</p>
    <h3>1. 정상공기로 표준공기</h3>
    <p>단축하기 전 주공정은 ${esc(plainPath(normal))}이고, 표준공기는 ${normal.project}일입니다. 지정공기는 이보다 3일 짧은 ${target}일입니다.</p>
    <div class="canvas-wrap">${cpmSvg(normal, { showCrit: true, caption: "" })}</div>
    <p class="caption">결합점 위칸의 왼쪽은 EST, 오른쪽은 LST입니다. 짙은 붉은 화살표가 주공정입니다.</p>
    <h3>2. 하루를 줄이는 비용</h3>
    <p>특급 공기까지 줄일 수 있는 날로, 늘어나는 경비를 나눕니다. 싼 작업부터 주공정을 줄입니다.</p>
    <div class="table-wrap"><table class="cpm-table">
      <thead><tr><th>작업</th><th>줄일 수 있는 날</th><th>하루 비용</th><th>이번 단축</th></tr></thead>
      <tbody>${slopes
        .map(
          (row) =>
            `<tr><td>${esc(row.name)}</td><td>${row.days ? `${row.days}일` : "없음"}</td><td>${row.slope == null ? "—" : won(row.slope)}</td><td>${used(row.name) ? `${used(row.name)}일` : ""}</td></tr>`
        )
        .join("")}</tbody>
    </table></div>
    <ul>
      <li>처음 주공정에서 하루 비용이 가장 싼 작업은 E입니다. E를 1일 줄이면 500원이 늘고, 공기는 21일이 됩니다. 이때 A-D-H-I도 21일이 되어 주공정이 두 갈래가 됩니다.</li>
      <li>두 갈래를 함께 하루 줄이려면 각 갈래에서 하나씩 줄입니다. B는 하루 1,000원, D는 하루 3,000원으로 이 짝이 가장 쌉니다.</li>
      <li>B 1일과 D 1일을 줄이면 공기는 20일입니다. 같은 이유로 B 1일과 D 1일을 한 번 더 줄이면 공기가 ${target}일이 됩니다.</li>
      <li>결과적으로 B는 ${after(slopes.find((row) => row.name === "B"))}일, E는 ${after(slopes.find((row) => row.name === "E"))}일, D는 ${after(slopes.find((row) => row.name === "D"))}일입니다. C, F, G, H는 정상공기로 둡니다.</li>
    </ul>
    <h3>3. 3일을 단축한 공정표</h3>
    <p>단축 뒤 주공정은 ${esc(plainPath(crashed))}입니다. 공기 ${crashed.project}일입니다.</p>
    <div class="canvas-wrap">${cpmSvg(crashed, { showCrit: true, caption: "" })}</div>
    <p class="caption">결합점 위칸의 왼쪽은 EST, 오른쪽은 LST입니다. 짙은 붉은색 화살표가 주공정입니다.</p>
    <h3>4. 총공사금액</h3>
    <p>정상 경비를 모두 더하면 ${won(normalCost)}입니다. 단축으로 늘어난 경비는 B ${won(used("B") * slopes.find((row) => row.name === "B").slope)}, E ${won(used("E") * slopes.find((row) => row.name === "E").slope)}, D ${won(used("D") * slopes.find((row) => row.name === "D").slope)}으로 ${won(extra)}입니다.</p>
    <p>총공사금액은 ${won(normalCost)} + ${won(extra)} = <strong>${won(normalCost + extra)}</strong>입니다.</p>
    ${item.answerImage ? `<figure class="exam-photo"><img src="${esc(item.answerImage)}" alt="${esc(item.source)} 해설"></figure>` : ""}
  `;
}

function cut4ExamSolution(item) {
  const normal = solveCpm(item.activities);
  const crashed = solveCpm(
    item.activities.map((act) => ({
      ...act,
      duration: act.duration - (act.dummy ? 0 : item.crashed[act.name] || 0),
    }))
  );
  const slopes = item.costs.map((row) => {
    const days = row.normal - row.crash;
    const slope = days > 0 ? (row.crashCost - row.normalCost) / days : null;
    return { ...row, days, slope };
  });
  const slopeOf = (name) => slopes.find((row) => row.name === name).slope;
  const used = (name) => item.crashed[name] || 0;
  const normalCost = item.costs.reduce((sum, row) => sum + row.normalCost, 0);
  const extra = slopes.reduce((sum, row) => sum + used(row.name) * (row.slope || 0), 0);
  const day1 = slopeOf("D");
  const day2 = slopeOf("G");
  const day3 = slopeOf("B") + slopeOf("G");
  const day4 = slopeOf("A") + slopeOf("B");
  return `
    <h2>해설</h2>
    <p>표준공기 ${normal.project}일 · 4일 단축한 공기 ${crashed.project}일 · 총공사비 ${won(normalCost + extra)}</p>
    <p>아래 그림이 표준 공정표입니다. 삼각형이 EST, 사각형이 LST이고, 굵은 선이 주공정 ${esc(plainPath(normal))}입니다.</p>
    ${item.answerImage ? `<figure class="exam-photo"><img src="${esc(item.answerImage)}" alt="${esc(item.source)} 답안 공정표"></figure>` : ""}
    <h3>1. 표준 공정표를 잇는 방법</h3>
    <ul>
      <li>A, B, C는 바로 앞 작업이 없습니다. A는 0번에서 1번으로 5일, B는 0번에서 공사 끝인 6번으로 18일, C는 0번에서 5번으로 16일입니다.</li>
      <li>D, E, F는 A 다음입니다. D는 1번에서 4번으로 8일, E는 1번에서 2번으로 7일, F는 1번에서 3번으로 6일입니다.</li>
      <li>G는 D, E, F가 모두 끝난 뒤에 시작합니다. D가 도착한 4번에서 G가 6번으로 7일 나갑니다. E가 끝난 2번과 F가 끝난 3번에서는 4번으로 기간 0인 점선을 이어, 그 소식만 전달합니다.</li>
      <li>C도 공사 끝에 포함되도록 5번에서 6번으로 점선을 잇습니다.</li>
    </ul>
    <p>결합점 EST/LST는 ${esc(eventLine(normal))}입니다. 가장 긴 길은 A 5일, D 8일, G 7일을 더한 ${normal.project}일입니다. A-E-G는 19일, B와 A-F-G는 18일, C는 16일이라 주공정이 아닙니다.</p>
    <h3>2. 표준공기 총공사비</h3>
    <p>표준 공비를 모두 더하면 ${item.costs.map((row) => won(row.normalCost)).join(" + ")} = <strong>${won(normalCost)}</strong>입니다.</p>
    <h3>3. 4일을 줄이는 순서</h3>
    <p>비용경사는 하루를 줄일 때 늘어나는 돈입니다. 급속공비에서 표준공비를 빼고, 줄일 수 있는 날수로 나눕니다. 주공정 위에서 이 값이 작은 작업부터 하루씩 줄입니다. 주공정이 여러 갈래가 되면, 그 갈래를 모두 하루씩 줄이는 짝 가운데 가장 싼 것을 고릅니다.</p>
    <div class="table-wrap"><table class="cpm-table">
      <thead><tr><th>작업</th><th>줄일 수 있는 날</th><th>하루 비용</th><th>이번 단축</th><th>단축 후</th></tr></thead>
      <tbody>${slopes
        .map(
          (row) =>
            `<tr><td>${esc(row.name)}</td><td>${row.days ? `${row.days}일` : "없음"}</td><td>${row.slope == null ? "—" : won(row.slope)}</td><td>${used(row.name) ? `${used(row.name)}일` : ""}</td><td>${row.normal - used(row.name)}</td></tr>`
        )
        .join("")}</tbody>
    </table></div>
    <ul>
      <li>20일에서 19일. 주공정은 A, D, G입니다. 하루 비용은 D ${won(slopeOf("D"))}, G ${won(slopeOf("G"))}, A ${won(slopeOf("A"))}입니다. 가장 싼 D를 하루 줄입니다. 추가 ${won(day1)}. D가 7일이 되면 A-E-G도 19일이 되어 주공정이 두 갈래가 됩니다.</li>
      <li>19일에서 18일. 두 갈래에 함께 있는 G를 하루 줄이는 값이 ${won(day2)}으로 가장 쌉니다. 공기는 18일이 되고, 18일인 B도 주공정이 됩니다.</li>
      <li>18일에서 17일. B를 그대로 두면 공기가 줄지 않습니다. B 하루 ${won(slopeOf("B"))}과, 아직 하루 더 줄일 수 있는 G ${won(slopeOf("G"))}을 함께 줄입니다. 추가 ${won(day3)}.</li>
      <li>17일에서 16일. G는 급속공기 5일까지 이미 줄었습니다. A 하루 ${won(slopeOf("A"))}과 B 하루 ${won(slopeOf("B"))}을 함께 줄입니다. 추가 ${won(day4)}.</li>
    </ul>
    <h3>4. 4일 단축 총공사비</h3>
    <p>추가 비용은 ${won(day1)} + ${won(day2)} + ${won(day3)} + ${won(day4)} = ${won(extra)}입니다.</p>
    <p>4일을 줄인 총공사비는 ${won(normalCost)} + ${won(extra)} = <strong>${won(normalCost + extra)}</strong>입니다. 단축 뒤 공기는 ${crashed.project}일이고, A-D-G, A-E-G, B, C가 모두 ${crashed.project}일입니다.</p>
  `;
}

function practiceBankSolution(item) {
  const built = jobsToNetwork(item.jobs);
  const solved = solveCpm(built.activities);
  return `
    <h2>해설</h2>
    <p>${esc(bankAnswerLine(item, solved))}</p>
    <div class="canvas-wrap">${cpmSvg(solved, { showCrit: true, caption: "" })}</div>
    <p class="caption">짙은 붉은색 화살표가 주공정입니다. 점선은 기간 0인 더미이고, 한 결합점에는 작업 화살이 하나만 들어갑니다.</p>
    ${built.notes.length ? `<ul>${built.notes.map((line) => `<li>${line}</li>`).join("")}</ul>` : ""}
    ${examTable(solved, "cp")}
  `;
}

function givenExamSolution(item) {
  const solved = solveCpm(item.activities);
  const rows = realRows(solved);
  const byName = Object.fromEntries(rows.map((row) => [row.name, row]));
  const line = (name) => {
    const row = byName[name];
    return `${name}는 ${row.es}일에 시작해 ${row.ef}일에 끝납니다. 늦어도 ${row.ls}일에 시작하면 되고, TF ${row.tf}일, FF ${row.ff}일, DF ${rowDf(row)}일입니다.`;
  };
  return `
    <h2>해설</h2>
    <p>공기 ${solved.project}일 · 주공정 ${esc(plainPath(solved))}</p>
    <p>답안 사진과 같은 연결입니다. 점선은 일이 없는 더미이고, 선행만 전달합니다. 굵은 흐름이 주공정입니다.</p>
    ${item.answerImage ? `<figure class="exam-photo"><img src="${esc(item.answerImage)}" alt="${esc(item.source || item.title)} 답안"></figure>` : ""}
    <h3>공정표를 잇는 순서</h3>
    <ul>
      <li>A는 선행이 없습니다. 1번에서 2번으로 갑니다.</li>
      <li>B, C, D는 모두 A 다음입니다. B는 3번, C는 5번, D는 4번에서 끝냅니다.</li>
      <li>F는 B, C, D가 모두 끝난 뒤에 시작합니다. C는 5번에 바로 들어가고, B가 끝난 3번과 D가 끝난 4번에서 5번으로 점선을 잇습니다.</li>
      <li>E는 B 다음이라 3번에서 6번으로 갑니다. H는 E 다음에 6번에서 9번으로 갑니다.</li>
      <li>I는 E와 F 다음입니다. F는 7번에서 끝나고, E가 끝난 6번에서 7번으로 점선을 잇습니다.</li>
      <li>J는 E, F, G 다음입니다. G는 4번에서 8번으로 가고, F와 E가 모인 7번에서 8번으로 점선을 잇습니다.</li>
      <li>K는 H, I, J가 모인 9번 다음에 10번으로 갑니다. 공기 ${solved.project}일입니다.</li>
    </ul>
    <h3>여유시간</h3>
    <p>TF는 총여유, FF는 자유여유, DF는 TF에서 FF를 뺀 간섭여유입니다. TF가 0이면 주공정입니다.</p>
    <ul>
      ${["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K"].map((name) => `<li>${line(name)}</li>`).join("")}
    </ul>
    <p>E의 TF가 ${byName.E.tf}일인 이유는, E가 ${byName.E.ef}일에 끝나도 J는 ${byName.J.ls}일에 시작하면 되기 때문입니다. H는 E가 끝나는 날에 바로 시작할 수 있어 FF는 0입니다.</p>
    <p>D의 TF는 ${byName.D.tf}일입니다. D 다음 G는 ${byName.G.es}일에 바로 시작하므로 FF는 0이고, 남은 ${byName.D.tf}일이 DF입니다.</p>
    ${examTable(solved, "cp")}
  `;
}

function bankAnswerLine(item, solved) {
  const rows = realRows(solved);
  const path = plainPath(solved);
  const lines = [`공기 ${solved.project}일`, `주공정 ${path}`];
  if (item.focus) {
    const row = rows.find((entry) => entry.name === item.focus);
    if (row) lines.push(`작업 ${row.name}의 TF ${row.tf}일, FF ${row.ff}일, DF ${rowDf(row)}일`);
  }
  return lines.join(" · ");
}

function answerFigures(item) {
  return [item.answerImage, item.answerImage2]
    .filter(Boolean)
    .map(
      (src, index) =>
        `<figure class="exam-photo"><img src="${esc(src)}" alt="${esc(item.source || item.title)} 해설 ${index + 1}"></figure>`
    )
    .join("");
}

function sheetFloatTable(solved) {
  const rows = solved.rows.filter((row) => !row.dummy || row.name !== "Dummy");
  return `<div class="table-wrap"><table class="cpm-table">
    <thead><tr><th>작업</th><th>EST</th><th>EFT</th><th>LST</th><th>LFT</th><th>TF</th><th>FF</th><th>DF</th><th>CP</th></tr></thead>
    <tbody>${rows
      .map(
        (row) => `<tr class="${row.tf === 0 ? "is-crit" : ""}">
          <td>${esc(row.name)}</td><td>${row.es}</td><td>${row.ef}</td><td>${row.ls}</td><td>${row.lf}</td>
          <td>${row.tf}</td><td>${row.ff}</td><td>${row.tf - row.ff}</td><td>${row.tf === 0 ? "*" : ""}</td>
        </tr>`
      )
      .join("")}</tbody>
  </table></div>`;
}

function arrowName(act) {
  if (!act || act.name === "Dummy" || act.name === "더미") return "더미";
  return act.name;
}

function jobTable(jobs) {
  return `<div class="table-wrap"><table class="cpm-table">
    <thead><tr><th>작업</th><th>일수</th><th>바로 앞</th></tr></thead>
    <tbody>${jobs
      .map(
        (job) =>
          `<tr><td>${esc(job.name)}</td><td>${job.duration}</td><td>${job.preds.length ? esc(job.preds.join(", ")) : "없음"}</td></tr>`
      )
      .join("")}</tbody>
  </table></div>`;
}

function arrivalLine(solved, act) {
  const start = solved.TE[act.from];
  const arrive = start + act.duration;
  const who = arrowName(act);
  if (!act.duration) {
    return `<li>${who}는 일수가 0이라 결합점 ${act.from}의 EST ${start}일을 그대로 가져옵니다.</li>`;
  }
  return `<li>${who}는 결합점 ${act.from}의 EST ${start}일에 ${act.duration}일을 더해 ${arrive}일에 도착합니다.</li>`;
}

function departLine(solved, act) {
  const leave = solved.TL[act.to] - act.duration;
  const who = arrowName(act);
  if (!act.duration) {
    return `<li>${who}는 일수가 0이라 결합점 ${act.to}의 LST ${solved.TL[act.to]}일을 그대로 맞춥니다.</li>`;
  }
  return `<li>${who}는 결합점 ${act.to}의 LST ${solved.TL[act.to]}일보다 ${act.duration}일 먼저 출발해야 하므로 ${leave}일입니다.</li>`;
}

function networkSteps(item, solved) {
  const steps = [
    {
      title: "작업 목록",
      html: `<p>바로 앞 작업이 모두 끝나야 그 일이 시작합니다. 앞에 일이 없으면 0일에 시작합니다. 여러 일이 한 점으로 모이면, 그 점의 EST는 도착 시각 중 가장 늦은 값입니다.</p>${jobTable(item.jobs)}`,
    },
  ];
  solved.order.forEach((id) => {
    const incoming = solved.incoming[id];
    if (!incoming.length) {
      steps.push({
        title: `결합점 ${id}의 EST`,
        html: `<p>결합점 ${id}로 들어오는 작업이 없습니다. 시작점이므로 EST는 <strong>0</strong>일입니다.</p>`,
      });
      return;
    }
    const late = incoming.filter((act) => solved.TE[act.from] + act.duration === solved.TE[id]);
    const picked = late.map(arrowName).join(", ");
    steps.push({
      title: `결합점 ${id}의 EST`,
      html: `<p>결합점 ${id}에 도착하는 작업을 각각 계산합니다.</p>
        <ul>${incoming.map((act) => arrivalLine(solved, act)).join("")}</ul>
        <p>${incoming.length > 1 ? `이 중 가장 늦은 시각은 ${picked}의 ${solved.TE[id]}일입니다.` : `도착 시각이 EST입니다.`} 결합점 ${id}의 EST는 <strong>${solved.TE[id]}</strong>일입니다.</p>`,
    });
  });
  const ends = solved.ids.filter((id) => !solved.outgoing[id].length);
  steps.push({
    title: "공기와 주공정",
    html: `<p>나가는 작업이 없는 결합점 ${ends.join(", ")}번의 EST 가운데 가장 늦은 값이 공기입니다. 공기는 <strong>${solved.project}일</strong>입니다.</p>
      <p>주공정은 ${esc(item.path || plainPath(solved))}입니다. 이 길의 작업은 하루도 늦출 수 없습니다.</p>`,
  });
  [...solved.order].reverse().forEach((id) => {
    const outgoing = solved.outgoing[id];
    if (!outgoing.length) {
      steps.push({
        title: `결합점 ${id}의 LST`,
        html: `<p>결합점 ${id}에서 나가는 작업이 없습니다. 공사 끝이므로 LST는 공기와 같은 <strong>${solved.TL[id]}</strong>일입니다.</p>`,
      });
      return;
    }
    const early = outgoing.filter((act) => solved.TL[act.to] - act.duration === solved.TL[id]);
    const picked = early.map(arrowName).join(", ");
    steps.push({
      title: `결합점 ${id}의 LST`,
      html: `<p>결합점 ${id}에서 나가는 길이 제시간에 끝나려면, 각 길의 출발 시각을 계산합니다. 그중 가장 이른 시각이 LST입니다.</p>
        <ul>${outgoing.map((act) => departLine(solved, act)).join("")}</ul>
        <p>${outgoing.length > 1 ? `가장 이른 시각은 ${picked} 쪽 ${solved.TL[id]}일입니다.` : `이 출발 시각이 LST입니다.`} 결합점 ${id}의 LST는 <strong>${solved.TL[id]}</strong>일입니다.</p>`,
    });
  });
  solved.rows.forEach((row) => {
    if (row.dummy && (row.name === "Dummy" || row.name === "더미")) return;
    const df = row.tf - row.ff;
    const meaning = row.tf === 0
      ? "TF가 0이므로 이 작업을 늦추면 공기가 늘어납니다. 주공정입니다."
      : `시작을 ${row.tf}일까지 늦출 수 있습니다. 그중 FF ${row.ff}일은 뒤 작업의 EST를 바꾸지 않고, DF ${df}일은 뒤 작업의 여유를 줄입니다.`;
    steps.push({
      title: `작업 ${row.name}의 여유`,
      html: `<p>${esc(row.name)}는 결합점 ${row.from}에서 ${row.to}로 ${row.duration}일 걸립니다.</p>
        <ul>
          <li>ES = 시작점 EST = ${row.es}</li>
          <li>EF = ${row.es} + ${row.duration} = ${row.ef}</li>
          <li>LF = 끝점 LST = ${row.lf}</li>
          <li>LS = ${row.lf} − ${row.duration} = ${row.ls}</li>
          <li>TF = ${row.lf} − ${row.es} − ${row.duration} = <strong>${row.tf}</strong></li>
          <li>FF = ${solved.TE[row.to]} − ${row.es} − ${row.duration} = <strong>${row.ff}</strong></li>
          <li>DF = ${row.tf} − ${row.ff} = <strong>${df}</strong></li>
        </ul>
        <p>${meaning}</p>`,
    });
  });
  steps.push({
    title: "여유시간 표",
    html: `<p>앞에서 구한 값을 한 표로 모읍니다. TF가 0인 줄이 주공정입니다.</p>${sheetFloatTable(solved)}${answerFigures(item)}`,
  });
  return steps;
}

function crashSheetSteps(item) {
  const steps = [
    {
      title: "비용경사",
      html: `<p>비용경사는 그 작업을 하루 줄일 때 늘어나는 돈입니다. 표준 총공사비는 ${won(item.normalCost)}입니다. 경사가 없는 작업은 공기를 줄이지 않습니다.</p>`,
    },
  ];
  const slopes = item.jobs.filter((job) => job.slope != null);
  const frozen = item.jobs.filter((job) => job.slope == null);
  slopes.forEach((job) => {
    const preds = job.preds.length ? `${job.preds.join(", ")}입니다` : "없습니다";
    const limit = job.limit ? ` 최대 ${job.limit}일까지 줄일 수 있습니다.` : "";
    steps.push({
      title: `${job.name}의 하루 비용`,
      html: `<p>${esc(job.name)}는 ${job.duration}일이고, 바로 앞 작업은 ${esc(preds)}. 하루 줄이면 <strong>${won(job.slope)}</strong>이 늘어납니다.${limit}</p>`,
    });
  });
  if (frozen.length) {
    steps.push({
      title: "줄이지 않는 작업",
      html: `<p>${frozen.map((job) => esc(job.name)).join(", ")}는 공기를 줄이지 않습니다.</p>`,
    });
  }
  steps.push({
    title: "표준 주공정",
    html: `<p>표준 주공정은 ${esc(item.path)}이고, 표준공기는 <strong>${item.project}일</strong>입니다. 이 길에서 하루 비용이 싼 작업부터 줄입니다. 다른 길도 같은 길이가 되면, 그 길까지 함께 줄여야 공기가 짧아집니다.</p>`,
  });
  let running = 0;
  let prev = item.project;
  item.crashSteps.forEach((step) => {
    running += step.cost;
    const names = step.names.join(", ");
    const why =
      step.names.length > 1
        ? `주공정이 여러 갈래라 ${esc(names)}를 함께 하루씩 줄입니다.`
        : `주공정에서 하루 비용이 싼 ${esc(names)}를 하루 줄입니다.`;
    steps.push({
      title: `${prev}일에서 ${step.day}일`,
      html: `<p>${why} 이번 추가 비용은 ${won(step.cost)}이고, 지금까지 더한 추가 비용은 <strong>${won(running)}</strong>입니다. 공기는 ${step.day}일이 됩니다.</p>`,
    });
    prev = step.day;
  });
  const extra = running;
  const cutDays = item.crashSteps.length;
  steps.push({
    title: "총공사비",
    html: `<p>${cutDays}일을 줄이는 데 ${won(extra)}이 더 듭니다. 총공사비는 ${won(item.normalCost)} + ${won(extra)} = <strong>${won(item.normalCost + extra)}</strong>입니다. 단축 뒤 공기는 ${item.project - cutDays}일입니다.</p>${answerFigures(item)}`,
  });
  return steps;
}

function sheetSteps(item) {
  if (item.crashSteps) return crashSheetSteps(item);
  return networkSteps(item, solveCpm(item.activities));
}

function stepLead(html, fallback) {
  const text = String(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const lead = text.split(/[.。]/)[0].trim();
  if (!lead) return fallback;
  if (lead.length <= 42) return lead;
  const cut = lead.slice(0, 42);
  const pause = Math.max(cut.lastIndexOf(" "), cut.lastIndexOf(","));
  return `${pause > 18 ? cut.slice(0, pause) : cut}…`;
}

function splitBody(title, body) {
  const parts = String(body).split(/(<ul>[\s\S]*?<\/ul>|<ol>[\s\S]*?<\/ol>)/);
  const steps = [];
  parts.forEach((part) => {
    if (!part || !part.trim()) return;
    if (/^\s*<[uo]l>/.test(part)) {
      const lis = [];
      part.replace(/<li>([\s\S]*?)<\/li>/g, (_, inner) => {
        lis.push(inner.trim());
        return "";
      });
      lis.forEach((inner) => steps.push({ title: stepLead(inner, title), html: `<p>${inner}</p>` }));
      return;
    }
    steps.push({ title, html: part });
  });
  return steps;
}

function legacySteps(html) {
  const figures = [];
  const stripped = String(html || "").replace(/<figure[\s\S]*?<\/figure>/gi, (fig) => {
    figures.push(fig);
    return "";
  });
  const chunks = stripped.split("<h3>");
  const head = (chunks.shift() || "").replace(/<h2>[^<]*<\/h2>/, "").trim();
  const steps = [];
  chunks.forEach((chunk) => {
    const cut = chunk.indexOf("</h3>");
    const title = (cut >= 0 ? chunk.slice(0, cut) : "다음 계산").replace(/<[^>]+>/g, "").trim() || "다음 계산";
    const body = cut >= 0 ? chunk.slice(cut + 5) : chunk;
    steps.push(...splitBody(title, body));
  });
  if (head) steps.push({ title: "계산 결과", html: head });
  if (figures.length) steps.push({ title: "해설 그림", html: figures.join("") });
  return steps.length ? steps : [{ title: "해설", html }];
}

function examSteps(item) {
  if (item.solution === "sheet") return sheetSteps(item);
  const html =
    item.solution === "half"
      ? halfCrashSolution(item)
      : item.solution === "cut4"
        ? cut4ExamSolution(item)
        : item.solution === "crash"
          ? crashExamSolution(item)
          : item.activities
            ? givenExamSolution(item)
            : practiceBankSolution(item);
  return legacySteps(html);
}

function explainActions(html) {
  return `<p class="actions" style="display:flex;gap:10px;flex-wrap:wrap">${html}</p>`;
}

function stepViewer(steps) {
  const allButton = `<button type="button" class="btn ghost" id="bank-all">전체 해설 보기</button>`;
  const stepButton = `<button type="button" class="btn next" id="bank-reveal">단계별 해설</button>`;
  if (bankUi.all) {
    const open = steps
      .map(
        (step) => `<section class="explain-step">
          <h3>${esc(step.title)}</h3>
          ${step.html}
        </section>`
      )
      .join("");
    return `${explainActions(stepButton)}${open}`;
  }
  const count = bankUi.step || 0;
  if (!count) return explainActions(`${stepButton}${allButton}`);
  const step = steps[Math.min(count, steps.length) - 1];
  const prev = count > 1 ? `<button type="button" class="btn prev" id="bank-prev-step">이전 단계</button>` : "";
  const next =
    count < steps.length
      ? `<button type="button" class="btn next" id="bank-next-step">다음 단계</button>`
      : `<button type="button" class="btn ghost" id="bank-reveal">처음부터</button>`;
  return `<section class="explain-step" id="explain-current">
      <h3>${esc(step.title)}</h3>
      ${step.html}
      ${explainActions(`${prev}${next}${allButton}`)}
      <p class="lead">${count} / ${steps.length}</p>
    </section>`;
}

function ensureBankDraw(item) {
  if (!item.jobs) return;
  if (drawUi.bankFor === item.id) return;
  drawUi.bankFor = item.id;
  drawUi.problem = {
    title: item.title,
    level: LEVEL_NAME[item.level] || item.level,
    jobs: item.jobs,
    activities: item.activities,
  };
  drawUi.nodes = [{ id: 1, x: 88, y: 220 }];
  drawUi.arrows = [];
  drawUi.nextNode = 2;
  drawUi.nextArrow = 1;
  drawUi.tool = "node";
  drawUi.arm = null;
  drawUi.pending = null;
  drawUi.lines = [];
  drawUi.checks = [];
  drawUi.ok = false;
  drawUi.showAnswer = false;
  drawUi.tableMsg = "";
  drawUi.tableHint = false;
  drawUi.answers = [];
}

function studyBar(item) {
  const rec = studyOf()[item.id];
  const saved = rec ? (rec.correct ? "맞춘 문제로 저장되어 있습니다." : "오답으로 저장되어 있습니다.") : "";
  return `<div class="study-bar">
    <p>${saved || "해설을 한 단계씩 본 뒤 이해했는지 표시하세요."}</p>
    ${bankUi.flash ? `<p class="solve-error">${esc(bankUi.flash)}</p>` : ""}
    <p class="actions">
      <button type="button" class="btn" id="study-ok">이해했어요</button>
      <button type="button" class="btn ghost" id="study-miss">다시 볼 문제</button>
    </p>
  </div>`;
}

function bankProblem(id) {
  const item = EXAM_BANK.find((entry) => entry.id === id) || EXAM_BANK[0];
  if (bankUi.seen !== item.id) {
    bankUi.seen = item.id;
    bankUi.step = 0;
    bankUi.all = false;
    bankUi.flash = "";
  }
  ensureBankDraw(item);
  const index = EXAM_BANK.findIndex((entry) => entry.id === item.id);
  const prev = EXAM_BANK[index - 1];
  const next = EXAM_BANK[index + 1];
  const no = bankNo(item);
  let steps = "";
  try {
    steps = stepViewer(examSteps(item));
  } catch (error) {
    steps = `<p class="solve-error" role="alert">${esc(error.message || "이 문제를 풀지 못했습니다.")}</p>`;
  }
  return `
    <div class="kicker">문제은행 · ${LEVEL_NAME[item.level] || item.level} · ${no} / ${String(EXAM_BANK.length).padStart(2, "0")}</div>
    <h1>${no}. ${esc(item.title)}</h1>
    <p class="exam-source">출처 · ${esc(bankSource(item))}</p>
    ${examSheet(item)}
    ${
      item.jobs
        ? `<section class="bank-practice">
            <h2>이 문제로 그려 보기</h2>
            <p class="lead">오른쪽 목록의 작업명, 바로 앞 작업, 일수가 이 기출의 기본값입니다. 결합점과 화살표를 직접 그려 보세요.</p>
            ${drawView(true)}
          </section>`
        : ""
    }
    ${steps}
    ${studyBar(item)}
    <p class="actions">
      <a class="btn prev" href="#/solve/bank">목록</a>
      ${prev ? `<a class="btn prev" href="#/solve/bank/${prev.id}">이전 문제</a>` : ""}
      ${next ? `<a class="btn next" href="#/solve/bank/${next.id}">다음 문제</a>` : ""}
    </p>
  `;
}

function markStudy(correct) {
  const id = bankUi.seen;
  if (!id) return;
  if (!recordStudy(id, correct)) {
    bankUi.flash = "로그인하면 맞춘 문제와 오답이 이 브라우저에 저장됩니다.";
    paintDraw();
    return;
  }
  bankUi.flash = "";
  paintDraw();
}

function bindBank() {
  document.querySelectorAll("[data-bank-year]").forEach((btn) => {
    btn.addEventListener("click", () => {
      bankUi.year = btn.getAttribute("data-bank-year") || "전체";
      render();
    });
  });
  document.querySelectorAll("[data-bank-kind]").forEach((btn) => {
    btn.addEventListener("click", () => {
      bankUi.kind = btn.getAttribute("data-bank-kind") || "전체";
      render();
    });
  });
  document.getElementById("bank-reveal")?.addEventListener("click", () => {
    bankUi.all = false;
    bankUi.step = 1;
    paintDraw();
    document.getElementById("explain-current")?.scrollIntoView({ block: "nearest" });
  });
  document.getElementById("bank-all")?.addEventListener("click", () => {
    bankUi.all = true;
    paintDraw();
    document.getElementById("bank-reveal")?.scrollIntoView({ block: "nearest" });
  });
  document.getElementById("bank-prev-step")?.addEventListener("click", () => {
    bankUi.step = Math.max(1, (bankUi.step || 1) - 1);
    paintDraw();
    document.getElementById("explain-current")?.scrollIntoView({ block: "nearest" });
  });
  document.getElementById("bank-next-step")?.addEventListener("click", () => {
    bankUi.step += 1;
    paintDraw();
    document.getElementById("explain-current")?.scrollIntoView({ block: "nearest" });
  });
  document.getElementById("study-ok")?.addEventListener("click", () => markStudy(true));
  document.getElementById("study-miss")?.addEventListener("click", () => markStudy(false));
}

function loginView() {
  const name = authApi.session();
  if (name) {
    return `
      <div class="kicker">계정</div>
      <h1>${esc(name)} 님</h1>
      <p class="lead">이 브라우저에 로그인되어 있습니다.</p>
      <p class="actions"><a class="btn" href="#/me">내 학습</a><button type="button" class="btn ghost" id="logout">로그아웃</button></p>
    `;
  }
  return `
    <div class="kicker">계정</div>
    <h1>로그인</h1>
    <p class="lead">이름과 학습 기록은 이 브라우저에만 저장됩니다. 서버로 옮길 때는 같은 이름과 풀이 기록을 그대로 쓰면 됩니다.</p>
    <div class="auth-grid">
      <form id="login-form" class="auth-card">
        <h2>로그인</h2>
        <label>이름<input name="name" autocomplete="username" required></label>
        <label>비밀번호<input name="password" type="password" autocomplete="current-password" required></label>
        <button class="btn" type="submit">로그인</button>
      </form>
      <form id="signup-form" class="auth-card">
        <h2>회원가입</h2>
        <label>이름<input name="name" autocomplete="username" required></label>
        <label>비밀번호<input name="password" type="password" autocomplete="new-password" required></label>
        <label>비밀번호 확인<input name="again" type="password" autocomplete="new-password" required></label>
        <button class="btn" type="submit">가입하고 시작</button>
      </form>
    </div>
    <p id="auth-msg" class="solve-error"></p>
  `;
}

function meView() {
  const name = authApi.session();
  if (!name) {
    return `
      <div class="kicker">내 학습</div>
      <h1>로그인하면 기록이 남습니다</h1>
      <p class="actions"><a class="btn" href="#/login">로그인</a></p>
    `;
  }
  const book = studyOf(name);
  const stat = studyStats(name);
  const rows = Object.keys(book)
    .map((id) => ({ id, ...book[id], item: EXAM_BANK.find((entry) => entry.id === id) }))
    .filter((row) => row.item);
  const list = (items, empty) =>
    items.length
      ? `<ul class="study-list">${items
          .map(
            (row) =>
              `<li><a href="#/solve/bank/${row.item.id}">${esc(row.item.tag || bankNo(row.item))} · ${esc(row.item.title)}</a></li>`
          )
          .join("")}</ul>`
      : `<p class="lead">${empty}</p>`;
  return `
    <div class="kicker">내 학습</div>
    <h1>${esc(name)}의 기록</h1>
    <div class="stat-row">
      <article class="stat"><b>${stat.tried}</b><span>푼 문제</span></article>
      <article class="stat"><b>${stat.correct}</b><span>맞춤</span></article>
      <article class="stat"><b>${stat.wrong}</b><span>오답</span></article>
      <article class="stat"><b>${stat.rate}%</b><span>정답률</span></article>
    </div>
    <section class="card"><h2>맞춘 문제</h2>${list(rows.filter((row) => row.correct), "아직 맞춘 기출이 없습니다.")}</section>
    <section class="card"><h2>틀린 문제</h2>${list(rows.filter((row) => !row.correct), "오답으로 표시한 문제가 없습니다.")}</section>
    <p class="actions"><button type="button" class="btn ghost" id="logout">로그아웃</button></p>
  `;
}

function bindAuth() {
  document.getElementById("signup-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    const name = String(data.get("name") || "").trim();
    const password = String(data.get("password") || "");
    const again = String(data.get("again") || "");
    const msg = document.getElementById("auth-msg");
    if (name.length < 2) {
      msg.textContent = "이름은 두 글자 이상으로 적어 주세요.";
      return;
    }
    if (password.length < 4) {
      msg.textContent = "비밀번호는 네 글자 이상으로 적어 주세요.";
      return;
    }
    if (password !== again) {
      msg.textContent = "비밀번호가 서로 다릅니다.";
      return;
    }
    const users = authApi.users();
    if (users[name]) {
      msg.textContent = "이미 있는 이름입니다. 로그인해 주세요.";
      return;
    }
    users[name] = { password, created: Date.now() };
    authApi.saveUsers(users);
    authApi.setSession(name);
    location.hash = "#/me";
  });
  document.getElementById("login-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.target);
    const name = String(data.get("name") || "").trim();
    const password = String(data.get("password") || "");
    const users = authApi.users();
    const msg = document.getElementById("auth-msg");
    if (!users[name] || users[name].password !== password) {
      msg.textContent = "이름 또는 비밀번호가 맞지 않습니다.";
      return;
    }
    authApi.setSession(name);
    location.hash = "#/me";
  });
  document.getElementById("logout")?.addEventListener("click", () => {
    authApi.setSession("");
    location.hash = "#/";
  });
}

function onPhotoPage() {
  return location.hash === "#/solve/photo";
}

function paintSolve() {
  if (!onPhotoPage()) return;
  app.innerHTML = solveView();
  navActive();
  bindSolve();
}

function setSolveStatus(text) {
  solveUi.status = text;
  const status = document.getElementById("solve-status");
  if (status) status.textContent = text;
}

async function loadTesseract() {
  if (window.Tesseract) return window.Tesseract;
  await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
    script.onload = resolve;
    script.onerror = () => reject(new Error("글자를 읽는 도구를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 사진을 다시 올려 주세요."));
    document.head.appendChild(script);
  });
  if (!window.Tesseract) throw new Error("글자를 읽는 도구를 시작하지 못했습니다.");
  return window.Tesseract;
}

function loadSolveImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("사진을 열지 못했습니다."));
    image.src = url;
  });
}

function cropExamImage(image) {
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  const { width, height } = canvas;
  const pixels = ctx.getImageData(0, 0, width, height).data;
  const rowInk = new Float64Array(height);
  const colInk = new Float64Array(width);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const gray = pixels[index] * 0.299 + pixels[index + 1] * 0.587 + pixels[index + 2] * 0.114;
      if (gray < 185) {
        rowInk[y] += 1;
        colInk[x] += 1;
      }
    }
  }
  const rowCut = Math.max(2, width * 0.008);
  const colCut = Math.max(2, height * 0.008);
  let top = 0;
  let bottom = height - 1;
  let left = 0;
  let right = width - 1;
  while (top < bottom && rowInk[top] < rowCut) top += 1;
  while (bottom > top && rowInk[bottom] < rowCut) bottom -= 1;
  while (left < right && colInk[left] < colCut) left += 1;
  while (right > left && colInk[right] < colCut) right -= 1;
  const pad = 12;
  top = Math.max(0, top - pad);
  left = Math.max(0, left - pad);
  bottom = Math.min(height - 1, bottom + pad);
  right = Math.min(width - 1, right + pad);
  const cropW = Math.max(1, right - left + 1);
  const cropH = Math.max(1, bottom - top + 1);
  if (cropW > width * 0.98 && cropH > height * 0.98) return image;
  const cropped = document.createElement("canvas");
  cropped.width = cropW;
  cropped.height = cropH;
  cropped.getContext("2d").drawImage(canvas, left, top, cropW, cropH, 0, 0, cropW, cropH);
  return cropped;
}

function sharpenExam(source) {
  const { gray, width, height } = source;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const pixels = ctx.createImageData(width, height);
  const at = (x, y) => gray[Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const blur = (at(x - 1, y) + at(x + 1, y) + at(x, y - 1) + at(x, y + 1) + at(x, y)) / 5;
      const value = Math.max(0, Math.min(255, at(x, y) + (at(x, y) - blur) * 0.9));
      const index = (y * width + x) * 4;
      pixels.data[index] = value;
      pixels.data[index + 1] = value;
      pixels.data[index + 2] = value;
      pixels.data[index + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

function scaledExamGray(image) {
  const longest = Math.max(image.width, image.height);
  const scale = longest < 2200 ? Math.min(3, 2200 / longest) : Math.min(1, 2800 / longest);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height);
  const data = pixels.data;
  const gray = new Uint8ClampedArray(width * height);
  for (let pixel = 0, index = 0; pixel < gray.length; pixel += 1, index += 4) {
    gray[pixel] = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
  }
  const sample = [];
  for (let pixel = 0; pixel < gray.length; pixel += 17) sample.push(gray[pixel]);
  sample.sort((a, b) => a - b);
  const low = sample[Math.floor(sample.length * 0.02)] || 0;
  const high = sample[Math.floor(sample.length * 0.98)] || 255;
  const span = Math.max(1, high - low);
  for (let pixel = 0, index = 0; pixel < gray.length; pixel += 1, index += 4) {
    const value = Math.max(0, Math.min(255, ((gray[pixel] - low) / span) * 255));
    gray[pixel] = value;
    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
  }
  ctx.putImageData(pixels, 0, 0);
  return { canvas, gray, width, height };
}

function adaptiveExamCanvas(source) {
  const { gray, width, height } = source;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  const pixels = ctx.createImageData(width, height);
  const radius = Math.max(12, Math.round(Math.min(width, height) / 45));
  const stride = width + 1;
  const integral = new Float64Array(stride * (height + 1));
  for (let y = 0; y < height; y += 1) {
    let row = 0;
    for (let x = 0; x < width; x += 1) {
      row += gray[y * width + x];
      integral[(y + 1) * stride + (x + 1)] = integral[y * stride + (x + 1)] + row;
    }
  }
  const rect = (x0, y0, x1, y1) =>
    integral[y1 * stride + x1] - integral[y0 * stride + x1] - integral[y1 * stride + x0] + integral[y0 * stride + x0];
  for (let y = 0; y < height; y += 1) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(height, y + radius + 1);
    for (let x = 0; x < width; x += 1) {
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(width, x + radius + 1);
      const mean = rect(x0, y0, x1, y1) / ((x1 - x0) * (y1 - y0));
      const value = gray[y * width + x] < mean - 8 ? 0 : 255;
      const index = (y * width + x) * 4;
      pixels.data[index] = value;
      pixels.data[index + 1] = value;
      pixels.data[index + 2] = value;
      pixels.data[index + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

function examScore(jobs) {
  if (!jobs || jobs.length < 2) return 0;
  const links = jobs.reduce((sum, job) => sum + job.preds.length, 0);
  const penalty = (jobs.dropped || 0) * 30;
  try {
    jobsToNetwork(jobs);
  } catch (e) {
    return Math.max(0, jobs.length - penalty);
  }
  return jobs.length * 10 + links - penalty;
}

function projectionBands(ink, length, cutoff, minThick, minGap) {
  const bands = [];
  let start = -1;
  for (let index = 0; index <= length; index += 1) {
    const on = index < length && ink[index] >= cutoff;
    if (on && start < 0) start = index;
    if (!on && start >= 0) {
      if (index - start >= minThick) bands.push({ a: start, b: index });
      start = -1;
    }
  }
  const merged = [];
  bands.forEach((band) => {
    const prev = merged[merged.length - 1];
    if (prev && band.a - prev.b <= minGap) prev.b = band.b;
    else merged.push({ a: band.a, b: band.b });
  });
  return merged;
}

function withoutExamRules(canvas) {
  const copy = document.createElement("canvas");
  copy.width = canvas.width;
  copy.height = canvas.height;
  const ctx = copy.getContext("2d");
  ctx.drawImage(canvas, 0, 0);
  const { width, height } = copy;
  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;
  const rowInk = new Float64Array(height);
  const colInk = new Float64Array(width);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4] < 150) {
        rowInk[y] += 1;
        colInk[x] += 1;
      }
    }
  }
  const thin = Math.max(10, Math.round(Math.min(width, height) * 0.012));
  const bands = (ink, length, cutoff) => {
    const found = [];
    let start = -1;
    for (let index = 0; index <= length; index += 1) {
      const on = index < length && ink[index] >= cutoff;
      if (on && start < 0) start = index;
      if (!on && start >= 0) {
        if (index - start <= thin) found.push([start, index]);
        start = -1;
      }
    }
    return found;
  };
  const rows = bands(rowInk, height, Math.max(12, width * 0.28));
  const cols = bands(colInk, width, Math.max(12, height * 0.28));
  const wipe = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const index = (y * width + x) * 4;
    data[index] = 255;
    data[index + 1] = 255;
    data[index + 2] = 255;
  };
  rows.forEach(([a, b]) => {
    for (let y = a - 2; y < b + 2; y += 1) {
      for (let x = 0; x < width; x += 1) wipe(x, y);
    }
  });
  cols.forEach(([a, b]) => {
    for (let x = a - 2; x < b + 2; x += 1) {
      for (let y = 0; y < height; y += 1) wipe(x, y);
    }
  });
  ctx.putImageData(image, 0, 0);
  return copy;
}

function examTableGrid(canvas) {
  const { width, height } = canvas;
  const data = canvas.getContext("2d").getImageData(0, 0, width, height).data;
  const rowInk = new Float64Array(height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4] < 150) rowInk[y] += 1;
    }
  }
  const rows = projectionBands(rowInk, height, Math.max(4, width * 0.004), 10, 8).map((band) => ({
    y0: band.a,
    y1: band.b,
  }));
  if (rows.length < 3) return null;
  const colHits = new Float64Array(width);
  rows.forEach((row) => {
    const seen = new Uint8Array(width);
    for (let y = row.y0; y < row.y1; y += 1) {
      for (let x = 0; x < width; x += 1) {
        if (data[(y * width + x) * 4] < 150) seen[x] = 1;
      }
    }
    for (let x = 0; x < width; x += 1) colHits[x] += seen[x];
  });
  const cores = projectionBands(colHits, width, Math.max(2, Math.ceil(rows.length * 0.34)), 8, 12)
    .filter((band) => band.b - band.a > Math.max(12, width * 0.015))
    .map((band) => ({ x0: band.a, x1: band.b }));
  const cols = [];
  cores.forEach((core) => {
    const prev = cols[cols.length - 1];
    const gap = prev ? core.x0 - prev.x1 : Infinity;
    const close = gap <= Math.max(40, width * 0.04);
    if (prev && close) prev.x1 = core.x1;
    else cols.push({ ...core });
  });
  if (cols.length < 2) return null;
  return { rows, cols };
}

function columnBounds(cols, index, width) {
  const left = index <= 0 ? 0 : Math.floor((cols[index - 1].x1 + cols[index].x0) / 2);
  const right = index >= cols.length - 1 ? width : Math.ceil((cols[index].x1 + cols[index + 1].x0) / 2);
  return { left, right };
}

function expandRowSpan(canvas, row, x0, x1, leftLimit, rightLimit) {
  const y0 = Math.max(0, row.y0);
  const y1 = Math.min(canvas.height, row.y1);
  const stripH = Math.max(1, y1 - y0);
  const data = canvas.getContext("2d").getImageData(0, y0, canvas.width, stripH).data;
  const dark = (x) => {
    if (x < 0 || x >= canvas.width) return false;
    for (let y = 0; y < stripH; y += 1) {
      if (data[(y * canvas.width + x) * 4] < 160) return true;
    }
    return false;
  };
  const gap = 18;
  let left = x0;
  let blank = 0;
  for (let x = x0 - 1; x >= leftLimit; x -= 1) {
    if (dark(x)) {
      left = x;
      blank = 0;
    } else {
      blank += 1;
      if (blank >= gap) break;
    }
  }
  let right = x1;
  blank = 0;
  for (let x = x1; x < rightLimit; x += 1) {
    if (dark(x)) {
      right = x + 1;
      blank = 0;
    } else {
      blank += 1;
      if (blank >= gap) break;
    }
  }
  return {
    x0: Math.max(leftLimit, left - 8),
    x1: Math.min(rightLimit, right + 8),
  };
}

function sliceExamCell(canvas, row, col, bounds) {
  const limit = bounds || { left: 0, right: canvas.width };
  const span = expandRowSpan(canvas, row, col.x0, col.x1, limit.left, limit.right);
  const x0 = Math.max(0, span.x0);
  const y0 = Math.max(0, row.y0);
  const x1 = Math.min(canvas.width, span.x1);
  const y1 = Math.min(canvas.height, row.y1);
  const sw = Math.max(1, x1 - x0);
  const sh = Math.max(1, y1 - y0);
  const sample = canvas.getContext("2d").getImageData(x0, y0, sw, sh).data;
  let ink = 0;
  for (let index = 0; index < sample.length; index += 4) {
    if (sample[index] < 160) ink += 1;
  }
  const scale = Math.min(8, Math.max(3, 180 / sh));
  const out = document.createElement("canvas");
  const dw = Math.round(sw * scale);
  const dh = Math.round(sh * scale);
  out.width = dw + 36;
  out.height = dh + 36;
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, x0, y0, sw, sh, 18, 18, dw, dh);
  const drawn = ctx.getImageData(0, 0, out.width, out.height);
  const pixels = drawn.data;
  for (let index = 0; index < pixels.length; index += 4) {
    const value = pixels[index] < 176 ? 0 : 255;
    pixels[index] = value;
    pixels[index + 1] = value;
    pixels[index + 2] = value;
  }
  ctx.putImageData(drawn, 0, 0);
  return { canvas: out, ink };
}

async function ocrExamCell(worker, slice, whitelist, mode) {
  if (!slice || slice.ink < 20) return { text: "", confidence: 0 };
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: mode,
      tessedit_char_whitelist: whitelist,
      user_defined_dpi: "300",
      preserve_interword_spaces: "1",
    });
  } catch (e) {
    /* keep the current parameters */
  }
  const result = await worker.recognize(slice.canvas);
  return {
    text: String(result.data.text || "").replace(/\s+/g, " ").trim(),
    confidence: Number(result.data.confidence) || 0,
  };
}

function cleanCellName(text) {
  const token = String(text || "")
    .replace(/([A-Za-z])\1+/gi, "$1")
    .replace(/[^A-Za-z가-힣]/g, "");
  return examName(token);
}

function cleanCellDuration(text) {
  const digits = String(text || "").replace(/[^\d]/g, "");
  return examDuration(digits);
}

function cleanCellPreds(text, name) {
  const preds = [];
  String(text || "")
    .toUpperCase()
    .replace(/([A-Z])\1+/g, "$1")
    .split(/[^A-Z가-힣]+/)
    .filter(Boolean)
    .forEach((part) => {
      if (/^[A-Z]{2,4}$/.test(part)) preds.push(...part.split(""));
      else {
        const pred = examName(part);
        if (pred) preds.push(pred);
      }
    });
  return [...new Set(preds.filter((pred) => pred !== name))];
}

async function readExamTable(worker, latin, canvas, readId) {
  const sheet = withoutExamRules(canvas);
  const grid = examTableGrid(sheet);
  if (!grid) return [];
  const letters = latin || worker;
  const boundsOf = (index) => columnBounds(grid.cols, index, sheet.width);
  let headerAt = -1;
  const headerLimit = Math.min(grid.rows.length, 4);
  for (let row = 0; row < headerLimit && headerAt < 0; row += 1) {
    if (readId !== solveUi.readId) return [];
    const line = await ocrExamCell(
      worker,
      sliceExamCell(sheet, grid.rows[row], { x0: 0, x1: sheet.width }, { left: 0, right: sheet.width }),
      "",
      "7"
    );
    if (/작업|activity/i.test(line.text) && /선행|기간|일수|시간/i.test(line.text)) headerAt = row;
  }
  const sample = grid.rows.slice(headerAt >= 0 ? headerAt + 1 : 1);
  const scores = grid.cols.map(() => ({ digit: 0, single: 0, multi: 0 }));
  for (let row = 0; row < sample.length; row += 1) {
    for (let col = 0; col < grid.cols.length; col += 1) {
      if (readId !== solveUi.readId) return [];
      const read = await ocrExamCell(letters, sliceExamCell(sheet, sample[row], grid.cols[col], boundsOf(col)), "", "7");
      const text = read.text.replace(/\s/g, "");
      const letterCount = (text.match(/[A-Za-z]/g) || []).length;
      if (/^\d{1,3}$/.test(text)) scores[col].digit += 1;
      else if (letterCount >= 2 || /[,.]/.test(text)) scores[col].multi += 1;
      else if (letterCount === 1) scores[col].single += 1;
    }
  }
  const bestCol = (pick) => {
    let index = -1;
    let best = 0;
    scores.forEach((score, col) => {
      const value = pick(score);
      if (value > best) {
        best = value;
        index = col;
      }
    });
    return index;
  };
  let durCol = bestCol((score) => score.digit);
  if (durCol < 0) durCol = grid.cols.length - 1;
  let predCol = bestCol((score) => (score === scores[durCol] ? 0 : score.multi));
  let nameCol = -1;
  let nameBest = -1;
  scores.forEach((score, col) => {
    if (col === durCol || col === predCol) return;
    if (score.single >= nameBest) {
      nameBest = score.single;
      nameCol = col;
    }
  });
  if (nameCol < 0) nameCol = scores.findIndex((_, col) => col !== durCol && col !== predCol);
  if (predCol < 0) predCol = scores.findIndex((_, col) => col !== durCol && col !== nameCol);
  const jobs = [];
  const seen = new Set();
  for (let row = headerAt >= 0 ? headerAt + 1 : 0; row < grid.rows.length; row += 1) {
    if (readId !== solveUi.readId || !onPhotoPage()) return [];
    setSolveStatus(`표의 ${row}번째 줄을 읽고 있습니다.`);
    const nameSlice = sliceExamCell(sheet, grid.rows[row], grid.cols[nameCol], boundsOf(nameCol));
    const durSlice = sliceExamCell(sheet, grid.rows[row], grid.cols[durCol], boundsOf(durCol));
    if (nameSlice.ink < 20 || durSlice.ink < 20) continue;
    const nameLoose = await ocrExamCell(letters, nameSlice, "", "13");
    const looseCompact = nameLoose.text.replace(/\s/g, "");
    const looseName = cleanCellName(nameLoose.text);
    let name = "";
    if (/^[A-Za-z]$/.test(looseCompact) && nameLoose.confidence >= 50) name = looseCompact.toUpperCase();
    if (!name) {
      const nameStrict = await ocrExamCell(letters, nameSlice, "ABCDEFGHIJKLMNOPQRSTUVWXYZ", "13");
      const strictLetter = String(nameStrict.text || "").replace(/[^A-Za-z]/g, "");
      if (/^[A-Za-z]$/.test(strictLetter) && nameStrict.confidence >= 50) name = strictLetter.toUpperCase();
    }
    if (!name) {
      const hangul = await ocrExamCell(worker, nameSlice, "", "7");
      const hangulName = cleanCellName(hangul.text);
      if (hangulName && /^[가-힣]{1,4}$/.test(hangulName) && hangul.text.replace(/\s/g, "").length <= 4) name = hangulName;
    }
    if (!name && looseName && /^[가-힣]{1,4}$/.test(looseName) && nameLoose.text.replace(/\s/g, "").length <= 4) name = looseName;
    const durLoose = await ocrExamCell(letters, durSlice, "", "7");
    const shown = (durLoose.text.match(/\d{1,3}/) || [""])[0];
    const duration = examDuration(shown);
    if (!name || duration == null || seen.has(name)) continue;
    let preds = [];
    if (predCol >= 0) {
      const predSlice = sliceExamCell(sheet, grid.rows[row], grid.cols[predCol], boundsOf(predCol));
      if (predSlice.ink >= 20) {
        const predLoose = await ocrExamCell(letters, predSlice, "", "7");
        const predText = predLoose.text.trim();
        if (!emptyPred(predText) && /[A-Za-z가-힣]/.test(predText)) {
          const predStrict = await ocrExamCell(letters, predSlice, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz,-.", "7");
          const loosePreds = predLoose.confidence >= 70 ? cleanCellPreds(predLoose.text, name) : [];
          const strictPreds = predStrict.confidence >= 70 ? cleanCellPreds(predStrict.text, name) : [];
          preds = strictPreds.length >= loosePreds.length ? strictPreds : loosePreds;
        } else if (!emptyPred(predText) && !/[A-Za-z]/.test(predText)) {
          const predHangul = await ocrExamCell(worker, predSlice, "", "7");
          if (/[가-힣]/.test(predHangul.text) && !emptyPred(predHangul.text.trim())) {
            preds = cleanCellPreds(predHangul.text, name);
          }
        }
      }
    }
    seen.add(name);
    jobs.push({ name, duration, preds });
  }
  return refineExamJobs(jobs);
}

async function recognizeExam(worker, canvas, mode, whitelist) {
  try {
    await worker.setParameters({
      tessedit_pageseg_mode: mode,
      user_defined_dpi: "300",
      preserve_interword_spaces: "1",
      tessedit_char_whitelist: whitelist || "",
    });
  } catch (e) {
    /* keep the worker defaults */
  }
  const result = await worker.recognize(canvas);
  return jobsFromOcr(result.data);
}

async function readExamPhoto(url, readId) {
  solveUi.status = "사진에서 글자를 읽고 있습니다.";
  solveUi.error = "";
  solveUi.built = null;
  solveUi.draft = null;
  solveUi.draftError = "";
  solveUi.panel = "table";
  ganttStore.solve = null;
  paintSolve();
  let worker = null;
  try {
    const Tesseract = await loadTesseract();
    if (readId !== solveUi.readId) return;
    const image = cropExamImage(await loadSolveImage(url));
    const gray = scaledExamGray(image);
    const latin = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789,-.+ ";
    const passes = [
      [gray.canvas, "6", ""],
      [gray.canvas, "6", latin],
      [sharpenExam(gray), "6", latin],
      [adaptiveExamCanvas(gray), "6", ""],
      [gray.canvas, "4", ""],
    ];
    const logger = (message) => {
      if (readId !== solveUi.readId) return;
      const label = {
        "loading tesseract core": "읽는 도구를 준비하고 있습니다.",
        "initializing tesseract": "읽는 도구를 준비하고 있습니다.",
        "loading language traineddata": "한글과 숫자를 준비하고 있습니다.",
        "initializing api": "사진을 열 준비를 하고 있습니다.",
        "recognizing text": `사진에서 글자를 읽고 있습니다. ${Math.round((message.progress || 0) * 100)}%`,
      }[message.status];
      if (label) setSolveStatus(label);
    };
    try {
      worker = await Tesseract.createWorker("kor+eng", 1, { logger });
    } catch (e) {
      worker = await Tesseract.createWorker("eng", 1, { logger });
    }
    solveUi.worker = worker;
    if (readId !== solveUi.readId) return;
    let latinWorker = worker;
    try {
      latinWorker = await Tesseract.createWorker("eng");
    } catch (e) {
      latinWorker = worker;
    }
    solveUi.latin = latinWorker;
    if (readId !== solveUi.readId) return;
    setSolveStatus("표의 칸을 하나씩 읽고 있습니다.");
    const fromCells = await readExamTable(worker, latinWorker, gray.canvas, readId);
    if (readId !== solveUi.readId || !onPhotoPage()) return;
    let chosen = fromCells;
    if (chosen.length < 2) {
      const founds = [];
      for (let pass = 0; pass < passes.length; pass += 1) {
        if (readId !== solveUi.readId || !onPhotoPage()) return;
        setSolveStatus(`사진의 글자를 읽고 있습니다. ${pass + 1}/${passes.length}`);
        founds.push(await recognizeExam(worker, passes[pass][0], passes[pass][1], passes[pass][2]));
        if (founds.length >= 3) {
          const prev = refineExamJobs(founds[founds.length - 2].map((job) => ({ ...job, preds: [...(job.preds || [])] })));
          const curr = refineExamJobs(founds[founds.length - 1].map((job) => ({ ...job, preds: [...(job.preds || [])] })));
          const keyOf = (jobs) =>
            jobs
              .map((job) => `${job.name}:${job.duration}:${[...job.preds].sort().join("+")}`)
              .sort()
              .join("|");
          if (prev.length >= 3 && !prev.dropped && !curr.dropped && keyOf(prev) === keyOf(curr)) break;
        }
      }
      chosen = assembleExamJobs(founds);
    }
    if (readId !== solveUi.readId || !onPhotoPage()) return;
    const rows = chosen.length ? draftFromJobs(chosen) : [blankDraftRow(), blankDraftRow(), blankDraftRow(), blankDraftRow()];
    solveUi.draft = rows;
    solveUi.draftError =
      chosen.length < 2
        ? "사진에서 작업 표를 충분히 읽지 못했습니다. 아래 칸을 사진과 같게 고친 뒤 계산하기를 누르세요."
        : "";
    solveUi.built = null;
    solveUi.step = 0;
    solveUi.panel = "table";
    solveUi.status = "";
    solveUi.error = "";
  } catch (err) {
    if (readId !== solveUi.readId) return;
    solveUi.built = null;
    solveUi.status = "";
    solveUi.error = "";
    solveUi.draft = solveUi.draft && solveUi.draft.length ? solveUi.draft : [blankDraftRow(), blankDraftRow(), blankDraftRow(), blankDraftRow()];
    solveUi.draftError = `${err.message || "사진을 읽지 못했습니다."} 아래 칸에 사진의 작업을 적고 계산하기를 누르세요.`;
  } finally {
    if (solveUi.latin && solveUi.latin !== worker) {
      solveUi.latin.terminate().catch(() => {});
      solveUi.latin = null;
    }
    if (worker) {
      worker.terminate().catch(() => {});
      if (solveUi.worker === worker) solveUi.worker = null;
    }
  }
  if (readId === solveUi.readId && onPhotoPage()) {
    paintSolve();
    window.scrollTo(0, 0);
  }
}

function bindSolve() {
  const file = document.getElementById("solve-file");
  file?.addEventListener("change", () => {
    const picked = file.files && file.files[0];
    if (!picked) return;
    const reader = new FileReader();
    reader.onload = () => {
      const readId = solveUi.readId + 1;
      solveUi.readId = readId;
      if (solveUi.worker) {
        solveUi.worker.terminate().catch(() => {});
        solveUi.worker = null;
      }
      solveUi.imageUrl = String(reader.result || "");
      readExamPhoto(solveUi.imageUrl, readId);
    };
    reader.readAsDataURL(picked);
  });
  document.getElementById("solve-prev")?.addEventListener("click", () => {
    solveUi.step = Math.max(0, solveUi.step - 1);
    paintSolve();
  });
  document.getElementById("solve-next")?.addEventListener("click", () => {
    const { steps } = solveSteps(solveUi.built);
    if (solveUi.step >= steps.length - 1) return;
    solveUi.step += 1;
    paintSolve();
  });
  document.getElementById("solve-back")?.addEventListener("click", () => {
    solveUi.readId += 1;
    if (solveUi.worker) {
      solveUi.worker.terminate().catch(() => {});
      solveUi.worker = null;
    }
    solveUi.built = null;
    solveUi.draft = null;
    solveUi.draftError = "";
    solveUi.step = 0;
    solveUi.panel = "table";
    solveUi.status = "";
    solveUi.error = "";
    solveUi.imageUrl = "";
    ganttStore.solve = null;
    paintSolve();
  });
  document.getElementById("solve-add-row")?.addEventListener("click", () => {
    solveUi.draft = [...collectDraft(), blankDraftRow()];
    solveUi.draftError = "";
    paintSolve();
  });
  document.querySelectorAll("[data-draft-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const rows = collectDraft();
      const index = [...document.querySelectorAll("[data-draft-remove]")].indexOf(btn);
      rows.splice(index, 1);
      solveUi.draft = rows.length ? rows : [blankDraftRow()];
      solveUi.draftError = "";
      paintSolve();
    });
  });
  document.getElementById("solve-calc")?.addEventListener("click", () => {
    const rows = collectDraft();
    solveUi.draft = rows;
    try {
      const jobs = jobsFromDraft(rows);
      const built = jobsToNetwork(jobs);
      rememberGantt("solve", solveCpm(built.activities), "사진에서 확인한 작업");
      solveUi.built = built;
      solveUi.step = 0;
      solveUi.panel = "table";
      solveUi.draftError = "";
      paintSolve();
      window.scrollTo(0, 0);
    } catch (err) {
      solveUi.draftError = err.message || "표를 계산하지 못했습니다.";
      paintSolve();
    }
  });
  document.getElementById("solve-edit")?.addEventListener("click", () => {
    solveUi.built = null;
    solveUi.panel = "table";
    solveUi.draftError = "";
    paintSolve();
  });
  bindResultViews(paintSolve);
}

function render() {
  const hash = location.hash || "#/";
  const onRoll = (value) =>
    value === "#/cpm/practice/roll" ||
    value === "#/cpm/practice" ||
    value === "#/cpm/walk/roll" ||
    value === "#/cpm/play/roll";
  if (onRoll(hash) && !onRoll(lastHash)) {
    sessionNets.roll = rollNetwork(freshSeed());
    practiceUi.id = null;
    practiceUi.key = null;
  }
  const drawNow = hash.startsWith("#/cpm/draw");
  const drawWas = lastHash.startsWith("#/cpm/draw");
  if (drawNow && !drawWas) resetDraw(true);
  lastHash = hash;

  const { parts } = parseHash();
  const [a, b, c] = parts;
  if (!a) app.innerHTML = homeView();
  else if (a === "login") app.innerHTML = loginView();
  else if (a === "me") app.innerHTML = meView();
  else if (a === "gantt") app.innerHTML = ganttView();
  else if (a === "glossary") app.innerHTML = glossaryView();
  else if (a === "notes") app.innerHTML = notesView();
  else if (a === "solve" && b === "bank" && c) app.innerHTML = bankProblem(c);
  else if (a === "solve" && b === "bank") app.innerHTML = bankList();
  else if (a === "solve" && b === "photo") app.innerHTML = solveView();
  else if (a === "solve") app.innerHTML = examGate();
  else if (a === "quiz") location.hash = "#/cpm/quiz";
  else if (a === "cpm" && !b) app.innerHTML = cpmHub();
  else if (a === "cpm" && b === "learn") app.innerHTML = cpmLearn(c);
  else if (a === "cpm" && b === "practice") app.innerHTML = cpmPractice(c);
  else if (a === "cpm" && b === "quiz") app.innerHTML = cpmQuizView(c);
  else if (a === "cpm" && b === "lab") app.innerHTML = cpmLab();
  else if (a === "cpm" && b === "walk") app.innerHTML = cpmWalk(c);
  else if (a === "cpm" && b === "play") app.innerHTML = cpmPlay(c);
  else if (a === "cpm" && b === "crash") app.innerHTML = cpmCrash(c);
  else if (a === "cpm" && b === "draw") app.innerHTML = drawView();
  else app.innerHTML = homeView();
  document.body.classList.toggle("page-home", !!app.querySelector(".gate-nav"));
  navActive();
  paintAccount();
  window.scrollTo(0, 0);
  bindAuth();
  bindCpmPractice();
  bindCpmLab();
  bindCpmWalk();
  bindCpmCrash();
  bindCpmPlay();
  bindNotes();
  bindDraw();
  bindGantt();
  bindSolve();
  bindBank();
}

function gradeQuiz(btn, bank) {
  const box = btn.closest("[data-cpm-quiz]");
  if (!box) return;
  const qi = Number(box.getAttribute("data-cpm-quiz"));
  const choice = Number(btn.dataset.choice);
  const item = bank[qi];
  const buttons = [...box.querySelectorAll("[data-choice]")];
  if (buttons.some((b) => b.classList.contains("correct") || b.classList.contains("wrong"))) return;
  buttons.forEach((b, j) => {
    if (j === item.answer) b.classList.add("correct");
    if (j === choice && choice !== item.answer) b.classList.add("wrong");
  });
  let explain = box.querySelector(".quiz-why");
  if (!explain) {
    explain = document.createElement("p");
    explain.className = "quiz-why";
    box.appendChild(explain);
  }
  if (choice === item.answer) {
    forgetNote(`quiz:${item.q}`);
    refreshNoteCount();
    explain.innerHTML = `${esc(item.why)}${reactFigure("ok")}`;
    return;
  }
  rememberNote({
    id: `quiz:${item.q}`,
    kind: "quiz",
    q: item.q,
    choices: item.choices,
    answer: item.answer,
    yours: choice,
    why: item.why,
  });
  explain.innerHTML = `오답노트에 넣어 두었습니다. ${esc(item.why)}${reactFigure("bad")}`;
}

function bindNotes() {
  document.querySelectorAll("[data-note-pick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      btn.classList.toggle("on");
      btn.setAttribute("aria-pressed", btn.classList.contains("on") ? "true" : "false");
    });
  });
  document.querySelectorAll("[data-note-drop]").forEach((btn) => {
    btn.addEventListener("click", () => {
      forgetNote(btn.getAttribute("data-note-drop"));
      app.innerHTML = notesView();
      bindNotes();
      refreshNoteCount();
    });
  });
  document.querySelectorAll("[data-note-quiz]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-note-quiz");
      const note = loadNotes().find((n) => n.id === id);
      if (!note) return;
      const choice = Number(btn.dataset.choice);
      if (choice === note.answer) {
        forgetNote(id);
        noteUi.id = null;
        noteUi.cheer = "ok";
      } else {
        noteUi.id = id;
        noteUi.text = note.why;
        noteUi.cheer = "";
      }
      app.innerHTML = notesView();
      bindNotes();
      refreshNoteCount();
    });
  });
  document.querySelectorAll("[data-note-form]").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const id = form.getAttribute("data-note-form");
      const note = loadNotes().find((n) => n.id === id);
      const bundle = note && noteBundle(note);
      if (!note || !bundle) return;
      const step = bundle.step;
      if (step.kind === "multi") {
        const picked = [...form.querySelectorAll("[data-note-pick].on")].map((b) => b.getAttribute("data-note-pick"));
        if (!picked.length) {
          noteUi.id = id;
          noteUi.text = "주공정이라고 생각하는 작업을 고르세요.";
          noteUi.cheer = "";
        } else if (sameNames(picked, step.answer)) {
          forgetNote(id);
          noteUi.id = null;
          noteUi.cheer = "ok";
        } else {
          noteUi.id = id;
          noteUi.text = step.miss[0];
          noteUi.cheer = "";
        }
      } else {
        const raw = String(new FormData(form).get("answer") || "").trim().replace(/일$/, "");
        if (!/^-?\d+$/.test(raw)) {
          noteUi.id = id;
          noteUi.text = "정수로 입력하세요.";
          noteUi.cheer = "";
        } else if (Number(raw) === step.answer) {
          forgetNote(id);
          noteUi.id = null;
          noteUi.cheer = "ok";
        } else {
          noteUi.id = id;
          noteUi.text = step.miss[0];
          noteUi.cheer = "";
        }
      }
      app.innerHTML = notesView();
      bindNotes();
      refreshNoteCount();
    });
  });
}

document.addEventListener("click", (e) => {
  const cpmBtn = e.target.closest("[data-cpm-quiz] [data-choice]");
  if (cpmBtn) gradeQuiz(cpmBtn, CPM_QUIZ);
  const quizChoice = e.target.closest("[data-quiz-choice]");
  if (quizChoice && quizUi.choice == null) {
    const choice = Number(quizChoice.getAttribute("data-quiz-choice"));
    const item = quizUi.order[quizUi.at] && quizUi.order[quizUi.at].item;
    if (!item) return;
    quizUi.choice = choice;
    if (choice === item.answer) forgetNote(`quiz:${item.q}`);
    else {
      rememberNote({
        id: `quiz:${item.q}`,
        kind: "quiz",
        q: item.q,
        choices: item.choices,
        answer: item.answer,
        yours: choice,
        why: item.why,
      });
    }
    refreshNoteCount();
    const { parts } = parseHash();
    app.innerHTML = cpmQuizView(parts[2]);
    navActive();
    return;
  }
  if (e.target.closest("[data-quiz-next]")) {
    quizUi.choice = null;
    quizUi.at += 1;
    if (quizUi.at >= quizUi.order.length) {
      const level = quizUi.level;
      quizUi.round += 1;
      startQuiz(level, true);
    }
    const { parts } = parseHash();
    app.innerHTML = cpmQuizView(parts[2]);
    navActive();
    window.scrollTo(0, 0);
  }
});

document.getElementById("nav-back")?.addEventListener("click", () => {
  if (history.length > 1) history.back();
  else location.hash = "#/";
});

window.addEventListener("hashchange", render);
if (!location.hash) location.hash = "#/";
else render();
