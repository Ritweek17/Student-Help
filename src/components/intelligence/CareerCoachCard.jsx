import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import {
  Sparkles,
  Send,
  Loader2,
  AlertCircle,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { AuthContext } from '../../context/AuthContext';
import { getCareerCoachAdvice, IntelligenceApiError } from '../../services/intelligenceApi';

/**
 * Contextual configuration and suggested prompts per CareerOS surface.
 */
const CONTEXT_CONFIG = {
  dashboard: {
    badge: 'Dashboard Copilot',
    suggestedPrompts: [
      'What should I focus on this week?',
      'What is my highest-priority career action?',
      'How can I improve my momentum?',
    ],
    defaultPrompt: 'What should I focus on this week?',
  },
  opportunity: {
    badge: 'Opportunity Prep',
    suggestedPrompts: [
      'How should I prepare for this opportunity?',
      'What are my key gaps for this opportunity?',
      'How should I position my background for this role?',
    ],
    defaultPrompt: 'How should I prepare for this opportunity?',
  },
  readiness: {
    badge: 'Readiness Coach',
    suggestedPrompts: [
      'What is my biggest career bottleneck right now?',
      'How can I advance my readiness band?',
      'Which skill should I prioritize learning first?',
    ],
    defaultPrompt: 'What is my biggest career bottleneck right now?',
  },
};

const MAX_QUERY_LENGTH = 500;

/**
 * CareerCoachCard
 *
 * Contextual AI Career Copilot component grounded exclusively in authoritative
 * CareerOS deterministic data (Phase 11H — B5).
 *
 * Architectural & Safety Guarantees:
 * - Never recomputes readiness, match scores, or skill gaps on the client.
 * - Never stores prompts, responses, or session keys in browser storage (localStorage/sessionStorage).
 * - Never sends client-inferred metrics or userId to the AI endpoint.
 * - Gracefully renders deterministic fallback guidance when the AI provider is unavailable.
 * - Keyboard-accessible, screen-reader friendly (aria-live), and responsive.
 *
 * @param {Object} props
 * @param {'dashboard' | 'opportunity' | 'readiness'} [props.contextType='dashboard'] - Surface context
 * @param {string} [props.defaultPrompt] - Optional override for initial prompt
 * @param {string} [props.token] - Optional auth token override (falls back to AuthContext)
 * @param {boolean} [props.defaultExpanded=false] - Initial expanded state
 * @param {boolean} [props.compact=false] - Dense rendering variant
 * @param {string} [props.className=''] - Extra styling classes
 * @param {Object} [props.initialResult=null] - Optional initial result state (for tests or pre-seeded state)
 * @param {Object} [props.initialError=null] - Optional initial error state
 * @param {boolean} [props.initialLoading=false] - Optional initial loading state
 */
export function CareerCoachCard({
  contextType = 'dashboard',
  defaultPrompt: customDefaultPrompt,
  token: propToken,
  defaultExpanded = false,
  compact = false,
  className = '',
  initialResult = null,
  initialError = null,
  initialLoading = false,
}) {
  const auth = useContext(AuthContext);
  const token = propToken || auth?.token;

  const config = CONTEXT_CONFIG[contextType] || CONTEXT_CONFIG.dashboard;
  const initialPrompt = customDefaultPrompt || config.defaultPrompt;

  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [query, setQuery] = useState(initialPrompt);
  const [loading, setLoading] = useState(initialLoading);
  const [result, setResult] = useState(initialResult);
  const [error, setError] = useState(initialError);
  const [lastSubmittedQuery, setLastSubmittedQuery] = useState('');

  const abortControllerRef = useRef(null);

  // Clean up in-flight requests on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  /**
   * Dispatches the AI Career Coach query using the authenticated API client.
   */
  const executeQuery = useCallback(
    async (queryToSubmit) => {
      const trimmed = (queryToSubmit || query).trim();
      if (!trimmed) {
        setError({
          message: 'Please enter a question for the Career Coach.',
          status: 400,
        });
        return;
      }

      if (trimmed.length > MAX_QUERY_LENGTH) {
        setError({
          message: `Career Coach query must be ${MAX_QUERY_LENGTH} characters or fewer.`,
          status: 400,
        });
        return;
      }

      // Abort any previous pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setLoading(true);
      setError(null);
      setLastSubmittedQuery(trimmed);

      // Ensure card is expanded when executing query
      setIsExpanded(true);

      try {
        const response = await getCareerCoachAdvice(token, trimmed, controller.signal);

        if (response?.source === 'ai' && response.data) {
          setResult({
            source: 'ai',
            ...response.data,
            requestId: response.requestId,
          });
        } else if (response?.source === 'deterministic_fallback' && response.fallbackData) {
          setResult({
            source: 'deterministic_fallback',
            reason: response.reason,
            ...response.fallbackData,
            requestId: response.requestId,
          });
        } else if (response?.data) {
          setResult({
            source: 'ai',
            ...response.data,
            requestId: response.requestId,
          });
        } else {
          throw new IntelligenceApiError(
            'Unable to generate advice. Please try again later.',
            500,
            'INVALID_RESPONSE'
          );
        }
      } catch (err) {
        if (err.name === 'AbortError') return;

        setError({
          message: err.message || 'An unexpected error occurred while communicating with Career Coach.',
          status: err.status || 500,
          code: err.code || 'UNKNOWN',
        });
      } finally {
        setLoading(false);
      }
    },
    [query, token]
  );

  const handleSubmit = (e) => {
    e.preventDefault();
    if (loading) return;
    executeQuery(query);
  };

  const handleSuggestedPromptClick = (promptText) => {
    setQuery(promptText);
    if (!loading) {
      executeQuery(promptText);
    }
  };

  const handleRetry = () => {
    if (lastSubmittedQuery) {
      executeQuery(lastSubmittedQuery);
    } else {
      executeQuery(query);
    }
  };

  const isRejectionRelated =
    result?.adviceType?.toLowerCase().includes('rejection') ||
    result?.headline?.toLowerCase().includes('rejection') ||
    result?.suggestedAction?.toLowerCase().includes('rejection');

  return (
    <Card
      padding={compact ? 'sm' : 'md'}
      className={`border-indigo-100 dark:border-indigo-950/60 bg-gradient-to-br from-indigo-50/30 via-white to-purple-50/20 dark:from-slate-900 dark:via-slate-900 dark:to-indigo-950/20 shadow-xs transition-all ${className}`}
    >
      {/* ─── Header / Collapsed Bar ───────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 font-heading truncate">
                AI Career Coach
              </h3>
              <Badge variant="primary" size="sm" className="hidden sm:inline-flex">
                {config.badge}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              AI-generated guidance grounded in your CareerOS data.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
            aria-controls="career-coach-content"
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
            aria-label={isExpanded ? 'Collapse AI Career Coach' : 'Expand AI Career Coach'}
          >
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ─── Collapsed Quick Teaser ──────────────────────────────── */}
      {!isExpanded && (
        <div className="mt-3 pt-3 border-t border-indigo-100/50 dark:border-slate-800/60 flex flex-wrap items-center justify-between gap-2">
          {result ? (
            <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 min-w-0 truncate">
              {result.source === 'deterministic_fallback' ? (
                <ShieldCheck className="w-3.5 h-3.5 text-amber-500 shrink-0" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
              )}
              <span className="font-medium truncate">{result.headline}</span>
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Need contextual direction? Ask what to prioritize next.
            </p>
          )}

          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setIsExpanded(true);
              if (!result && !loading) {
                executeQuery(query);
              }
            }}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 py-1 px-2.5 ml-auto"
          >
            {result ? 'View Guidance' : 'Ask Coach'}
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      )}

      {/* ─── Expanded Surface ─────────────────────────────────────── */}
      {isExpanded && (
        <div id="career-coach-content" className="mt-4 space-y-4">
          {/* Suggested Contextual Prompts */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Suggested Questions
            </span>
            <div className="flex flex-wrap gap-1.5">
              {config.suggestedPrompts.map((promptText, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSuggestedPromptClick(promptText)}
                  disabled={loading}
                  className="text-left text-xs px-2.5 py-1 rounded-lg border border-indigo-200/70 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:border-indigo-400 dark:hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {promptText}
                </button>
              ))}
            </div>
          </div>

          {/* Query Input Box */}
          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="relative">
              <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                maxLength={MAX_QUERY_LENGTH}
                disabled={loading}
                rows={2}
                placeholder="Ask about your next career priority or role preparation..."
                aria-label="Ask AI Career Coach"
                className="w-full text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none transition-all disabled:opacity-60"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 px-1">
                <span>Maximum 500 characters</span>
                <span className={query.length >= MAX_QUERY_LENGTH ? 'text-red-500 font-semibold' : ''}>
                  {query.length}/{MAX_QUERY_LENGTH}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="submit"
                size="sm"
                variant="primary"
                disabled={loading || !query.trim() || query.length > MAX_QUERY_LENGTH}
                className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                    <span>Analyzing CareerOS Data...</span>
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    <span>Get Guidance</span>
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* ─── Async Status / Live Region ─────────────────────────── */}
          <div aria-live="polite" className="space-y-3">
            {/* Loading Indicator */}
            {loading && (
              <div className="p-4 rounded-xl border border-indigo-100 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 space-y-3 animate-pulse">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Synthesizing guidance grounded in your profile and activity...</span>
                </div>
                {!result && (
                  <>
                    <div className="h-4 bg-slate-200 dark:bg-slate-800 rounded-md w-3/4" />
                    <div className="space-y-1.5">
                      <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-md w-full" />
                      <div className="h-3 bg-slate-100 dark:bg-slate-800 rounded-md w-5/6" />
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div
                role="alert"
                className="p-3.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/80 dark:bg-red-950/40 text-red-900 dark:text-red-200 text-xs space-y-2"
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{error.message}</p>
                    {error.status === 401 && (
                      <p className="text-[11px] text-red-700 dark:text-red-300 mt-0.5">
                        Please sign in again to receive personalized guidance.
                      </p>
                    )}
                    {error.status === 429 && (
                      <p className="text-[11px] text-red-700 dark:text-red-300 mt-0.5">
                        To maintain service reliability, queries are rate-limited. Please retry in a short while.
                      </p>
                    )}
                  </div>
                </div>

                {error.status !== 401 && error.status !== 429 && (
                  <div className="flex justify-end pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleRetry}
                      disabled={loading}
                      className="text-xs py-1 px-2.5 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Retry
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Structured Guidance Result Display */}
            {result && (
              <div
                className={`p-4 rounded-xl border border-indigo-100 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 shadow-2xs space-y-3.5 transition-opacity ${
                  loading ? 'opacity-50 pointer-events-none' : ''
                }`}
              >
                {/* Fallback Banner if applicable */}
                {result.source === 'deterministic_fallback' && (
                  <div className="p-2.5 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/80 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
                    <Info className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>
                      Career Coach is temporarily unavailable. Here's a trusted CareerOS recommendation based on your current profile.
                    </span>
                  </div>
                )}

                {/* Advice Type Badge & Headline */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {result.adviceType && (
                      <Badge variant="primary" size="sm">
                        {result.adviceType}
                      </Badge>
                    )}
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      {result.source === 'ai' ? (
                        <>
                          <Sparkles className="w-3 h-3 text-indigo-500" /> Grounded Guidance
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="w-3 h-3 text-amber-500" /> Deterministic Rule
                        </>
                      )}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 leading-snug">
                    {result.headline}
                  </h4>
                </div>

                {/* Key Points */}
                {result.keyPoints?.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Key Recommendations
                    </span>
                    <ul className="space-y-1.5 text-xs text-slate-700 dark:text-slate-300">
                      {result.keyPoints.map((point, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
                          <span className="leading-relaxed">{point}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Referenced Skills */}
                {result.referencedSkills?.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                      Referenced Skills
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {result.referencedSkills.map((skill, idx) => (
                        <Badge key={idx} variant="default" size="sm">
                          {skill}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Suggested Action Callout */}
                {result.suggestedAction && (
                  <div className="p-3 rounded-lg border border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/60 dark:bg-indigo-950/30 flex items-start gap-2.5">
                    <Zap className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 block">
                        Recommended Next Step
                      </span>
                      <p className="text-xs text-indigo-900/90 dark:text-indigo-300 leading-relaxed mt-0.5">
                        {result.suggestedAction}
                      </p>
                    </div>
                  </div>
                )}

                {/* Transparency Footnote */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 space-y-0.5">
                  <p>AI-generated guidance grounded in your CareerOS data.</p>
                  {isRejectionRelated && (
                    <p className="italic">
                      Observed patterns, not confirmed employer rejection reasons.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
