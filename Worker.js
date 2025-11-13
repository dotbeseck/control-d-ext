// Listen for alarms to expire temporary rules and re-apply removed rules
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith('expire_rule_')) {
    const domain = alarm.name.replace('expire_rule_', '');
    removeRule(domain);
  } else if (alarm.name.startsWith('reapply_rule_')) {
    const domain = alarm.name.replace('reapply_rule_', '');
    await reapplyRule(domain);
  }
});

// Function to remove a rule via Control D API
async function removeRule(domain) {
  const data = await chrome.storage.sync.get(['apiKey', 'profileId']);
  const { apiKey, profileId } = data;

  if (!apiKey || !profileId) return;

  try {
    // We need to DELETE the rule. 
    // Control D API typically manages rules via PUT to the rules endpoint with the domain.
    // To "remove" a custom rule, we usually DELETE it.
    // Note: API specifics vary, but based on standard REST patterns for this service:
    
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

  } catch (error) {
    // Error removing rule
  }
}

// Function to re-apply a temporarily removed rule
async function reapplyRule(domain) {
  const data = await chrome.storage.sync.get(['apiKey', 'profileId']);
  const { apiKey, profileId } = data;

  if (!apiKey || !profileId) return;

  try {
    // Get stored rule info
    const ruleKey = `rule_${domain}`;
    const ruleData = await chrome.storage.local.get([ruleKey]);
    const ruleInfo = ruleData[ruleKey];

    if (!ruleInfo) {
      return;
    }

    const { action, proxyId } = ruleInfo;
    
    if (action === null || action === undefined) {
      await chrome.storage.local.remove([ruleKey]);
      return;
    }
    
    // Re-apply the rule
    const url = `https://api.controld.com/profiles/${profileId}/rules`;
    const body = {
      hostnames: [domain],
      do: action
    };

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
      await chrome.storage.local.remove([ruleKey]);
    }
  } catch (error) {
    // Error re-applying rule
  }
}