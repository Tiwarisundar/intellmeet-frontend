import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Brain, FileText, CheckSquare, ArrowLeft,
  Loader2, Copy, Check, MessageSquare, Send
} from 'lucide-react';
import useThemeStore from '../../store/themeStore';
import api from '../../services/api';

const PostMeeting = () => {
  const navigate = useNavigate();
  const { isDark } = useThemeStore();

  const [transcript, setTranscript] = useState('');
  const [summary, setSummary] = useState<any>(null);
  const [actionItems, setActionItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiAnswer, setAiAnswer] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'actions' | 'ai'>('summary');
  const [error, setError] = useState('');

  const bg = isDark ? 'bg-gray-950' : 'bg-gray-50';
  const cardBg = isDark ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200';
  const textPrimary = isDark ? 'text-white' : 'text-gray-900';
  const textSecondary = isDark ? 'text-gray-400' : 'text-gray-500';
  const inputBg = isDark
    ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-500'
    : 'bg-white border-gray-200 text-gray-900 placeholder-gray-400';

  const handleGenerateSummary = async () => {
    if (!transcript.trim()) return;
    setLoading(true);
    setError('');
    setSummary(null);
    setActionItems([]);

    try {
      // Summary generate karo
      const summaryRes = await api.post('/ai/summary', {
        transcript,
        meetingId: ''
      });

      if (summaryRes.data.success) {
        setSummary(summaryRes.data);
      }

      // Action items extract karo
      try {
        const actionRes = await api.post('/ai/action-items', {
          transcript,
          participants: []
        });
        if (actionRes.data.success) {
          setActionItems(actionRes.data.actionItems || []);
        }
      } catch (e) {
        console.log('Action items extraction failed');
      }

      setActiveTab('summary');

    } catch (err: any) {
      console.log('AI Error:', err.message);
      setError(err.response?.data?.message || 'AI service error. Check your API key in .env file.');
    } finally {
      setLoading(false);
    }
  };

  const handleAskAI = async () => {
    if (!aiQuestion.trim()) return;
    setAiLoading(true);
    try {
      const res = await api.post('/ai/chat', {
        question: aiQuestion,
        context: transcript
      });
      if (res.data.success) {
        setAiAnswer(res.data.answer);
      }
    } catch (err) {
      setAiAnswer('Sorry, AI is not available right now.');
    } finally {
      setAiLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getPriorityColor = (priority: string) => {
    if (priority === 'high') return isDark ? 'bg-red-900 text-red-300' : 'bg-red-100 text-red-600';
    if (priority === 'medium') return isDark ? 'bg-yellow-900 text-yellow-300' : 'bg-yellow-100 text-yellow-600';
    return isDark ? 'bg-green-900 text-green-300' : 'bg-green-100 text-green-600';
  };

  return (
    <div className={`min-h-screen ${bg} transition-colors`}>

      {/* Header */}
      <div className={`${cardBg} border-b px-6 py-4 sticky top-0 z-10`}>
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition ${
              isDark ? 'bg-gray-800 hover:bg-gray-700 text-gray-300' : 'bg-gray-100 hover:bg-gray-200 text-gray-600'
            }`}
          >
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className={`text-lg font-bold ${textPrimary} flex items-center gap-2`}>
              <Brain size={20} className="text-purple-400" />
              AI Meeting Intelligence
            </h1>
            <p className={`text-xs ${textSecondary}`}>Generate summary, action items and insights</p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6 space-y-6">

        {/* Error */}
        {error && (
          <div className="bg-red-500 bg-opacity-10 border border-red-500 border-opacity-30 text-red-400 p-4 rounded-xl text-sm flex items-center gap-2">
            ⚠️ {error}
          </div>
        )}

        {/* Transcript Input */}
        <div className={`${cardBg} border rounded-2xl p-6`}>
          <h2 className={`font-bold ${textPrimary} mb-4 flex items-center gap-2`}>
            <FileText size={18} className="text-blue-400" /> Meeting Transcript
          </h2>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Paste your meeting transcript here...&#10;&#10;Example:&#10;Rahul: Good morning everyone. Let's discuss Q2 planning.&#10;Priya: I will handle the frontend design by Friday.&#10;Amit: I will complete the backend API by Monday."
            rows={10}
            className={`w-full border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none ${inputBg}`}
          />
          <div className="flex items-center justify-between mt-3">
            <span className={`text-xs ${textSecondary}`}>{transcript.length} characters</span>
            <button
              onClick={handleGenerateSummary}
              disabled={loading || transcript.trim().length < 20}
              className="bg-purple-600 text-white px-6 py-2.5 rounded-xl hover:bg-purple-500 disabled:opacity-50 transition flex items-center gap-2 font-medium"
            >
              {loading
                ? <><Loader2 size={16} className="animate-spin" /> Analyzing...</>
                : <><Brain size={16} /> Analyze with AI</>
              }
            </button>
          </div>
        </div>

        {/* Results */}
        {summary && (
          <div className={`${cardBg} border rounded-2xl overflow-hidden`}>

            {/* Tabs */}
            <div className={`flex border-b ${isDark ? 'border-gray-800' : 'border-gray-200'}`}>
              {[
                { id: 'summary', label: 'Summary', icon: FileText },
                { id: 'actions', label: `Actions (${actionItems.length})`, icon: CheckSquare },
                { id: 'ai', label: 'Ask AI', icon: MessageSquare }
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setActiveTab(id as any)}
                  className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition border-b-2 ${
                    activeTab === id
                      ? 'border-purple-500 text-purple-400'
                      : `border-transparent ${textSecondary} hover:text-purple-400`
                  }`}
                >
                  <Icon size={15} /> {label}
                </button>
              ))}
            </div>

            <div className="p-6">

              {/* Summary Tab */}
              {activeTab === 'summary' && (
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className={`font-semibold ${textPrimary}`}>Meeting Summary</h3>
                      <button
                        onClick={() => copyToClipboard(summary.summary)}
                        className={`text-xs flex items-center gap-1 ${textSecondary} hover:text-purple-400`}
                      >
                        {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />} Copy
                      </button>
                    </div>
                    <p className={`text-sm ${textSecondary} leading-relaxed`}>{summary.summary}</p>
                  </div>

                  {summary.keyPoints?.length > 0 && (
                    <div>
                      <h3 className={`font-semibold ${textPrimary} mb-3`}>Key Points</h3>
                      <ul className="space-y-2">
                        {summary.keyPoints.map((point: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="w-5 h-5 bg-purple-500 bg-opacity-20 text-purple-400 rounded-full flex items-center justify-center text-xs flex-shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <span className={`text-sm ${textSecondary}`}>{point}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {summary.decisions?.length > 0 && (
                    <div>
                      <h3 className={`font-semibold ${textPrimary} mb-3`}>Decisions Made</h3>
                      <ul className="space-y-2">
                        {summary.decisions.map((decision: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <Check size={14} className="text-green-400 flex-shrink-0 mt-0.5" />
                            <span className={`text-sm ${textSecondary}`}>{decision}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Action Items Tab */}
              {activeTab === 'actions' && (
                <div className="space-y-3">
                  {actionItems.length === 0 ? (
                    <div className="text-center py-8">
                      <CheckSquare size={32} className={`mx-auto mb-2 ${textSecondary}`} />
                      <p className={textSecondary}>No action items found</p>
                    </div>
                  ) : (
                    actionItems.map((item: any, i: number) => (
                      <div key={i} className={`p-4 rounded-xl border ${isDark ? 'border-gray-800 bg-gray-800' : 'border-gray-100 bg-gray-50'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1">
                            <p className={`font-medium text-sm ${textPrimary}`}>{item.task}</p>
                            <div className="flex items-center gap-3 mt-2 flex-wrap">
                              {item.owner && (
                                <span className={`text-xs ${textSecondary} flex items-center gap-1`}>
                                  👤 {item.owner}
                                </span>
                              )}
                              {item.deadline && (
                                <span className={`text-xs ${textSecondary} flex items-center gap-1`}>
                                  📅 {item.deadline}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full font-medium flex-shrink-0 capitalize ${getPriorityColor(item.priority)}`}>
                            {item.priority}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Ask AI Tab */}
              {activeTab === 'ai' && (
                <div className="space-y-4">
                  <p className={`text-sm ${textSecondary}`}>
                    Ask questions about your meeting. AI will answer based on the transcript.
                  </p>

                  {/* Quick questions */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      'What were the main decisions?',
                      'Who has the most action items?',
                      'What are the deadlines?',
                      'Summarize in one sentence'
                    ].map(q => (
                      <button
                        key={q}
                        onClick={() => setAiQuestion(q)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                          isDark ? 'border-gray-700 text-gray-300 hover:border-purple-500' : 'border-gray-200 text-gray-600 hover:border-purple-400'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiQuestion}
                      onChange={(e) => setAiQuestion(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAskAI()}
                      placeholder="Ask anything about this meeting..."
                      className={`flex-1 border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${inputBg}`}
                    />
                    <button
                      onClick={handleAskAI}
                      disabled={aiLoading || !aiQuestion.trim()}
                      className="bg-purple-600 text-white w-10 h-10 rounded-xl flex items-center justify-center hover:bg-purple-500 disabled:opacity-50 transition"
                    >
                      {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                    </button>
                  </div>

                  {aiAnswer && (
                    <div className={`p-4 rounded-xl border ${isDark ? 'border-purple-900 bg-purple-950 bg-opacity-30' : 'border-purple-100 bg-purple-50'}`}>
                      <p className={`text-sm leading-relaxed ${textPrimary}`}>{aiAnswer}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PostMeeting;