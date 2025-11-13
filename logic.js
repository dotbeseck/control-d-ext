document.addEventListener('DOMContentLoaded', async () => {
    // UI Elements
    const views = {
        config: document.getElementById('configSection'),
        main: document.getElementById('mainSection'),
        settingsBtn: document.getElementById('settingsBtn'),
        domain: document.getElementById('currentDomain'),
        status: document.getElementById('statusBadge'), // May not exist in new HTML
        statusDot: document.getElementById('statusDot'),
        statusText: document.getElementById('statusText'),
        applyBtn: document.getElementById('applyBtn'),
        removeBtn: document.getElementById('removeBtn'),
        redirectCountrySection: document.getElementById('redirectCountrySection'),
        inputs: {
            apiKey: document.getElementById('apiKeyInput'),
            profileId: document.getElementById('profileIdInput'),
            duration: document.getElementById('durationSelect'),
            country: document.getElementById('countrySelect')
        },
        message: document.getElementById('message')
    };

    // State
    let currentDomain = '';
    let selectedAction = 1; // Default to Bypass (1)
    let selectedProxy = '';
    let availableProxies = [];
    let hasExistingRule = false; // Track if current domain has an existing rule
    let existingRuleAction = null; // Track what type of rule exists (0=Block, 1=Bypass, 3=Redirect)
    let foundRule = null; // Store the found rule object for deletion

    // 1. Load Settings & Current Tab
    const data = await chrome.storage.sync.get(['apiKey', 'profileId']);
    
    if (data.apiKey) {
        views.inputs.apiKey.value = data.apiKey;
    }
    if (data.profileId) {
        views.inputs.profileId.value = data.profileId;
    }
    
    if (!data.apiKey || !data.profileId) {
        views.config.classList.remove('hidden');
    }
    
    // Initialize button visibility - ensure apply button is visible by default
    if (views.applyBtn) views.applyBtn.classList.remove('hidden');
    if (views.removeBtn) views.removeBtn.classList.add('hidden');

    // Helper: Get base domain (without www)
    function getBaseDomain(domain) {
        if (!domain) return domain;
        // Remove www. prefix if present
        if (domain.startsWith('www.')) {
            return domain.substring(4);
        }
        return domain;
    }
    
    // Helper: Get all domain variations to check (with and without www)
    function getDomainVariations(domain) {
        const variations = [domain];
        const baseDomain = getBaseDomain(domain);
        if (baseDomain !== domain) {
            variations.push(baseDomain);
        } else {
            // If no www, also check with www
            variations.push(`www.${domain}`);
        }
        return variations;
    }

    // Get current tab domain and check for existing rule
    chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
        if (!tabs || tabs.length === 0) {
            views.domain.textContent = "No active tab";
            views.applyBtn.disabled = true;
            return;
        }
        
        const tab = tabs[0];
        
        if (!tab.url) {
            views.domain.textContent = "No URL available";
            views.applyBtn.disabled = true;
            return;
        }
        
        // Check if URL is a special Chrome page that can't be parsed
        if (tab.url.startsWith('chrome://') || 
            tab.url.startsWith('chrome-extension://') || 
            tab.url.startsWith('about:') ||
            tab.url.startsWith('edge://') ||
            tab.url.startsWith('moz-extension://')) {
            views.domain.textContent = "Special page";
            views.applyBtn.disabled = true;
            return;
        }
        
        try {
            const url = new URL(tab.url);
            currentDomain = url.hostname;
            
            if (!currentDomain) {
                throw new Error('No hostname in URL');
            }
            
            views.domain.textContent = currentDomain;
            
            // Update status - check for statusDot instead of status-pulse class
            const statusDot = document.getElementById('statusDot');
            if (statusDot) {
                statusDot.style.backgroundColor = '#10b981';
            }
            
            if (views.statusText) {
                views.statusText.textContent = "Ready";
            }
            
            // Check if domain has an existing rule
            await checkExistingRule();
        } catch (e) {
            views.domain.textContent = `Invalid URL: ${tab.url.substring(0, 30)}...`;
            views.applyBtn.disabled = true;
        }
    });

    // Load available proxies
    async function loadProxies() {
        const storedData = await chrome.storage.sync.get(['apiKey']);
        const apiKey = storedData.apiKey?.trim();
        
        if (!apiKey) {
            const select = document.getElementById('countrySelect');
            if (select) {
                select.innerHTML = '<option value="">API Key required</option>';
            }
            return;
        }
        
        const select = document.getElementById('countrySelect');
        if (!select) return;
        
        select.innerHTML = '<option value="">Loading proxies...</option>';
        select.disabled = true;
        
        try {
            const res = await fetch('https://api.controld.com/proxies', {
                headers: {
                    'Authorization': `Bearer ${apiKey}`
                }
            });
            
            if (res.ok) {
                let data;
                try {
                    data = JSON.parse(await res.text());
                } catch (parseErr) {
                    throw new Error(`Invalid JSON response: ${parseErr.message}`);
                }
                
                // Try multiple possible response structures
                if (data.body) {
                    if (data.body.proxies && Array.isArray(data.body.proxies)) {
                        availableProxies = data.body.proxies;
                    } else if (Array.isArray(data.body)) {
                        availableProxies = data.body;
                    } else if (data.body && typeof data.body === 'object') {
                        for (const key in data.body) {
                            if (Array.isArray(data.body[key])) {
                                availableProxies = data.body[key];
                                break;
                            }
                        }
                    }
                } else if (Array.isArray(data)) {
                    availableProxies = data;
                } else if (data.data && Array.isArray(data.data)) {
                    availableProxies = data.data;
                } else {
                    availableProxies = [];
                }
                
                if (availableProxies.length > 0) {
                    populateProxySelect();
                } else {
                    select.innerHTML = '<option value="">No proxies available</option>';
                }
                
                select.disabled = false;
            } else {
                select.innerHTML = `<option value="">Failed to load proxies (${res.status})</option>`;
                select.disabled = false;
            }
        } catch (err) {
            const select = document.getElementById('countrySelect');
            if (select) {
                const errorMsg = err.message || 'Unknown error';
                select.innerHTML = `<option value="">Error: ${errorMsg}</option>`;
                select.disabled = false;
            }
        }
    }
    
    // Populate proxy select dropdown
    function populateProxySelect() {
        const select = document.getElementById('countrySelect');
        if (!select) return;
        
        select.innerHTML = '<option value="">Select Proxy Location</option>';
        
        if (availableProxies.length === 0) {
            select.innerHTML = '<option value="">No proxies available</option>';
            return;
        }
        
        availableProxies.forEach((proxy) => {
            const proxyId = proxy.PK || proxy.uid || proxy.id || proxy.identifier || 
                           proxy._id || proxy.code || proxy.iata || proxy.proxy_id || 
                           proxy.proxyId || proxy.proxy;
            
            if (!proxyId) return;
            
            const city = proxy.city || proxy.name || proxy.location || proxy.label || proxy.city_name;
            const country = proxy.country_name || proxy.country || proxy.countryName || proxy.country_code;
            
            const option = document.createElement('option');
            option.value = proxyId;
            
            let displayText = 'Unknown Proxy';
            if (city && country && proxyId) {
                displayText = `${city} (${country}) - ${proxyId.toUpperCase()}`;
            } else if (city && proxyId) {
                displayText = `${city} - ${proxyId.toUpperCase()}`;
            } else {
                displayText = `${proxyId.toUpperCase()}`;
            }
            
            option.textContent = displayText;
            select.appendChild(option);
        });
        
        if (select.options.length === 1) {
            select.innerHTML = '<option value="">No valid proxy IDs found</option>';
        }
    }
    
    // Event Listeners
    views.settingsBtn.addEventListener('click', () => {
        views.config.classList.toggle('hidden');
    });

    document.getElementById('saveApiKeyBtn').addEventListener('click', async () => {
        const apiKey = views.inputs.apiKey.value.trim();
        
        if (!apiKey) {
            showMessage("Please enter an API Key", "text-red-300");
            return;
        }
        
        await chrome.storage.sync.set({ apiKey });
        showMessage("API Key saved!", "text-emerald-300");
        // Reload proxies if redirect section is visible
        if (!views.redirectCountrySection.classList.contains('hidden')) {
            loadProxies();
        }
    });

    document.getElementById('saveProfileIdBtn').addEventListener('click', async () => {
        const profileId = views.inputs.profileId.value.trim();
        
        if (!profileId) {
            showMessage("Please enter a Profile ID", "text-red-300");
            return;
        }
        
        await chrome.storage.sync.set({ profileId });
        showMessage("Profile ID saved!", "text-emerald-300");
    });

    // Action Selection (Block/Bypass/Redirect)
    // No default highlighting on load - buttons only highlight on click or hover
    
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remove active class from all buttons
            document.querySelectorAll('.action-btn').forEach(b => {
                b.classList.remove('active');
            });
            
            // Add active class to clicked button
            e.target.classList.add('active');
            
            selectedAction = parseInt(e.target.dataset.action);
            
            if (selectedAction === 3) {
                views.redirectCountrySection.classList.remove('hidden');
                setTimeout(() => {
                    const select = document.getElementById('countrySelect');
                    if (select && availableProxies.length === 0) {
                        loadProxies();
                    } else if (select && availableProxies.length > 0) {
                        populateProxySelect();
                    }
                }, 150);
            } else {
                views.redirectCountrySection.classList.add('hidden');
            }
        });
    });

    // Proxy selection
    views.inputs.country.addEventListener('change', (e) => {
        selectedProxy = e.target.value;
    });

    // Apply Rule
    views.applyBtn.addEventListener('click', async () => {
        if (!currentDomain) return;
        
        const duration = parseInt(views.inputs.duration.value);
        
        const storedData = await chrome.storage.sync.get(['apiKey', 'profileId']);
        const apiKey = storedData.apiKey?.trim();
        const profileId = storedData.profileId?.trim();

        if (!apiKey || !profileId) {
            showMessage("Missing API Key or Profile ID. Please configure in settings.", "text-red-300");
            views.config.classList.remove('hidden');
            return;
        }

        views.applyBtn.textContent = "Applying...";
        views.applyBtn.disabled = true;

        try {
            let redirectProxyId = null;
            if (selectedAction === 3) {
                const selectValue = views.inputs.country.value?.trim();
                redirectProxyId = selectValue || selectedProxy?.trim() || null;
                
                if (!redirectProxyId) {
                    showMessage("Please select a proxy location for redirect", "text-red-300");
                    views.applyBtn.textContent = "Apply Rule";
                    views.applyBtn.disabled = false;
                    return;
                }
            }
            
            const result = await updateControlDRule(apiKey, profileId, currentDomain, selectedAction, redirectProxyId);
            
            if (result.success) {
                showMessage("Rule updated successfully!", "text-emerald-300");
                
                // Update status dot
                if (duration > 0) {
                    if (views.statusDot) {
                        views.statusDot.style.backgroundColor = '#fbbf24'; // yellow
                        views.statusDot.classList.add('pulse');
                    }
                    if (views.statusText) views.statusText.textContent = `Expires in ${duration}m`;
                    chrome.alarms.create(`expire_rule_${currentDomain}`, {
                        delayInMinutes: duration
                    });
                } else {
                    if (views.statusDot) {
                        views.statusDot.style.backgroundColor = '#10b981'; // emerald
                        views.statusDot.classList.remove('pulse');
                    }
                    if (views.statusText) views.statusText.textContent = 'Permanent Rule Set';
                }
            } else {
                showMessage(result.error || "API Error. Check credentials.", "text-red-300");
            }
            
            // Refresh rule status after applying
            await checkExistingRule();
        } catch (err) {
            showMessage(`Network Error: ${err.message}`, "text-red-300");
        } finally {
            views.applyBtn.textContent = "Apply Rule";
            views.applyBtn.disabled = false;
        }
    });

    // Remove Rule
    views.removeBtn?.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (!currentDomain) return;
        
        const duration = parseInt(views.inputs.duration.value);
        
        const storedData = await chrome.storage.sync.get(['apiKey', 'profileId']);
        const apiKey = storedData.apiKey?.trim();
        const profileId = storedData.profileId?.trim();

        if (!apiKey || !profileId) {
            showMessage("Missing API Key or Profile ID. Please configure in settings.", "text-red-300");
            views.config.classList.remove('hidden');
            return;
        }

        views.removeBtn.textContent = "Removing...";
        views.removeBtn.disabled = true;

        try {
            const result = await removeControlDRule(apiKey, profileId, currentDomain, duration);
            
            if (result.success) {
                if (duration > 0) {
                    showMessage(`Rule removed! Will re-apply in ${duration} minutes.`, "text-emerald-300");
                    
                    chrome.alarms.create(`reapply_rule_${currentDomain}`, {
                        delayInMinutes: duration
                    });
                    
                    const ruleAction = existingRuleAction !== null && existingRuleAction !== undefined ? existingRuleAction : null;
                    
                    if (ruleAction === null) {
                        showMessage("Warning: Could not detect rule type. Rule will be permanently removed.", "text-yellow-300");
                    }
                    
                    await chrome.storage.local.set({
                        [`rule_${currentDomain}`]: {
                            action: ruleAction,
                            proxyId: selectedProxy,
                            timestamp: Date.now()
                        }
                    });
                } else {
                    showMessage("Rule removed permanently!", "text-emerald-300");
                }
                
                // Update status display
                if (duration > 0) {
                    if (views.statusDot) {
                        views.statusDot.style.backgroundColor = '#fbbf24';
                        views.statusDot.classList.add('pulse');
                    }
                    if (views.statusText) views.statusText.textContent = `Removed (re-applies in ${duration}m)`;
                } else {
                    if (views.statusDot) {
                        views.statusDot.style.backgroundColor = '#10b981';
                        views.statusDot.classList.remove('pulse');
                    }
                    if (views.statusText) views.statusText.textContent = 'Rule Removed';
                }
                
                setTimeout(async () => {
                    await checkExistingRule();
                    
                    if (hasExistingRule) {
                        showMessage("Warning: Rule may still be active. Please check Control-D dashboard.", "text-yellow-300");
                    }
                }, 2000);
            } else {
                showMessage(result.error || "API Error. Check credentials.", "text-red-300");
            }
        } catch (err) {
            showMessage(`Network Error: ${err.message}`, "text-red-300");
        } finally {
            views.removeBtn.textContent = "Remove Rule";
            views.removeBtn.disabled = false;
        }
    });

    // Check if domain has an existing rule
    async function checkExistingRule() {
        if (!currentDomain) return;
        
        const storedData = await chrome.storage.sync.get(['apiKey', 'profileId']);
        const apiKey = storedData.apiKey?.trim();
        const profileId = storedData.profileId?.trim();
        
        if (!apiKey || !profileId) {
            return; // Can't check without credentials
        }
        
        try {
            const domainVariations = getDomainVariations(currentDomain);
            
            foundRule = null;
            let checkedDomain = null;
            
            for (const domainVar of domainVariations) {
                const url = `https://api.controld.com/profiles/${profileId}/rules?hostname=${encodeURIComponent(domainVar)}`;
                
                const res = await fetch(url, {
                    headers: {
                        'Authorization': `Bearer ${apiKey}`
                    }
                });
                
                if (res.ok) {
                    const data = await res.json();
                    const rules = data.body?.rules || data.body || data.rules || data;
                    
                    if (Array.isArray(rules) && rules.length > 0) {
                        foundRule = rules.find(r => {
                            const hostnames = r.hostnames || (r.hostname ? [r.hostname] : []);
                            const rulePK = r.PK || r.hostname;
                            return domainVariations.some(dv => 
                                hostnames.includes(dv) || 
                                r.hostname === dv || 
                                rulePK === dv ||
                                (rulePK && domainVariations.some(d => rulePK === d))
                            );
                        });
                        
                        if (foundRule) {
                            checkedDomain = domainVar;
                            break;
                        }
                    } else if (rules && typeof rules === 'object' && Object.keys(rules).length > 0) {
                        for (const key of Object.keys(rules)) {
                            const rule = rules[key];
                            const hostnames = rule.hostnames || (rule.hostname ? [rule.hostname] : []);
                            const rulePK = rule.PK || rule.hostname;
                            
                            if (domainVariations.some(dv => 
                                hostnames.includes(dv) || 
                                rule.hostname === dv || 
                                rulePK === dv ||
                                (rulePK && domainVariations.some(d => rulePK === d))
                            )) {
                                foundRule = rule;
                                checkedDomain = domainVar;
                                break;
                            }
                        }
                        if (foundRule) break;
                    }
                }
            }
            
            if (foundRule) {
                if (foundRule.action?.do !== undefined) {
                    existingRuleAction = foundRule.action.do;
                } else if (foundRule.do !== undefined) {
                    existingRuleAction = typeof foundRule.do === 'number' ? foundRule.do : 
                                       (foundRule.do?.value !== undefined ? foundRule.do.value : null);
                } else if (foundRule.action !== undefined) {
                    existingRuleAction = typeof foundRule.action === 'number' ? foundRule.action : 
                                       (foundRule.action?.value !== undefined ? foundRule.action.value : null);
                } else {
                    existingRuleAction = null;
                }
                
                hasExistingRule = true;
            } else {
                hasExistingRule = false;
                existingRuleAction = null;
                foundRule = null;
            }
            
            updateUIForRuleStatus();
        } catch (err) {
            hasExistingRule = false;
            updateUIForRuleStatus();
        }
    }
    
    // Update UI based on whether rule exists
    function updateUIForRuleStatus() {
        if (!views.applyBtn || !views.removeBtn) return;
        
        if (hasExistingRule) {
            views.applyBtn.classList.add('hidden');
            views.removeBtn.classList.remove('hidden');
            if (views.statusText) {
                views.statusText.textContent = "Rule Active";
            }
            if (views.statusDot) {
                views.statusDot.style.backgroundColor = '#ef4444';
                views.statusDot.classList.add('pulse');
            }
        } else {
            views.applyBtn.classList.remove('hidden');
            views.removeBtn.classList.add('hidden');
            if (views.statusText) {
                views.statusText.textContent = "Ready";
            }
            if (views.statusDot) {
                views.statusDot.style.backgroundColor = '#10b981';
                views.statusDot.classList.remove('pulse');
            }
        }
    }
    
    // Remove rule via API
    async function removeControlDRule(key, profile, domain, duration = 0) {
        const url = `https://api.controld.com/profiles/${profile}/rules`;
        const domainVariations = getDomainVariations(domain);
        
        let domainsToTry = domainVariations;
        if (foundRule && foundRule.PK) {
            domainsToTry = [foundRule.PK, ...domainVariations.filter(d => d !== foundRule.PK)];
        }
        
        try {
            for (const domainVar of domainsToTry) {
                let res = await fetch(url, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${key}`
                    },
                    body: JSON.stringify({
                        hostnames: [domainVar]
                    })
                });
            
                const responseClone = res.clone();
                let responseData;
                try {
                    responseData = await res.json();
                } catch (parseErr) {
                    try {
                        await responseClone.text();
                        continue;
                    } catch (textErr) {
                        continue;
                    }
                }
                
                if (res.ok && responseData.success !== false) {
                    return { success: true };
                }
            }
            
            return await removeRuleViaBypass(key, profile, domain, domainVariations);
            
        } catch (err) {
            return await removeRuleViaBypass(key, profile, domain, domainVariations);
        }
    }
    
    // Alternative: Remove rule by setting it to Bypass (action 1)
    async function removeRuleViaBypass(key, profile, domain, domainVariations = null) {
        const url = `https://api.controld.com/profiles/${profile}/rules`;
        const domainsToBypass = domainVariations || [domain];
        
        const body = {
            hostnames: domainsToBypass,
            do: 1
        };
        
        try {
            let res = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                body: JSON.stringify(body)
            });
            
            const responseClone = res.clone();
            let responseData;
            try {
                responseData = await res.json();
            } catch (parseErr) {
                try {
                    const textResponse = await responseClone.text();
                    return { 
                        success: false, 
                        error: `Invalid response format: ${textResponse.substring(0, 100)}` 
                    };
                } catch (textErr) {
                    return { 
                        success: false, 
                        error: `HTTP ${res.status}: ${res.statusText} (Could not parse response)` 
                    };
                }
            }
            
            if (!res.ok || (responseData.success === false)) {
                let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
                
                if (responseData.error) {
                    if (typeof responseData.error === 'string') {
                        errorMessage = responseData.error;
                    } else if (responseData.error.message) {
                        errorMessage = responseData.error.message;
                        if (responseData.error.code) {
                            errorMessage += ` (Code: ${responseData.error.code})`;
                        }
                    } else {
                        errorMessage = JSON.stringify(responseData.error);
                    }
                } else if (responseData.message) {
                    errorMessage = responseData.message;
                } else if (responseData.detail) {
                    errorMessage = responseData.detail;
                } else if (typeof responseData === 'string') {
                    errorMessage = responseData;
                } else {
                    errorMessage = JSON.stringify(responseData).substring(0, 200);
                }
                
                return { success: false, error: errorMessage };
            }
            
            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    // Helper: Update Rule via API
    async function updateControlDRule(key, profile, domain, action, proxyId = null) {
        const url = `https://api.controld.com/profiles/${profile}/rules`;
        
        const body = {
            hostnames: [domain],
            do: action
        };
        
        if (action === 3 && proxyId) {
            body.via = proxyId;
        }

        try {
            let res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${key}`
                },
                body: JSON.stringify(body)
            });

            const postResponseClone = res.clone();
            let responseData;
            let shouldTryPut = false;
            
            try {
                responseData = await res.json();
                
                if (res.ok && responseData.success !== false) {
                    return { success: true };
                }
                
                const errorCode = responseData.error?.code;
                const errorMessage = responseData.error?.message?.toLowerCase() || '';
                
                if (errorCode === 40003 || 
                    errorMessage.includes('already exists') || 
                    errorMessage.includes('exist') ||
                    res.status === 409) {
                    shouldTryPut = true;
                }
            } catch (parseErr) {
                shouldTryPut = true;
            }

            if (shouldTryPut || (!res.ok && res.status !== 200 && res.status !== 201)) {
                res = await fetch(url, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${key}`
                    },
                    body: JSON.stringify(body)
                });
            }

            const responseClone = res.clone();
            try {
                responseData = await res.json();
            } catch (parseErr) {
                try {
                    const textResponse = await responseClone.text();
                    return { 
                        success: false, 
                        error: `Invalid response format: ${textResponse.substring(0, 100)}` 
                    };
                } catch (textErr) {
                    return { 
                        success: false, 
                        error: `HTTP ${res.status}: ${res.statusText} (Could not parse response)` 
                    };
                }
            }

            if (!res.ok || (responseData.success === false)) {
                let errorMessage = `HTTP ${res.status}: ${res.statusText}`;
                
                if (responseData.error) {
                    if (typeof responseData.error === 'string') {
                        errorMessage = responseData.error;
                    } else if (responseData.error.message) {
                        errorMessage = responseData.error.message;
                        if (responseData.error.code) {
                            errorMessage += ` (Code: ${responseData.error.code})`;
                        }
                    } else {
                        errorMessage = JSON.stringify(responseData.error);
                    }
                } else if (responseData.message) {
                    errorMessage = responseData.message;
                } else if (responseData.detail) {
                    errorMessage = responseData.detail;
                } else if (typeof responseData === 'string') {
                    errorMessage = responseData;
                } else {
                    errorMessage = JSON.stringify(responseData).substring(0, 200);
                }
                
                return { success: false, error: errorMessage };
            }

            return { success: true };
        } catch (err) {
            return { success: false, error: err.message };
        }
    }

    function showMessage(text, colorClass) {
        if (views.message) {
            views.message.textContent = text;
            views.message.className = `mt-5 text-center text-xs h-5 font-medium ${colorClass}`;
            setTimeout(() => {
                if (views.message) {
                    views.message.textContent = '';
                    views.message.className = 'mt-5 text-center text-xs h-5 font-medium';
                }
            }, 3000);
        }
    }
});
