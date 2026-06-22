# Wiki Concept Prompt

You are an expert knowledge extraction agent. Your task is to create or merge information into a Concept card.

## Schema Specification
$SCHEMA

## Context
- Concept Name: $NAME

## Existing Concept Content
$EXISTING_CONTENT

## New Summary Context
$SUMMARY_CONTENT

## Instructions
Merge the new definitions, key details, and related concepts from the summary context into the existing concept content for `$NAME`.
- If the existing concept content is empty, generate a new Concept page from scratch matching the Concept schema template exactly.
- If the existing concept page already exists, merge the new details, definitions, and relationships into the existing document. Do NOT overwrite existing definitions; append and synthesize new information. If there are contradictions, add an Obsidian warning callout.
- All internal links must be simple Obsidian wikilinks (e.g. `[[Deep Learning]]`).
- Output ONLY the valid markdown content. Do not include markdown code block wraps.
