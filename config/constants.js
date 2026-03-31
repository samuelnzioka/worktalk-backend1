/**
 * Application Constants
 * Reusable constants across the application
 */

// User Roles
const USER_ROLES = {
    PUBLIC: 'public',
    EMPLOYEE: 'employee',
    COMPANY_ADMIN: 'company_admin',
    ADMIN: 'admin'
};

// Post Types
const POST_TYPES = {
    COMPANY_SPACE: 'company_space',
    PUBLIC_TIMELINE: 'public_timeline'
};

// Post Status
const POST_STATUS = {
    ACTIVE: 'active',
    FLAGGED: 'flagged',
    REMOVED: 'removed'
};

// Verification Methods
const VERIFICATION_METHODS = {
    EMAIL: 'email',
    INVITE_CODE: 'invite_code',
    ADMIN: 'admin'
};

// Available color usernames for employees
const COLOR_USERNAMES = [
    'Crimson', 'Navy', 'Olive', 'Amber', 'Teal', 'Rust', 'Indigo',
    'Scarlet', 'Emerald', 'Azure', 'Violet', 'Sienna', 'Mauve',
    'Coral', 'Cyan', 'Lavender', 'Maroon', 'Bronze', 'Silver',
    'Copper', 'Jade', 'Ruby', 'Sapphire', 'Topaz', 'Onyx', 'Ivory',
    'Plum', 'Sage', 'Apricot', 'Cerulean', 'Fuchsia', 'Mustard',
    'Pewter', 'Slate', 'Taupe', 'Magenta', 'Burgundy', 'Chartreuse',
    'Cobalt', 'Umber', 'Ochre', 'Vermilion', 'Viridian'
];

// Blocked words for public usernames
const BLOCKED_USERNAMES = [
    'admin', 'moderator', 'worktalk', 'support', 'helpdesk',
    'fuck', 'shit', 'bitch', 'asshole', 'dick', 'pussy', 'cunt',
    'nigger', 'faggot', 'tranny', 'kike', 'raghead',
    'safaricom', 'equity', 'kcb', 'kenyaairways', 'airtel', 'kplc',
    'hacker', 'scam', 'fraud', 'spam', 'bot'
];

// Department icon mapping (smart detection)
const DEPARTMENT_ICON_MAP = {
    // Technology & IT
    'engin': '💻', 'tech': '💻', 'it': '💻', 'software': '💻', 'dev': '💻',
    'network': '🌐', 'infrastructure': '🌐', 'sys': '🌐',
    'data': '📊', 'analytics': '📊', 'ai': '📊', 'ml': '📊',
    'cyber': '🔒', 'security': '🔒', 'infosec': '🔒',
    
    // Sales & Marketing
    'sales': '📈', 'revenue': '📈', 'biz': '📈',
    'market': '📢', 'brand': '📢', 'pr': '📢', 'comms': '📢',
    'social': '📱', 'digital': '📱',
    
    // Operations & Logistics
    'oper': '⚙️', 'process': '⚙️',
    'logist': '🚚', 'supply': '🚚', 'warehouse': '🚚', 'inventory': '🚚',
    'product': '📋', 'project': '📋',
    'quality': '✅', 'qa': '✅', 'assurance': '✅',
    
    // Finance & Legal
    'financ': '💰', 'account': '💰', 'audit': '💰',
    'legal': '⚖️', 'compliance': '⚖️', 'risk': '⚖️',
    'procurement': '🛒', 'purchasing': '🛒',
    
    // HR & People
    'hr': '👥', 'human': '👥', 'people': '👥', 'talent': '👥', 'recruit': '👥',
    'training': '📚', 'learning': '📚', 'development': '📚',
    
    // Customer Service
    'customer': '🎧', 'support': '🎧', 'service': '🎧', 'care': '🎧', 'client': '🎧',
    
    // Healthcare
    'medical': '🏥', 'health': '🏥', 'clinical': '🏥', 'nurse': '🏥',
    
    // Education
    'teach': '📖', 'educat': '📖', 'academic': '📖', 'train': '📖',
    
    // Manufacturing
    'manufact': '🏭', 'prod': '🏭', 'factory': '🏭', 'assembly': '🏭',
    
    // Aviation
    'cabin': '✈️', 'crew': '✈️', 'flight': '✈️',
    'pilot': '🛫', 'cockpit': '🛫',
    'ground': '🛬', 'ramp': '🛬',
    'cargo': '📦',
    'maintenance': '🔧', 'mro': '🔧',
    
    // Banking
    'bank': '🏦', 'teller': '🏦', 'branch': '🏦',
    'loan': '📄', 'credit': '📄',
    'investment': '📊', 'wealth': '📊',
    
    // Telecommunications
    'telecom': '📡',
    
    // Energy
    'power': '⚡', 'energy': '⚡', 'electric': '⚡'
};

// Company industry icons
const COMPANY_INDUSTRY_ICONS = {
    'Telecommunications': '📱',
    'Banking': '🏦',
    'Finance': '💰',
    'Aviation': '✈️',
    'Energy': '⚡',
    'E-commerce': '🛒',
    'Logistics': '🚚',
    'Technology': '💻',
    'Manufacturing': '🏭',
    'Retail': '🏬',
    'Healthcare': '🏥',
    'Education': '📚',
    'Hospitality': '🏨',
    'Construction': '🏗️',
    'Agriculture': '🌾'
};

module.exports = {
    USER_ROLES,
    POST_TYPES,
    POST_STATUS,
    VERIFICATION_METHODS,
    COLOR_USERNAMES,
    BLOCKED_USERNAMES,
    DEPARTMENT_ICON_MAP,
    COMPANY_INDUSTRY_ICONS
};