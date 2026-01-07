/**
 * Control D Quick Switcher - Constants
 *
 * Centralized configuration and constant values for the extension.
 */

// =============================================================================
// Rule Actions
// =============================================================================

/**
 * Rule action types supported by Control D API
 */
const RuleAction = {
    BLOCK: 0,      // Block the domain completely
    BYPASS: 1,     // Bypass filtering for the domain
    REDIRECT: 3    // Redirect traffic through a proxy
};

/**
 * Human-readable labels for rule actions
 */
const RuleActionLabels = {
    [RuleAction.BLOCK]: 'Block',
    [RuleAction.BYPASS]: 'Bypass',
    [RuleAction.REDIRECT]: 'Redirect'
};

// =============================================================================
// API Configuration
// =============================================================================

/**
 * Control D API endpoints
 */
const API = {
    BASE_URL: 'https://api.controld.com',
    ENDPOINTS: {
        PROXIES: '/proxies',
        RULES: (profileId) => `/profiles/${profileId}/rules`,
        RULE_QUERY: (profileId, hostname) => `/profiles/${profileId}/rules?hostname=${encodeURIComponent(hostname)}`
    }
};

// =============================================================================
// Cache Configuration
// =============================================================================

/**
 * Cache settings for data persistence
 */
const Cache = {
    PROXY_LIST_TTL: 60 * 60 * 1000,  // 1 hour in milliseconds
    PROXY_LIST_KEY: 'cached_proxy_list',
    PROXY_LIST_TIMESTAMP_KEY: 'cached_proxy_list_timestamp'
};

// =============================================================================
// Storage Keys
// =============================================================================

/**
 * Chrome storage keys used throughout the extension
 */
const StorageKeys = {
    API_KEY: 'apiKey',
    PROFILE_ID: 'profileId',
    CACHED_PROXIES: Cache.PROXY_LIST_KEY,
    CACHED_PROXIES_TIMESTAMP: Cache.PROXY_LIST_TIMESTAMP_KEY
};

// =============================================================================
// UI Configuration
// =============================================================================

/**
 * UI timing and display settings
 */
const UI = {
    MESSAGE_TIMEOUT: 3000,           // Message display duration in ms
    PROXY_LOAD_DELAY: 150,           // Delay before loading proxies in ms
    RECHECK_DELAY: 2000,             // Delay before rechecking rule status in ms
    STATUS_COLORS: {
        READY: '#10b981',            // Emerald
        ACTIVE: '#ef4444',           // Red
        TEMPORARY: '#fbbf24'         // Yellow/Amber
    }
};

// =============================================================================
// Error Messages
// =============================================================================

/**
 * Standardized error messages
 */
const ErrorMessages = {
    MISSING_CREDENTIALS: 'Missing API Key or Profile ID. Please configure in settings.',
    INVALID_API_KEY: 'Invalid API Key. Please check your credentials.',
    NETWORK_ERROR: 'Network error. Please check your connection.',
    API_ERROR: 'API error occurred. Please try again.',
    NO_DOMAIN: 'Unable to detect domain from current page.',
    MISSING_PROXY: 'Please select a proxy location for redirect',
    SPECIAL_PAGE: 'Cannot manage rules for this type of page',
    NO_PROXIES: 'No proxies available'
};

// =============================================================================
// HTTP Status Codes
// =============================================================================

/**
 * Common HTTP status codes used in API responses
 */
const HttpStatus = {
    OK: 200,
    CREATED: 201,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    INTERNAL_SERVER_ERROR: 500
};

// =============================================================================
// Logging Configuration
// =============================================================================

/**
 * Logging levels and configuration
 */
const Logging = {
    ENABLED: true,
    PREFIX: '[Control D]',
    LEVELS: {
        ERROR: 'ERROR',
        WARN: 'WARN',
        INFO: 'INFO',
        DEBUG: 'DEBUG'
    }
};

// =============================================================================
// Logger Utility
// =============================================================================

/**
 * Centralized logging utility with consistent formatting
 */
const Logger = {
    /**
     * Log an error message
     * @param {string} context - Where the error occurred
     * @param {string} message - Error message
     * @param {Error|Object} [error] - Error object or additional data
     */
    error: (context, message, error = null) => {
        if (!Logging.ENABLED) return;
        console.error(`${Logging.PREFIX} [${Logging.LEVELS.ERROR}] [${context}]`, message, error || '');
    },

    /**
     * Log a warning message
     * @param {string} context - Where the warning occurred
     * @param {string} message - Warning message
     * @param {Object} [data] - Additional data
     */
    warn: (context, message, data = null) => {
        if (!Logging.ENABLED) return;
        console.warn(`${Logging.PREFIX} [${Logging.LEVELS.WARN}] [${context}]`, message, data || '');
    },

    /**
     * Log an info message
     * @param {string} context - Where the info occurred
     * @param {string} message - Info message
     * @param {Object} [data] - Additional data
     */
    info: (context, message, data = null) => {
        if (!Logging.ENABLED) return;
        console.info(`${Logging.PREFIX} [${Logging.LEVELS.INFO}] [${context}]`, message, data || '');
    },

    /**
     * Log a debug message
     * @param {string} context - Where the debug occurred
     * @param {string} message - Debug message
     * @param {Object} [data] - Additional data
     */
    debug: (context, message, data = null) => {
        if (!Logging.ENABLED) return;
        console.debug(`${Logging.PREFIX} [${Logging.LEVELS.DEBUG}] [${context}]`, message, data || '');
    }
};

// =============================================================================
// Alarm Names
// =============================================================================

/**
 * Chrome alarm name prefixes
 */
const AlarmPrefix = {
    EXPIRE_RULE: 'expire_rule_',
    REAPPLY_RULE: 'reapply_rule_'
};

// =============================================================================
// Validation Patterns
// =============================================================================

/**
 * Regular expressions for validation
 */
const Patterns = {
    PROFILE_ID: /^p\d+$/,            // Profile ID format (e.g., p12345)
    DOMAIN: /^[a-z0-9]+([\-\.]{1}[a-z0-9]+)*\.[a-z]{2,}$/i  // Basic domain validation
};

// =============================================================================
// Export for use in other scripts
// =============================================================================

// All constants are available globally when this script is loaded
