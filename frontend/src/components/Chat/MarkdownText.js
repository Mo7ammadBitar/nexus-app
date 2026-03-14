import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Text, View, StyleSheet } from 'react-native-web';
import { parseContentWithLinks, containsMessageLink } from '../../utils/messageLinkUtils';
import MessageLinkPreview from './MessageLinkPreview';

/**
 * MarkdownText - Renders markdown content with chat-friendly styling
 * Supports: **bold**, *italic*, `inline code`, ```code blocks```, and message link previews
 */
const MarkdownText = ({ children, style }) => {
    if (!children) return null;

    // Check if content contains message links
    const hasLinks = containsMessageLink(children);

    if (hasLinks) {
        // Parse content and split into text/link parts
        const parts = parseContentWithLinks(children);

        return (
            <div style={styles.container}>
                {parts.map((part, index) => {
                    if (part.type === 'link') {
                        // Render message link preview
                        return (
                            <MessageLinkPreview
                                key={`link-${index}`}
                                linkData={part.linkData}
                            />
                        );
                    }
                    // Render regular text through markdown
                    return (
                        <div key={`text-${index}`}>
                            <ReactMarkdown
                                components={markdownComponents(style)}
                            >
                                {part.value}
                            </ReactMarkdown>
                        </div>
                    );
                })}
            </div>
        );
    }

    // No links - render normally through markdown
    return (
        <div>
            <ReactMarkdown components={markdownComponents(style)}>
                {children}
            </ReactMarkdown>
        </div>
    );
};

// Extracted markdown components for reuse
const markdownComponents = (customStyle) => ({
    // Paragraph wrapper
    p: ({ children }) => (
        <Text style={[styles.text, customStyle]}>{children}</Text>
    ),
    // Bold text
    strong: ({ children }) => (
        <Text style={styles.bold}>{children}</Text>
    ),
    // Italic text
    em: ({ children }) => (
        <Text style={styles.italic}>{children}</Text>
    ),
    // Inline code
    code: ({ inline, children }) => {
        if (inline) {
            return (
                <Text style={styles.inlineCode}>{children}</Text>
            );
        }
        // Code block
        return (
            <View style={styles.codeBlock}>
                <Text style={styles.codeBlockText}>{children}</Text>
            </View>
        );
    },
    // Code block wrapper (pre tag)
    pre: ({ children }) => (
        <View style={styles.codeBlock}>{children}</View>
    ),
});

const styles = StyleSheet.create({
    container: {
        flexDirection: 'column',
    },
    text: {
        color: '#b4b4b4',
        fontSize: 14,
        lineHeight: 20,
    },
    bold: {
        fontWeight: '700',
        color: '#e0e0e0',
    },
    italic: {
        fontStyle: 'italic',
        color: '#c0c0c0',
    },
    inlineCode: {
        fontFamily: 'Consolas, Monaco, "Courier New", monospace',
        backgroundColor: 'rgba(88, 101, 242, 0.2)',
        color: '#a8b3ff',
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 4,
        fontSize: 13,
    },
    codeBlock: {
        backgroundColor: '#16213e',
        borderRadius: 8,
        padding: 12,
        marginVertical: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    codeBlockText: {
        fontFamily: 'Consolas, Monaco, "Courier New", monospace',
        color: '#a8b3ff',
        fontSize: 13,
        lineHeight: 18,
    },
});

export default MarkdownText;

