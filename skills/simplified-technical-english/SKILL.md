---
name: simplified-technical-english
user-invocable: false
description: "Write and check technical content against Simplified Technical English (ASD-STE100), the controlled language that ASD maintains through the STE Maintenance Group (STEMG). An author aid plus a linter, never a converter: it explains STE, drafts and rewrites prose toward compliance, and reports each violation with the rule, the offending span, and a concrete fix. Enforces the checkable rules: 20 words at most per instruction and 25 at most per descriptive sentence; active voice in every procedure, passive in a description only when the agent is unknown; one instruction per sentence; one topic per paragraph, 6 sentences at most; approved verb forms only (infinitive, imperative, simple present, simple past, simple future, and the past participle as an adjective), so no auxiliary-built complex tenses and no '-ing' form except as a technical noun or modifier; compound nouns of 3 words at most; no omitted subject, verb, or article; one word, one part of speech, one meaning, with an approved alternative offered for each unapproved word; a warning or a caution that opens with a command or a condition; a vertical list for complex text; the Technical Name and Technical Verb exception (rules 1.5 and 1.12). Activates for: 'simplified technical english', 'asd-ste100', 'check this against ste', 'rewrite this in ste', 'controlled language check', 'is this ste compliant', 'ste sentence length rule', 'approved words dictionary', 's1000d language rules', 'ata i2200 writing rules'. The approved-word dictionary is ASD property: this skill ships the RULES and the METHOD, never the word list, and points to the free official specification as the vocabulary source of truth. STE cannot be used alone and no checker converts non-STE text into STE: this supplements a style guide and subject-matter expertise, it does not replace them."
argument-hint: "[lint | rewrite | explain | procedures | descriptions]"
allowed-tools:
  - Read
  - Edit
triggers:
  - "simplified technical english"
  - "asd-ste100"
  - "check this against ste"
  - "rewrite this in ste"
  - "controlled language check"
  - "is this ste compliant"
  - "ste sentence length rule"
  - "approved words dictionary"
  - "s1000d language rules"
  - "ata i2200 writing rules"
antiTriggers:
  - "claude code plugin"
  - "chat assistant skill"
  - "translate this document"
  - "grammar check my email"
  - "plain language legal notice"
  - "simplify this code"
---


<objective>
Help an author write technical content in Simplified Technical English
(ASD-STE100) and report where a draft breaks the standard. Do two jobs. First,
LINT: read the text, apply the checkable rules below, and give one finding per
violation with the rule, the exact span, and a concrete fix. Second, AUTHOR or
REWRITE: produce text that satisfies the same rules, and mark every place where
the rewrite needs a decision only a subject-matter expert can make. Keep the
vocabulary work honest: the approved-word dictionary belongs to ASD, so this
skill carries the method and points to the official specification, and it never
reproduces the word list.
</objective>

# Workflow: simplified-technical-english

> STE is a controlled natural language for technical documentation. ASD (the
> AeroSpace and Defence Industries Association of Europe) maintains it through
> the STE Maintenance Group. It started in the 1980s as AECMA Simplified
> English, it is free of charge since Issue 6, and Issue 9 became an
> international standard. New issues appear about every three years. SOURCE
> PRECEDENCE: the current official specification wins over this skill and over
> any tool output. Get it from ASD (`asd-ste100.org`) and read the issue that
> your program contracts to.

## What STE gives you, and what it does not

STE has two parts. Part 1 is a set of about 53 writing rules, split into rules
for PROCEDURES and rules for DESCRIPTIONS. Part 2 is a dictionary of about 900
approved words, built on one principle: one word, one part of speech, one
meaning.

The goals are practical. STE makes procedures clearer. It makes text easier to
read for a person whose first language is not English. It makes human and
machine translation cheaper. It lowers the human-factor risk that a misread
instruction creates during maintenance or assembly.

The limits are equally practical, and ASD states them itself:

- **STE cannot be used alone.** It supplements a style guide, a terminology
  list, and subject-matter expertise. It does not replace them.
- **A checker cannot convert non-STE text into STE.** A tool flags candidates.
  A qualified author makes the decision, and an expert confirms the technical
  content. Present every rewrite as a proposal, never as a verified conversion.
- **Rules do not create accuracy.** A short, active, approved-word sentence can
  still be technically wrong.

Related standards make STE contractual rather than optional: S1000D and the ATA
specifications (i2200, which superseded ATA104) require STE compliance for the
publications in their scope. Ask which one applies before you lint.

## First decide the scope: strict or general

Not every text gets the same treatment. Decide, and say which mode you used.

- **STRICT conformance** applies to manuals, procedures, work cards, and safety
  text. All rules apply, including the approved-word dictionary and the
  program's typographic conventions (many programs put procedure titles and
  warnings in uppercase). Vocabulary findings are blocking here.
- **GENERAL conformance** applies to everything else: a design note, a README,
  a support article, release notes. Apply the structural rules (length, voice,
  one instruction per sentence, verb forms, noun clusters, complete sentences).
  Report a vocabulary finding as advisory, not as a failure.

When the user does not say which mode applies, ask once. If no answer arrives,
lint in general mode and label the report as such.

## The checkable rules

Each rule below has a test you can run on the text and a fix you can propose.

### Sentence length

- An instruction has 20 words at most.
- A descriptive sentence has 25 words at most.
- Count words in the sentence, not in the paragraph. Split at a coordinating
  conjunction or at a relative clause; do not compress by dropping articles.

### One instruction per sentence

One sentence gives one command. Two commands in one sentence become two
sentences, or a vertical list of steps. A sentence that contains "and then",
"after which", or a semicolon between two imperatives is a candidate.

Keep the condition before the action: "Before you remove the panel, de-energize
the circuit" reads correctly; "De-energize the circuit before you remove the
panel" makes the reader act before the condition arrives.

### Active voice with a named actor

- In a procedure, the active voice is mandatory. Every instruction is an
  imperative, or it names its actor.
- In a description, the passive voice is permitted only when the agent is
  unknown or genuinely irrelevant. If you can name the agent, name it.
- Flag: a form of "be" plus a past participle. Fix: name the actor, then make
  the verb active.

### Approved verb forms only

Use the infinitive, the imperative, the simple present, the simple past, the
simple future, and the past participle as an adjective. Do not build complex
tenses with auxiliaries, and do not use the "-ing" form as a verb.

The "-ing" form stays legal in two places: as a technical noun ("bearing",
"tubing") and as a modifier that names part of the technical vocabulary. A
gerund that carries the action of the sentence is a finding.

| Do not write | Write |
|---|---|
| The valve is being replaced by the technician. | The technician replaces the valve. |
| You will have completed the test. | You complete the test. |
| Before removing the cover, ... | Before you remove the cover, ... |
| The system has been shut down. | The operator shut down the system. |

### One word, one part of speech, one meaning

This is the heart of the standard. An approved word is approved for ONE part of
speech and ONE meaning. The dictionary sets that meaning; the word is not
available for any other sense.

The canonical example: "close" is approved as a verb for "to move together" or
"to operate a circuit breaker". So "Close the door" is correct and "Close the
meeting" is not; write "Finish the meeting" instead. Apply the same discipline
to every word that carries two senses in ordinary English ("follow", "check",
"clear", "free", "right").

Method for an unapproved word:

1. Name the word and the sense the author intended.
2. Give an approved alternative that keeps the meaning.
3. If no alternative carries the technical meaning, say so, and route the
   decision to the Technical Name and Technical Verb exception below.
4. Never invent an entry. Verify each substitution against the official
   dictionary before you call the text conformant.

Common patterns of the same shape, useful as illustrations rather than as a
substitute for the dictionary: prefer a short common verb over a long formal
one, prefer a verb over a noun built from that verb, and keep one term for one
part through the whole document. Write "use", not "utilize". Write "start", not
"initiate" or "commence". Write "Install the pump", not "Perform installation of
the pump". If the document calls a part the "drain valve" once, it is the "drain
valve" everywhere.

### Compound nouns of 3 words at most

A noun cluster longer than three words hides its relations. Break it with a
preposition or a relative clause. "Runway light circuit breaker failure
indicator" becomes "the failure indicator for the runway-light circuit breaker".

### Do not omit parts of the sentence

Keep the subject, the verb, and the article. Telegraphic style ("Remove cover,
check gasket") saves nothing and damages translation. Write "Remove the cover.
Examine the gasket."

### Paragraphs

One paragraph covers one topic. A paragraph has 6 sentences at most. A longer
run of sentences becomes a new paragraph or, when the content is a sequence of
actions, a vertical list.

### Safety instructions

A warning or a caution opens with a clear command or a clear condition, never
with background. Put the safety statement before the step it protects. State
the consequence after the command, not instead of it.

Correct shape: "Do not touch the terminals. High voltage can kill you."
Wrong shape: "There is a possibility of electric shock during this procedure."

### Vertical lists for complex text

When one sentence carries more than one condition, more than one object, or a
sequence of actions, present it as a vertical list. A list of steps is numbered.
A list of items or conditions is bulleted. Each entry stands as a complete
sentence.

## The Technical Name and Technical Verb exception

Rules 1.5 and 1.12 let a text use words that no dictionary entry lists.

- A **Technical Name** is a noun that names a real object in the equipment, a
  part, a material, a tool, or a standard: "propeller", "torque wrench",
  "hydraulic fluid". Use it when no approved word names the object.
- A **Technical Verb** names a manufacturing or maintenance process: "to drill",
  "to rivet", "to solder".

Apply the exception with discipline. The word must belong to an approved
category, it must be necessary, and the document must use it consistently. Do
not let the exception smuggle in ordinary vocabulary. When you invoke it in a
lint report, say which category the word belongs to and why no approved word
serves.

## Report format for a lint run

Report findings in document order. One finding per violation. Use this shape,
and keep the rewrite proposal separate from the observation:

```
<file>:<line>  [rule: sentence-length | voice | verb-form | one-instruction |
                noun-cluster | omitted-part | vocabulary | paragraph | safety |
                vertical-list]
  span:  "<the exact offending text>"
  why:   <the rule, in one sentence, with the measured value where there is one>
  fix:   "<the proposed rewrite>"
  note:  <optional: what a subject-matter expert must confirm>
```

Close the report with a short summary: the mode used (strict or general), the
count per rule, and an explicit list of anything you could NOT check. Vocabulary
is almost always on that list, because the authoritative dictionary is not part
of this skill.

Never report a compliance score as a guarantee. Report what you checked.

## Licensing: never bundle the dictionary

The approximately 900 approved words, their parts of speech, and their approved
meanings are ASD intellectual property. The specification is free of charge, but
free is not the same as freely redistributable.

- Do not paste the word list, or a large extract of it, into this repository,
  into a generated file, or into a chat answer that reads as a substitute for
  the dictionary.
- Do cite the official specification as the source of truth, and quote a single
  entry only when you discuss that specific entry.
- Before anyone ships a machine-readable word list with this pack, get the
  licensing confirmed in writing by ASD. Until that confirmation exists, treat
  every vocabulary check as advisory and say so in the report.

## Boundaries (what this skill defers)

- **Technical accuracy** belongs to the subject-matter expert. This skill checks
  language, never facts.
- **The authoritative vocabulary** belongs to the official ASD specification.
- **Document structure and information typing** (how a data module or a task is
  organized) belong to S1000D or to the ATA specification in force, not here.
- **Terminology decisions** (which name a program uses for a part) belong to the
  program's terminology list. This skill enforces consistency with that list; it
  does not create the list.
- **Certified conformance** comes from the program's approved checker and its
  qualified authors. This skill never claims certification.

## Steps (operational)

1. Establish the scope: which document, which audience, and strict or general
   conformance. Ask once if the answer is not in the request.
2. Read the text. Split it into sentences, and classify each one as an
   instruction or as a description. The classification sets the word limit.
3. Run the checkable rules in order: length, one instruction per sentence,
   voice, verb form, vocabulary, noun clusters, omitted parts, paragraphs,
   safety statements, vertical lists.
4. Write one finding per violation in the report format above, each with a
   concrete rewrite.
5. On request, apply the rewrites to the file with `Edit`, one rule at a time,
   and keep the technical content unchanged. Where a fix needs a technical
   decision, leave the text alone and raise the question.
6. State the limits in the closing summary: the mode used, what you could not
   check, and the reminder that a qualified author and an expert confirm the
   result before it ships.
