---
name: simplified-technical-english
user-invocable: false
description: "Write and check technical content against ASD-STE100 Simplified Technical English, the controlled language that ASD maintains through the STE Maintenance Group (STEMG). An author aid and a linter, never a converter. It explains the rules, proposes rewrites, and reports each candidate violation with the rule, the offending span, and a concrete fix. It carries a fixed set of Issue 9 rule numbers that were checked against the official specification (sentence length 5.1 and 6.3, one instruction 5.2, imperative 5.3, active voice 3.6, verb forms 3.1 to 3.5, multi-word nouns 2.1, omitted words 4.2, vertical lists 4.3, paragraphs 6.4 to 6.6, safety 7.1 to 7.3, punctuation and word count 8.1 to 8.7), and it cites no rule number that is not in that set. The approved-word dictionary stays with ASD, so every vocabulary result is advisory and marked unverified unless the official dictionary was actually read."
when_to_use: "Trigger phrases: \"simplified technical english\", \"asd-ste100\", \"check this against ste\", \"rewrite this in ste\", \"controlled language check\", \"is this ste compliant\", \"ste sentence length rule\", \"approved words dictionary\", \"s1000d language rules\", \"ata ispec 2200 writing rules\". Use it for technical documentation, procedures, work cards, and safety text. Do not use it for general prose, email, or plain-language legal work."
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
  - "ata ispec 2200 writing rules"
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
(ASD-STE100) and report where a draft appears to break the standard. Do two
jobs. First, LINT: read the text, apply the checkable rules below, and give one
finding per candidate violation with the rule, the exact span, and a concrete
fix. Second, AUTHOR or REWRITE: attempt text that follows the same rules, and
mark every place where the result needs a decision that only a subject-matter
expert can make. Claim no more than that. This skill cannot certify
conformance, it cannot confirm a word against a dictionary it does not carry,
and it cannot guarantee that a rewrite keeps the technical meaning.
</objective>

# Workflow: simplified-technical-english

> STE is a controlled natural language for technical documentation. ASD (the
> AeroSpace and Defence Industries Association of Europe) maintains it through
> the STE Maintenance Group. It began as the AECMA Simplified English Guide,
> first released in 1986, and it became ASD-STE100 in 2005. ASD makes the
> specification available free of charge through the STEMG website. Issue 9 is
> dated 2025-01-15. New issues appear about every three years. SOURCE
> PRECEDENCE: the official specification wins over this skill and over any tool
> output. Get it from ASD (`asd-ste100.org`) and read the issue that your
> program contracts to.

## What STE is, and what it is not

STE has two parts. Part 1 holds 53 writing rules in 9 sections: words,
multi-word nouns, verbs, sentences, procedural writing, descriptive writing,
safety instructions, punctuation and word count, and writing practices. Part 2
is a dictionary of approximately 900 approved words, built on one principle:
one word, one part of speech, one meaning.

The goals are practical. STE makes procedures clearer. It makes text easier to
read for a person whose first language is not English. It makes human and
machine translation cheaper. It lowers the human-factor risk that a misread
instruction creates during maintenance or assembly.

The limits are equally practical:

- **STE cannot be used alone.** It supplements a style guide, a terminology
  list, and subject-matter expertise. It does not replace them.
- **A checker cannot convert non-STE text into STE.** A tool flags candidates.
  A qualified author makes the decision, and an expert confirms the technical
  content. Present every rewrite as a proposal, never as a verified conversion.
- **Rules do not create accuracy.** A short, active, approved-word sentence can
  still be technically wrong.
- **The specification is advisory in its own words.** ASD states that the
  document offers recommendations and definitions to assist technical
  communication, and that it does not create legal obligations.

Where STE is contractual, the contract says so, not this skill. ASD records
that the Air Transport Association of America required STE in its ATA 100
specification for technical publications in the 1980s. ATA iSpec 2200 is the
successor of ATA 100. ATA 104 is a separate specification and it covers
training. ASD material describes STE as a recommendation in S1000D, and older
ASD material calls it a requirement, so do not assert either. Ask which
specification, which issue, and which publication scope applies before you
lint.

## Cite only these rule numbers

Rule numbers move between issues. In Issue 9 the rule on articles and
demonstrative adjectives moved out of section 2 and became rule 4.5. So a
number without an issue is worthless.

The numbers below were checked against the official Issue 9 specification.
**Cite a rule number only if it appears in this table.** For anything else,
name the category instead and leave the rule number empty. Never guess a
number, and never carry a number over from another issue.

| Rule | Subject |
|---|---|
| 1.1 to 1.4 | Approved words, part of speech, approved meaning, approved forms |
| 1.5 to 1.7 | Technical nouns and their categories |
| 1.12, 1.13 | Technical verbs and their categories |
| 1.14 | American English spelling |
| 2.1, 2.2 | Multi-word nouns of no more than three words |
| 3.1 to 3.5 | Approved verb forms, past participle as adjective, no complex tenses |
| 3.6 | Active voice |
| 3.7 | An approved verb describes an action |
| 4.1, 4.2 | Short sentences, no omitted words and no contractions |
| 4.3 | Vertical lists for complex text |
| 4.4, 4.5 | Connecting words, articles and demonstrative adjectives |
| 5.1 | Procedural sentence length, 20 words at most |
| 5.2 | One instruction per sentence, with a stated exception |
| 5.3, 5.4 | Imperative form, condition before the command |
| 6.3 | Descriptive sentence length, 25 words at most |
| 6.4 to 6.6 | Paragraphs, one topic, six sentences at most |
| 7.1 to 7.3 | Safety instructions |
| 8.1 to 8.7 | Punctuation and the word-count method |
| 9.2 to 9.4 | Correct use of approved words, no phrasal verbs, consistent style |

If a program contracts to an earlier issue, treat every number above as
unverified for that issue and report the category only.

## Decide the mode first

STE is written for technical documentation. ASD says it is not intended for
general-purpose writing. The specification defines no conformance classes, so
this skill does not invent one. Pick a mode, and name it in the report.

- **CONTRACTED STE** applies when a contract or a specification requires STE:
  manuals, procedures, work cards, and safety text. All rules apply, together
  with the approved-word dictionary and the program's typographic conventions.
  Many programs put procedure titles and warnings in uppercase. A vocabulary
  result is still only as good as the dictionary you actually read.
- **ADVISORY REVIEW** applies to everything else: a design note, a README, a
  support article, release notes. Apply the structural rules and report them as
  suggestions. Do not call the result conformant, compliant, or a pass. Say
  that the text borrows STE principles.

When the user does not say which mode applies, ask once. If no answer arrives,
run an advisory review and label the report as such.

## The checkable rules

Each rule below has a test you can run and a fix you can propose.

### Sentence length (rules 5.1 and 6.3)

- An instruction has 20 words at most (rule 5.1).
- A descriptive sentence has 25 words at most (rule 6.3).
- Report the measured count with every finding.

Count words by the method in rules 8.4 to 8.7, or the same text yields a
different number on every run:

- A colon in a vertical list ends the sentence for counting, in the same way as
  a period (rule 8.4).
- Text in parentheses counts as one word in its sentence, and the words inside
  the parentheses also count as their own sentence (rule 8.5).
- Each of these counts as one word (rule 8.6): a number, a number with its unit
  of measurement, an abbreviation, an alphanumeric identifier, quoted text, a
  title or heading, text on a placard or label, and a proper noun of a person,
  a group, an organization, or a geopolitical entity.
- A hyphenated word counts as one word (rule 8.7).

State the counting method in the report summary. When a sentence sits within
two words of a limit, mark the finding `confidence: low` and show your count.

### One instruction per sentence (rule 5.2)

Rule 5.2 carries an exception, and a linter that ignores it produces false
findings. Write one instruction per sentence UNLESS two or more actions happen
at the same time. Holding a part while you install a fastener is one sentence,
not two.

So: flag a sentence that packs several sequential commands. Do not flag a
sentence that describes simultaneous actions. When you cannot tell whether the
actions are sequential or simultaneous, report `confidence: low` and ask.

Keep the condition before the command (rule 5.4). "Before you remove the panel,
de-energize the circuit" reads correctly. The reverse order makes the reader
act before the condition arrives.

### Active voice (rules 3.6 and 3.3)

- In a procedure, use the active voice. Every instruction is an imperative
  (rule 5.3), or it names its actor.
- In descriptive writing, rule 3.6 permits the passive voice ONLY when the
  agent is unknown. "The agent is irrelevant" is not an exception in the
  standard. Do not offer it as one.
- Fix: name the actor, then make the verb active.

Do not flag every form of "be" plus a past participle. Rule 3.3 uses the past
participle as an adjective, before a noun or after a form of "to be", "to
become", or "to stay", and the standard states that this construction is not
passive voice. "The unit is disassembled" can be a description of a condition.

So the test has three outcomes. A clear passive with a named agent in a "by"
phrase is a finding. An adjectival state after "be", "become", or "stay" is not
a finding. Anything else is a candidate with `confidence: low`, and the author
decides.

### Approved verb forms (rules 3.1 to 3.5)

Use the infinitive, the imperative, the simple present, the simple past, the
simple future, and the past participle as an adjective. Do not build complex
tenses with auxiliary verbs (rule 3.4). Do not use the "-ing" form as a verb.

The "-ing" form is allowed as a technical noun or as a modifier inside a
technical noun (rule 3.5). A gerund that carries the action of the sentence is
a finding.

| Do not write | Write |
|---|---|
| The valve is being replaced by the technician. | The technician replaces the valve. |
| You will have completed the test. | You complete the test. |
| Before removing the cover, ... | Before you remove the cover, ... |
| The system has been shut down. | The operator shut down the system. |

### Words, part of speech, and meaning (rules 1.1 to 1.4)

This is the heart of the standard. An approved word is approved for ONE part of
speech and ONE meaning. The dictionary sets that meaning, and the word is not
available for any other sense. A word that carries two senses in ordinary
English is a candidate for review, and only the dictionary settles it.

This skill does not carry the dictionary, so it cannot settle anything. See
"Vocabulary" below for what you may and may not write in a report.

Two rules need no dictionary and stay checkable:

- Do not join approved words into a phrasal verb (rule 9.3). A phrasal verb
  means something different from the sum of its parts.
- Use one term for one part through the whole document (rule 9.4). If the text
  calls it the drain valve once, it is the drain valve everywhere. This is an
  internal-consistency check, so run it and report it with confidence.

### Multi-word nouns (rules 2.1 and 2.2)

A multi-word noun has three words at most (rule 2.1). A longer cluster hides
the relations between its parts. Break it with a preposition or a relative
clause. "Runway light circuit breaker failure indicator" becomes "the failure
indicator for the runway-light circuit breaker". When the full technical noun
is longer than three words, rule 2.2 tells you to write it in full first.

### Do not omit words (rule 4.2)

Keep the subject, the verb, and the article. Do not use contractions.
Telegraphic style ("Remove cover, check gasket") saves nothing and it damages
translation. Write "Remove the cover. Examine the gasket."

### Vertical lists (rule 4.3)

When one sentence carries more than one condition, more than one object, or a
sequence of actions, present it as a vertical list. A list of steps is
numbered. A list of items or conditions is bulleted. Remember rule 8.4 when you
count the words of the lead-in sentence.

### Paragraphs (rules 6.4 to 6.6)

A paragraph shows related information (rule 6.4). One paragraph covers one
topic (rule 6.5). A paragraph has six sentences at most (rule 6.6). A longer
run becomes a new paragraph, or a vertical list when the content is a sequence
of actions.

### Safety instructions (rules 7.1 to 7.3)

- Use the applicable word, such as "warning" or "caution", to identify the
  level of risk (rule 7.1).
- Start the safety instruction with a clear and accurate command or condition
  (rule 7.2). Never start it with background.
- Give the explanation that shows the risk or the possible result (rule 7.3).
  State it after the command, not instead of it.

Put the safety statement before the step it protects. Correct shape: "Do not
touch the terminals. High voltage can kill you." Wrong shape: "There is a
possibility of electric shock during this procedure."

### Punctuation (rules 8.1 and 8.2)

The semicolon is not permitted in STE (rule 8.1), because it lets an author
build very long sentences. Replace it with a period or restructure the
sentence. Use hyphens to connect words that are directly related (rule 8.2).

## Vocabulary: what you may and may not say

The dictionary is not part of this skill. That fact controls what a report may
claim.

- You MAY say that a word is a candidate for review, and why.
- You MAY apply the rules that need no dictionary: part-of-speech consistency
  inside the document, phrasal verbs (rule 9.3), and consistent terminology
  (rule 9.4).
- You MAY NOT call a word approved or unapproved unless you actually read the
  entry in the official dictionary during this run.
- You MAY NOT propose a substitution as an approved alternative on that basis
  alone. Offer it as a suggestion and mark it unverified.

Every vocabulary finding carries a source field:

```
source: ASD-STE100 Issue 9, dictionary entry "<word>"   (only if you read it)
source: not verified, dictionary not consulted
```

When the source is not verified, the only valid rule value is
`vocabulary-unverified`. It is never a violation, and it never blocks, not even
in CONTRACTED STE mode. Say plainly in the summary that the vocabulary pass did
not run against the dictionary.

If no approved word seems to carry the technical meaning, route the decision to
the technical noun and technical verb categories (rules 1.5 to 1.7 and 1.12 to
1.13), and say which category you think applies and why. The author confirms
it against the specification.

## Report format for a lint run

Report findings in document order. Give each finding a stable ID, so a second
run over unchanged text produces the same IDs and the same order.

Build the ID as `STE-<line>-<rule-or-category>-<n>`, where `<n>` counts
findings that share the first two parts. For pasted text that has no file,
number the lines yourself from 1, starting at the first line of the pasted
block, and say in the summary that the line numbers are synthetic.

```
[STE-0042-5.1-1]  <file>:<line>
  rule:       5.1                      (a number from the table above, or empty)
  category:   sentence-length | one-instruction | voice | verb-form |
              multi-word-noun | omitted-word | vertical-list | paragraph |
              safety | punctuation | vocabulary-unverified | consistency
  issue:      ASD-STE100 Issue 9
  span:       "<the exact offending text>"
  measured:   <the count or other measured value, when the rule measures one>
  why:        <the rule in one sentence>
  severity:   blocking | advisory
  confidence: high | medium | low
  fix:        "<the proposed rewrite>"  or  deferred
  source:     <required for a vocabulary finding, see above>
  note:       <what a subject-matter expert must confirm>
```

Rules for the fields:

- `rule` stays empty when the number is not in the table. Fill `category`
  always.
- `severity` is `blocking` only in CONTRACTED STE mode, and never for
  `vocabulary-unverified`.
- `confidence` is `low` whenever the test could not separate two readings, such
  as a possible adjectival participle or a possible simultaneous action.
- `fix` is `deferred` whenever the rewrite could change the technical meaning.
  Say what the author must decide. A wrong fix in a procedure is worse than an
  open finding.
- One finding per span. When two rules hit the same span, report the more
  specific rule and name the other in `note`. Do not emit two findings for one
  span.

Close the report with a summary: the mode used, the counting method, the count
per category, and an explicit list of what you could NOT check. Vocabulary
belongs on that list unless you read the dictionary. Never report a compliance
score, and never call a text conformant.

## Licensing: never bundle the dictionary

ASD fully owns ASD-STE100. The specification is free of charge, but free is not
the same as freely redistributable. ASD grants reproduction rights to a named
list of member organizations and institutions, and it prohibits unauthorized
distribution without written permission from the STEMG. A public plugin pack is
not on that list.

- Do not paste the word list, or an extract of it, into this repository, into a
  generated file, or into a chat answer that reads as a substitute for the
  dictionary.
- Do not paste the specification text either. Paraphrase a rule and cite its
  number.
- Do cite the official specification as the source of truth. Quote a single
  dictionary entry only while you discuss that one entry with the author.
- Before anyone ships a machine-readable word list with this pack, get the
  licensing confirmed in writing by ASD. Until that confirmation exists, every
  vocabulary check stays advisory and the report says so.

## Boundaries (what this skill defers)

- **Technical accuracy** belongs to the subject-matter expert. This skill
  checks language, never facts.
- **The authoritative vocabulary** belongs to the official ASD specification.
- **The authoritative rule text** belongs there too. This skill paraphrases.
- **Document structure and information typing** belong to S1000D or to the ATA
  specification in force, not here.
- **Terminology decisions** belong to the program's terminology list. This
  skill checks consistency with that list. It does not create the list.
- **Certified conformance** comes from the program's approved checker and its
  qualified authors. This skill never claims certification.

## Steps (operational)

1. Establish the scope: which document, which audience, which specification and
   issue, and which mode. Ask once if the answer is not in the request.
2. Read the text. Split it into sentences, and classify each one as an
   instruction or as a description. The classification sets the word limit.
3. Run the checkable rules in order: sentence length with the counting method,
   one instruction per sentence, voice, verb forms, multi-word nouns, omitted
   words, vertical lists, paragraphs, safety instructions, punctuation, and the
   consistency checks. Run the vocabulary pass last, and mark it unverified
   unless you read the dictionary.
4. Write one finding per span in the format above, each with a stable ID and a
   concrete fix, or `fix: deferred` when the meaning could change.
5. On request, apply the rewrites with `Edit`, one rule at a time. Apply only
   the findings whose fix is concrete. Leave a deferred finding in the file and
   raise the question. After the edit, say what you changed and what you left.
6. Close with the limits: the mode, the counting method, what you could not
   check, and the reminder that a qualified author and a subject-matter expert
   confirm the result before it ships.
