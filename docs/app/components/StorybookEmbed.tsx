import React from 'react';

function toKebabCase(str: string) {
    return str
        .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-') // sanitize
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}

function toId(title: string, story: string) {
    // Storybook Title Strategy: Lowercase, non-alphanumeric to hyphen
    // It usually does NOT split camelCase in titles
    const titleId = title
        .toLowerCase()
        .replace(/\//g, '-')
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    // Story Export Strategy: CamelCase to KebabCase
    const storyId = toKebabCase(story);

    return `${titleId}--${storyId}`;
}

interface StorybookEmbedProps {
    title: string;
    story: string;
    width?: string | number;
    height?: string | number;
    viewMode?: 'story' | 'docs';
}

export const StorybookEmbed = ({
    title,
    story,
    width = '100%',
    height = '500px',
    viewMode = 'story',
}: StorybookEmbedProps) => {
    const id = toId(title, story);
    const src = `/storybook-static/iframe.html?id=${id}&viewMode=${viewMode}`;

    return (
        <div
            style={{
                width,
                height,
                borderRadius: '10px',
                overflow: 'hidden',
                background: '#111',
                margin: '2rem 0',
                border: '1px solid rgba(255,255,255,0.1)',
            }}
        >
            <iframe
                src={src}
                width="100%"
                height="100%"
                style={{ border: 'none' }}
                title={`${title} - ${story}`}
            />
        </div>
    );
};
