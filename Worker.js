/**
 * Control D Quick Switcher - Background Service Worker
 *
 * Handles:
 * - Temporary rule expiration via Chrome alarms
 * - Rule re-application after temporary removal
 * - Background API interactions
 */

// Simple logger for service worker (constants.js not available in service worker context)
const log = {
  info: (context, message, data) => console.info(`[Control D] [INFO] [${context}]`, message, data || ''),
  error: (context, message, error) => console.error(`[Control D] [ERROR] [${context}]`, message, error || ''),
  warn: (context, message, data) => console.warn(`[Control D] [WARN] [${context}]`, message, data || '')
};

// Listen for alarms to expire temporary rules and re-apply removed rules
chrome.alarms.onAlarm.addListener(async (alarm) => {
  log.info('AlarmListener', 'Alarm triggered', { name: alarm.name });

  if (alarm.name.startsWith('expire_rule_')) {
    const domain = alarm.name.replace('expire_rule_', '');
    log.info('AlarmListener', 'Expiring rule for domain', { domain });
    await removeRule(domain);
  } else if (alarm.name.startsWith('reapply_rule_')) {
    const domain = alarm.name.replace('reapply_rule_', '');
    log.info('AlarmListener', 'Re-applying rule for domain', { domain });
    await reapplyRule(domain);
  }
});

// Function to remove a rule via Control D API
async function removeRule(domain) {
  const data = await chrome.storage.sync.get(['apiKey', 'profileId']);
  const { apiKey, profileId } = data;

  if (!apiKey || !profileId) {
    log.warn('removeRule', 'Missing credentials, cannot remove rule', { domain });
    return;
  }

  try {
    log.info('removeRule', 'Attempting to remove rule', { domain, profileId });

    const response = await fetch(`https://api.controld.com/profiles/${profileId}/rules`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        hostnames: [domain]
      })
    });

    if (response.ok) {
      log.info('removeRule', 'Rule removed successfully', { domain, status: response.status });
    } else {
      log.error('removeRule', 'Failed to remove rule', {
        domain,
        status: response.status,
        statusText: response.statusText
      });
    }
  } catch (error) {
    log.error('removeRule', 'Error removing rule', { domain, error: error.message });
  }
}

// Function to re-apply a temporarily removed rule
async function reapplyRule(domain) {
  const data = await chrome.storage.sync.get(['apiKey', 'profileId']);
  const { apiKey, profileId } = data;

  if (!apiKey || !profileId) {
    log.warn('reapplyRule', 'Missing credentials, cannot re-apply rule', { domain });
    return;
  }

  try {
    // Get stored rule info
    const ruleKey = `rule_${domain}`;
    const ruleData = await chrome.storage.local.get([ruleKey]);
    const ruleInfo = ruleData[ruleKey];

    if (!ruleInfo) {
      log.warn('reapplyRule', 'No stored rule info found', { domain, ruleKey });
      return;
    }

    const { action, proxyId } = ruleInfo;

    if (action === null || action === undefined) {
      log.warn('reapplyRule', 'Invalid action in stored rule, removing', { domain, ruleInfo });
      await chrome.storage.local.remove([ruleKey]);
      return;
    }

    log.info('reapplyRule', 'Re-applying rule', { domain, action, proxyId });

    // Re-apply the rule
    const url = `https://api.controld.com/profiles/${profileId}/rules`;
    const body = {
      hostnames: [domain],
      do: action
    };

    // Action 3 = Redirect (requires proxy ID)
    if (action === 3 && proxyId) {
      body.via = proxyId;
    }

    // Try POST first, then PUT
    let response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(body)
    });

    // If POST fails, try PUT
    if (!response.ok) {
      log.info('reapplyRule', 'POST failed, trying PUT', {
        domain,
        postStatus: response.status
      });

      response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(body)
      });
    }

    if (response.ok) {
      log.info('reapplyRule', 'Rule re-applied successfully', {
        domain,
        action,
        status: response.status
      });
      await chrome.storage.local.remove([ruleKey]);
    } else {
      log.error('reapplyRule', 'Failed to re-apply rule', {
        domain,
        action,
        status: response.status,
        statusText: response.statusText
      });
    }
  } catch (error) {
    log.error('reapplyRule', 'Error re-applying rule', {
      domain,
      error: error.message
    });
  }
}