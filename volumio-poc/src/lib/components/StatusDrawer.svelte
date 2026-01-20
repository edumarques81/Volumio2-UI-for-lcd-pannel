<script lang="ts">
  import { statusDrawerOpen } from '$lib/stores/ui';
  import {
    activeIssuesList,
    highestSeverity,
    issueCounts,
    issueActions,
    type Issue,
    type Severity
  } from '$lib/stores/issues';
  import { navigationActions } from '$lib/stores/navigation';
  import Icon from './Icon.svelte';

  function closeDrawer() {
    statusDrawerOpen.set(false);
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      closeDrawer();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      closeDrawer();
    }
  }

  function handleAction(actionId: string) {
    if (actionId === 'open-settings') {
      closeDrawer();
      navigationActions.goToSettings();
    } else {
      issueActions.executeAction(actionId);
    }
  }

  function dismissIssue(issue: Issue) {
    issueActions.resolveIssue(issue.id);
  }

  function getIcon(severity: Severity): string {
    switch (severity) {
      case 'error': return 'x-circle';
      case 'warning': return 'alert-triangle';
      default: return 'info';
    }
  }

  function getSeverityColor(severity: Severity): string {
    switch (severity) {
      case 'error': return '#ff3b30';
      case 'warning': return '#ffcc00';
      default: return '#007aff';
    }
  }

  function getStatusLabel(severity: Severity | 'ok'): string {
    switch (severity) {
      case 'error': return 'Issues Detected';
      case 'warning': return 'Warnings';
      case 'info': return 'Info';
      default: return 'All Systems OK';
    }
  }

  function formatTime(ts: number): string {
    const date = new Date(ts);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }).toLowerCase();
  }

  // Recent resolved issues for history
  $: recentIssues = issueActions.listRecent(5);
</script>

<svelte:window on:keydown={handleKeydown} />

{#if $statusDrawerOpen}
  <!-- Backdrop -->
  <div
    class="drawer-backdrop"
    on:click={handleBackdropClick}
    on:keydown={handleKeydown}
    role="button"
    tabindex="-1"
    aria-label="Close drawer"
  >
    <!-- Drawer panel -->
    <div class="drawer-panel" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <!-- Header -->
      <div class="drawer-header">
        <div class="header-status">
          <span
            class="status-indicator"
            style="background-color: {$highestSeverity === 'ok' ? '#34c759' : getSeverityColor($highestSeverity as Severity)}"
          ></span>
          <h2 id="drawer-title" class="header-title">{getStatusLabel($highestSeverity)}</h2>
        </div>
        <button class="close-btn" on:click={closeDrawer} aria-label="Close">
          <Icon name="x" size={24} />
        </button>
      </div>

      <!-- Summary counts -->
      {#if $issueCounts.total > 0}
        <div class="summary-counts">
          {#if $issueCounts.error > 0}
            <span class="count-badge error">
              <Icon name="x-circle" size={14} />
              {$issueCounts.error} Error{$issueCounts.error > 1 ? 's' : ''}
            </span>
          {/if}
          {#if $issueCounts.warning > 0}
            <span class="count-badge warning">
              <Icon name="alert-triangle" size={14} />
              {$issueCounts.warning} Warning{$issueCounts.warning > 1 ? 's' : ''}
            </span>
          {/if}
          {#if $issueCounts.info > 0}
            <span class="count-badge info">
              <Icon name="info" size={14} />
              {$issueCounts.info} Info
            </span>
          {/if}
        </div>
      {/if}

      <!-- Content -->
      <div class="drawer-content">
        {#if $activeIssuesList.length === 0}
          <!-- All OK state -->
          <div class="empty-state">
            <div class="ok-icon">
              <Icon name="check-circle" size={48} />
            </div>
            <p class="ok-text">No active issues</p>
            <p class="ok-subtext">Your system is running smoothly</p>
          </div>
        {:else}
          <!-- Active issues list -->
          <div class="issues-section">
            <h3 class="section-title">Active Issues</h3>
            <div class="issues-list">
              {#each $activeIssuesList as issue (issue.id)}
                <div class="issue-item" class:error={issue.severity === 'error'} class:warning={issue.severity === 'warning'}>
                  <div class="issue-icon" style="color: {getSeverityColor(issue.severity)}">
                    <Icon name={getIcon(issue.severity)} size={20} />
                  </div>
                  <div class="issue-content">
                    <div class="issue-header">
                      <span class="issue-title">{issue.title}</span>
                      <span class="issue-time">{formatTime(issue.ts)}</span>
                    </div>
                    {#if issue.detail}
                      <p class="issue-detail">{issue.detail}</p>
                    {/if}
                    {#if issue.actions && issue.actions.length > 0}
                      <div class="issue-actions">
                        {#each issue.actions as action}
                          <button class="action-btn" on:click={() => handleAction(action.actionId)}>
                            {action.label}
                          </button>
                        {/each}
                      </div>
                    {/if}
                  </div>
                  {#if !issue.persistent}
                    <button class="dismiss-btn" on:click={() => dismissIssue(issue)} aria-label="Dismiss">
                      <Icon name="x" size={16} />
                    </button>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        <!-- Quick actions -->
        <div class="quick-actions">
          <button class="quick-action-btn" on:click={() => handleAction('open-settings')}>
            <Icon name="settings" size={18} />
            <span>Open Settings</span>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .drawer-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    display: flex;
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .drawer-panel {
    width: 380px;
    max-width: 90vw;
    height: 100%;
    background: rgba(30, 30, 35, 0.95);
    backdrop-filter: blur(20px) saturate(150%);
    -webkit-backdrop-filter: blur(20px) saturate(150%);
    border-right: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    flex-direction: column;
    animation: slideIn 0.25s ease-out;
    box-shadow: 4px 0 24px rgba(0, 0, 0, 0.3);
  }

  @keyframes slideIn {
    from { transform: translateX(-100%); }
    to { transform: translateX(0); }
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .header-status {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .status-indicator {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    box-shadow: 0 0 8px currentColor;
  }

  .header-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0;
  }

  .close-btn {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    color: var(--color-text-primary);
    cursor: pointer;
    transition: all 0.2s;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.15);
  }

  .close-btn:active {
    transform: scale(0.95);
  }

  .summary-counts {
    display: flex;
    gap: 8px;
    padding: 12px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .count-badge {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
  }

  .count-badge.error {
    background: rgba(255, 59, 48, 0.2);
    color: #ff6961;
  }

  .count-badge.warning {
    background: rgba(255, 204, 0, 0.2);
    color: #ffcc00;
  }

  .count-badge.info {
    background: rgba(0, 122, 255, 0.2);
    color: #5ac8fa;
  }

  .drawer-content {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 40px 20px;
    text-align: center;
  }

  .ok-icon {
    color: #34c759;
    margin-bottom: 16px;
  }

  .ok-text {
    font-size: 18px;
    font-weight: 600;
    color: var(--color-text-primary);
    margin: 0 0 4px;
  }

  .ok-subtext {
    font-size: 14px;
    color: var(--color-text-secondary);
    margin: 0;
  }

  .issues-section {
    margin-bottom: 20px;
  }

  .section-title {
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--color-text-tertiary);
    margin: 0 0 12px;
  }

  .issues-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .issue-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    border-left: 3px solid transparent;
  }

  .issue-item.error {
    border-left-color: #ff3b30;
    background: rgba(255, 59, 48, 0.08);
  }

  .issue-item.warning {
    border-left-color: #ffcc00;
    background: rgba(255, 204, 0, 0.08);
  }

  .issue-icon {
    flex-shrink: 0;
    margin-top: 2px;
  }

  .issue-content {
    flex: 1;
    min-width: 0;
  }

  .issue-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .issue-title {
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-primary);
  }

  .issue-time {
    font-size: 11px;
    color: var(--color-text-tertiary);
    flex-shrink: 0;
  }

  .issue-detail {
    font-size: 12px;
    color: var(--color-text-secondary);
    margin: 4px 0 0;
    line-height: 1.4;
  }

  .issue-actions {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }

  .action-btn {
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 500;
    color: var(--color-accent);
    background: rgba(0, 122, 255, 0.15);
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-btn:hover {
    background: rgba(0, 122, 255, 0.25);
  }

  .action-btn:active {
    transform: scale(0.97);
  }

  .dismiss-btn {
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--color-text-tertiary);
    cursor: pointer;
    opacity: 0.6;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .dismiss-btn:hover {
    opacity: 1;
    background: rgba(255, 255, 255, 0.1);
  }

  .quick-actions {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-top: 16px;
    margin-top: auto;
  }

  .quick-action-btn {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 12px 16px;
    font-size: 14px;
    font-weight: 500;
    color: var(--color-text-primary);
    background: rgba(255, 255, 255, 0.08);
    border: none;
    border-radius: 12px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .quick-action-btn:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  .quick-action-btn:active {
    transform: scale(0.98);
  }

  /* LCD mode adjustments */
  @media (max-height: 500px) {
    .drawer-panel {
      width: 350px;
    }

    .drawer-header {
      padding: 12px 16px;
    }

    .header-title {
      font-size: 16px;
    }

    .drawer-content {
      padding: 12px 16px;
    }

    .empty-state {
      padding: 20px;
    }

    .issue-item {
      padding: 10px;
    }
  }
</style>
