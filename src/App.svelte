<script lang="ts">
  import { onMount } from "svelte";
  import {
    AVAILABLE_MODEL_OPTIONS,
    getSelectedModel,
    setSelectedModel,
    type SelectedModelId,
  } from "./shared/models";

  let selectedModel = $state<SelectedModelId>("default");
  let isSaving = $state(false);
  let showSavedNotice = $state(false);
  let savedNoticeTimer: ReturnType<typeof setTimeout> | null = null;

  function t(key: string, fallback: string): string {
    if (typeof chrome !== "undefined" && chrome.i18n?.getMessage) {
      const msg = chrome.i18n.getMessage(key);
      if (msg) return msg;
    }
    return fallback;
  }

  onMount(async () => {
    try {
      selectedModel = await getSelectedModel();
    } catch (err) {
      console.warn("[CheckMail] Error loading selected model:", err);
    }
  });

  async function selectModel(id: SelectedModelId) {
    if (selectedModel === id) return;
    selectedModel = id;
    isSaving = true;

    try {
      await setSelectedModel(id);
      showNotice();
    } catch (err) {
      console.error("[CheckMail] Failed to save inspection settings:", err);
    } finally {
      isSaving = false;
    }
  }

  function showNotice() {
    showSavedNotice = true;
    if (savedNoticeTimer) clearTimeout(savedNoticeTimer);
    savedNoticeTimer = setTimeout(() => {
      showSavedNotice = false;
    }, 2200);
  }
</script>

<main class="popup-container">
  <!-- Header with Brand & Live Shield Status -->
  <header class="popup-header">
    <div class="brand-row">
      <div class="logo-shield">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="20"
          height="20"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" stroke-width="2.2" />
        </svg>
      </div>
      <div class="brand-text">
        <div class="brand-title">{t("popupTitle", "CheckMail")}</div>
        <div class="brand-subtitle">
          {t("popupSubtitle", "Silnik inspekcji i ochrony poczty")}
        </div>
      </div>
    </div>

    <div class="status-pill" title={t("protectionActive", "Ochrona aktywna")}>
      <span class="status-dot"></span>
      <span class="status-label"
        >{t("protectionActive", "Ochrona aktywna")}</span
      >
    </div>
  </header>

  <!-- Section: Inspection Depth / Security Modes -->
  <section class="section-container">
    <div class="section-header">
      <div class="section-title-row">
        <svg
          class="section-icon"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width="15"
          height="15"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <polygon points="12 2 2 7 12 12 22 7 12 2" />
          <polyline points="2 17 12 22 22 17" />
          <polyline points="2 12 12 17 22 12" />
        </svg>
        <h2 class="section-title">
          {t("modelSelectionTitle", "Poziom inspekcji wiadomości")}
        </h2>
      </div>
      <p class="section-description">
        {t(
          "modelSelectionSubtitle",
          "Dostosuj rygor weryfikacji nagłówków, reputacji i socjotechniki",
        )}
      </p>
    </div>

    <!-- Security Mode Cards -->
    <div
      class="options-list"
      role="radiogroup"
      aria-label={t("modelSelectionTitle", "Poziom inspekcji wiadomości")}
    >
      {#each AVAILABLE_MODEL_OPTIONS as option (option.id)}
        {@const isSelected = selectedModel === option.id}
        <button
          type="button"
          role="radio"
          aria-checked={isSelected}
          class="option-card"
          class:selected={isSelected}
          onclick={() => selectModel(option.id)}
        >
          <div class="card-radio-box">
            <div class="radio-indicator" class:checked={isSelected}>
              {#if isSelected}
                <div class="radio-inner-dot"></div>
              {/if}
            </div>
          </div>

          <div class="card-body">
            <div class="card-title-row">
              <span class="card-name">{t(option.nameKey, option.id)}</span>
              {#if option.badgeKey}
                <span
                  class="card-badge"
                  class:badge-auto={option.badgeType === "auto"}
                  class:badge-speed={option.badgeType === "speed"}
                  class:badge-smart={option.badgeType === "smart"}
                >
                  {t(option.badgeKey, "")}
                </span>
              {/if}
            </div>


            <p class="card-desc">
              {t(option.descriptionKey, "")}
            </p>
          </div>
        </button>
      {/each}
    </div>
  </section>

  <!-- Technical Configuration Feedback -->
  <div class="feedback-row" class:visible={showSavedNotice}>
    <span class="feedback-dot"></span>
    <span>{t("settingsSaved", "Parametry silnika zaktualizowane")}</span>
  </div>

  <!-- Footer Info -->
  <footer class="popup-footer">
    <div class="providers-row">
      <span class="providers-text"
        >{t(
          "supportedProviders",
          "Zabezpiecza: Gmail, Outlook, Yahoo, WP, Onet, Interia",
        )}</span
      >
    </div>
    <div class="footer-meta">
      <span
        >CheckMail Core v0.1.0 • {t(
          "protectionActive",
          "Ochrona aktywna",
        )}</span
      >
    </div>
  </footer>
</main>

<style>
  .popup-container {
    width: 360px;
    padding: 16px 16px 12px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    background: #0b0f17;
    box-sizing: border-box;
    user-select: none;
  }

  /* Header */
  .popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 12px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .brand-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .logo-shield {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background: rgba(37, 99, 235, 0.15);
    border: 1px solid rgba(59, 130, 246, 0.35);
    color: #60a5fa;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .brand-title {
    font-size: 14px;
    font-weight: 700;
    letter-spacing: 0.2px;
    color: #f1f5f9;
  }

  .brand-subtitle {
    font-size: 11px;
    color: #64748b;
  }

  .status-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 8px;
    border-radius: 6px;
    background: rgba(16, 185, 129, 0.08);
    border: 1px solid rgba(16, 185, 129, 0.2);
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #10b981;
  }

  .status-label {
    font-size: 10.5px;
    font-weight: 500;
    color: #34d399;
  }

  /* Section */
  .section-container {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .section-header {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .section-title-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .section-icon {
    color: #60a5fa;
  }

  .section-title {
    font-size: 12.5px;
    font-weight: 600;
    letter-spacing: 0.2px;
    color: #cbd5e1;
    margin: 0;
  }

  .section-description {
    font-size: 11px;
    color: #64748b;
    margin: 0;
    line-height: 1.35;
  }

  /* Mode Cards */
  .options-list {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .option-card {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    width: 100%;
    padding: 9px 11px;
    border-radius: 8px;
    background: rgba(17, 24, 39, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.07);
    cursor: pointer;
    text-align: left;
    transition:
      background 0.15s ease,
      border-color 0.15s ease;
    outline: none;
  }

  .option-card:hover {
    background: rgba(30, 41, 59, 0.55);
    border-color: rgba(255, 255, 255, 0.14);
  }

  .option-card.selected {
    background: rgba(37, 99, 235, 0.1);
    border-color: #2563eb;
  }

  .card-radio-box {
    padding-top: 2px;
    flex-shrink: 0;
  }

  .radio-indicator {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 1.5px solid #475569;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: border-color 0.15s ease;
  }

  .radio-indicator.checked {
    border-color: #3b82f6;
    background: rgba(37, 99, 235, 0.2);
  }

  .radio-inner-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background-color: #60a5fa;
  }

  .card-body {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .card-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .card-name {
    font-size: 12px;
    font-weight: 600;
    color: #e2e8f0;
  }

  .option-card.selected .card-name {
    color: #60a5fa;
  }

  .card-badge {
    font-size: 9.5px;
    font-weight: 600;
    padding: 2px 6.5px;
    border-radius: 4px;
    letter-spacing: 0.2px;
  }

  .badge-auto {
    background: rgba(56, 189, 248, 0.12);
    color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.25);
  }

  .badge-speed {
    background: rgba(245, 158, 11, 0.12);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.25);
  }

  .badge-smart {
    background: rgba(168, 85, 247, 0.12);
    color: #c084fc;
    border: 1px solid rgba(168, 85, 247, 0.25);
  }


  .card-desc {
    font-size: 10.5px;
    color: #94a3b8;
    line-height: 1.35;
    margin: 0;
  }

  /* Feedback bar */
  .feedback-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 4px 8px;
    border-radius: 5px;
    background: rgba(16, 185, 129, 0.06);
    border: 1px solid rgba(16, 185, 129, 0.15);
    color: #34d399;
    font-size: 10.5px;
    font-weight: 500;
    opacity: 0;
    transform: translateY(2px);
    transition:
      opacity 0.2s ease,
      transform 0.2s ease;
    pointer-events: none;
    min-height: 22px;
  }

  .feedback-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background-color: #10b981;
  }

  .feedback-row.visible {
    opacity: 1;
    transform: translateY(0);
  }

  /* Footer */
  .popup-footer {
    padding-top: 8px;
    border-top: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    gap: 3px;
    text-align: center;
  }

  .providers-text {
    font-size: 10px;
    color: #475569;
  }

  .footer-meta {
    font-size: 9.5px;
    color: #334155;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      monospace;
  }
</style>
