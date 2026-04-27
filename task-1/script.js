let categories = [];
let years = [];
let quarters = [];
let leaderboardData = [];
let fullListLeaders = [];

const icons = {
  education:
    '<svg viewBox="0 0 24 24" focusable="false"><path d="M12 3.25 2.5 8.3 12 13.35l7-3.72v5.62h1.5V8.3L12 3.25Zm0 8.4L5.68 8.3 12 4.94l6.32 3.36L12 11.65Zm-5 1.06v3.04c0 2.1 2.33 3.75 5 3.75s5-1.65 5-3.75v-3.04l-1.5.8v2.24c0 1.1-1.5 2.25-3.5 2.25s-3.5-1.15-3.5-2.25v-2.24L7 12.71Z"/></svg>',
  presentation:
    '<svg viewBox="0 0 24 24" focusable="false"><path d="M4 4.75h16v9.5H4v-9.5Zm1.5 1.5v6.5h13v-6.5h-13ZM11.25 14.25h1.5v4h4v1.5h-9.5v-1.5h4v-4Zm-2.5-5.5h6.5v1.5h-6.5v-1.5Z"/></svg>',
  partnership:
    '<svg viewBox="0 0 24 24" focusable="false"><path d="M12 2.75a9.25 9.25 0 1 0 0 18.5 9.25 9.25 0 0 0 0-18.5Zm0 1.5a7.75 7.75 0 1 1 0 15.5 7.75 7.75 0 0 1 0-15.5ZM8.25 8.7a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1Zm7.5 0a1.05 1.05 0 1 1 0 2.1 1.05 1.05 0 0 1 0-2.1Zm-7.08 5.02a.75.75 0 0 1 1.04-.2c1.48.99 3.1.99 4.58 0a.75.75 0 1 1 .83 1.25 5.6 5.6 0 0 1-6.25 0 .75.75 0 0 1-.2-1.05Z"/></svg>',
  star:
    '<svg class="starIcon" viewBox="0 0 24 24" focusable="false"><path d="m12 2.75 2.86 5.8 6.4.93-4.63 4.51 1.1 6.37L12 17.35l-5.73 3.01 1.1-6.37-4.63-4.51 6.4-.93L12 2.75Z"/></svg>',
  chevron:
    '<svg class="chevronIcon" viewBox="0 0 20 20" focusable="false"><path d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.17l3.71-3.94a.75.75 0 1 1 1.1 1.02l-4.25 4.5a.75.75 0 0 1-1.1 0l-4.25-4.5a.75.75 0 0 1 .02-1.04Z"/></svg>',
};

const state = {
  year: "all",
  quarter: "all",
  category: "all",
  search: "",
  expandedId: null,
};

const elements = {
  leaderboard: document.querySelector(".leaderboard"),
  yearFilter: document.querySelector("#yearFilter"),
  quarterFilter: document.querySelector("#quarterFilter"),
  categoryFilter: document.querySelector("#categoryFilter"),
  searchInput: document.querySelector("#searchInput"),
  clearSearch: document.querySelector("#clearSearch"),
  podium: document.querySelector("#podium"),
  list: document.querySelector("#leaderboardList"),
  emptyState: document.querySelector("#emptyState"),
};

async function loadLeaderboardData() {
  let data;

  try {
    const response = await fetch("leaderboard-data.json");

    if (!response.ok) {
      throw new Error(`Unable to load leaderboard data: ${response.status}`);
    }

    data = await response.json();
  } catch (error) {
    console.warn("Using generated leaderboard data fallback.", error);
    data = createFallbackLeaderboardData();
  }

  applyLeaderboardData(data);
}

function applyLeaderboardData(data) {
  categories = data.categories;
  years = data.years;
  quarters = data.quarters;
  leaderboardData = data.users.map((entry, index) => ({
    ...entry,
    hasPhoto: true,
    photoUrl: entry.photoUrl || getUserPhotoUrl(index),
  }));
  fullListLeaders = [...leaderboardData]
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .slice(0, 3)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function getUserPhotoUrl(index) {
  const folder = index % 2 === 0 ? "men" : "women";
  const photoId = (index % 99) + 1;
  return `https://randomuser.me/api/portraits/${folder}/${photoId}.jpg`;
}

function createFallbackLeaderboardData() {
  const fallbackCategories = [
    { id: "education", label: "Education", icon: "education", weight: 16 },
    { id: "speaking", label: "Public Speaking", icon: "presentation", weight: 8 },
    { id: "partnership", label: "University Partnership", icon: "partnership", weight: 6 },
  ];
  const fallbackYears = [2026, 2025, 2024];
  const fallbackQuarters = ["Q1", "Q2", "Q3", "Q4"];
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
  ];
  const roles = [
    "Software Engineer",
    "Senior Software Engineer",
    "QA Engineer",
    "Team Manager",
    "Project Manager",
    "Business Analyst",
    "Product Designer",
    "HR Manager",
  ];
  const units = ["BY.U1.D1.G2", "TGU.TAD.SO", "IPSD.Services", "North Campus", "Digital Studio"];
  const gradients = [
    ["#2563eb", "#0ea5e9"],
    ["#7c3aed", "#db2777"],
    ["#0f766e", "#14b8a6"],
    ["#ea580c", "#f59e0b"],
    ["#475569", "#0f172a"],
  ];
  const activityTemplates = {
    education: [
      'Lecture "JS Workshop #1: JS variables"',
      'Lecture "JS Workshop #2: Conditional statements and loops"',
      'Lecture "JS Workshop #3: Functions"',
      'Lecture "Introduction to ASP .Net Core (WEB API)"',
      "Mentoring of Lubica Kormanova",
      "Mentoring of Pavel Shmelev",
    ],
    speaking: [
      "Offline Meetup in Bratislava for Vention Employees: Quality Gates: Stop, Test, Go!",
      "Frontend Community Demo: Building Accessible Components",
      "Lightning Talk: Delivery Practices That Scale",
    ],
    partnership: [
      "Campus partner consultation",
      "University program planning",
      "Student project review",
      "Partner onboarding session",
    ],
  };
  const prefixes = {
    education: ["[LAB]", "[LAB]", "[LAB]", "[MENTORING]"],
    speaking: ["[REG]", "[REG]", "[TALK]", "[WEBINAR]"],
    partnership: ["[CAMPUS]", "[PARTNER]", "[UNIVERSITY]", "[OUTREACH]"],
  };

  const users = Array.from({ length: 227 }, (_, index) => {
    const first = firstNames[index % firstNames.length];
    const last = lastNames[Math.floor(index / firstNames.length) % lastNames.length];
    const primaryCategory = fallbackCategories[(index * 5) % fallbackCategories.length];
    const recentActivity = buildFallbackActivity(
      index,
      primaryCategory.id,
      fallbackCategories,
      fallbackYears,
      fallbackQuarters,
      activityTemplates,
      prefixes,
    );
    const score = recentActivity.reduce((total, item) => total + item.pointsValue, 0);
    const palette = gradients[index % gradients.length];

    return {
      id: index + 1,
      name: `${first} ${last}`,
      initials: `${first[0]}${last[0]}`,
      role: `${roles[index % roles.length]} (${units[index % units.length]})`,
      year: fallbackYears[index % fallbackYears.length],
      quarter: fallbackQuarters[(index + Math.floor(index / 8)) % fallbackQuarters.length],
      score,
      avatarA: palette[0],
      avatarB: palette[1],
      hasPhoto: index < 3 || index % 6 !== 0,
      activity: summarizeFallbackActivity(recentActivity, fallbackCategories),
      recentActivity: recentActivity.map(({ categoryId, pointsValue, ...item }) => item),
    };
  });

  return {
    categories: fallbackCategories,
    years: fallbackYears,
    quarters: fallbackQuarters,
    users,
  };
}

function buildFallbackActivity(
  seed,
  primaryCategory,
  fallbackCategories,
  fallbackYears,
  fallbackQuarters,
  activityTemplates,
  prefixes,
) {
  const categoryIds = [
    primaryCategory,
    fallbackCategories[(seed + 1) % fallbackCategories.length].id,
    fallbackCategories[(seed + 2) % fallbackCategories.length].id,
  ];
  const rowCount = fallbackInt(seed + 17, 6, 9);

  return Array.from({ length: rowCount }, (_, index) => {
    const categoryId = categoryIds[fallbackInt(seed * 31 + index * 7, 0, categoryIds.length - 1)];
    const category = fallbackCategories.find((item) => item.id === categoryId) || fallbackCategories[0];
    const templates = activityTemplates[categoryId];
    const prefix = prefixes[categoryId][fallbackInt(seed * 13 + index, 0, prefixes[categoryId].length - 1)];
    const pointsValue = category.weight * fallbackInt(seed * 29 + index * 11, 1, 4);
    const year = fallbackYears[fallbackInt(seed * 5 + index, 0, fallbackYears.length - 1)];
    const quarterIndex = fallbackInt(seed + index * 13, 0, fallbackQuarters.length - 1);
    const month = quarterIndex * 3 + fallbackInt(seed * 11 + index, 1, 3);
    const day = fallbackInt(seed * 19 + index * 5, 4, 27);

    return {
      activity: `${prefix} ${templates[fallbackInt(seed + index * 3, 0, templates.length - 1)]}`,
      categoryId,
      category: category.label,
      date: `${String(day).padStart(2, "0")}-${monthName(month)}-${year}`,
      points: `+${pointsValue}`,
      pointsValue,
    };
  });
}

function summarizeFallbackActivity(activityItems, fallbackCategories) {
  return fallbackCategories
    .map((category) => ({
      id: category.id,
      count: activityItems.filter((item) => item.categoryId === category.id).length,
    }))
    .filter((item) => item.count > 0);
}

function fallbackInt(seed, min, max) {
  return Math.floor(fallbackNumber(seed) * (max - min + 1)) + min;
}

function fallbackNumber(seed) {
  const value = Math.sin(seed * 9999 + 42) * 10000;
  return value - Math.floor(value);
}

function monthName(month) {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
    month - 1
  ];
}

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

function getFilteredEntries({ includeSearch = true } = {}) {
  const query = includeSearch ? state.search.trim().toLowerCase() : "";
  return leaderboardData
    .filter((entry) => state.year === "all" || String(entry.year) === state.year)
    .filter((entry) => state.quarter === "all" || entry.quarter === state.quarter)
    .filter(
      (entry) => state.category === "all" || entry.activity.some((item) => item.id === state.category),
    )
    .filter((entry) => matchesNameSearch(entry, query))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function matchesNameSearch(entry, query) {
  if (!query) return true;
  return entry.name.toLowerCase().includes(query);
}

function render() {
  const query = state.search.trim().toLowerCase();
  const entriesBeforeSearch = getFilteredEntries({ includeSearch: false });
  const entries = query
    ? entriesBeforeSearch.filter((entry) => matchesNameSearch(entry, query))
    : entriesBeforeSearch;
  const podiumEntries = getPodiumEntries(entriesBeforeSearch, query);
  const hasEntries = entries.length > 0;
  const hasPodiumEntries = podiumEntries.length > 0;

  elements.emptyState.hidden = hasEntries;
  elements.podium.hidden = !hasPodiumEntries;
  elements.list.hidden = !hasEntries;
  elements.leaderboard.classList.toggle("noPodium", !hasPodiumEntries);

  if (!hasEntries) {
    elements.list.innerHTML = "";
  }

  if (!hasPodiumEntries) {
    elements.podium.innerHTML = "";
  } else {
    renderPodium(podiumEntries);
  }

  if (hasEntries) {
    renderList(entries);
  }
}

function getPodiumEntries(entriesBeforeSearch, query) {
  const leadersBeforeSearch = entriesBeforeSearch.slice(0, 3);

  if (query) {
    return leadersBeforeSearch.filter((entry) => matchesNameSearch(entry, query));
  }

  return leadersBeforeSearch;
}

function renderPodium(topEntries) {
  const order = [2, 1, 3];
  elements.podium.className = `podium podiumCount${topEntries.length}`;
  elements.podium.innerHTML = order
    .map((rank) => topEntries.find((entry) => entry.rank === rank))
    .filter(Boolean)
    .map(
      (entry) => `
        <article class="podiumColumn podiumRank${entry.rank}">
          <div class="podiumUser">
            <div class="podiumAvatarContainer">
              ${renderAvatar(entry, "podiumAvatar")}
              <span class="podiumRankBadge">${entry.rank}</span>
            </div>
            <h2 class="podiumName">${entry.name}</h2>
            <p class="podiumRole">${entry.role}</p>
            <div class="podiumScore">${icons.star}<span>${entry.score}</span></div>
          </div>
          <div class="podiumBlock">
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
            ${renderAvatar(entry, "avatar")}
            <div class="info">
              <h2 class="name">${entry.name}</h2>
              <span class="role">${entry.role}</span>
            </div>
          </div>
          <div class="rowRight">
            <div class="categoryStats">${renderCategoryStats(entry.activity)}</div>
            <div class="totalSection">
              <span class="totalLabel">TOTAL</span>
              <div class="score">${icons.star}<span>${entry.score}</span></div>
            </div>
            <button class="expandButton" type="button" aria-label="${isExpanded ? "Collapse" : "Expand"}" aria-expanded="${isExpanded}" data-entry-id="${entry.id}">
              ${icons.chevron}
            </button>
          </div>
        </div>
      </div>
      <div class="details">
        <h3 class="detailsTitle">Recent Activity</h3>
        <div class="activityTable" role="table" aria-label="Recent activity for ${entry.name}">
          <div class="activityHeader" role="row">
            <span role="columnheader">Activity</span>
            <span role="columnheader">Category</span>
            <span role="columnheader">Date</span>
            <span role="columnheader">Points</span>
          </div>
          ${entry.recentActivity.map(renderActivityRow).join("")}
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
        <span class="categoryStat" data-tooltip="${category.label}">
          <span class="categoryStatIcon" aria-hidden="true">${icons[category.icon]}</span>
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

function renderAvatar(entry, className) {
  if (entry.photoUrl) {
    return `
      <div class="${className} photoAvatar" aria-hidden="true">
        <img src="${entry.photoUrl}" alt="" loading="lazy" onerror="this.onerror=null;this.src='assets/avatar-placeholder.svg';" />
      </div>
    `;
  }

  if (!entry.hasPhoto) {
    return `
      <div class="${className} placeholderAvatar" aria-hidden="true">
        <img src="assets/avatar-placeholder.svg" alt="" />
      </div>
    `;
  }

  return `<div class="${className}" style="${avatarStyle(entry)}" aria-hidden="true"></div>`;
}

function renderActivityRow(item) {
  return `
    <div class="activityRow" role="row">
      <span class="activityName" role="cell">${item.activity}</span>
      <span role="cell"><span class="activityPill">${item.category}</span></span>
      <span class="activityDate" role="cell">${item.date}</span>
      <span class="activityPoints" role="cell">${item.points}</span>
    </div>
  `;
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
  updateClearSearch();
  render();
});

elements.clearSearch.addEventListener("click", () => {
  elements.searchInput.value = "";
  state.search = "";
  state.expandedId = null;
  updateClearSearch();
  render();
  elements.searchInput.focus();
});

elements.list.addEventListener("click", (event) => {
  const button = event.target.closest(".expandButton");
  if (!button) return;
  const id = Number(button.dataset.entryId);
  state.expandedId = state.expandedId === id ? null : id;
  render();
});

function updateClearSearch() {
  elements.clearSearch.hidden = elements.searchInput.value.length === 0;
}

async function init() {
  try {
    await loadLeaderboardData();
    renderOptions();
    updateClearSearch();
    render();
  } catch (error) {
    elements.emptyState.hidden = false;
    elements.emptyState.textContent = "Unable to load leaderboard data.";
    elements.podium.hidden = true;
    elements.list.hidden = true;
    console.error(error);
  }
}

init();
