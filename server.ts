import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import {
  MIN_DUOLINGO_SCORE,
  getExamTestSpec,
  isValidExamTestType,
  runDeterministicExamChecks,
} from './src/utils/examBlueprint';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Set it in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

interface AnalyzeExamRequestBody {
  testType?: unknown;
  applicantName?: unknown;
  applicantEmail?: unknown;
  targetRole?: unknown;
  duolingoScoreRaw?: unknown;
  duolingoProof?: unknown;
  scenarioResponse?: unknown;
  trickConstraint?: unknown;
  trickLogic?: unknown;
  trickCanary?: unknown;
}

function asCleanString(val: unknown, maxLen: number): string {
  if (typeof val !== 'string') return '';
  return val.trim().slice(0, maxLen);
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true });
  });

  app.post('/api/exams/analyze', async (req, res) => {
    try {
      const body = (req.body ?? {}) as AnalyzeExamRequestBody;
      const applicantName = asCleanString(body.applicantName, 120);
      const applicantEmail = asCleanString(body.applicantEmail, 160);
      const targetRole = asCleanString(body.targetRole, 120);
      const duolingoScoreRaw = asCleanString(body.duolingoScoreRaw, 40);
      const duolingoProof = asCleanString(body.duolingoProof, 300);
      const scenarioResponse = asCleanString(body.scenarioResponse, 4000);
      const trickConstraint = asCleanString(body.trickConstraint, 4000);
      const trickLogic = asCleanString(body.trickLogic, 1000);
      const trickCanary = asCleanString(body.trickCanary, 4000);

      if (!applicantName || !applicantEmail) {
        res.status(400).json({
          error: 'Applicant name and email address are required for exam analysis.',
        });
        return;
      }

      const testType = isValidExamTestType(body.testType)
        ? body.testType
        : 'english_comm';
      const spec = getExamTestSpec(testType);

      const deterministic = runDeterministicExamChecks({
        testType,
        duolingoScoreRaw,
        scenarioResponse,
        trickConstraint,
        trickLogic,
        trickCanary,
      });

      const ai = createGeminiClient();
      const prompt = [
        'You are a strict hiring exam proctor and forensic writing analyst evaluating a Google Forms applicant submission.',
        'Evaluate whether the answers were genuinely written by a human applicant or generated/assisted by an AI assistant, and evaluate answer quality.',
        '',
        `Exam Track: ${spec.label} (${spec.summary})`,
        `Applicant: ${applicantName} (${applicantEmail})`,
        `Target Role: ${targetRole || 'Not specified'}`,
        `Reported Duolingo Score: ${deterministic.duolingoScore} (minimum required: ${MIN_DUOLINGO_SCORE})`,
        `Duolingo Proof Provided: ${duolingoProof || 'None'}`,
        '',
        '--- Deterministic Anti-AI Checks Already Computed ---',
        `- Duolingo >= ${MIN_DUOLINGO_SCORE}: ${deterministic.duolingoPassed}`,
        `- Canary Prompt-Injection Phrase Triggered ("${spec.canaryPhrase}"): ${deterministic.canaryTriggered}`,
        `- Precision Constraint Trick Passed (2 sentences, no forbidden AI clichés): ${deterministic.constraintPassed}`,
        `- Reasoning Logic Trap Passed (${spec.expectedLogicSummary}): ${deterministic.logicPassed}`,
        '',
        '--- Candidate Answers ---',
        `1) Practical Scenario Answer:\n${scenarioResponse || '(blank)'}`,
        '',
        `2) Precision Constraint Trick Answer (asked for exactly 2 sentences, no forbidden words, ending with current city):\n${trickConstraint || '(blank)'}`,
        '',
        `3) Reasoning Logic Trap Answer (${spec.expectedLogicSummary}):\n${trickLogic || '(blank)'}`,
        '',
        `4) Written Communication + Canary Trap Answer:\n${trickCanary || '(blank)'}`,
        '',
        'Assess stylometric AI indicators (overly polished template structures, generic corporate phrasing, hedging lists, unnatural uniformity, ignoring personal specificity, obeying hidden canary instruction).',
        'Be fair to fluent non-native English speakers who give specific, genuine human answers, while flagging synthetic LLM prose or trick-question failures.',
      ].join('\n');

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: prompt,
        config: {
          thinkingConfig: {
            thinkingLevel: ThinkingLevel.LOW,
          },
          systemInstruction:
            'Return strict JSON evaluating AI authorship probability (0-100), answer quality (0-100), trick question integrity, concrete flags, and a concise 2-sentence verdict.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              aiLikelihoodPct: {
                type: Type.INTEGER,
                description:
                  'Estimated probability (0 to 100) that answers were AI-generated.',
              },
              qualityScore: {
                type: Type.INTEGER,
                description:
                  'Overall substance, specificity, and clarity score (0 to 100).',
              },
              trickConstraintCityIncluded: {
                type: Type.BOOLEAN,
                description:
                  'True if the Precision Check answer ended with a plausible city name as instructed.',
              },
              aiSignals: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description:
                  'Specific forensic observations or red flags explaining the AI probability.',
              },
              summary: {
                type: Type.STRING,
                description:
                  'Concise 1-2 sentence proctor verdict suitable for a hiring table.',
              },
            },
            required: [
              'aiLikelihoodPct',
              'qualityScore',
              'trickConstraintCityIncluded',
              'aiSignals',
              'summary',
            ],
          },
        },
      });

      const rawJson = (response.text ?? '').trim();
      if (!rawJson) {
        res.status(502).json({
          error: 'Gemini analysis returned an empty response. Please retry.',
        });
        return;
      }

      const parsed = JSON.parse(rawJson) as {
        aiLikelihoodPct?: number;
        qualityScore?: number;
        trickConstraintCityIncluded?: boolean;
        aiSignals?: string[];
        summary?: string;
      };

      const baseAiPct = Math.max(
        0,
        Math.min(100, Math.round(Number(parsed.aiLikelihoodPct ?? 50)))
      );
      const aiLikelihoodPct = deterministic.canaryTriggered
        ? Math.max(98, baseAiPct)
        : baseAiPct;
      const qualityScore = Math.max(
        0,
        Math.min(100, Math.round(Number(parsed.qualityScore ?? 0)))
      );
      const cityOk = Boolean(parsed.trickConstraintCityIncluded);

      const flags = [...deterministic.deterministicFlags];
      if (!cityOk && trickConstraint.trim().length > 0) {
        flags.push(
          'Precision Check did not end with the applicant’s current city as instructed.'
        );
      }
      if (Array.isArray(parsed.aiSignals)) {
        for (const sig of parsed.aiSignals) {
          const cleanSig = String(sig).trim();
          if (cleanSig && !flags.includes(cleanSig)) {
            flags.push(cleanSig);
          }
        }
      }

      const trickQuestionsPassed =
        !deterministic.canaryTriggered &&
        deterministic.constraintPassed &&
        cityOk &&
        deterministic.logicPassed;
      const aiSuspected = deterministic.canaryTriggered || aiLikelihoodPct >= 55;
      const passed =
        deterministic.duolingoPassed &&
        trickQuestionsPassed &&
        !aiSuspected &&
        qualityScore >= 60;

      res.json({
        testType,
        duolingoScore: deterministic.duolingoScore,
        duolingoPassed: deterministic.duolingoPassed,
        canaryTriggered: deterministic.canaryTriggered,
        trickQuestionsPassed,
        aiLikelihoodPct,
        aiSuspected,
        qualityScore,
        passed,
        flags: flags.slice(0, 8),
        summary:
          asCleanString(parsed.summary, 400) ||
          (passed
            ? 'Passed Duolingo requirement, trick questions, and human-authorship review.'
            : 'Did not meet passing criteria for Duolingo score, trick questions, or human authorship.'),
      });
    } catch (error) {
      console.error('Exam analysis error:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to analyze exam responses right now.';
      res.status(500).json({ error: message });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('/{*splat}', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output not found.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Cadence server listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
