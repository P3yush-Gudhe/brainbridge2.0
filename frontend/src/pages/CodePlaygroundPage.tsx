import { lazy, Suspense, useState } from 'react'
import { motion } from 'framer-motion'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Play, Brain, Bug, Zap, ChevronDown, Terminal, Loader2, RotateCcw, AlertCircle } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useAppStore, resolveTheme } from '@/stores/appStore'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

const MonacoEditor = lazy(() => import('@monaco-editor/react'))

const LANGUAGES = [
  { id: 'python', label: 'Python', ext: '.py' },
  { id: 'javascript', label: 'JavaScript', ext: '.js' },
  { id: 'typescript', label: 'TypeScript', ext: '.ts' },
  { id: 'cpp', label: 'C++', ext: '.cpp' },
  { id: 'java', label: 'Java', ext: '.java' },
  { id: 'c', label: 'C', ext: '.c' },
]

const SAMPLE_CODE: Record<string, string> = {
  python: `# Python - Binary Search
def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    
    return -1

# Test
arr = [1, 3, 5, 7, 9, 11, 13, 15]
target = 7
result = binary_search(arr, target)
print(f"Element {target} found at index: {result}")
`,
  javascript: `// JavaScript - Fibonacci with memoization
function fibonacci(n, memo = {}) {
  if (n in memo) return memo[n];
  if (n <= 1) return n;
  
  memo[n] = fibonacci(n - 1, memo) + fibonacci(n - 2, memo);
  return memo[n];
}

const fibs = Array.from({ length: 10 }, (_, i) => fibonacci(i));
console.log('Fibonacci sequence:', fibs);
`,
  cpp: `#include <iostream>
#include <vector>
#include <algorithm>
using namespace std;

int main() {
    vector<int> arr = {64, 34, 25, 12, 22, 11, 90};
    sort(arr.begin(), arr.end());
    
    cout << "Sorted array: ";
    for (int x : arr) cout << x << " ";
    cout << endl;
    
    return 0;
}`,
  java: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, StudyMate!");
    }
}`,
  c: `#include <stdio.h>

int main() {
    printf("Hello, StudyMate!\\n");
    return 0;
}`,
  typescript: `const greeting: string = "Hello, StudyMate!";
console.log(greeting);`,
}

export function CodePlaygroundPage() {
  const { theme } = useAppStore()
  const effectiveTheme = resolveTheme(theme)
  const [language, setLanguage] = useState('python')
  const [code, setCode] = useState(SAMPLE_CODE.python)
  const [output, setOutput] = useState('')
  const [running, setRunning] = useState(false)
  const [aiOutput, setAiOutput] = useState('')
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [showLangMenu, setShowLangMenu] = useState(false)

  const runCode = async () => {
    setRunning(true)
    setOutput('')
    try {
      const response = await api.post('/ai/code', { action: 'run', language, code })
      setOutput(response.data?.output || 'Program executed successfully')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string }
      const msg = err.response?.data?.error || err.message || 'Execution failed'
      toast.error(msg)
      setOutput(`Error: ${msg}`)
    } finally {
      setRunning(false)
    }
  }

  const handleAI = async (action: 'explain' | 'debug' | 'optimize') => {
    setAiLoading(true)
    setAiOutput('')
    setAiError(null)
    try {
      const response = await api.post('/ai/code', { action, language, code })
      setAiOutput(response.data?.analysis || '')
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } }; message?: string }
      const msg = err.response?.data?.error || err.message || 'AI analysis failed'
      setAiError(msg)
      toast.error(msg)
    } finally {
      setAiLoading(false)
    }
  }

  const switchLanguage = (lang: string) => {
    setLanguage(lang)
    setCode(SAMPLE_CODE[lang] || '')
    setOutput('')
    setAiOutput('')
    setAiError(null)
    setShowLangMenu(false)
  }

  return (
    <div className="h-full flex flex-col bg-bg">
      {/* Header Toolbar */}
      <div className="min-h-12 border-b border-border bg-surface flex flex-wrap items-center px-3 sm:px-4 py-1.5 gap-2 flex-shrink-0">
        {/* Language Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowLangMenu(m => !m)}
            aria-expanded={showLangMenu}
            aria-label="Select programming language"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface-subtle border border-border text-xs font-mono text-text-primary hover:border-border-strong"
          >
            <span>{LANGUAGES.find(l => l.id === language)?.label}</span>
            <ChevronDown className="w-3.5 h-3.5 text-text-muted" aria-hidden="true" />
          </button>
          {showLangMenu && (
            <div className="absolute top-10 left-0 bg-surface border border-border rounded-lg shadow-lg z-20 py-1 min-w-36">
              {LANGUAGES.map(lang => (
                <button
                  type="button"
                  key={lang.id}
                  onClick={() => switchLanguage(lang.id)}
                  className={cn(
                    'w-full text-left px-3.5 py-1.5 text-xs hover:bg-surface-secondary transition-colors',
                    language === lang.id ? 'text-accent-text font-semibold' : 'text-text-primary'
                  )}
                >
                  {lang.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="h-4 w-px bg-border" />

        <button
          type="button"
          onClick={() => void runCode()}
          disabled={running}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#3E7250] text-white text-xs font-medium hover:opacity-90 transition-all disabled:opacity-50"
        >
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Play className="w-3.5 h-3.5" aria-hidden="true" />}
          Run
        </button>

        <div className="h-4 w-px bg-border" />

        <button type="button" onClick={() => void handleAI('explain')} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-surface-secondary">
          <Brain className="w-3.5 h-3.5 text-accent-text" aria-hidden="true" /> Explain
        </button>
        <button type="button" onClick={() => void handleAI('debug')} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-surface-secondary">
          <Bug className="w-3.5 h-3.5 text-accent-text" aria-hidden="true" /> Debug
        </button>
        <button type="button" onClick={() => void handleAI('optimize')} className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs text-text-secondary hover:text-text-primary hover:bg-surface-secondary">
          <Zap className="w-3.5 h-3.5 text-accent-text" aria-hidden="true" /> Optimize
        </button>

        <div className="flex-1" />
        <button
          type="button"
          onClick={() => { setCode(SAMPLE_CODE[language]); setOutput(''); setAiOutput(''); setAiError(null) }}
          className="btn-icon-sm btn-ghost text-text-secondary"
          title="Reset code"
          aria-label="Reset code to sample"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Code Editor & Output Pane */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        <div className="flex-1 min-h-[300px] overflow-hidden">
          <Suspense
            fallback={
              <div className="h-full flex items-center justify-center bg-surface text-xs text-text-secondary gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-accent-text" />
                Loading Monaco code editor...
              </div>
            }
          >
            <MonacoEditor
              height="100%"
              language={language === 'cpp' ? 'cpp' : language}
              value={code}
              onChange={v => setCode(v || '')}
              theme={effectiveTheme === 'dark' ? 'vs-dark' : 'vs'}
              options={{
                fontSize: 13,
                fontFamily: 'JetBrains Mono, Fira Code, monospace',
                lineNumbers: 'on',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: 'on',
                tabSize: 4,
                automaticLayout: true,
                padding: { top: 12, bottom: 12 },
                renderLineHighlight: 'gutter',
                cursorBlinking: 'smooth',
              }}
            />
          </Suspense>
        </div>

        {/* Side Output & AI Panel */}
        <div className="w-full lg:w-80 h-60 lg:h-auto border-t lg:border-t-0 lg:border-l border-border bg-surface flex flex-col flex-shrink-0">
          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-surface-subtle">
              <Terminal className="w-3.5 h-3.5 text-text-secondary" aria-hidden="true" />
              <span className="text-xs font-semibold text-text-primary">Console Output</span>
            </div>
            <div className="flex-1 p-4 font-mono text-xs text-text-primary overflow-y-auto bg-bg">
              {running ? (
                <div className="flex items-center gap-2 text-accent-text">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  Running code...
                </div>
              ) : output ? (
                <motion.pre initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="whitespace-pre-wrap leading-relaxed">{output}</motion.pre>
              ) : (
                <span className="text-text-muted">Click Run to execute code...</span>
              )}
            </div>
          </div>

          {(aiOutput || aiLoading || aiError) && (
            <div className="border-t border-border flex flex-col max-h-60">
              <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-surface-subtle">
                <Brain className="w-3.5 h-3.5 text-accent-text" aria-hidden="true" />
                <span className="text-xs font-semibold text-text-primary">AI Analysis</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3.5 text-xs text-text-primary leading-relaxed bg-surface">
                {aiLoading ? (
                  <div className="flex items-center gap-2 text-accent-text">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    Analyzing code...
                  </div>
                ) : aiError ? (
                  <div role="alert" className="p-2.5 rounded-lg bg-error-light border border-error/30 text-error flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{aiError}</span>
                  </div>
                ) : (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="prose-studymate text-xs">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiOutput}</ReactMarkdown>
                  </motion.div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
