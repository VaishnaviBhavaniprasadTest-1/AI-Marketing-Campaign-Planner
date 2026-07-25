/* ============================================================
   APP — dashboard orchestration
   ============================================================ */

let currentUser = null;
let currentCampaign = null; // { title, product_description, result_json, raw_text, id? }

/* ---------- Auth guard ---------- */
(async function guardSession(){
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session){
    window.location.href = "index.html";
    return;
  }
  currentUser = session.user;
  document.getElementById("userEmail").textContent = currentUser.email;
  document.getElementById("avatarInitial").textContent = (currentUser.email || "?")[0].toUpperCase();

  gsap.timeline()
    .to(".reveal", { opacity: 1, y: 0, duration: 0.7, stagger: 0.08, ease: "power3.out" });

  loadCampaigns();
})();

supabaseClient.auth.onAuthStateChange((event) => {
  if (event === "SIGNED_OUT") window.location.href = "index.html";
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await supabaseClient.auth.signOut();
  window.location.href = "index.html";
});

/* ---------- Generate ---------- */
const generateBtn = document.getElementById("generateBtn");
const generateError = document.getElementById("generateError");

generateBtn.addEventListener("click", async () => {
  const productDescription = document.getElementById("productInput").value.trim();
  generateError.textContent = "";

  if (productDescription.length < 15){
    generateError.textContent = "Describe your product in a bit more detail (15+ characters).";
    return;
  }

  generateBtn.disabled = true;
  setLoading(true, "GENERATING CAMPAIGN", "Warming up the model…");

  try{
    const { campaign, rawText, aiError, wasBackfilled } = await generateCampaign(
      productDescription,
      uploadedInsights,
      (status) => setLoading(true, "GENERATING CAMPAIGN", status)
    );

    currentCampaign = {
      title: productDescription.slice(0, 60) + (productDescription.length > 60 ? "…" : ""),
      product_description: productDescription,
      result_json: campaign,
      raw_text: rawText
    };

    renderCampaign(currentCampaign);

    if (aiError){
      showToast("Model was unreachable, so we generated your campaign directly from the description instead.", "error");
    } else if (wasBackfilled){
      showToast("Campaign generated.");
    } else {
      showToast("Campaign generated successfully.");
    }
  } catch(err){
    console.error(err);
    generateError.textContent = "Something went wrong: " + (err.message || "Unknown error. Please try again.");
  } finally {
    generateBtn.disabled = false;
    setLoading(false);
  }
});

/* ---------- Render campaign ---------- */
function renderCampaign(campaign){
  const wrap = document.getElementById("resultsWrap");
  const content = document.getElementById("resultsContent");
  wrap.style.display = "block";

  const c = campaign.result_json;

  if (!c){
    content.innerHTML = `
      <div class="glass panel result-block">
        <h3>Raw Model Output</h3>
        <p style="font-size:12.5px; margin-bottom:10px;">The model didn't return clean JSON this time — here's the raw generation. Try regenerating for structured cards.</p>
        <div class="raw-output glass">${escapeHTML(campaign.raw_text || "No output.")}</div>
      </div>`;
  } else {
    content.innerHTML = `
      ${renderPersonas(c.personas)}
      ${renderAdCopy(c.ad_copy)}
      ${renderKeywords(c.keywords)}
      ${renderBudget(c.budget)}
      ${renderSchedule(c.schedule)}
    `;
  }

  wrap.scrollIntoView({ behavior: "smooth", block: "start" });
  gsap.fromTo("#resultsContent > *", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: "power3.out" });
}

function renderPersonas(personas){
  if (!personas?.length) return "";
  return `<div class="result-block"><h3>Target Audience Personas</h3>
    ${personas.map(p => `
      <div class="glass persona-card">
        <h4>${escapeHTML(p.name || "Persona")} <span style="color:var(--text-low); font-weight:400; font-size:12px;">· ${escapeHTML(p.age_range || "")}</span></h4>
        <p style="font-size:13.5px; margin:0;">${escapeHTML(p.summary || "")}</p>
      </div>`).join("")}
  </div>`;
}

function renderAdCopy(adCopy){
  if (!adCopy) return "";
  const platforms = [
    { key: "facebook", label: "Facebook" },
    { key: "instagram", label: "Instagram" },
    { key: "google", label: "Google Ads" },
    { key: "twitter", label: "X / Twitter" }
  ];
  return `<div class="result-block"><h3>Ad Copy</h3>
    <div class="copy-grid">
      ${platforms.map(p => (adCopy[p.key] || []).map((copy, i) => `
        <div class="glass copy-card">
          <span class="platform-tag">${p.label} · v${i + 1}</span>
          <p style="margin:0; font-size:13px; color:var(--text-hi);">${escapeHTML(copy)}</p>
        </div>`).join("")).join("")}
    </div>
  </div>`;
}

function renderKeywords(keywords){
  if (!keywords) return "";
  return `<div class="result-block glass panel"><h3>Keywords</h3>
    <p style="font-size:12px; margin-bottom:8px; color:var(--text-low);">High Intent</p>
    <div style="margin-bottom:16px;">${(keywords.high_intent || []).map(k => `<span class="keyword-pill">${escapeHTML(k)}</span>`).join("")}</div>
    <p style="font-size:12px; margin-bottom:8px; color:var(--text-low);">Long-Tail</p>
    <div>${(keywords.long_tail || []).map(k => `<span class="keyword-pill long">${escapeHTML(k)}</span>`).join("")}</div>
  </div>`;
}

function renderBudget(budget){
  if (!budget) return "";
  return `<div class="result-block glass panel"><h3>Budget Suggestions</h3>
    <table class="budget-table" style="margin-bottom:18px;">
      <tr><th>Daily</th><th>Weekly</th><th>Monthly</th></tr>
      <tr><td>${escapeHTML(budget.daily || "—")}</td><td>${escapeHTML(budget.weekly || "—")}</td><td>${escapeHTML(budget.monthly || "—")}</td></tr>
    </table>
    <table class="budget-table">
      <tr><th>Channel</th><th>Split</th><th>Why</th></tr>
      ${(budget.channel_split || []).map(cs => `<tr><td>${escapeHTML(cs.channel || "")}</td><td>${escapeHTML(cs.percent || "")}</td><td>${escapeHTML(cs.reasoning || "")}</td></tr>`).join("")}
    </table>
  </div>`;
}

function renderSchedule(schedule){
  if (!schedule?.length) return "";
  return `<div class="result-block glass panel"><h3>30-Day Publishing Schedule</h3>
    <div class="schedule-grid">
      ${schedule.map(s => `
        <div class="glass schedule-day">
          <span class="day-num">DAY ${s.day}</span>
          ${escapeHTML(s.focus || "")}
        </div>`).join("")}
    </div>
  </div>`;
}

function escapeHTML(str){
  if (typeof str !== "string") return String(str ?? "");
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- Save ---------- */
document.getElementById("saveBtn").addEventListener("click", async () => {
  if (!currentCampaign){ showToast("Nothing to save yet.", "error"); return; }
  try{
    const { data, error } = await supabaseClient
      .from("campaigns")
      .insert({
        user_id: currentUser.id,
        title: currentCampaign.title,
        product_description: currentCampaign.product_description,
        result_json: currentCampaign.result_json,
        raw_text: currentCampaign.raw_text
      })
      .select()
      .single();
    if (error) throw error;
    showToast("Campaign saved.");
    loadCampaigns();
  } catch(err){
    console.error(err);
    showToast("Could not save campaign: " + err.message, "error");
  }
});

/* ---------- Export ---------- */
document.getElementById("exportBtn").addEventListener("click", () => {
  if (!currentCampaign){ showToast("Nothing to export yet.", "error"); return; }
  const md = campaignToMarkdown(currentCampaign);
  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `campaign-${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
});

function campaignToMarkdown(campaign){
  const c = campaign.result_json;
  let md = `# ${campaign.title}\n\n**Product Description:**\n${campaign.product_description}\n\n`;

  if (!c){
    return md + `## Raw Output\n\n${campaign.raw_text || ""}\n`;
  }

  md += `## Target Audience Personas\n\n`;
  (c.personas || []).forEach(p => { md += `### ${p.name} (${p.age_range})\n${p.summary}\n\n`; });

  md += `## Ad Copy\n\n`;
  ["facebook", "instagram", "google", "twitter"].forEach(platform => {
    md += `### ${platform.charAt(0).toUpperCase() + platform.slice(1)}\n`;
    (c.ad_copy?.[platform] || []).forEach((copy, i) => { md += `**Version ${i + 1}:** ${copy}\n\n`; });
  });

  md += `## Keywords\n\n**High Intent:** ${(c.keywords?.high_intent || []).join(", ")}\n\n**Long-Tail:** ${(c.keywords?.long_tail || []).join(", ")}\n\n`;

  md += `## Budget\n\n- Daily: ${c.budget?.daily}\n- Weekly: ${c.budget?.weekly}\n- Monthly: ${c.budget?.monthly}\n\n`;
  md += `### Channel Split\n\n`;
  (c.budget?.channel_split || []).forEach(cs => { md += `- **${cs.channel}**: ${cs.percent} — ${cs.reasoning}\n`; });

  md += `\n## 30-Day Publishing Schedule\n\n`;
  (c.schedule || []).forEach(s => { md += `- **Day ${s.day}:** ${s.focus}\n`; });

  return md;
}

/* ---------- Load / list / delete ---------- */
async function loadCampaigns(){
  const listEl = document.getElementById("campaignList");
  try{
    const { data, error } = await supabaseClient
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;

    if (!data.length){
      listEl.innerHTML = `<div class="empty-state">No campaigns yet. Generate your first one →</div>`;
      return;
    }

    listEl.innerHTML = data.map(row => `
      <div class="glass campaign-item" data-id="${row.id}">
        <div>
          <div class="ci-title">${escapeHTML(row.title)}</div>
          <div class="ci-date">${new Date(row.created_at).toLocaleDateString()} · ${new Date(row.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
        </div>
        <div class="campaign-actions">
          <div class="icon-btn" data-action="load" title="Load">⤴</div>
          <div class="icon-btn danger" data-action="delete" title="Delete">✕</div>
        </div>
      </div>
    `).join("");

    listEl.querySelectorAll(".campaign-item").forEach(item => {
      const id = item.dataset.id;
      const row = data.find(r => String(r.id) === String(id));

      item.querySelector('[data-action="load"]').addEventListener("click", (e) => {
        e.stopPropagation();
        currentCampaign = {
          id: row.id,
          title: row.title,
          product_description: row.product_description,
          result_json: row.result_json,
          raw_text: row.raw_text
        };
        renderCampaign(currentCampaign);
        showToast("Campaign loaded.");
      });

      item.querySelector('[data-action="delete"]').addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!confirm("Delete this campaign permanently?")) return;
        const { error } = await supabaseClient.from("campaigns").delete().eq("id", row.id);
        if (error){ showToast("Delete failed: " + error.message, "error"); return; }
        showToast("Campaign deleted.");
        loadCampaigns();
      });
    });
  } catch(err){
    console.error(err);
    listEl.innerHTML = `<div class="empty-state">Could not load campaigns: ${escapeHTML(err.message)}</div>`;
  }
}
