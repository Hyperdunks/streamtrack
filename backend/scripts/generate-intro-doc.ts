import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    AlignmentType,
    Document,
    Packer,
    Paragraph,
    TextRun,
    convertMillimetersToTwip,
} from 'docx';

type IntroSection = {
    subHeading: string;
    paragraphs: string[];
    pageBreakBefore?: boolean;
};

const documentTitle = 'StreamTrack Introduction';

const introSections: IntroSection[] = [
    {
        subHeading: 'What StreamTrack Is',
        paragraphs: [
            'StreamTrack is a streaming discovery and watchlist platform built to help people decide what to watch faster. Instead of opening multiple apps and scrolling through disconnected catalogs, users can search by title, browse trends, and discover content based on mood or vibe.',
            'The product combines discovery, personalization, and lightweight tracking into one experience. A user can save titles, mark progress, and return later without losing context about where they left off or why a title looked interesting in the first place.',
        ],
    },
    {
        subHeading: 'Why It Exists',
        paragraphs: [
            'Modern streaming is fragmented. Great movies and shows are spread across providers, recommendation quality is inconsistent, and it is easy to forget what to watch next. StreamTrack is designed to reduce that friction by giving users one place to explore options that fit their taste and current mood.',
        ],
    },
    {
        subHeading: 'Core Experience',
        paragraphs: [
            'The core experience combines title search across movies and TV shows, discovery through predefined or custom vibes, trending browsing with provider-aware filtering, and a personal watchlist that supports simple status tracking from want to watched.',
        ],
    },
    {
        subHeading: 'How It Works Today',
        pageBreakBefore: true,
        paragraphs: [
            'StreamTrack runs as a Bun-based monorepo with an Angular frontend and an Express backend. The frontend handles search, discovery, onboarding, and watchlist views, while the backend manages auth validation, user preferences, watchlist persistence, and integrations with external content services.',
            'In practical terms, the current system uses Angular standalone components for the user-facing product experience, Express on Bun for API routing, MongoDB with Mongoose for persistent user data, Firebase Auth for identity, and TMDB for entertainment metadata and discovery inputs.',
        ],
    },
    {
        subHeading: 'Who It Is For',
        paragraphs: [
            'The product is aimed at viewers who already subscribe to multiple streaming services and want less browsing fatigue. It is especially useful for people who like mood-based recommendations, keep informal watchlists, or struggle to remember where specific titles are available.',
        ],
    },
    {
        subHeading: 'Near-Term Direction',
        paragraphs: [
            'The near-term direction is focused on improving consistency between API behavior and documentation, strengthening provider and region handling, refining discovery quality so recommendations feel more intentional, and continuing to polish onboarding, watchlist flows, and critical tests.',
        ],
    },
    {
        subHeading: 'Closing Note',
        paragraphs: [
            'At its best, StreamTrack acts like a lightweight decision layer on top of the streaming services people already use. The goal is not to replace those platforms, but to make choosing the next movie or show feel quicker, clearer, and more personal.',
        ],
    },
];

function createBodyParagraph(text: string): Paragraph {
    return new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        children: [
            new TextRun({
                text,
                size: 22,
                font: 'Arial',
            }),
        ],
        spacing: {
            after: 180,
            line: 276,
        },
    });
}

function createHeadingParagraph(text: string): Paragraph {
    return new Paragraph({
        children: [
            new TextRun({
                text,
                bold: true,
                size: 32,
                font: 'Arial',
            }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: {
            after: 220,
        },
    });
}

function createSubHeadingParagraph(text: string, pageBreakBefore = false): Paragraph {
    return new Paragraph({
        children: [
            new TextRun({
                text,
                bold: true,
                size: 24,
                font: 'Arial',
            }),
        ],
        alignment: AlignmentType.LEFT,
        pageBreakBefore,
        spacing: {
            before: 120,
            after: 120,
        },
    });
}

function buildDocSections(): Paragraph[] {
    const children: Paragraph[] = [
        createHeadingParagraph(documentTitle),
    ];

    introSections.forEach((section) => {
        children.push(createSubHeadingParagraph(section.subHeading, section.pageBreakBefore));
        section.paragraphs.forEach((paragraph) => children.push(createBodyParagraph(paragraph)));
    });

    return children;
}

function buildMarkdown(): string {
    const lines: string[] = [
        `# ${documentTitle}`,
        '',
    ];

    introSections.forEach((section) => {
        if (section.pageBreakBefore) {
            lines.push('---', '');
        }

        lines.push(`## ${section.subHeading}`, '');
        section.paragraphs.forEach((paragraph) => {
            lines.push(paragraph, '');
        });
    });

    return `${lines.join('\n').trim()}\n`;
}

async function main(): Promise<void> {
    const currentFile = fileURLToPath(import.meta.url);
    const currentDir = dirname(currentFile);
    const outputDir = resolve(currentDir, '../../specs');
    const docxPath = resolve(outputDir, 'streamtrack-intro.docx');
    const markdownPath = resolve(outputDir, 'streamtrack-intro.md');

    await mkdir(outputDir, { recursive: true });

    const doc = new Document({
        creator: 'OpenCode',
        title: documentTitle,
        description: 'A short, two-page introduction to StreamTrack.',
        sections: [
            {
                properties: {
                    page: {
                        size: {
                            width: convertMillimetersToTwip(210),
                            height: convertMillimetersToTwip(297),
                        },
                        margin: {
                            top: convertMillimetersToTwip(22),
                            right: convertMillimetersToTwip(22),
                            bottom: convertMillimetersToTwip(22),
                            left: convertMillimetersToTwip(22),
                        },
                    },
                },
                children: buildDocSections(),
            },
        ],
    });

    const buffer = await Packer.toBuffer(doc);
    await writeFile(docxPath, buffer);
    await writeFile(markdownPath, buildMarkdown(), 'utf8');

    console.log(`Created ${docxPath}`);
    console.log(`Created ${markdownPath}`);
}

main().catch((error) => {
    console.error('Failed to generate intro document:', error);
    process.exitCode = 1;
});
