<script lang="ts">
  import { onMount } from 'svelte';
  import {
    AVAILABLE_MODEL_OPTIONS,
    getSelectedModel,
    setSelectedModel,
    type SelectedModelId,
  } from './shared/models';

  let selectedModel = $state<SelectedModelId>('default');
  let isSaving = $state(false);
  let showSavedNotice = $state(false);
  let savedNoticeTimer: ReturnType<typeof setTimeout> | null = null;

  function t(key: string, fallback: string): string {
    if (typeof chrome !== 'undefined' && chrome.i18n?.getMessage) {
      const msg = chrome.i18n.getMessage(key);
      if (msg) return msg;
    }
    return fallback;
  }

  onMount(async () => {
    try {
      selectedModel = await getSelectedModel();
    } catch (err) {
      console.warn('[CheckMail] Error loading selected model:', err);
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
      console.error('[CheckMail] Failed to save model selection:', err);
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
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="M9 12l2 2 4-4" stroke-width="2.5"/>
        </svg>
      </div>
      <div class="brand-text">
        <div class="brand-title">{t('popupTitle', 'CheckMail')}</div>
        <div class="brand-subtitle">{t('popupSubtitle', 'Ochrona poczty przed phishingiem')}</div>
      </div>
    </div>

    <div class="status-pill" title={t('protectionActive', 'Ochrona aktywna')}>
      <span class="status-dot"></span>
      <span class="status-label">{t('protectionActive', 'Ochrona aktywna')}</span>
    </div>
  </header>

  <!-- Section: LLM Selection -->
  <section class="section-container">
    <div class="section-header">
      <div class="section-title-row">
        <svg class="section-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2a4 4 0 0 1 4 4v1a3 3 0 0 1 3 3v2a3 3 0 0 1-1 2.22V17a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3v-2.78A3 3 0 0 1 5 12V9a3 3 0 0 1 3-3V6a4 4 0 0 1 4-4z"/>
          <line x1="9" y1="12" x2="9.01" y2="12"/>
          <line x1="15" y1="12" x2="15.01" y2="12"/>
          <path d="M10 16a2 2 0 0 0 4 0"/>
        </svg>
        <h2 class="section-title">{t('modelSelectionTitle', 'Model analizy LLM')}</h2>
      </div>
      <p class="section-description">
        {t('modelSelectionSubtitle', 'Wybierz model AI analizujący treść i nagłówki')}
      </p>
    </div>

    <!-- Models List Cards -->
    <div class="options-list" role="radiogroup" aria-label={t('modelSelectionTitle', 'Model analizy LLM')}>
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
                  class:badge-auto={option.id === 'default'}
                  class:badge-speed={option.id === 'gemini-3.5-flash-lite'}
                  class:badge-smart={option.id === 'gemini-3.7-flash'}
                >
                  {t(option.badgeKey, '')}
                </span>
              {/if}
            </div>

            <p class="card-desc">
              {t(option.descriptionKey, '')}
            </p>
          </div>
        </button>
      {/each}
    </div>
  </section>

  <!-- Auto-save floating feedback -->
  <div class="feedback-row" class:visible={showSavedNotice}>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="14" height="14" fill="currentColor">
      <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
    </svg>
    <span>{t('settingsSaved', 'Zapisano')}</span>
  </div>

  <!-- Footer Info -->
  <footer class="popup-footer">
    <div class="providers-row">
      <span class="providers-text">{t('supportedProviders', 'Obsługa: Gmail, Outlook, Yahoo, WP, Onet, Interia')}</span>
    </div>
    <div class="footer-meta">
      <span>CheckMail Plugin • {t('versionText', 'Wersja')} 0.1.0</span>
    </div>
  </footer>
</main>

<style>
  .popup-container {
    width: 360px;
    padding: 18px 16px 14px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    background: linear-gradient(180deg, #0b0f19 0%, #0d1322 100%);
    box-sizing: border-box;
    user-select: none;
  }

  /* Header */
  .popup-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 14px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .brand-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .logo-shield {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: linear-gradient(135deg, rgba(14, 165, 233, 0.2) 0%, rgba(37, 99, 235, 0.3) 100%);
    border: 1px solid rgba(56, 189, 248, 0.3);
    color: #38bdf8;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 0 16px rgba(14, 165, 233, 0.25);
  }

  .brand-title {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.3px;
    color: #f8fafc;
  }

  .brand-subtitle {
    font-size: 11px;
    color: var(--text-secondary);
  }

  .status-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 9px;
    border-radius: 12px;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.25);
  }

  .status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background-color: #10b981;
    box-shadow: 0 0 8px #10b981;
    animation: pulse 2s infinite ease-in-out;
  }

  @keyframes pulse {
    0%, 100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.6;
      transform: scale(0.85);
    }
  }

  .status-label {
    font-size: 11px;
    font-weight: 600;
    color: #34d399;
  }

  /* Section */
  .section-container {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-header {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .section-title-row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .section-icon {
    color: var(--accent-cyan);
  }

  .section-title {
    font-size: 13px;
    font-weight: 600;
    letter-spacing: 0.2px;
    color: #e2e8f0;
    margin: 0;
  }

  .section-description {
    font-size: 11.5px;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.35;
  }

  /* Radio Cards */
  .options-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .option-card {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    width: 100%;
    padding: 10px 12px;
    border-radius: 9px;
    background: rgba(17, 24, 39, 0.65);
    border: 1px solid var(--border-subtle);
    cursor: pointer;
    text-align: left;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    outline: none;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }

  .option-card:hover {
    background: rgba(30, 41, 59, 0.6);
    border-color: var(--border-hover);
    transform: translateY(-1px);
  }

  .option-card.selected {
    background: linear-gradient(135deg, rgba(14, 165, 233, 0.12) 0%, rgba(30, 58, 138, 0.12) 100%);
    border-color: #0ea5e9;
    box-shadow: 0 0 14px rgba(14, 165, 233, 0.15), inset 0 0 0 1px rgba(14, 165, 233, 0.2);
  }

  .card-radio-box {
    padding-top: 2px;
    flex-shrink: 0;
  }

  .radio-indicator {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    border: 1.5px solid #475569;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .radio-indicator.checked {
    border-color: #38bdf8;
    background: rgba(14, 165, 233, 0.2);
  }

  .radio-inner-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background-color: #38bdf8;
    box-shadow: 0 0 6px #38bdf8;
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
    font-size: 12.5px;
    font-weight: 600;
    color: #f1f5f9;
  }

  .option-card.selected .card-name {
    color: #38bdf8;
  }

  .card-badge {
    font-size: 10px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 6px;
    letter-spacing: 0.2px;
  }

  .badge-auto {
    background: rgba(56, 189, 248, 0.15);
    color: #38bdf8;
    border: 1px solid rgba(56, 189, 248, 0.3);
  }

  .badge-speed {
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .badge-smart {
    background: rgba(168, 85, 247, 0.15);
    color: #c084fc;
    border: 1px solid rgba(168, 85, 247, 0.3);
  }

  .card-desc {
    font-size: 11px;
    color: var(--text-secondary);
    line-height: 1.3;
    margin: 0;
  }

  /* Feedback bar */
  .feedback-row {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 5px 10px;
    border-radius: 6px;
    background: rgba(16, 185, 129, 0.12);
    border: 1px solid rgba(16, 185, 129, 0.25);
    color: #34d399;
    font-size: 11.5px;
    font-weight: 500;
    opacity: 0;
    transform: translateY(4px);
    transition: all 0.25s ease;
    pointer-events: none;
    min-height: 26px;
  }

  .feedback-row.visible {
    opacity: 1;
    transform: translateY(0);
  }

  /* Footer */
  .popup-footer {
    padding-top: 10px;
    border-top: 1px solid var(--border-subtle);
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: center;
  }

  .providers-text {
    font-size: 10.5px;
    color: var(--text-muted);
  }

  .footer-meta {
    font-size: 10px;
    color: #475569;
  }
</style>
