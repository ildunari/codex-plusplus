const HOME = "/Users/Kosta";
const CATALOG_PATH = "/Users/Kosta/.codex/model-catalog-with-glm.json";
const CONFIG_PATH = "/Users/Kosta/.codex/config.toml";
const PROVIDER_ID = "go-llm-proxy-vibe";
const MODELS = [
  {
    id: "glm-5.1",
    name: "GLM-5.1",
    profile: "glm",
    description: "Default GLM coding model through VibeProxy.",
  },
  {
    id: "glm-5v-turbo",
    name: "GLM-5V-Turbo",
    profile: "glm-vision",
    description: "Vision-capable GLM model through VibeProxy.",
  },
];

module.exports = {
  start(api) {
    if (api.process === "main") {
      globalThis.__codexppExternalModels = { readStatus, testModel };
      if (!globalThis.__codexppExternalModelsHandlers) {
        api.ipc.handle("status", () => globalThis.__codexppExternalModels.readStatus());
        api.ipc.handle("test-model", (model) =>
          globalThis.__codexppExternalModels.testModel(model),
        );
        globalThis.__codexppExternalModelsHandlers = true;
      }
      return;
    }

    const page = api.settings.registerPage({
      id: "main",
      title: "External Models",
      description: "GLM and provider bridge controls.",
      iconSvg:
        '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" class="icon-sm inline-block align-middle" aria-hidden="true">' +
        '<path d="M4 6.5h12M4 13.5h12M7 4v5M13 11v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>' +
        "</svg>",
      render: (root) => render(root, api),
    });

    this._page = page;
  },

  stop() {
    this._page?.unregister?.();
  },
};

function readStatus() {
  const configText = readText(CONFIG_PATH);
  const catalog = readJson(CATALOG_PATH);
  const catalogModels = Array.isArray(catalog?.models)
    ? catalog.models.map((m) => m.slug)
    : [];

  return {
    configPath: CONFIG_PATH,
    catalogPath: CATALOG_PATH,
    providerConfigured:
      configText.includes(`[model_providers.${PROVIDER_ID}]`) &&
      configText.includes('base_url = "http://127.0.0.1:8484/v1"'),
    catalogConfigured: configText.includes(`model_catalog_json = "${CATALOG_PATH}"`),
    glmProfileConfigured:
      configText.includes("[profiles.glm]") &&
      configText.includes('model_provider = "go-llm-proxy-vibe"'),
    glmVisionProfileConfigured:
      configText.includes("[profiles.glm-vision]") &&
      configText.includes('model = "glm-5v-turbo"'),
    catalogModels: MODELS.map((model) => ({
      ...model,
      present: catalogModels.includes(model.id),
    })),
  };
}

function testModel(model) {
  const { execFile } = require("node:child_process");
  const selected = MODELS.find((entry) => entry.id === model);
  if (!selected) {
    return Promise.resolve({ ok: false, output: `Unknown model: ${model}` });
  }

  return new Promise((resolve) => {
    execFile(
      "codex",
      [
        "exec",
        "--skip-git-repo-check",
        "-c",
        `model=${selected.id}`,
        "-c",
        `model_provider=${PROVIDER_ID}`,
        "-c",
        "web_search=disabled",
        "Reply with exactly: ok",
      ],
      { cwd: HOME, timeout: 45000, maxBuffer: 1024 * 1024 },
      (error, stdout, stderr) => {
        const output = `${stdout || ""}${stderr || ""}`.trim();
        resolve({
          ok: !error && /\bok\b/i.test(output),
          output: lastLines(output, 12),
        });
      },
    );
  });
}

function render(root, api) {
  root.innerHTML = "";
  const wrap = el("div", "flex flex-col gap-4");
  const statusSection = el("section", "flex flex-col gap-2");
  statusSection.appendChild(sectionTitle("Bridge"));

  const card = roundedCard();
  const statusBox = el("div", "flex flex-col gap-2 p-3 text-sm text-token-text-secondary");
  statusBox.textContent = "Loading...";
  card.appendChild(statusBox);
  statusSection.appendChild(card);

  const modelSection = el("section", "flex flex-col gap-2");
  modelSection.appendChild(sectionTitle("Models"));
  const modelCard = roundedCard();
  for (const model of MODELS) {
    modelCard.appendChild(modelRow(api, model));
  }
  modelSection.appendChild(modelCard);

  const note = el("div", "text-token-text-secondary text-sm");
  note.textContent =
    "Use the glm or glm-vision profile when starting a new GLM session. The bridge must stay tied to the model so requests do not fall back to OpenAI.";

  wrap.append(statusSection, modelSection, note);
  root.appendChild(wrap);

  refreshStatus(api, statusBox);
}

async function refreshStatus(api, box) {
  try {
    const status = await api.ipc.invoke("status");
    box.innerHTML = "";
    box.append(
      statusLine("Provider", status.providerConfigured),
      statusLine("Local catalog", status.catalogConfigured),
      statusLine("GLM profile", status.glmProfileConfigured),
      statusLine("GLM vision profile", status.glmVisionProfileConfigured),
      pathLine("Catalog", status.catalogPath),
      pathLine("Config", status.configPath),
    );
  } catch (error) {
    box.textContent = `Could not read model bridge status: ${error?.message || error}`;
  }
}

function modelRow(api, model) {
  const row = el("div", "flex items-center justify-between gap-4 p-3");
  const left = el("div", "flex min-w-0 flex-col gap-1");
  const title = el("div", "min-w-0 text-sm text-token-text-primary");
  title.textContent = model.name;
  const desc = el("div", "text-token-text-secondary min-w-0 text-sm");
  desc.textContent = `${model.description} Profile: ${model.profile}.`;
  left.append(title, desc);

  const button = el(
    "button",
    "h-token-button-composer rounded-md border border-token-border bg-token-foreground/5 px-3 text-sm text-token-text-primary hover:bg-token-foreground/10 cursor-interaction",
  );
  button.type = "button";
  button.textContent = "Test";
  button.addEventListener("click", async () => {
    button.disabled = true;
    button.textContent = "Testing...";
    const result = await api.ipc.invoke("test-model", model.id);
    button.textContent = result.ok ? "OK" : "Failed";
    button.title = result.output || "";
    setTimeout(() => {
      button.disabled = false;
      button.textContent = "Test";
    }, 2500);
  });

  row.append(left, button);
  return row;
}

function statusLine(label, ok) {
  const row = el("div", "flex items-center justify-between gap-4");
  const l = el("span", "text-token-text-secondary");
  l.textContent = label;
  const v = el(
    "span",
    ok
      ? "rounded-full bg-token-charts-green/10 px-2 py-0.5 text-token-charts-green"
      : "rounded-full bg-token-charts-red/10 px-2 py-0.5 text-token-charts-red",
  );
  v.textContent = ok ? "Configured" : "Missing";
  row.append(l, v);
  return row;
}

function pathLine(label, value) {
  const row = el("div", "flex items-start justify-between gap-4");
  const l = el("span", "shrink-0 text-token-text-secondary");
  l.textContent = label;
  const v = el("code", "min-w-0 break-all text-token-text-primary");
  v.textContent = value;
  row.append(l, v);
  return row;
}

function sectionTitle(text) {
  const title = el("div", "flex h-toolbar items-center justify-between gap-2 px-0 py-0");
  const inner = el("div", "flex min-w-0 flex-1 flex-col gap-1");
  const label = el("div", "text-base font-medium text-token-text-primary");
  label.textContent = text;
  inner.appendChild(label);
  title.appendChild(inner);
  return title;
}

function roundedCard() {
  const card = el(
    "div",
    "border-token-border flex flex-col divide-y-[0.5px] divide-token-border rounded-lg border",
  );
  card.style.backgroundColor = "var(--color-background-panel, var(--color-token-bg-fog))";
  return card;
}

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function readText(file) {
  const fs = require("node:fs");
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function readJson(file) {
  const fs = require("node:fs");
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function lastLines(text, count) {
  return text.split(/\r?\n/).slice(-count).join("\n");
}
