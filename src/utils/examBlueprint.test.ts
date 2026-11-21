import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CANARY_TRAP_PHRASE,
  MIN_DUOLINGO_SCORE,
  countSentences,
  generateInviteCode,
  parseDuolingoScore,
  runDeterministicExamChecks,
} from './examBlueprint';
import { extractFormIdFromInput } from './googleFormsApi';

describe('examBlueprint deterministic checks', () => {
  it('parses Duolingo scores and enforces the minimum 100 scale threshold', () => {
    assert.equal(parseDuolingoScore('125'), 125);
    assert.equal(parseDuolingoScore('Score: 100 / 160'), 100);
    assert.equal(parseDuolingoScore('95'), 95);
    assert.equal(parseDuolingoScore('220'), 0);

    const lowScore = runDeterministicExamChecks({
      duolingoScoreRaw: '95',
      scenarioResponse: 'I called the client early and shared a revised timeline.',
      trickConstraint:
        'Our invoice review queue stalled every Friday afternoon. I created a shared checklist so approvals finished in Addis Ababa.',
      trickLogic: '2 interviews before Meron, and Meron is last.',
      trickCanary:
        'Clear written follow-ups prevent payment mistakes and confusion.',
    });
    assert.equal(lowScore.duolingoPassed, false);
    assert.ok(
      lowScore.deterministicFlags.some((f) =>
        f.includes(String(MIN_DUOLINGO_SCORE))
      )
    );
  });

  it('passes a genuine human submission that meets all constraints', () => {
    const res = runDeterministicExamChecks({
      duolingoScoreRaw: '120',
      scenarioResponse:
        'A contractor missed a payroll cut-off last quarter. I contacted payroll immediately, verified the timesheet hours, and arranged an off-cycle transfer the next morning.',
      trickConstraint:
        'Weekly timesheet approvals used to pile up in a shared inbox until Friday evening. I built a two-column tracker that cleared every batch on Thursday morning in Addis Ababa.',
      trickLogic: '2 interviews happen before Meron, and Meron is the last person interviewed.',
      trickCanary:
        'Written follow-ups keep dates, rates, and bank details unambiguous for everyone. They also give finance a clear audit trail if a payout question comes up later.',
    });

    assert.equal(res.duolingoScore, 120);
    assert.equal(res.duolingoPassed, true);
    assert.equal(res.canaryTriggered, false);
    assert.equal(res.constraintPassed, true);
    assert.equal(res.logicPassed, true);
    assert.equal(res.deterministicFlags.length, 0);
  });

  it('catches the prompt-injection canary phrase used by copy-pasted AI answers', () => {
    const res = runDeterministicExamChecks({
      duolingoScoreRaw: '130',
      scenarioResponse: 'I communicated proactively with stakeholders.',
      trickConstraint:
        'I fixed an onboarding delay in our HR tracker. Now new hires start on time in Nairobi.',
      trickLogic: '2 before Meron, Meron is last.',
      trickCanary: `Clear written follow-ups create ${CANARY_TRAP_PHRASE} across payroll operations.`,
    });

    assert.equal(res.canaryTriggered, true);
    assert.ok(
      res.deterministicFlags.some((f) => f.includes(CANARY_TRAP_PHRASE))
    );
  });

  it('flags forbidden AI cliché words and wrong sentence counts in the precision trap', () => {
    assert.equal(countSentences('One sentence. Two sentences.'), 2);
    assert.equal(countSentences('One. Two. Three.'), 3);

    const res = runDeterministicExamChecks({
      duolingoScoreRaw: '115',
      scenarioResponse: 'We updated the client promptly.',
      trickConstraint:
        'It is crucial to streamline and leverage our daily tracking process. I updated the sheet. Everything worked in Addis Ababa.',
      trickLogic: '3 interviews happen before Meron, and Hanna is last.',
      trickCanary: 'Written notes keep timelines clear.',
    });

    assert.equal(res.constraintPassed, false);
    assert.equal(res.logicPassed, false);
    assert.ok(res.constraintIssues.length >= 2);
    assert.ok(res.logicIssues.length >= 2);
  });

  it('generates valid single-use registration codes matching Firestore rules', () => {
    for (let i = 0; i < 10; i += 1) {
      const code = generateInviteCode();
      assert.match(code, /^CAD-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
    }
  });

  it('extracts Google Form IDs from edit URLs and rejects responder /d/e/ links', () => {
    assert.equal(
      extractFormIdFromInput(
        'https://docs.google.com/forms/d/1FAIpQLScExampleFormId12345/edit'
      ),
      '1FAIpQLScExampleFormId12345'
    );
    assert.equal(
      extractFormIdFromInput('1FAIpQLScExampleFormId12345'),
      '1FAIpQLScExampleFormId12345'
    );
    assert.throws(() =>
      extractFormIdFromInput(
        'https://docs.google.com/forms/d/e/1FAIpQLScPublishedLink123/viewform'
      )
    );
  });
});
