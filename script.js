const categories = [
  { id: "education", label: "Education", icon: "E", weight: 16 },
  { id: "speaking", label: "Public Speaking", icon: "P", weight: 8 },
  { id: "partnership", label: "University Partnership", icon: "U", weight: 6 },
];

const years = [2026, 2025, 2024];
const quarters = ["Q1", "Q2", "Q3", "Q4"];
const firstNames = [
  "Avery",
  "Morgan",
  "Jordan",
  "Taylor",
  "Casey",
  "Riley",
  "Quinn",
  "Jamie",
  "Reese",
  "Hayden",
  "Parker",
  "Rowan",
  "Emery",
  "Skyler",
  "Finley",
  "Kendall",
  "Logan",
  "Harper",
  "Devon",
  "Cameron",
  "Blair",
  "Sage",
  "Drew",
  "Lennox",
  "Arden",
  "Tatum",
  "Ellis",
  "Marley",
  "Shiloh",
  "Remy",
];
const lastNames = [
  "Stone",
  "Rivera",
  "Vale",
  "Brooks",
  "Hart",
  "Lane",
  "Gray",
  "Frost",
  "Wells",
  "Reed",
  "Fox",
  "Blake",
  "Page",
  "Grant",
  "Quill",
  "North",
  "Summers",
  "West",
  "Hayes",
  "Fields",
  "Knight",
  "Dale",
  "Chase",
  "Mills",
  "Briar",
  "Lake",
  "Hale",
  "Wren",
  "Moon",
  "Sloan",
];
const roleFamilies = [
  "Software Engineer",
  "Senior Software Engineer",
  "QA Engineer",
  "QA Automation Engineer",
  "Team Manager",
  "Project Manager",
  "Business Analyst",
  "Product Designer",
  "Learning Consultant",
  "Community Manager",
  "Delivery Manager",
  "Operations Specialist",
];
const units = [
  "North Campus",
  "South Campus",
  "Central Lab",
  "Digital Studio",
  "Cloud Guild",
  "Data Circle",
  "Design Hub",
  "Quality Office",
  "Partner Desk",
  "Growth Team",
];
const gradients = [
  ["#2563eb", "#0ea5e9"],
  ["#7c3aed", "#db2777"],
  ["#0f766e", "#14b8a6"],
  ["#ea580c", "#f59e0b"],
  ["#475569", "#0f172a"],
  ["#16a34a", "#65a30d"],
  ["#be123c", "#fb7185"],
  ["#0369a1", "#38bdf8"],
];

const scoreShape = [
  536, 328, 320, 320, 304, 296, 288, 288, 288, 256, 256, 224, 224, 224, 224,
  208, 208, 200, 192, 192, 192, 192, 192, 192, 192, 192, 192, 192, 192, 176,
  168, 160, 160, 160, 160, 160, 144, 144, 144, 144, 128, 128, 128, 128, 128,
  128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 128, 120,
  112, 112, 100,
];

const generatedTail = Array.from({ length: 164 }, (_, index) => {
  if (index < 30) return 96;
  if (index < 64) return 64;
  if (index < 72) return 48;
  if (index < 75) return 40;
  if (index < 77) return 38;
  if (index < 78) return 36;
  if (index < 102) return 32;
  if (index < 104) return 24;
  if (index < 116) return 16;
  if (index < 119) return 10;
  if (index < 128) return 8;
  return 6;
});

const leaderboardData = [...scoreShape, ...generatedTail].map((score, index) => {
  const first = firstNames[index % firstNames.length];
  const last = lastNames[(index * 7) % lastNames.length];
  const name = `${first} ${last}`;
  const primary = categories[(index * 5) % categories.length];
  const secondary = categories[(index + 1) % categories.length];
  const tertiary = categories[(index + 2) % categories.length];
  const primaryCount = Math.max(1, Math.round(score / primary.weight / (index < 4 ? 2 : 4)));
  const secondaryCount = index % 3 === 0 ? Math.max(1, Math.round(primaryCount / 2)) : 0;
  const tertiaryCount = index % 11 === 0 ? Math.max(1, Math.round(primaryCount / 3)) : 0;
  const palette = gradients[index % gradients.length];

  return {
    id: index + 1,
    name,
    initials: `${first[0]}${last[0]}`,
    role: `${roleFamilies[index % roleFamilies.length]} (${units[(index * 3) % units.length]})`,
    year: years[index % years.length],
    quarter: quarters[(index + Math.floor(index / 8)) % quarters.length],
    score,
    avatarA: palette[0],
    avatarB: palette[1],
    activity: [
      { id: primary.id, count: primaryCount },
      ...(secondaryCount ? [{ id: secondary.id, count: secondaryCount }] : []),
      ...(tertiaryCount ? [{ id: tertiary.id, count: tertiaryCount }] : []),
    ],
  };
});

const state = {
  year: "all",
  quarter: "all",
  category: "all",
  search: "",
  expandedId: null,
};

const elements = {
  yearFilter: document.querySelector("#yearFilter"),
  quarterFilter: document.querySelector("#quarterFilter"),
  categoryFilter: document.querySelector("#categoryFilter"),
  searchInput: document.querySelector("#searchInput"),
  podium: document.querySelector("#podium"),
  list: document.querySelector("#leaderboardList"),
  emptyState: document.querySelector("#emptyState"),
};

function renderOptions() {
  fillSelect(elements.yearFilter, [
    { value: "all", label: "All Years" },
    ...years.map((year) => ({ value: String(year), label: String(year) })),
  ]);
  fillSelect(elements.quarterFilter, [
    { value: "all", label: "All Quarters" },
    ...quarters.map((quarter) => ({ value: quarter, label: quarter })),
  ]);
  fillSelect(elements.categoryFilter, [
    { value: "all", label: "All Categories" },
    ...categories.map((category) => ({ value: category.id, label: category.label })),
  ]);
}

function fillSelect(select, options) {
  select.innerHTML = options
    .map((option) => `<option value="${option.value}">${option.label}</option>`)
    .join("");
}

function getFilteredEntries() {
  const query = state.search.trim().toLowerCase();
  return leaderboardData
    .filter((entry) => state.year === "all" || String(entry.year) === state.year)
    .filter((entry) => state.quarter === "all" || entry.quarter === state.quarter)
    .filter(
      (entry) => state.category === "all" || entry.activity.some((item) => item.id === state.category),
    )
    .filter((entry) => {
      if (!query) return true;
      return `${entry.name} ${entry.role}`.toLowerCase().includes(query);
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function render() {
  const entries = getFilteredEntries();
  const hasEntries = entries.length > 0;

  elements.emptyState.hidden = hasEntries;
  elements.podium.hidden = !hasEntries;
  elements.list.hidden = !hasEntries;

  if (!hasEntries) {
    elements.podium.innerHTML = "";
    elements.list.innerHTML = "";
    return;
  }

  renderPodium(entries.slice(0, 3));
  renderList(entries);
}

function renderPodium(topEntries) {
  const order = [2, 1, 3];
  elements.podium.innerHTML = order
    .map((rank) => topEntries.find((entry) => entry.rank === rank))
    .filter(Boolean)
    .map(
      (entry) => `
        <article class="podiumColumn podiumRank${entry.rank}">
          <div class="podiumUser">
            <div class="podiumAvatarContainer">
              <div class="podiumAvatar" style="${avatarStyle(entry)}">${entry.initials}</div>
              <div class="podiumRankBadge">${entry.rank}</div>
            </div>
            <h2 class="podiumName">${entry.name}</h2>
            <p class="podiumRole">${entry.role}</p>
            <div class="podiumScore"><span class="star">*</span><span>${entry.score}</span></div>
          </div>
          <div class="podiumBlock">
            <div class="podiumBlockTop"></div>
            <span class="podiumRankNumber">${entry.rank}</span>
          </div>
        </article>
      `,
    )
    .join("");
}

function renderList(entries) {
  elements.list.innerHTML = entries.map(renderRow).join("");
}

function renderRow(entry) {
  const isExpanded = state.expandedId === entry.id;
  return `
    <article class="userRowContainer ${isExpanded ? "expanded" : ""}">
      <div class="row">
        <div class="rowMain">
          <div class="rowLeft">
            <span class="rank">${entry.rank}</span>
            <div class="avatar" style="${avatarStyle(entry)}">${entry.initials}</div>
            <div class="info">
              <h2 class="name">${entry.name}</h2>
              <span class="role">${entry.role}</span>
            </div>
          </div>
          <div class="rowRight">
            <div class="categoryStats">${renderCategoryStats(entry.activity)}</div>
            <div class="totalSection">
              <span class="totalLabel">TOTAL</span>
              <div class="score"><span class="star">*</span><span>${entry.score}</span></div>
            </div>
            <button class="expandButton" type="button" aria-label="${isExpanded ? "Collapse" : "Expand"}" aria-expanded="${isExpanded}" data-entry-id="${entry.id}">v</button>
          </div>
        </div>
      </div>
      <div class="details">
        <div class="detailCard">
          <span class="detailLabel">Year</span>
          <span class="detailValue">${entry.year}</span>
        </div>
        <div class="detailCard">
          <span class="detailLabel">Quarter</span>
          <span class="detailValue">${entry.quarter}</span>
        </div>
        <div class="detailCard">
          <span class="detailLabel">Top Category</span>
          <span class="detailValue">${getCategory(entry.activity[0].id).label}</span>
        </div>
        <div class="detailCard">
          <span class="detailLabel">Contributions</span>
          <span class="detailValue">${entry.activity.reduce((sum, item) => sum + item.count, 0)}</span>
        </div>
      </div>
    </article>
  `;
}

function renderCategoryStats(activity) {
  return activity
    .map((item) => {
      const category = getCategory(item.id);
      return `
        <span class="categoryStat" title="${category.label}">
          <span class="categoryStatIcon" aria-hidden="true">${category.icon}</span>
          <span class="categoryStatCount">${item.count}</span>
        </span>
      `;
    })
    .join("");
}

function getCategory(id) {
  return categories.find((category) => category.id === id);
}

function avatarStyle(entry) {
  return `--avatar-a: ${entry.avatarA}; --avatar-b: ${entry.avatarB};`;
}

elements.yearFilter.addEventListener("change", (event) => {
  state.year = event.target.value;
  state.expandedId = null;
  render();
});

elements.quarterFilter.addEventListener("change", (event) => {
  state.quarter = event.target.value;
  state.expandedId = null;
  render();
});

elements.categoryFilter.addEventListener("change", (event) => {
  state.category = event.target.value;
  state.expandedId = null;
  render();
});

elements.searchInput.addEventListener("input", (event) => {
  state.search = event.target.value;
  state.expandedId = null;
  render();
});

elements.list.addEventListener("click", (event) => {
  const button = event.target.closest(".expandButton");
  if (!button) return;
  const id = Number(button.dataset.entryId);
  state.expandedId = state.expandedId === id ? null : id;
  render();
});

renderOptions();
render();
