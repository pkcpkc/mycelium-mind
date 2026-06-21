import * as fs from "fs/promises";
import * as path from "path";
import matter from "gray-matter";
import { config, __dirname } from "./config.js";

/**
 * Strips brackets and aliases from Obsidian wikilinks:
 * [[Alan Turing]] -> "Alan Turing"
 * [[Alan Turing|Turing]] -> "Alan Turing"
 */
export function sanitizeWikilinks(text: string): string[] {
  if (!text) return [];
  const links: string[] = [];
  const regex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    links.push(match[1].trim());
  }
  return Array.from(new Set(links));
}

/**
 * Strips bracket wrappers from text content so LLM reads plain prose
 */
export function cleanContentBody(content: string): string {
  if (!content) return "";
  return content.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, p1, p2) => {
    return p2 || p1;
  });
}

/**
 * Standardizes a title into a safe lowercase, underscore-separated markdown filename.
 * e.g., "Andrej Karpathy" -> "Andrej_Karpathy.md"
 */
export function toSafeFilename(title: string): string {
  return title.trim().replace(/\s+/g, "_") + ".md";
}

/**
 * Parses a safe filename back into a clean display title/subject.
 * e.g., "Andrej_Karpathy.md" -> "Andrej Karpathy"
 */
export function fromSafeFilename(filename: string): string {
  const base = path.basename(filename, ".md");
  return base.replace(/_/g, " ");
}


/**
 * Validates and resolves the absolute path to a specific vault's compiled wiki folder.
 * Resolves both absolute and relative vaultsRoot paths.
 */
export function getVaultWikiDir(requestedVault?: string): string {
  // In single-vault mode, always ignore the requestedVault and use the configured vaultName
  const targetVault = config.vaultMode === "single" ? config.vaultName : requestedVault;

  if (!targetVault) {
    throw new Error("Missing parameter: vault_name is required in multi-vault mode.");
  }

  // Resolve vaultsRoot relative to script directory
  const rootDir = path.isAbsolute(config.vaultsRoot)
    ? config.vaultsRoot
    : path.resolve(__dirname, "..", config.vaultsRoot);

  return path.join(rootDir, targetVault, "wiki");
}

/**
 * Reads a markdown file, extracts YAML frontmatter, cleans body text, and harvests outbound wikilinks.
 */
export async function parseMarkdownNote(filePath: string) {
  const rawText = await fs.readFile(filePath, "utf-8");
  const { data: metadata, content: rawBody } = matter(rawText);
  const cleanBody = cleanContentBody(rawBody);
  const outboundLinks = sanitizeWikilinks(rawBody);

  return {
    metadata: metadata || {},
    content: cleanBody.trim(),
    links: {
      outbound_links: outboundLinks,
    },
  };
}

/**
 * Searches all markdown files in a vault to discover inbound wikilinks targeting a specific node name.
 */
export async function findInboundLinks(wikiDir: string, targetName: string): Promise<string[]> {
  const inboundLinks: string[] = [];
  const normalizedTarget = targetName.toLowerCase();

  try {
    const entries = await fs.readdir(wikiDir, { withFileTypes: true });
    const folders = entries
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
      .map((entry) => entry.name);

    for (const folder of folders) {
      const dirPath = path.join(wikiDir, folder);
      try {
        const files = await fs.readdir(dirPath);
        for (const file of files) {
          if (!file.endsWith(".md")) continue;
          if (file === "index.md") continue;
          const filePath = path.join(dirPath, file);
          const rawContent = await fs.readFile(filePath, "utf-8");
          const outlinks = sanitizeWikilinks(rawContent);

          if (outlinks.some((link) => link.toLowerCase() === normalizedTarget)) {
            // Harvest the title/subject of the referencing file
            const parsed = matter(rawContent);
            const title = parsed.data.title || parsed.data.name || fromSafeFilename(file);
            inboundLinks.push(title);
          }
        }
      } catch {
        // Folder might not exist, skip gracefully
      }
    }
  } catch {
    // Ignore readdir failure
  }
  return Array.from(new Set(inboundLinks));
}

/**
 * Lists all non-core subdirectories in the wiki directory to discover collections.
 */
export async function listCollections(wikiDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(wikiDir, { withFileTypes: true });
    return entries
      .filter(
        (entry) =>
          entry.isDirectory() &&
          !["concepts", "summaries", "reports", "assets", "schemas"].includes(entry.name) &&
          !entry.name.startsWith(".")
      )
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

/**
 * Lists all root-level markdown files (excluding index.md) to discover overviews.
 */
export async function listOverviews(wikiDir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(wikiDir, { withFileTypes: true });
    return entries
      .filter(
        (entry) =>
          entry.isFile() &&
          entry.name.endsWith(".md") &&
          entry.name !== "index.md" &&
          !entry.name.startsWith(".")
      )
      .map((entry) => path.basename(entry.name, ".md"));
  } catch {
    return [];
  }
}

/**
 * Safely lists titles of markdown files inside a vault subdirectory
 */
export async function listNoteTitles(wikiDir: string, subfolder: string): Promise<Array<{ title: string }>> {
  const dirPath = path.join(wikiDir, subfolder);
  try {
    const files = await fs.readdir(dirPath);
    const titles: Array<{ title: string }> = [];

    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      if (file === "index.md") continue;
      const filePath = path.join(dirPath, file);
      const rawText = await fs.readFile(filePath, "utf-8");
      const parsed = matter(rawText);
      const title = parsed.data.title || parsed.data.name || fromSafeFilename(file);
      titles.push({ title });
    }
    return titles;
  } catch {
    return [];
  }
}

export interface NoteMetadata {
  title: string;
  category: string;
  tags?: string[];
  description?: string;
  filePath: string;
}

/**
 * Traverses all markdown notes in a vault and returns their logical title, category, tags, and description.
 */
export async function getAllNotesWithMetadata(wikiDir: string): Promise<NoteMetadata[]> {
  const notes: NoteMetadata[] = [];
  const coreFolders = ["concepts", "summaries", "reports"];
  const collections = await listCollections(wikiDir);
  const allSubfolders = [...coreFolders, ...collections];

  for (const folder of allSubfolders) {
    const dirPath = path.join(wikiDir, folder);
    try {
      const files = await fs.readdir(dirPath);
      for (const file of files) {
        if (!file.endsWith(".md")) continue;
        if (file === "index.md") continue;

        const filePath = path.join(dirPath, file);
        try {
          const rawText = await fs.readFile(filePath, "utf-8");
          const parsed = matter(rawText);
          const metadata = parsed.data || {};

          const title = metadata.title || metadata.name || fromSafeFilename(file);
          const description = metadata.description;

          let tags: string[] = [];
          if (metadata.tags) {
            if (Array.isArray(metadata.tags)) {
              tags = metadata.tags.map((t: any) => String(t).trim());
            } else if (typeof metadata.tags === "string") {
              tags = metadata.tags.split(",").map((t: any) => String(t).trim()).filter(Boolean);
            }
          }

          notes.push({
            title,
            category: folder,
            tags: tags.length > 0 ? tags : undefined,
            description,
            filePath,
          });
        } catch {
          // Skip unreadable files
        }
      }
    } catch {
      // Subfolder might not exist
    }
  }

  // Add root level overviews
  try {
    const overviews = await listOverviews(wikiDir);
    for (const overview of overviews) {
      const filePath = path.join(wikiDir, `${overview}.md`);
      try {
        const rawText = await fs.readFile(filePath, "utf-8");
        const parsed = matter(rawText);
        const metadata = parsed.data || {};

        const title = metadata.title || metadata.name || fromSafeFilename(overview);
        const description = metadata.description;

        let tags: string[] = [];
        if (metadata.tags) {
          if (Array.isArray(metadata.tags)) {
            tags = metadata.tags.map((t: any) => String(t).trim());
          } else if (typeof metadata.tags === "string") {
            tags = metadata.tags.split(",").map((t: any) => String(t).trim()).filter(Boolean);
          }
        }

        notes.push({
          title,
          category: "overview",
          tags: tags.length > 0 ? tags : undefined,
          description,
          filePath,
        });
      } catch {
        // Skip unreadable overview files
      }
    }
  } catch {
    // Overview discovery failed
  }

  return notes;
}

/**
 * Reads all summary files in the summaries directory and extracts unique entity names.
 */
export async function getEntitiesFromSummaries(
  wikiDir: string,
  entityType: "concepts" | "persons"
): Promise<string[]> {
  const summariesDir = path.join(wikiDir, "summaries");
  const entities = new Set<string>();

  try {
    const files = await fs.readdir(summariesDir);
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      if (file === "index.md") continue;

      const filePath = path.join(summariesDir, file);
      try {
        const rawText = await fs.readFile(filePath, "utf-8");
        const parsed = matter(rawText);
        const metadata = parsed.data || {};

        const entitiesBlock = metadata.entities || {};
        if (entitiesBlock && typeof entitiesBlock === "object") {
          const list = entitiesBlock[entityType];
          if (Array.isArray(list)) {
            for (const item of list) {
              if (typeof item === "string" && item.trim()) {
                entities.add(item.trim());
              }
            }
          }
        }
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    // summaries directory missing or empty
  }

  return Array.from(entities).sort((a, b) => a.localeCompare(b));
}

export interface EntityStatus {
  exists: boolean;
  outdated: boolean;
  reason?: "missing" | "newer_summary" | "up_to_date";
}

/**
 * Checks if a concept or person note is missing or outdated compared to the summaries referencing it.
 */
export async function checkEntityNoteStatus(
  wikiDir: string,
  entityName: string,
  entityType: "concepts" | "persons"
): Promise<EntityStatus> {
  const safeName = toSafeFilename(entityName);
  const notePath = path.join(wikiDir, entityType, safeName);

  let noteMtime = 0;
  try {
    const noteStat = await fs.stat(notePath);
    noteMtime = noteStat.mtime.getTime();
  } catch {
    return { exists: false, outdated: true, reason: "missing" };
  }

  // Check if any summary mentioning this entity is newer than the note file
  const summariesDir = path.join(wikiDir, "summaries");
  try {
    const files = await fs.readdir(summariesDir);
    for (const file of files) {
      if (!file.endsWith(".md")) continue;
      if (file === "index.md") continue;

      const summaryPath = path.join(summariesDir, file);
      try {
        const sumStat = await fs.stat(summaryPath);
        const sumMtime = sumStat.mtime.getTime();

        if (sumMtime > noteMtime) {
          const rawText = await fs.readFile(summaryPath, "utf-8");
          const parsed = matter(rawText);
          const metadata = parsed.data || {};
          const entitiesBlock = metadata.entities || {};
          const list = entitiesBlock[entityType] || [];

          const mentions = Array.isArray(list) && list.some((item: any) =>
            typeof item === "string" && item.trim().toLowerCase() === entityName.trim().toLowerCase()
          );

          if (mentions) {
            return { exists: true, outdated: true, reason: "newer_summary" };
          }
        }
      } catch {
        // Skip check errors
      }
    }
  } catch {
    // summaries directory missing
  }

  return { exists: true, outdated: false, reason: "up_to_date" };
}

export interface AuditIssue {
  severity: "critical" | "warning" | "info";
  file: string;
  message: string;
}

export interface AuditReport {
  complianceScore: string;
  issues: AuditIssue[];
}

function countSentences(text: string): number {
  if (!text) return 0;
  const clean = text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#+.*$/gm, "")
    .replace(/\s+/g, " ");
  const sentences = clean.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 5);
  return sentences.length;
}

function checkSchemaConformance(type: string, metadata: any): string[] {
  const errors: string[] = [];
  const normalizedType = String(type).toLowerCase();

  if (normalizedType === "summary") {
    if (!metadata.type) errors.push("Missing required field: type");
    if (!metadata.title) errors.push("Missing required field: title");
    if (!metadata.resource) errors.push("Missing required field: resource");
    if (!metadata.timestamp) errors.push("Missing required field: timestamp");

    const entities = metadata.entities || {};
    if (!entities.concepts) errors.push("Missing required field: entities.concepts");
    if (!entities.persons) errors.push("Missing required field: entities.persons");
  } else if (["concept", "person", "report"].includes(normalizedType)) {
    if (!metadata.type) errors.push("Missing required field: type");
    if (!metadata.title) errors.push("Missing required field: title");
    if (!metadata.timestamp) errors.push("Missing required field: timestamp");
  }

  return errors;
}

function checkAcronym(str1: string, str2: string): boolean {
  const words = str2.split(/\s+/).filter(Boolean);
  if (words.length > 1) {
    const acronym = words.map(w => w[0]).join("").toLowerCase();
    if (acronym === str1.toLowerCase()) return true;
  }
  return false;
}

function isPotentialDuplicate(name1: string, name2: string): boolean {
  const n1 = name1.toLowerCase().trim();
  const n2 = name2.toLowerCase().trim();
  if (n1 === n2) return true;
  if (checkAcronym(n1, n2) || checkAcronym(n2, n1)) return true;
  return false;
}

/**
 * Runs a complete audit on the wiki vault to check compliance against schemas, format, and graph connectivity.
 */
export async function auditVault(wikiDir: string): Promise<AuditReport> {
  const issues: AuditIssue[] = [];

  interface NoteData {
    relPath: string;
    category: string;
    title: string;
    metadata: any;
    body: string;
    hasFrontmatter: boolean;
    rawText: string;
  }

  const notes: NoteData[] = [];
  const coreFolders = ["concepts", "summaries", "reports"];
  const collections = await listCollections(wikiDir);
  const folders = [...coreFolders, ...collections];

  for (const folder of folders) {
    const dirPath = path.join(wikiDir, folder);
    try {
      const files = await fs.readdir(dirPath);
      for (const file of files) {
        if (!file.endsWith(".md") || file === "index.md") continue;
        const filePath = path.join(dirPath, file);
        try {
          const rawText = await fs.readFile(filePath, "utf-8");
          const hasFM = rawText.startsWith("---");
          const parsed = matter(rawText);
          const metadata = parsed.data || {};
          const title = metadata.title || metadata.name || fromSafeFilename(file);
          notes.push({
            relPath: `${folder}/${file}`,
            category: folder,
            title,
            metadata,
            body: parsed.content,
            hasFrontmatter: hasFM,
            rawText,
          });
        } catch {
          issues.push({
            severity: "critical",
            file: `${folder}/${file}`,
            message: "Unable to read markdown file",
          });
        }
      }
    } catch {
      // Subfolder does not exist
    }
  }

  try {
    const overviews = await listOverviews(wikiDir);
    for (const overview of overviews) {
      const filePath = path.join(wikiDir, `${overview}.md`);
      try {
        const rawText = await fs.readFile(filePath, "utf-8");
        const hasFM = rawText.startsWith("---");
        const parsed = matter(rawText);
        const metadata = parsed.data || {};
        const title = metadata.title || metadata.name || fromSafeFilename(overview);
        notes.push({
          relPath: `${overview}.md`,
          category: "overview",
          title,
          metadata,
          body: parsed.content,
          hasFrontmatter: hasFM,
          rawText,
        });
      } catch {
        issues.push({
          severity: "critical",
          file: `${overview}.md`,
          message: "Unable to read overview file",
        });
      }
    }
  } catch {
    // Overviews list failed
  }

  const noteMapByTitle = new Map<string, NoteData>();
  const noteMapByFilename = new Map<string, NoteData>();

  for (const note of notes) {
    noteMapByTitle.set(note.title.toLowerCase().trim(), note);
    const nameOnly = path.basename(note.relPath, ".md");
    noteMapByFilename.set(nameOnly.toLowerCase().trim(), note);
    noteMapByFilename.set(nameOnly.replace(/_/g, " ").toLowerCase().trim(), note);
  }

  let compliantCount = 0;

  for (const note of notes) {
    const noteIssues: string[] = [];

    if (!note.hasFrontmatter) {
      issues.push({
        severity: "critical",
        file: note.relPath,
        message: "Missing YAML frontmatter block",
      });
      noteIssues.push("no_fm");
    } else if (!note.metadata.type) {
      issues.push({
        severity: "critical",
        file: note.relPath,
        message: "Missing 'type' field in frontmatter",
      });
      noteIssues.push("no_type");
    }

    if (note.metadata.type) {
      const schemaErrors = checkSchemaConformance(note.metadata.type, note.metadata);
      for (const err of schemaErrors) {
        issues.push({
          severity: "warning",
          file: note.relPath,
          message: `Schema conformance: ${err}`,
        });
        noteIssues.push("schema_error");
      }
    }

    if (note.category === "concepts" && String(note.metadata.type).toLowerCase() === "person") {
      issues.push({
        severity: "warning",
        file: note.relPath,
        message: "Concept note has type 'Person' (should reside in persons/ folder)",
      });
      noteIssues.push("person_concept_clash");
    }

    if (note.category === "concepts") {
      const nameOnly = path.basename(note.relPath, ".md");
      const personClash = notes.find(n => n.category === "persons" && path.basename(n.relPath, ".md") === nameOnly);
      if (personClash) {
        issues.push({
          severity: "warning",
          file: note.relPath,
          message: `Entity filename clash: '${nameOnly}' exists in both concepts/ and persons/`,
        });
        noteIssues.push("filename_clash");
      }
    }

    if (String(note.metadata.type).toLowerCase() === "summary") {
      const entities = note.metadata.entities || {};
      const concepts = entities.concepts || [];
      const persons = entities.persons || [];

      for (const entity of concepts) {
        const normalized = String(entity).toLowerCase().trim();
        const exists = notes.some(n => n.category === "concepts" && (n.title.toLowerCase().trim() === normalized || path.basename(n.relPath, ".md").replace(/_/g, " ").toLowerCase().trim() === normalized));
        if (!exists) {
          issues.push({
            severity: "warning",
            file: note.relPath,
            message: `Entity manifest: Referenced concept "${entity}" does not have a corresponding file in concepts/`,
          });
          noteIssues.push("missing_entity");
        }
      }

      for (const entity of persons) {
        const normalized = String(entity).toLowerCase().trim();
        const exists = notes.some(n => n.category === "persons" && (n.title.toLowerCase().trim() === normalized || path.basename(n.relPath, ".md").replace(/_/g, " ").toLowerCase().trim() === normalized));
        if (!exists) {
          issues.push({
            severity: "warning",
            file: note.relPath,
            message: `Entity manifest: Referenced person "${entity}" does not have a corresponding file in persons/`,
          });
          noteIssues.push("missing_entity");
        }
      }
    }

    const linksRegex = /\[\[([^\]]+)\]\]/g;
    let match;
    while ((match = linksRegex.exec(note.rawText)) !== null) {
      const fullLink = match[1];
      const linkTarget = fullLink.split("|")[0].trim();

      if (linkTarget.includes("/") || linkTarget.includes("\\")) {
        issues.push({
          severity: "warning",
          file: note.relPath,
          message: `Wikilink formatting: "${fullLink}" contains folder prefixes (should be simple)`,
        });
        noteIssues.push("prefix_link");
      }

      const normalizedTarget = linkTarget.replace(/_/g, " ").toLowerCase().trim();
      const targetExists = noteMapByTitle.has(normalizedTarget) || noteMapByFilename.has(normalizedTarget);
      if (!targetExists) {
        issues.push({
          severity: "warning",
          file: note.relPath,
          message: `Broken wikilink: "${linkTarget}" points to a non-existent page`,
        });
        noteIssues.push("broken_link");
      }
    }

    const sentences = countSentences(note.body);
    if (sentences < 3 && note.category !== "summaries" && note.category !== "reports" && note.relPath !== "index.md") {
      issues.push({
        severity: "info",
        file: note.relPath,
        message: `Stub note detected: only contains ${sentences} sentences (excluding headers)`,
      });
    }

    if (noteIssues.length === 0) {
      compliantCount++;
    }
  }

  const allInboundLinks = new Set<string>();
  for (const note of notes) {
    const linksRegex = /\[\[([^\]]+)\]\]/g;
    let match;
    while ((match = linksRegex.exec(note.rawText)) !== null) {
      const fullLink = match[1];
      const linkTarget = fullLink.split("|")[0].trim().replace(/_/g, " ").toLowerCase().trim();
      allInboundLinks.add(linkTarget);
    }
  }

  for (const note of notes) {
    const titleNorm = note.title.toLowerCase().trim();
    const filenameNorm = path.basename(note.relPath, ".md").replace(/_/g, " ").toLowerCase().trim();

    const isOrphan = !allInboundLinks.has(titleNorm) && !allInboundLinks.has(filenameNorm);
    if (isOrphan && note.relPath !== "index.md" && note.category !== "reports") {
      issues.push({
        severity: "info",
        file: note.relPath,
        message: `Orphan note: No incoming wikilinks found pointing to this page`,
      });
    }
  }

  const conceptNotes = notes.filter(n => n.category === "concepts");
  for (let i = 0; i < conceptNotes.length; i++) {
    for (let j = i + 1; j < conceptNotes.length; j++) {
      if (isPotentialDuplicate(conceptNotes[i].title, conceptNotes[j].title)) {
        issues.push({
          severity: "info",
          file: conceptNotes[i].relPath,
          message: `Potential duplicate concept: "${conceptNotes[i].title}" may conflict with "${conceptNotes[j].title}" (${conceptNotes[j].relPath})`,
        });
      }
    }
  }

  const totalCount = notes.length;
  const scorePercent = totalCount > 0 ? Math.round((compliantCount / totalCount) * 100) : 100;
  const scoreString = `OKF Compliance: ${scorePercent}% (${compliantCount}/${totalCount} pages compliant)`;

  return {
    complianceScore: scoreString,
    issues,
  };
}

export interface SocialNode {
  id: string;
  name: string;
  description?: string;
}

export interface SocialEdge {
  source: string;
  target: string;
  type: string;
  context: string;
}

export interface SocialNetwork {
  nodes: SocialNode[];
  edges: SocialEdge[];
}

function getInitials(name: string): string {
  return name
    .split(/[\s_-]+/)
    .map(w => w[0])
    .join("")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

/**
 * Scans the persons directory to build a social connection graph.
 */
export async function getSocialNetworkData(wikiDir: string): Promise<SocialNetwork> {
  const nodes: SocialNode[] = [];
  const edges: SocialEdge[] = [];

  const personsDir = path.join(wikiDir, "persons");
  const personFiles: Array<{ name: string; title: string; body: string; description?: string; filePath: string }> = [];

  try {
    const files = await fs.readdir(personsDir);
    for (const file of files) {
      if (!file.endsWith(".md") || file === "index.md") continue;
      const filePath = path.join(personsDir, file);
      try {
        const rawText = await fs.readFile(filePath, "utf-8");
        const parsed = matter(rawText);
        const metadata = parsed.data || {};
        const title = metadata.title || metadata.name || fromSafeFilename(file);
        personFiles.push({
          name: fromSafeFilename(file),
          title,
          body: parsed.content,
          description: metadata.description,
          filePath,
        });
      } catch {
        // Skip unreadable files
      }
    }
  } catch {
    // persons folder missing or unreadable
  }

  const titleToIdMap = new Map<string, string>();
  for (const person of personFiles) {
    const initials = getInitials(person.title);
    titleToIdMap.set(person.title.toLowerCase().trim(), initials);
    titleToIdMap.set(person.name.toLowerCase().trim(), initials);

    nodes.push({
      id: initials,
      name: person.title,
      description: person.description,
    });
  }

  for (const person of personFiles) {
    const sourceId = titleToIdMap.get(person.title.toLowerCase().trim())!;
    const linksRegex = /\[\[([^\]]+)\]\]/g;
    let match;
    const lines = person.body.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    while ((match = linksRegex.exec(person.body)) !== null) {
      const fullLink = match[0];
      const linkTarget = match[1].split("|")[0].trim();
      const normalizedTarget = linkTarget.replace(/_/g, " ").toLowerCase().trim();

      const targetId = titleToIdMap.get(normalizedTarget);
      if (targetId && targetId !== sourceId) {
        const contextLine = lines.find(l => l.includes(fullLink)) || "";

        let type = "collaborator";
        const contextLower = contextLine.toLowerCase();
        if (contextLower.includes("advised by") || contextLower.includes("advisor") || contextLower.includes("phd student")) {
          type = "student-advisor";
        } else if (contextLower.includes("coworker") || contextLower.includes("worked with") || contextLower.includes("co-authored")) {
          type = "coworker";
        } else if (contextLower.includes("class") || contextLower.includes("student at")) {
          type = "classmate";
        } else if (contextLower.includes("mentor") || contextLower.includes("advised")) {
          type = "mentor";
        }

        const cleanContext = contextLine.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (m, p1, p2) => p2 || p1);

        const exists = edges.some(e => e.source === sourceId && e.target === targetId);
        if (!exists) {
          edges.push({
            source: sourceId,
            target: targetId,
            type,
            context: cleanContext.trim() || `Mentioned in ${person.title}'s biography.`,
          });
        }
      }
    }
  }

  return { nodes, edges };
}



