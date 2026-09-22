/** Pure, deterministic pruning of Playwright's `locator.ariaSnapshot()` YAML-ish text
 * (Section 9.6). Never touches the network or filesystem. */

export interface PruneOptions {
  readonly maxLines?: number;
  readonly maxTextLength?: number;
  readonly collapseRepeatedAfter?: number;
  readonly interactiveOnly?: boolean;
}

const DEFAULTS = {
  maxLines: 150,
  maxTextLength: 80,
  collapseRepeatedAfter: 3,
  interactiveOnly: false,
} as const;

const INTERACTIVE_ROLES = new Set([
  'button',
  'link',
  'textbox',
  'combobox',
  'checkbox',
  'radio',
  'tab',
  'menuitem',
  'option',
  'searchbox',
  'switch',
  'slider',
]);

interface Node {
  content: string;
  role: string;
  children: Node[];
}

function parseLines(text: string): { indent: number; content: string }[] {
  return text
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      const stripped = line.replace(/^ */, '');
      const indent = (line.length - stripped.length) / 2;
      const content = stripped.replace(/^- /, '');
      return { indent, content };
    });
}

function roleOf(content: string): string {
  const match = /^([\w/][\w-]*)/.exec(content);
  return match?.[1] ?? content;
}

/** Builds a tree from indentation using a stack: `stack[d]` is the most recent node seen
 * at depth `d`, so a node's parent is always `stack[indent - 1]`. */
function buildTree(lines: readonly { indent: number; content: string }[]): Node[] {
  const roots: Node[] = [];
  const stack: Node[] = [];

  for (const { indent, content } of lines) {
    const node: Node = { content, role: roleOf(content), children: [] };
    stack.length = indent;
    const parent = indent > 0 ? stack[indent - 1] : undefined;
    if (parent !== undefined) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
    stack[indent] = node;
  }

  return roots;
}

function truncateContent(content: string, maxTextLength: number): string {
  let result = content.replace(/"([^"]*)"/g, (whole, inner: string) =>
    inner.length > maxTextLength ? `"${inner.slice(0, maxTextLength)}…"` : whole,
  );
  const colonMatch = /^([\w/][\w-]*): (.+)$/.exec(result);
  if (colonMatch) {
    const [, key, value] = colonMatch;
    if (
      key !== undefined &&
      value !== undefined &&
      !value.startsWith('"') &&
      value.length > maxTextLength
    ) {
      result = `${key}: ${value.slice(0, maxTextLength)}…`;
    }
  }
  return result;
}

function mapTruncate(nodes: readonly Node[], maxTextLength: number): Node[] {
  return nodes.map((node) => ({
    content: truncateContent(node.content, maxTextLength),
    role: node.role,
    children: mapTruncate(node.children, maxTextLength),
  }));
}

function filterInteractive(nodes: readonly Node[]): Node[] {
  const result: Node[] = [];
  for (const node of nodes) {
    const filteredChildren = filterInteractive(node.children);
    if (INTERACTIVE_ROLES.has(node.role) || filteredChildren.length > 0) {
      result.push({ content: node.content, role: node.role, children: filteredChildren });
    }
  }
  return result;
}

function collapseRepeated(nodes: readonly Node[], threshold: number): Node[] {
  const result: Node[] = [];
  let i = 0;
  while (i < nodes.length) {
    const current = nodes[i];
    if (current === undefined) break;
    const role = current.role;
    let j = i;
    while (nodes[j]?.role === role) j++;
    const run = nodes.slice(i, j);
    if (run.length > threshold) {
      for (const node of run.slice(0, threshold)) {
        result.push({
          content: node.content,
          role: node.role,
          children: collapseRepeated(node.children, threshold),
        });
      }
      const extra = run.length - threshold;
      result.push({
        content: `… (${String(extra)} more similar ${role} items)`,
        role: '…',
        children: [],
      });
    } else {
      for (const node of run) {
        result.push({
          content: node.content,
          role: node.role,
          children: collapseRepeated(node.children, threshold),
        });
      }
    }
    i = j;
  }
  return result;
}

function render(nodes: readonly Node[], depth: number): string[] {
  const lines: string[] = [];
  for (const node of nodes) {
    lines.push(`${'  '.repeat(depth)}- ${node.content}`);
    lines.push(...render(node.children, depth + 1));
  }
  return lines;
}

/** Prunes a raw ARIA snapshot for token-lean AI consumption: truncates long text, collapses
 * runs of similar siblings, optionally keeps only interactive elements (plus ancestors for
 * context), and caps total line count. Deterministic for the same input. */
export function pruneAriaSnapshot(raw: string, options: PruneOptions = {}): string {
  const maxLines = options.maxLines ?? DEFAULTS.maxLines;
  const maxTextLength = options.maxTextLength ?? DEFAULTS.maxTextLength;
  const collapseRepeatedAfter = options.collapseRepeatedAfter ?? DEFAULTS.collapseRepeatedAfter;
  const interactiveOnly = options.interactiveOnly ?? DEFAULTS.interactiveOnly;

  let tree = buildTree(parseLines(raw));
  tree = mapTruncate(tree, maxTextLength);
  if (interactiveOnly) tree = filterInteractive(tree);
  tree = collapseRepeated(tree, collapseRepeatedAfter);

  let lines = render(tree, 0);
  if (lines.length > maxLines) {
    lines = lines.slice(0, maxLines);
    lines.push('- … (truncated, use --scope to narrow)');
  }
  return lines.join('\n');
}
