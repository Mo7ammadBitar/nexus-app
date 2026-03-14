/**
 * Message Link Utilities
 * Parse and generate message links for deep linking
 */

// Unified regex pattern for message links (captures full URL and IDs)
// Supports: nexus://channels/... and http(s)://*/channels/...
export const MESSAGE_LINK_REGEX = /(?:nexus:\/\/|https?:\/\/[^/]+\/)channels\/([a-f0-9]{24})\/([a-f0-9]{24})\/([a-f0-9]{24})/gi;

// Legacy patterns for backwards compatibility
export const MESSAGE_LINK_PATTERNS = [
    /nexus:\/\/channels\/([a-f0-9]{24})\/([a-f0-9]{24})\/([a-f0-9]{24})/gi,
    /https?:\/\/[^/]+\/channels\/([a-f0-9]{24})\/([a-f0-9]{24})\/([a-f0-9]{24})/gi,
];

/**
 * Parse a message link and extract IDs
 * @param {string} text - Text containing the link
 * @returns {Object|null} - { serverId, channelId, messageId } or null
 */
export const parseMessageLink = (text) => {
    for (const pattern of MESSAGE_LINK_PATTERNS) {
        pattern.lastIndex = 0;
        const match = pattern.exec(text);
        if (match) {
            return {
                serverId: match[1],
                channelId: match[2],
                messageId: match[3],
            };
        }
    }
    return null;
};

/**
 * Check if text contains a message link
 * @param {string} text - Text to check
 * @returns {boolean}
 */
export const containsMessageLink = (text) => {
    return MESSAGE_LINK_PATTERNS.some(pattern => {
        pattern.lastIndex = 0;
        return pattern.test(text);
    });
};

/**
 * Parse content and split into text parts and link parts
 * @param {string} content - Message content to parse
 * @returns {Array<{type: 'text'|'link', value: string, linkData?: Object}>}
 */
export const parseContentWithLinks = (content) => {
    if (!content) return [];

    const parts = [];
    const regex = /(?:nexus:\/\/|https?:\/\/[^/]+\/)channels\/([a-f0-9]{24})\/([a-f0-9]{24})\/([a-f0-9]{24})/gi;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(content)) !== null) {
        // Add text before the match
        if (match.index > lastIndex) {
            const textBefore = content.slice(lastIndex, match.index);
            if (textBefore) {
                parts.push({ type: 'text', value: textBefore });
            }
        }

        // Add the link match
        parts.push({
            type: 'link',
            value: match[0],
            linkData: {
                serverId: match[1],
                channelId: match[2],
                messageId: match[3],
                fullUrl: match[0],
            }
        });

        lastIndex = regex.lastIndex;
    }

    // Add remaining text after last match
    if (lastIndex < content.length) {
        const remaining = content.slice(lastIndex);
        if (remaining) {
            parts.push({ type: 'text', value: remaining });
        }
    }

    // If no links found, return the whole content as text
    if (parts.length === 0) {
        parts.push({ type: 'text', value: content });
    }

    return parts;
};

/**
 * Generate a message link
 * @param {string} serverId 
 * @param {string} channelId 
 * @param {string} messageId 
 * @returns {string}
 */
export const generateMessageLink = (serverId, channelId, messageId) => {
    return `${window.location.origin}/channels/${serverId}/${channelId}/${messageId}`;
};

/**
 * Copy text to clipboard
 * @param {string} text 
 * @returns {Promise<boolean>}
 */
export const copyToClipboard = async (text) => {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (err) {
        console.error('Failed to copy to clipboard:', err);
        return false;
    }
};

