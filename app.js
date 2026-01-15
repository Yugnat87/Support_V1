let rawData = [];
let data = [];

let FIELDS = {
  category: null,
  subIssue: null,
  symptomId: null,
  symptomDesc: null,
  actionSupport: null,
  actionField: null,
  sparePart: null,
  sopLink: null
};

const state = {
  category: null,
  subIssue: null,
  confirmedGroup: null
};

const categorySelect = document.getElementById("categorySelect");
const subIssueSection = document.getElementById("subIssueSection");
const subIssueSelect = document.getElementById("subIssueSelect");
const skipSubIssueBtn = document.getElementById("skipSubIssueBtn");

const actionsSection = document.getElementById("actionsSection");
const actionsList = document.getElementById("actionsList");

const maintenanceSection = document.getElementById("maintenanceSection");
const maintenanceContent = document.getElementById("maintenanceContent");
const copyBtn = document.getElementById("copyBtn");

/* =============================
   LOAD DATA
============================= */
fetch("data.json")
  .then(r => r.json())
  .then(json => {
    rawData = Array.isArray(json)
      ? json
      : Array.isArray(json.rows)
        ? json.rows
        : Object.values(json);

    detectFields(rawData[0]);
    data = rawData;
    populateCategories();
  });

/* =============================
   FIELD DETECTION
============================= */
function detectFields(sample) {
  const keys = Object.keys(sample);

  FIELDS.category      = keys.find(k => k.toLowerCase().includes("category"));
  FIELDS.subIssue      = keys.find(k => k.toLowerCase().includes("sub"));
  FIELDS.actionSupport = keys.find(k => k.toLowerCase().includes("support"));
  FIELDS.actionField   = keys.find(k => k.toLowerCase().includes("actions for field"));
  FIELDS.sparePart     = keys.find(k => k.toLowerCase().includes("spare"));
  FIELDS.sopLink       = keys.find(k => k.toLowerCase().includes("sop"));

  FIELDS.symptomId = keys.find(k => /^s-\d+/i.test(String(sample[k])));
  FIELDS.symptomDesc = keys.find(k => {
    const v = String(sample[k] || "");
    return (
      v &&
      k !== FIELDS.symptomId &&
      k !== FIELDS.actionField &&
      !/^s-\d+/i.test(v)
    );
  });
}

/* =============================
   CATEGORY
============================= */
function populateCategories() {
  categorySelect.innerHTML = '<option value="">-- Choose category --</option>';

  [...new Set(data.map(r => r[FIELDS.category]))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat;
      opt.textContent = cat;
      categorySelect.appendChild(opt);
    });
}

categorySelect.addEventListener("change", e => {
  resetUI();
  state.category = e.target.value;
  if (!state.category) return;
  populateSubIssues();
});

/* =============================
   SUB-ISSUE
============================= */
function populateSubIssues() {
  subIssueSelect.innerHTML = '<option value="">-- Choose sub-issue --</option>';

  [...new Set(
    data
      .filter(r => r[FIELDS.category] === state.category)
      .map(r => r[FIELDS.subIssue])
  )]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .forEach(s => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s;
      subIssueSelect.appendChild(opt);
    });

  subIssueSection.classList.remove("hidden");
}

subIssueSelect.addEventListener("change", e => {
  state.subIssue = e.target.value;
  loadActions(false);
});

skipSubIssueBtn.addEventListener("click", () => {
  state.subIssue = null;
  loadActions(true);
});

/* =============================
   ACTIONS — DEDUPLICATED + GROUPED
============================= */
function loadActions(skip) {
  actionsSection.classList.remove("hidden");
  actionsList.innerHTML = "";

  const filtered = data.filter(r =>
    r[FIELDS.category] === state.category &&
    String(r[FIELDS.actionSupport] || "").trim() !== "/" &&
    (skip || r[FIELDS.subIssue] === state.subIssue)
  );

  const groups = {};

  filtered.forEach(r => {
    const key = `${r[FIELDS.subIssue]}||${r[FIELDS.actionSupport]}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  });

  Object.values(groups).forEach(rows => {
    const first = rows[0];

    const sopValue = String(first[FIELDS.sopLink] || "").trim().toUpperCase();
    const showHowTo = sopValue !== "" && sopValue !== "/" && sopValue !== "I";

    const actionDiv = document.createElement("div");
    actionDiv.className = "action-line assess";

    actionDiv.innerHTML = `
      <div class="action-text">${first[FIELDS.actionSupport]}</div>
      <div class="action-buttons">
        <button class="issue-btn">Issue confirmed</button>
        ${showHowTo ? `<button class="howto-btn">How to</button>` : ""}
      </div>
    `;

    actionDiv.querySelector(".issue-btn").onclick = () => {
      state.confirmedGroup = rows;
      showMaintenance();
    };

    if (showHowTo) {
      actionDiv.querySelector(".howto-btn").onclick = () => {
        if (first[FIELDS.sopLink]) window.open(first[FIELDS.sopLink], "_blank");
      };
    }

    actionsList.appendChild(actionDiv);
  });
}

/* =============================
   MAINTENANCE — AGGREGATED (SPARE PART RULE)
============================= */
function showMaintenance() {
  const rows = state.confirmedGroup;
  if (!rows || rows.length === 0) return;

  const base = rows[0];
  const symptomText = `${base[FIELDS.symptomId]} — ${base[FIELDS.symptomDesc]}`;

  const actions = rows
    .map(r => r[FIELDS.actionField])
    .filter(Boolean);

  const spare = String(base[FIELDS.sparePart] || "").trim();
  const showSpare = spare !== "" && spare !== "/";

  maintenanceContent.innerHTML = `
    <div class="maintenance-box">

      <div class="maintenance-row">
        <div class="maintenance-label">Sub issue:</div>
        <div class="maintenance-value">${base[FIELDS.subIssue]}</div>
      </div>

      <div class="maintenance-row">
        <div class="maintenance-label">Symptom to confirm on site:</div>
        <div class="maintenance-value">${symptomText}</div>
      </div>

      <div class="maintenance-row">
        <div class="maintenance-label">Actions to do:</div>
        <div class="maintenance-value">
          ${actions.map(a => `
            <label class="checkbox-item">
              <input type="checkbox" /> ${a}
            </label>
          `).join("")}
        </div>
      </div>

      ${showSpare ? `
      <div class="maintenance-row">
        <div class="maintenance-label">Spare parts needed:</div>
        <div class="maintenance-value">
          <label class="checkbox-item">
            <input type="checkbox" /> ${spare}
          </label>
        </div>
      </div>
      ` : ""}

    </div>
  `;

  maintenanceSection.classList.remove("hidden");

  copyBtn.onclick = () => {
    const text = `
Sub issue: ${base[FIELDS.subIssue]}
Symptom to confirm on site: ${symptomText}
Actions to do:
${actions.join("\n")}
${showSpare ? `Spare parts needed: ${spare}` : ""}
    `.trim();

    navigator.clipboard.writeText(text);
  };
}

/* =============================
   RESET
============================= */
function resetUI() {
  subIssueSection.classList.add("hidden");
  actionsSection.classList.add("hidden");
  maintenanceSection.classList.add("hidden");
  state.subIssue = null;
  state.confirmedGroup = null;
}
