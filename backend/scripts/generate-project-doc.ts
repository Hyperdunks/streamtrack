import { mkdir, readFile, writeFile } from 'node:fs/promises';
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

type Block =
    | { type: 'heading'; level: 1 | 2 | 3 | 4; text: string }
    | { type: 'paragraph'; text: string }
    | { type: 'bulletList'; items: string[] }
    | { type: 'orderedList'; items: string[] }
    | { type: 'code'; language: string; lines: string[] }
    | { type: 'table'; rows: string[][] }
    | { type: 'pageBreak' }
    | { type: 'placeholder'; text: string };

function normalizeText(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
}

function isHeading(line: string): boolean {
    return /^#{1,4}\s+/.test(line);
}

function isBullet(line: string): boolean {
    return /^-\s+/.test(line);
}

function isOrdered(line: string): boolean {
    return /^\d+\.\s+/.test(line);
}

function isTableRow(line: string): boolean {
    const trimmed = line.trim();
    return trimmed.startsWith('|') && trimmed.endsWith('|');
}

function isTableDivider(line: string): boolean {
    return /^\|?(\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?$/.test(line.trim());
}

function isPlaceholder(line: string): boolean {
    return /^\[INSERT .* HERE.*\]$/i.test(line.trim());
}

function parseTableLine(line: string): string[] {
    return line
        .trim()
        .slice(1, -1)
        .split('|')
        .map((cell) => normalizeText(cell));
}

function parseMarkdown(markdown: string): Block[] {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const blocks: Block[] = [];

    let index = 0;
    while (index < lines.length) {
        const rawLine = lines[index];
        const line = rawLine.trim();

        if (!line) {
            index += 1;
            continue;
        }

        if (line === '---') {
            blocks.push({ type: 'pageBreak' });
            index += 1;
            continue;
        }

        if (rawLine.startsWith('```')) {
            const language = rawLine.slice(3).trim();
            index += 1;
            const codeLines: string[] = [];

            while (index < lines.length && !lines[index].startsWith('```')) {
                codeLines.push(lines[index]);
                index += 1;
            }

            if (index < lines.length && lines[index].startsWith('```')) {
                index += 1;
            }

            blocks.push({
                type: 'code',
                language,
                lines: codeLines.length > 0 ? codeLines : [''],
            });
            continue;
        }

        const headingMatch = rawLine.match(/^(#{1,4})\s+(.*)$/);
        if (headingMatch) {
            blocks.push({
                type: 'heading',
                level: headingMatch[1].length as 1 | 2 | 3 | 4,
                text: normalizeText(headingMatch[2]),
            });
            index += 1;
            continue;
        }

        if (isPlaceholder(line)) {
            blocks.push({ type: 'placeholder', text: line });
            index += 1;
            continue;
        }

        if (isTableRow(rawLine) && index + 1 < lines.length && isTableDivider(lines[index + 1])) {
            const rows: string[][] = [parseTableLine(rawLine)];
            index += 2;

            while (index < lines.length && isTableRow(lines[index])) {
                rows.push(parseTableLine(lines[index]));
                index += 1;
            }

            blocks.push({ type: 'table', rows });
            continue;
        }

        if (isBullet(line)) {
            const items: string[] = [];

            while (index < lines.length && isBullet(lines[index].trim())) {
                items.push(normalizeText(lines[index].trim().replace(/^-\s+/, '')));
                index += 1;
            }

            blocks.push({ type: 'bulletList', items });
            continue;
        }

        if (isOrdered(line)) {
            const items: string[] = [];

            while (index < lines.length && isOrdered(lines[index].trim())) {
                items.push(normalizeText(lines[index].trim().replace(/^\d+\.\s+/, '')));
                index += 1;
            }

            blocks.push({ type: 'orderedList', items });
            continue;
        }

        const paragraphLines: string[] = [];
        while (index < lines.length) {
            const current = lines[index];
            const trimmed = current.trim();

            if (
                !trimmed ||
                trimmed === '---' ||
                current.startsWith('```') ||
                isHeading(current) ||
                isBullet(trimmed) ||
                isOrdered(trimmed) ||
                isPlaceholder(trimmed) ||
                (isTableRow(current) && index + 1 < lines.length && isTableDivider(lines[index + 1]))
            ) {
                break;
            }

            paragraphLines.push(trimmed);
            index += 1;
        }

        blocks.push({ type: 'paragraph', text: normalizeText(paragraphLines.join(' ')) });
    }

    return blocks;
}

function createTextRun(text: string, options?: Partial<ConstructorParameters<typeof TextRun>[0]>): TextRun {
    return new TextRun({
        text,
        font: 'Arial',
        size: 22,
        ...options,
    });
}

function createHeadingParagraph(text: string, pageBreakBefore = false): Paragraph {
    return new Paragraph({
        pageBreakBefore,
        children: [
            createTextRun(text, {
                bold: true,
                size: 32,
            }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: {
            before: 120,
            after: 180,
        },
    });
}

function createSubHeadingParagraph(text: string): Paragraph {
    return new Paragraph({
        children: [
            createTextRun(text, {
                bold: true,
                size: 24,
            }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: {
            before: 120,
            after: 120,
        },
    });
}

function createMinorHeadingParagraph(text: string): Paragraph {
    return new Paragraph({
        children: [
            createTextRun(text, {
                bold: true,
                size: 22,
            }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: {
            before: 90,
            after: 90,
        },
    });
}

function createBodyParagraph(text: string, options?: { bold?: boolean; italic?: boolean; alignment?: string }): Paragraph {
    return new Paragraph({
        alignment: (options?.alignment as typeof AlignmentType[keyof typeof AlignmentType]) || AlignmentType.JUSTIFIED,
        children: [
            createTextRun(text, {
                bold: options?.bold,
                italics: options?.italic,
            }),
        ],
        spacing: {
            after: 160,
            line: 276,
        },
    });
}

function createListParagraph(prefix: string, text: string): Paragraph {
    return new Paragraph({
        alignment: AlignmentType.JUSTIFIED,
        children: [createTextRun(`${prefix}${text}`)],
        spacing: {
            after: 100,
            line: 276,
        },
    });
}

function createCodeParagraph(text: string): Paragraph {
    return new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
            createTextRun(text, {
                font: 'Courier New',
                size: 20,
            }),
        ],
        spacing: {
            after: 60,
            line: 240,
        },
    });
}

function createPlaceholderParagraph(text: string): Paragraph {
    return new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
            createTextRun(text, {
                bold: true,
                italics: true,
            }),
        ],
        spacing: {
            before: 120,
            after: 180,
        },
    });
}

function createPageBreakParagraph(): Paragraph {
    return new Paragraph({
        pageBreakBefore: true,
        children: [createTextRun('')],
    });
}

function createTableParagraphs(block: Extract<Block, { type: 'table' }>): Paragraph[] {
    const [headerRow, ...bodyRows] = block.rows;
    const paragraphs: Paragraph[] = [];

    paragraphs.push(createMinorHeadingParagraph('Table'));
    paragraphs.push(
        createCodeParagraph(headerRow.map((cell) => cell || '').join(' | ')),
    );
    paragraphs.push(
        createCodeParagraph(headerRow.map(() => '---').join(' | ')),
    );

    bodyRows.forEach((row) => {
        paragraphs.push(createCodeParagraph(row.map((cell) => cell || '').join(' | ')));
    });

    paragraphs.push(createBodyParagraph(' ', { alignment: AlignmentType.LEFT }));
    return paragraphs;
}

function createDocChildren(blocks: Block[]): Paragraph[] {
    const children: Paragraph[] = [];
    let firstLevelOneSeen = false;
    let pendingPageBreak = false;

    for (const block of blocks) {
        if (block.type === 'pageBreak') {
            pendingPageBreak = true;
            continue;
        }

        if (block.type === 'heading') {
            if (block.level === 1) {
                const shouldBreak = firstLevelOneSeen || pendingPageBreak;
                children.push(createHeadingParagraph(block.text, shouldBreak));
                firstLevelOneSeen = true;
                pendingPageBreak = false;
                continue;
            }

            if (block.level === 2) {
                if (pendingPageBreak) {
                    children.push(createPageBreakParagraph());
                    pendingPageBreak = false;
                }
                children.push(createSubHeadingParagraph(block.text));
                continue;
            }

            if (pendingPageBreak) {
                children.push(createPageBreakParagraph());
                pendingPageBreak = false;
            }
            children.push(createMinorHeadingParagraph(block.text));
            continue;
        }

        if (pendingPageBreak) {
            children.push(createPageBreakParagraph());
            pendingPageBreak = false;
        }

        if (block.type === 'paragraph') {
            children.push(createBodyParagraph(block.text));
            continue;
        }

        if (block.type === 'bulletList') {
            block.items.forEach((item) => children.push(createListParagraph('- ', item)));
            continue;
        }

        if (block.type === 'orderedList') {
            block.items.forEach((item, index) => children.push(createListParagraph(`${index + 1}. `, item)));
            continue;
        }

        if (block.type === 'code') {
            if (block.language) {
                children.push(createMinorHeadingParagraph(`Code Block (${block.language})`));
            }
            block.lines.forEach((line) => children.push(createCodeParagraph(line || ' ')));
            children.push(createBodyParagraph(' ', { alignment: AlignmentType.LEFT }));
            continue;
        }

        if (block.type === 'placeholder') {
            children.push(createPlaceholderParagraph(block.text));
            continue;
        }

        if (block.type === 'table') {
            children.push(...createTableParagraphs(block));
        }
    }

    return children;
}

async function main(): Promise<void> {
    const currentFile = fileURLToPath(import.meta.url);
    const currentDir = dirname(currentFile);
    const specsDir = resolve(currentDir, '../../specs');
    const markdownPath = resolve(specsDir, 'streamtrack-project-report.md');
    const docxPath = resolve(specsDir, 'streamtrack-project-report.docx');

    const markdown = await readFile(markdownPath, 'utf8');
    const blocks = parseMarkdown(markdown);
    const children = createDocChildren(blocks);

    await mkdir(specsDir, { recursive: true });

    const doc = new Document({
        creator: 'OpenCode',
        title: 'StreamTrack Project Report',
        description: 'Comprehensive project documentation for StreamTrack.',
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
                children,
            },
        ],
    });

    const buffer = await Packer.toBuffer(doc);
    await writeFile(docxPath, buffer);

    console.log(`Created ${docxPath}`);
}

main().catch((error) => {
    console.error('Failed to generate project documentation:', error);
    process.exitCode = 1;
});
