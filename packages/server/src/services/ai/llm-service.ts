// =====================================================================
// LLM Service
// OpenAI GPT-5 integration for enhanced AI analysis
// =====================================================================

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-5'; // GPT-5 flagship model
const OPENAI_FALLBACK_MODEL = 'gpt-4-turbo-preview'; // Fallback if GPT-5 unavailable

// Request timeout
const REQUEST_TIMEOUT_MS = 30000;

interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

interface ChatCompletionResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: {
        index: number;
        message: {
            role: string;
            content: string;
        };
        finish_reason: string;
    }[];
    usage: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

interface LLMAnalysisResult {
    success: boolean;
    content?: string;
    model?: string;
    tokens?: {
        prompt: number;
        completion: number;
        total: number;
    };
    error?: string;
}

/**
 * Check if OpenAI is configured
 */
export function isLLMConfigured(): boolean {
    return Boolean(OPENAI_API_KEY);
}

/**
 * Get the current model configuration
 */
export function getLLMModelInfo(): { model: string; fallback: string; configured: boolean } {
    return {
        model: OPENAI_MODEL,
        fallback: OPENAI_FALLBACK_MODEL,
        configured: isLLMConfigured()
    };
}

/**
 * Send a chat completion request to OpenAI
 */
export async function chatCompletion(
    messages: ChatMessage[],
    options: {
        temperature?: number;
        maxTokens?: number;
        model?: string;
    } = {}
): Promise<LLMAnalysisResult> {
    if (!isLLMConfigured()) {
        return {
            success: false,
            error: 'OpenAI API key not configured'
        };
    }

    const model = options.model || OPENAI_MODEL;
    const temperature = options.temperature ?? 0.7;
    const maxTokens = options.maxTokens ?? 1000;

    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        const response = await fetch(`${OPENAI_BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model,
                messages,
                temperature,
                max_tokens: maxTokens
            }),
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));

            // If GPT-5 not available, try fallback
            if (response.status === 404 && model === OPENAI_MODEL && model !== OPENAI_FALLBACK_MODEL) {
                console.warn(`Model ${model} not available, falling back to ${OPENAI_FALLBACK_MODEL}`);
                return chatCompletion(messages, { ...options, model: OPENAI_FALLBACK_MODEL });
            }

            return {
                success: false,
                error: `OpenAI API error: ${response.status} - ${JSON.stringify(errorData)}`
            };
        }

        const data = await response.json() as ChatCompletionResponse;

        return {
            success: true,
            content: data.choices[0]?.message?.content || '',
            model: data.model,
            tokens: {
                prompt: data.usage.prompt_tokens,
                completion: data.usage.completion_tokens,
                total: data.usage.total_tokens
            }
        };
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            return {
                success: false,
                error: 'Request timed out'
            };
        }

        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}

/**
 * Analyze an incident using GPT-5
 */
export async function analyzeIncident(
    incidentDescription: string,
    contextData: Record<string, unknown>
): Promise<LLMAnalysisResult> {
    const systemPrompt = `You are an expert motorsport steward and race control analyst. 
You analyze racing incidents and provide objective assessments based on FIA regulations and sim racing best practices.
Your analysis should be fair, detailed, and consider all factors.
Always structure your response as JSON.`;

    const userPrompt = `Analyze this racing incident:

${incidentDescription}

Context data:
${JSON.stringify(contextData, null, 2)}

Provide your analysis in the following JSON format:
{
  "faultAssessment": {
    "primaryDriver": "driver_id or null",
    "faultPercentage": 0-100,
    "reasoning": "explanation"
  },
  "classification": {
    "type": "racing_incident | avoidable_contact | reckless_driving | unsafe_rejoin | track_limits | other",
    "severity": "minor | moderate | major | critical"
  },
  "recommendedAction": {
    "type": "no_action | warning | time_penalty | position_penalty | disqualification",
    "value": "penalty details if applicable",
    "reasoning": "why this penalty is appropriate"
  },
  "confidence": 0.0-1.0,
  "additionalNotes": "any other relevant observations"
}`;

    return chatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ], {
        temperature: 0.3, // Lower temperature for more consistent analysis
        maxTokens: 1500
    });
}

/**
 * Generate race commentary using GPT-5
 */
export async function generateCommentary(
    eventContext: string,
    recentEvents: string[],
    style: 'professional' | 'casual' | 'technical' = 'professional'
): Promise<LLMAnalysisResult> {
    const styleGuides = {
        professional: 'formal TV broadcast style, like Murray Walker or Martin Brundle',
        casual: 'enthusiastic and fan-friendly, like a popular streamer',
        technical: 'detailed technical analysis, focusing on driving technique and strategy'
    };

    const systemPrompt = `You are a motorsport commentator providing ${styleGuides[style]} commentary.
Keep responses concise but engaging. Reference specific drivers and events.`;

    const userPrompt = `Race context:
${eventContext}

Recent events to comment on:
${recentEvents.map((e, i) => `${i + 1}. ${e}`).join('\n')}

Provide engaging commentary for these events:`;

    return chatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ], {
        temperature: 0.8, // Higher temperature for more creative commentary
        maxTokens: 500
    });
}

/**
 * Analyze driver behavior patterns using GPT-5
 */
export async function analyzeDriverBehavior(
    driverHistory: {
        name: string;
        incidents: { type: string; severity: string; fault: number }[];
        racesCompleted: number;
        averageFinishPosition: number;
    }
): Promise<LLMAnalysisResult> {
    const systemPrompt = `You are a motorsport driving standards analyst.
Analyze driver behavior patterns and provide objective assessments.
Focus on safety, consistency, and areas for improvement.`;

    const userPrompt = `Analyze this driver's behavior pattern:

Driver: ${driverHistory.name}
Races Completed: ${driverHistory.racesCompleted}
Average Finish Position: ${driverHistory.averageFinishPosition.toFixed(1)}

Incident History:
${driverHistory.incidents.map(i => `- ${i.type} (${i.severity}): ${i.fault}% fault`).join('\n')}

Provide your assessment as JSON:
{
  "riskLevel": "low | moderate | high",
  "drivingStyle": "aggressive | balanced | conservative",
  "strengthAreas": ["list of strengths"],
  "improvementAreas": ["list of areas to improve"],
  "recommendedFocus": "primary recommendation",
  "overallAssessment": "brief summary"
}`;

    return chatCompletion([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
    ], {
        temperature: 0.4,
        maxTokens: 800
    });
}
