import {
  MIN_DUOLINGO_SCORE,
  getExamTestSpec,
} from './examBlueprint';
import type { ExamFormQuestionMap, ExamTestType } from '../types/payroll';

const FORMS_API_BASE = 'https://forms.googleapis.com/v1/forms';

export interface GoogleFormItemRaw {
  itemId?: string;
  title?: string;
  questionItem?: {
    question?: {
      questionId?: string;
    };
  };
}

export interface GoogleFormMetadataRaw {
  formId?: string;
  info?: {
    title?: string;
    documentTitle?: string;
    description?: string;
  };
  responderUri?: string;
  items?: GoogleFormItemRaw[];
}

export interface GoogleFormAnswerRaw {
  questionId?: string;
  textAnswers?: {
    answers?: Array<{ value?: string }>;
  };
}

export interface GoogleFormResponseRaw {
  responseId?: string;
  createTime?: string;
  lastSubmittedTime?: string;
  respondentEmail?: string;
  answers?: Record<string, GoogleFormAnswerRaw>;
}

export interface ParsedFormCandidateResponse {
  responseId: string;
  submittedAt: string;
  applicantName: string;
  applicantEmail: string;
  targetRole: string;
  duolingoScoreRaw: string;
  duolingoProof: string;
  scenarioResponse: string;
  trickConstraint: string;
  trickLogic: string;
  trickCanary: string;
}

export interface ExamAnalysisResult {
  testType: ExamTestType;
  duolingoScore: number;
  duolingoPassed: boolean;
  canaryTriggered: boolean;
  trickQuestionsPassed: boolean;
  aiLikelihoodPct: number;
  aiSuspected: boolean;
  qualityScore: number;
  passed: boolean;
  flags: string[];
  summary: string;
}

export function extractFormIdFromInput(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error('Enter a Google Form URL or Form ID.');
  }

  if (trimmed.includes('/forms/d/e/')) {
    throw new Error(
      'That looks like a public responder link (/forms/d/e/...). Paste the Form edit URL (/forms/d/<FORM_ID>/edit) or the raw Form ID instead.'
    );
  }

  const urlMatch = trimmed.match(/\/forms\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch?.[1]) {
    return urlMatch[1];
  }

  if (/^[a-zA-Z0-9_-]{10,160}$/.test(trimmed)) {
    return trimmed;
  }

  throw new Error(
    'Could not recognize a valid Google Form ID. Paste the form edit URL (https://docs.google.com/forms/d/FORM_ID/edit) or raw Form ID.'
  );
}

async function parseFormsError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as {
      error?: { message?: string; status?: string };
    };
    if (data.error?.message) {
      return `Google Forms API (${response.status}): ${data.error.message}`;
    }
  } catch {
    // fallback below
  }
  return `Google Forms API request failed with HTTP ${response.status}.`;
}

export function buildQuestionMapFromItems(
  items: GoogleFormItemRaw[] | undefined
): ExamFormQuestionMap {
  const map: ExamFormQuestionMap = {
    qFullName: '',
    qEmail: '',
    qTargetRole: '',
    qDuolingoScore: '',
    qDuolingoProof: '',
    qScenario: '',
    qTrickConstraint: '',
    qTrickLogic: '',
    qTrickCanary: '',
  };

  if (!Array.isArray(items)) return map;

  for (const item of items) {
    const qId = item.questionItem?.question?.questionId;
    const title = (item.title ?? '').toLowerCase();
    if (!qId) continue;

    if (!map.qFullName && title.includes('full name')) {
      map.qFullName = qId;
    } else if (!map.qEmail && title.includes('email')) {
      map.qEmail = qId;
    } else if (
      !map.qTargetRole &&
      (title.includes('target role') || title.includes('position'))
    ) {
      map.qTargetRole = qId;
    } else if (
      !map.qDuolingoScore &&
      title.includes('duolingo') &&
      title.includes('score')
    ) {
      map.qDuolingoScore = qId;
    } else if (
      !map.qDuolingoProof &&
      title.includes('duolingo') &&
      (title.includes('certificate') ||
        title.includes('link') ||
        title.includes('proof'))
    ) {
      map.qDuolingoProof = qId;
    } else if (
      !map.qScenario &&
      (title.includes('scenario') ||
        title.includes('deadline') ||
        title.includes('discrepancy') ||
        title.includes('workflow') ||
        title.includes('stakeholder'))
    ) {
      map.qScenario = qId;
    } else if (
      !map.qTrickConstraint &&
      (title.includes('precision') || title.includes('constraint'))
    ) {
      map.qTrickConstraint = qId;
    } else if (
      !map.qTrickLogic &&
      (title.includes('reasoning') ||
        title.includes('scheduling') ||
        title.includes('sequencing') ||
        title.includes('pipeline') ||
        title.includes('schedule'))
    ) {
      map.qTrickLogic = qId;
    } else if (
      !map.qTrickCanary &&
      (title.includes('written communication') ||
        title.includes('communication'))
    ) {
      map.qTrickCanary = qId;
    }
  }

  return map;
}

export async function createScreeningExamForm(
  accessToken: string,
  testType: ExamTestType,
  title?: string
): Promise<{
  googleFormId: string;
  testType: ExamTestType;
  title: string;
  responderUri: string;
  editUrl: string;
  questionMap: ExamFormQuestionMap;
}> {
  const spec = getExamTestSpec(testType);
  const cleanTitle = (title ?? '').trim() || spec.defaultFormTitle;

  const createRes = await fetch(FORMS_API_BASE, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      info: {
        title: cleanTitle,
        documentTitle: cleanTitle,
      },
    }),
  });

  if (!createRes.ok) {
    throw new Error(await parseFormsError(createRes));
  }

  const createdForm = (await createRes.json()) as GoogleFormMetadataRaw;
  const googleFormId = createdForm.formId;
  if (!googleFormId) {
    throw new Error('Google Forms API did not return a formId.');
  }

  const requests: Array<Record<string, unknown>> = [
    {
      updateFormInfo: {
        info: {
          description: `${spec.label} — Official Cadence Applicant Assessment.\n\n${spec.summary}\n\nRequirements:\n• Minimum Duolingo English Test score of ${MIN_DUOLINGO_SCORE} (10–160 scale) with verifiable certificate link or ID.\n• All written answers must be authored solely by you without AI assistance.\n• Passing candidates will receive a unique Cadence registration code to create their applicant account.`,
        },
        updateMask: 'description',
      },
    },
    ...spec.questions.map((q, index) => ({
      createItem: {
        item: {
          title: q.title,
          description: q.description,
          questionItem: {
            question: {
              required: q.required,
              textQuestion: {
                paragraph: q.paragraph,
              },
            },
          },
        },
        location: { index },
      },
    })),
  ];

  const batchRes = await fetch(
    `${FORMS_API_BASE}/${encodeURIComponent(googleFormId.trim())}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        includeFormInResponse: true,
        requests,
      }),
    }
  );

  if (!batchRes.ok) {
    throw new Error(await parseFormsError(batchRes));
  }

  const batchJson = (await batchRes.json()) as {
    form?: GoogleFormMetadataRaw;
  };
  const updatedForm = batchJson.form ?? createdForm;
  const questionMap = buildQuestionMapFromItems(updatedForm.items);
  const responderUri =
    updatedForm.responderUri ||
    `https://docs.google.com/forms/d/${encodeURIComponent(googleFormId)}/viewform`;
  const editUrl = `https://docs.google.com/forms/d/${encodeURIComponent(googleFormId)}/edit`;

  return {
    googleFormId,
    testType,
    title: updatedForm.info?.title || cleanTitle,
    responderUri,
    editUrl,
    questionMap,
  };
}

export async function fetchFormMetadata(
  accessToken: string,
  formId: string
): Promise<{
  googleFormId: string;
  title: string;
  responderUri: string;
  editUrl: string;
  questionMap: ExamFormQuestionMap;
}> {
  const safeId = encodeURIComponent(formId.trim());
  const res = await fetch(`${FORMS_API_BASE}/${safeId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(await parseFormsError(res));
  }

  const form = (await res.json()) as GoogleFormMetadataRaw;
  const resolvedId = form.formId || formId.trim();
  return {
    googleFormId: resolvedId,
    title: form.info?.title || form.info?.documentTitle || 'Linked Screening Exam',
    responderUri:
      form.responderUri ||
      `https://docs.google.com/forms/d/${encodeURIComponent(resolvedId)}/viewform`,
    editUrl: `https://docs.google.com/forms/d/${encodeURIComponent(resolvedId)}/edit`,
    questionMap: buildQuestionMapFromItems(form.items),
  };
}

export async function fetchFormResponses(
  accessToken: string,
  formId: string
): Promise<GoogleFormResponseRaw[]> {
  const safeId = encodeURIComponent(formId.trim());
  const res = await fetch(`${FORMS_API_BASE}/${safeId}/responses`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(await parseFormsError(res));
  }

  const data = (await res.json()) as { responses?: GoogleFormResponseRaw[] };
  return Array.isArray(data.responses) ? data.responses : [];
}

function readAnswerValue(
  answers: Record<string, GoogleFormAnswerRaw> | undefined,
  questionId: string
): string {
  if (!answers || !questionId) return '';
  const entry = answers[questionId];
  const values = entry?.textAnswers?.answers
    ?.map((a) => (a.value ?? '').trim())
    .filter(Boolean);
  return values ? values.join(' ') : '';
}

export function parseGoogleFormResponses(
  questionMap: ExamFormQuestionMap,
  rawResponses: GoogleFormResponseRaw[]
): ParsedFormCandidateResponse[] {
  return rawResponses.map((raw, idx) => {
    const answers = raw.answers;
    const responseId = raw.responseId || `resp-${idx + 1}`;
    const applicantName =
      readAnswerValue(answers, questionMap.qFullName) || 'Unnamed Applicant';
    const applicantEmail = (
      readAnswerValue(answers, questionMap.qEmail) ||
      raw.respondentEmail ||
      ''
    )
      .trim()
      .toLowerCase();

    return {
      responseId,
      submittedAt: raw.lastSubmittedTime || raw.createTime || new Date().toISOString(),
      applicantName,
      applicantEmail,
      targetRole: readAnswerValue(answers, questionMap.qTargetRole),
      duolingoScoreRaw: readAnswerValue(answers, questionMap.qDuolingoScore),
      duolingoProof: readAnswerValue(answers, questionMap.qDuolingoProof),
      scenarioResponse: readAnswerValue(answers, questionMap.qScenario),
      trickConstraint: readAnswerValue(answers, questionMap.qTrickConstraint),
      trickLogic: readAnswerValue(answers, questionMap.qTrickLogic),
      trickCanary: readAnswerValue(answers, questionMap.qTrickCanary),
    };
  });
}

export async function analyzeExamSubmission(payload: {
  testType: ExamTestType;
  applicantName: string;
  applicantEmail: string;
  targetRole: string;
  duolingoScoreRaw: string;
  duolingoProof: string;
  scenarioResponse: string;
  trickConstraint: string;
  trickLogic: string;
  trickCanary: string;
}): Promise<ExamAnalysisResult> {
  const res = await fetch('/api/exams/analyze', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = (await res.json()) as Partial<ExamAnalysisResult> & {
    error?: string;
  };
  if (!res.ok) {
    throw new Error(data.error || `Exam analysis failed (HTTP ${res.status}).`);
  }

  return {
    testType: payload.testType,
    duolingoScore: Number(data.duolingoScore ?? 0),
    duolingoPassed: Boolean(data.duolingoPassed),
    canaryTriggered: Boolean(data.canaryTriggered),
    trickQuestionsPassed: Boolean(data.trickQuestionsPassed),
    aiLikelihoodPct: Number(data.aiLikelihoodPct ?? 0),
    aiSuspected: Boolean(data.aiSuspected),
    qualityScore: Number(data.qualityScore ?? 0),
    passed: Boolean(data.passed),
    flags: Array.isArray(data.flags) ? data.flags.map(String) : [],
    summary: String(data.summary ?? ''),
  };
}
