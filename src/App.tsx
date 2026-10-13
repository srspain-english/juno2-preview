import { createContext, type Dispatch, type ReactNode, type SetStateAction, useContext, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ArrowLeft, ArrowRight, BarChart3, BookOpen, Check, CircleHelp, Mic, MicOff, Pause, Play, RotateCcw, Sparkles, StopCircle, Volume2 } from 'lucide-react';
import { Link, Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';

// Static Pages routes stay in the fragment, so refresh always requests index.html.
function usePreviewLocation(options?: Parameters<typeof useHashLocation>[0]): ReturnType<typeof useHashLocation> {
  const [path] = useHashLocation(options);
  return [path.split('?')[0], (to, options) => {
    if (options?.replace) window.location.replace('#' + to);
    else window.location.hash = to;
  }];
}
usePreviewLocation.hrefs = (href: string) => '#' + href;

const queryClient = new QueryClient();
type Mode = 'free' | 'scenario' | 'coach';

const scenario = 'A delayed project update';
const partner = 'Tutor';
const drillQuestions = [
  { prompt: 'Why is the project running late?', options: ['The client changed the brief', 'The team lost a file', 'The office was closed'], answer: 0, why: 'The speaker says the client changed the brief twice.' },
  { prompt: 'What does the speaker promise to send?', options: ['A revised timeline', 'A new invoice', 'The final design'], answer: 0, why: 'They promise a revised timeline by Friday morning.' },
];
const corrections = [
  ['I am working here since two weeks.', "I've been working here for two weeks.", 'For a length of time, use “for”; “since” introduces a starting point.'],
  ['Everybody is very nice with me.', 'Everybody has been really nice to me.', 'In English we say nice to someone, not nice with someone.'],
  ['I feel shame to interrupt.', 'I feel embarrassed about interrupting.', '“Shame” is much heavier in English than the Spanish “me da vergüenza”.'],
];
const expressions = [
  ['to get up to speed', 'Instead of “to learn everything about the job.”'],
  ['I lose the thread', 'You already used this one. Keep it.'],
  ['Sorry, could you run that by me again?', 'A softer way to interrupt in a meeting.'],
];

type DemoMessage = { who: string; text: string };
type DemoSession = {
  mode: Mode;
  paused: boolean;
  seconds: number;
  complete: boolean;
  messages: DemoMessage[];
};
const MOCK_REPLY = 'Mock reply: Thank you. This is a synthetic response; no AI or correction has run.';
function safeMode(value: string | null, fallback: Mode = 'free'): Mode {
  return value === 'free' || value === 'scenario' || value === 'coach' ? value : fallback;
}
function initialSession(mode: Mode): DemoSession {
  const opener = mode === 'scenario' ? 'So, tell me what happened with the project.' : mode === 'coach' ? 'Tell me about something that has been on your mind this week.' : 'What would you like to talk about today?';
  return { mode, paused: false, seconds: 0, complete: false, messages: [{ who: 'Mock tutor', text: `Synthetic opener: ${opener}` }] };
}
type DemoState = {
  mode: Mode;
  session: DemoSession;
  chooseMode: (mode: Mode) => void;
  begin: (mode: Mode) => void;
  updateSession: Dispatch<SetStateAction<DemoSession>>;
  reset: () => void;
};
const DemoContext = createContext<DemoState | null>(null);
function useDemo() {
  const value = useContext(DemoContext);
  if (!value) throw new Error('Missing synthetic demo state');
  return value;
}
function DemoProvider({ children }: { children: ReactNode }) {
  const [mode, chooseMode] = useState<Mode>('free');
  const [session, updateSession] = useState<DemoSession>(() => initialSession('free'));
  const value = useMemo(() => ({
    mode, session, chooseMode, updateSession,
    begin: (next: Mode) => {
      chooseMode(next);
      updateSession((previous) => previous.mode === next && !previous.complete ? previous : initialSession(next));
    },
    reset: () => {
      chooseMode('free');
      updateSession(initialSession('free'));
    },
  }), [mode, session]);
  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { reset } = useDemo();
  const nav = [
    { href: '/', label: 'Today', icon: Sparkles },
    { href: '/practice', label: 'Practice', icon: Mic },
    { href: '/progress', label: 'Progress', icon: BarChart3 },
  ];
  return (
    <div className="fp-noise min-h-[100dvh] bg-background text-foreground">
      <div className="relative z-30 flex flex-wrap items-center justify-between gap-3 border-b border-primary/25 bg-primary/8 px-5 py-3 text-xs sm:px-8" data-testid="banner-synthetic" role="note">
        <span><strong className="block font-semibold">Juno2 · Synthetic frontend demo</strong><span className="text-muted-foreground">No student account, AI, microphone capture, or saved learning records. Final product: JUNO.</span></span>
        <button type="button" onClick={reset} className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-2 font-medium hover:bg-secondary" data-testid="button-reset-demo"><RotateCcw size={13} /> Reset demo</button>
      </div>
      <div className="mx-auto flex min-h-[100dvh] max-w-[1380px]">
        <aside className="hidden w-[224px] shrink-0 flex-col border-r border-border bg-sidebar/60 px-5 py-7 lg:flex">
          <Link href="/" className="mb-14 flex items-center gap-3 no-underline" data-testid="link-brand">
            <span className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-primary text-primary-foreground"><Volume2 size={18} strokeWidth={2.4} /></span>
            <span className="font-serif text-[25px] tracking-tight">Juno2<span className="text-primary">.</span></span>
          </Link>
          <p className="mb-4 px-3 text-[10px] font-semibold uppercase tracking-[.18em] text-muted-foreground">Demo space</p>
          <nav className="flex flex-col gap-1" aria-label="Primary navigation">
            {nav.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} data-testid={`link-nav-${label.toLowerCase()}`} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${location === href ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}>
                <Icon size={17} /><span>{label}</span>
              </Link>
            ))}
            <Link href="/notes" data-testid="link-nav-notes" className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${location === '/notes' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}><BookOpen size={17} /><span>Session notes</span></Link>
          </nav>
          <div className="mt-auto rounded-2xl border border-border bg-card p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Synthetic week</p>
            <p className="mt-2 font-serif text-3xl">18<span className="text-base text-muted-foreground"> min</span></p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full w-[68%] rounded-full bg-accent" /></div>
            <p className="mt-2 text-xs text-muted-foreground">Illustrative 30 min goal · not measured</p>
          </div>
        </aside>
        <main className="min-w-0 flex-1 pb-24 lg:pb-0">{children}</main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 flex h-[72px] items-center justify-around border-t border-border bg-background/95 px-4 backdrop-blur lg:hidden" aria-label="Mobile navigation">
        {nav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} data-testid={`link-mobile-${label.toLowerCase()}`} className={`flex min-w-[76px] flex-col items-center gap-1 text-[10px] font-semibold uppercase tracking-[.08em] ${location === href ? 'text-primary' : 'text-muted-foreground'}`}><Icon size={19} /><span>{label}</span></Link>)}
        <Link href="/notes" data-testid="link-mobile-notes" className={`flex min-w-[76px] flex-col items-center gap-1 text-[10px] font-semibold uppercase tracking-[.08em] ${location === '/notes' ? 'text-primary' : 'text-muted-foreground'}`}><BookOpen size={19} /><span>Notes</span></Link>
      </nav>
    </div>
  );
}

function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return <header className="mb-8 flex items-end justify-between gap-4"><div><p className="mb-2 text-[10px] font-semibold uppercase tracking-[.18em] text-muted-foreground">{eyebrow}</p><h1 className="font-serif text-[40px] leading-[.98] tracking-tight sm:text-[48px]">{title}</h1></div>{children}</header>;
}

function Home() {
  const [, setLocation] = useLocation();
  const { session, chooseMode } = useDemo();
  const name = 'Synthetic learner';
  const completed = session.complete;
  const start = (mode: Mode) => { chooseMode(mode); setLocation(`/practice?mode=${mode}`); };
  const cards = [
    { mode: 'free' as Mode, title: 'Free talk', body: 'A synthetic free-talk preview. No teaching is connected.', icon: Mic, dark: true },
    { mode: 'scenario' as Mode, title: 'Scenario', body: scenario, icon: BookOpen, dark: false },
    { mode: 'coach' as Mode, title: 'Coach me', body: 'Preview the coaching layout; replies are mock text.', icon: Sparkles, dark: false },
  ];
  return <div className="fp-page mx-auto max-w-5xl px-5 py-10 sm:px-10 lg:px-16 lg:py-16">
    <PageHeader eyebrow="Today · synthetic practice space" title={<>Good evening,<br /><i>{name}</i></>}><div className="rounded-2xl border border-border bg-card px-4 py-3 text-center"><div className="font-serif text-2xl text-primary">B1+</div><div className="text-[9px] font-bold uppercase tracking-[.16em] text-muted-foreground">demo level</div></div></PageHeader>
    <p className="mb-3 text-[10px] font-semibold uppercase tracking-[.18em] text-muted-foreground">Talk to {partner}</p>
    <section className="grid gap-3 md:grid-cols-3" aria-label="Conversation modes">
      {cards.map(({ mode, title, body, icon: Icon, dark }) => <button key={mode} onClick={() => start(mode)} data-testid={`button-start-${mode}`} className={`group flex min-h-[174px] flex-col justify-between rounded-[25px] p-5 text-left transition-transform hover:-translate-y-1 ${dark ? 'bg-foreground text-background' : 'border border-border bg-card hover:bg-secondary'}`}>
        <div className={`flex h-11 w-11 items-center justify-center rounded-full ${dark ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground'}`}><Icon size={19} /></div>
        <div><div className="flex items-center justify-between gap-3"><h2 className="text-[17px] font-semibold">{title}</h2><ArrowRight size={17} className="opacity-50 transition-transform group-hover:translate-x-1" /></div><p className={`mt-1 text-[13px] leading-5 ${dark ? 'text-background/65' : 'text-muted-foreground'}`}>{body}</p></div>
      </button>)}
    </section>
    <section className="mt-8 grid gap-3 md:grid-cols-[1.15fr_.85fr]">
      <button onClick={() => setLocation('/drill')} className="rounded-[25px] border border-border bg-card p-5 text-left transition-colors hover:bg-secondary" data-testid="button-open-drill">
        <div className="mb-4 flex items-center justify-between"><span className="text-[10px] font-semibold uppercase tracking-[.18em] text-muted-foreground">Synthetic listening drill</span><span className="text-xs text-muted-foreground">2 of 3 done</span></div>
        <div className="mb-5 flex gap-2"><span className="h-1.5 flex-1 rounded-full bg-primary" /><span className="h-1.5 flex-1 rounded-full bg-primary" /><span className="h-1.5 flex-1 rounded-full bg-secondary" /></div>
        <div className="flex items-center gap-4"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary"><Play size={17} fill="currentColor" /></span><span><strong className="block text-[15px]">Voicemail from a client</strong><small className="text-xs text-muted-foreground">British English · two questions after</small></span><ArrowRight size={16} className="ml-auto text-muted-foreground" /></div>
      </button>
      <button onClick={() => setLocation('/notes')} className="flex items-center justify-between rounded-[25px] bg-secondary p-5 text-left transition-colors hover:bg-muted" data-testid="button-open-notes">
        <span><strong className="block text-[15px]">Synthetic session notes</strong><small className="mt-1 block text-xs text-muted-foreground">{completed ? 'Example recap · not based on your typed messages' : '3 example corrections · 3 example phrases'}</small></span><ArrowRight size={16} className="text-muted-foreground" />
      </button>
    </section>
    <div className="mt-8 flex items-center gap-3 border-t border-border pt-5 text-xs text-muted-foreground"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent/15 text-accent"><Check size={14} /></span><span>Small practice counts. You are building a speaking habit.</span></div>
  </div>;
}

function Practice() {
  const [, setLocation] = useLocation();
  const query = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const { mode: rememberedMode, begin } = useDemo();
  const initial = safeMode(query.get('mode'), rememberedMode);
  const [mode, setMode] = useState<Mode>(initial);
  const modes: { id: Mode; title: string; body: string; icon: typeof Mic }[] = [
    { id: 'free', title: 'Free talk', body: 'A synthetic layout preview with no fixed topic.', icon: Mic },
    { id: 'scenario', title: 'Scenario', body: 'Practise a real moment: explain a delayed project update.', icon: BookOpen },
    { id: 'coach', title: 'Coach me', body: 'Preview coaching controls. No real corrections run.', icon: Sparkles },
  ];
  return <div className="fp-page mx-auto max-w-3xl px-5 py-10 sm:px-10 lg:py-16">
    <Link href="/" className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" data-testid="link-practice-back"><ArrowLeft size={15} /> Today</Link>
    <PageHeader eyebrow="Before you begin" title={<>Choose how<br /><i>you want to talk.</i></>} />
    <div className="space-y-3">{modes.map(({ id, title, body, icon: Icon }) => <button key={id} onClick={() => setMode(id)} data-testid={`button-select-${id}`} className={`flex w-full items-center gap-4 rounded-2xl border p-4 text-left transition-all ${mode === id ? 'border-primary bg-primary/8 ring-2 ring-primary/20' : 'border-border bg-card hover:bg-secondary'}`}><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${mode === id ? 'bg-primary text-primary-foreground' : 'bg-secondary'}`}><Icon size={18} /></span><span className="min-w-0 flex-1"><strong className="block text-[16px]">{title}</strong><small className="text-sm text-muted-foreground">{body}</small></span><span className={`flex h-5 w-5 items-center justify-center rounded-full border ${mode === id ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>{mode === id && <Check size={13} />}</span></button>)}</div>
    <div className="mt-7 rounded-2xl bg-secondary/70 p-5"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-muted-foreground">A useful nudge</p><p className="mt-2 font-serif text-2xl leading-tight">You do not need perfect words. You need a little room to find them.</p></div>
    <button onClick={() => { begin(mode); setLocation(`/session?mode=${mode}`); }} className="mt-6 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary font-semibold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5" data-testid="button-begin-conversation">Begin conversation <ArrowRight size={17} /></button>
  </div>;
}

function Drill() {
  const [, setLocation] = useLocation();
  const [answers, setAnswers] = useState<(number | null)[]>([null, null]);
  const [scriptOpen, setScriptOpen] = useState(false);
  const playing = false;
  const [playbackNotice, setPlaybackNotice] = useState(false);
  const choose = (question: number, option: number) => { const next = [...answers]; next[question] = option; setAnswers(next); };
  const done = answers.every((answer) => answer !== null);
  const score = answers.reduce<number>((total, answer, i) => total + (answer === drillQuestions[i].answer ? 1 : 0), 0);
  return <div className="fp-page mx-auto max-w-3xl px-5 py-10 sm:px-10 lg:py-16">
    <Link href="/" className="mb-9 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground" data-testid="link-drill-back"><ArrowLeft size={15} /> Today</Link>
    <PageHeader eyebrow="Synthetic listening drill · not part of Juno teaching" title={<>Voicemail from<br /><i>a client</i></>} />
    <p className="-mt-4 mb-7 max-w-md text-sm leading-6 text-muted-foreground">Illustrative fixture only. The transcript is an invented voicemail. Audio playback is not connected; answers are not saved as learning progress.</p>
    <section className="rounded-[25px] bg-foreground p-5 text-background sm:p-6">
      <div className="flex items-center gap-4"><button onClick={() => setPlaybackNotice(true)} title="Playback is not connected in this build demo" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground" aria-label="Playback not connected" data-testid="button-play-drill">{playing ? <Pause size={19} fill="currentColor" /> : <Play size={19} fill="currentColor" />}</button><div><strong className="block text-[15px]">{playing ? 'Playing voicemail' : 'Listen to the voicemail'}</strong><span className="text-xs text-background/55">Playback not connected · see synthetic transcript</span></div><button onClick={() => setPlaybackNotice(true)} title="Playback is not connected in this build demo" className="ml-auto rounded-full border border-background/20 p-2.5 text-background/70 hover:bg-background/10" aria-label="Replay not connected" data-testid="button-replay-drill"><RotateCcw size={16} /></button></div>
      <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-background/15"><div className={`h-full rounded-full bg-primary transition-all ${playing ? 'w-[72%]' : 'w-[9%]'}`} /></div>
    </section>
    {playbackNotice && <p className="mt-3 text-sm text-muted-foreground" role="status" data-testid="status-drill-playback">Audio playback is not connected in this Phase 1 demo. Use the synthetic transcript below.</p>}
    <button onClick={() => setScriptOpen(!scriptOpen)} className="mt-3 flex w-full items-center justify-between rounded-2xl bg-secondary px-5 py-4 text-left text-sm hover:bg-muted" data-testid="button-toggle-transcript"><span className="font-medium">{scriptOpen ? 'Hide transcript' : 'See transcript'}</span><span className="text-xs text-muted-foreground">{scriptOpen ? 'Close' : 'Optional support'}</span></button>
    {scriptOpen && <div className="fp-page mt-2 rounded-2xl border border-border bg-card p-5 text-sm leading-7 text-muted-foreground" data-testid="text-drill-transcript">Hi, I wanted to give you a quick update on the project. We are running a little late because the client changed the brief twice. I will send a revised timeline by Friday morning.</div>}
    <div className="mt-7 space-y-3">{drillQuestions.map((question, index) => <fieldset key={question.prompt} className="rounded-[22px] border border-border bg-card p-5"><legend className="sr-only">{question.prompt}</legend><div className="mb-4 flex gap-3"><span className="text-xs font-bold text-muted-foreground">0{index + 1}</span><h2 className="text-[16px] font-semibold leading-6">{question.prompt}</h2></div><div className="space-y-2">{question.options.map((option, optionIndex) => { const selected = answers[index] === optionIndex; const correct = selected && optionIndex === question.answer; const wrong = selected && optionIndex !== question.answer; return <button key={option} onClick={() => choose(index, optionIndex)} className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${correct ? 'border-accent bg-accent/10' : wrong ? 'border-destructive bg-destructive/8' : selected ? 'border-primary bg-primary/8' : 'border-border hover:bg-secondary'}`} data-testid={`button-answer-${index}-${optionIndex}`}><span className={`flex h-4 w-4 items-center justify-center rounded-full border ${selected ? (correct ? 'border-accent bg-accent' : wrong ? 'border-destructive bg-destructive' : 'border-primary bg-primary') : 'border-muted-foreground/50'}`}>{selected && <span className="h-1.5 w-1.5 rounded-full bg-card" />}</span>{option}</button>; })}</div>{answers[index] !== null && <p className={`mt-4 border-t border-border pt-3 text-xs leading-5 ${answers[index] === question.answer ? 'text-accent-foreground' : 'text-muted-foreground'}`} data-testid={`text-feedback-${index}`}>{answers[index] === question.answer ? 'That is right. ' : 'Not quite. '}{question.why}</p>}</fieldset>)}</div>
    {done && <div className="mt-5 rounded-[22px] bg-foreground p-5 text-background" data-testid="status-drill-complete"><p className="text-[10px] font-semibold uppercase tracking-[.17em] text-background/55">Synthetic exercise result · not saved</p><p className="mt-2 font-serif text-3xl">{score} of 2 correct</p><p className="mt-1 text-sm text-background/65">{score === 2 ? 'You caught the important details.' : 'A second listen is often where the details land.'}</p><button onClick={() => setLocation('/session?mode=free')} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground" data-testid="button-continue-drill">On to the conversation <ArrowRight size={16} /></button></div>}
  </div>;
}

function Session() {
  const [, setLocation] = useLocation();
  const { mode: selectedMode, session, begin, updateSession } = useDemo();
  const query = new URLSearchParams(window.location.hash.split('?')[1] || '');
  const mode = safeMode(query.get('mode'), selectedMode);
  const isCoach = mode === 'coach';
  const [muted, setMuted] = useState(false);
  const [help, setHelp] = useState(false);
  const [draft, setDraft] = useState('');
  const { paused, seconds: elapsed, messages, complete } = session;
  const caption = [...messages].reverse().find((message) => message.who === 'Mock tutor')?.text;
  useEffect(() => { if (session.mode !== mode) begin(mode); }, [mode, session.mode, begin]);
  useEffect(() => {
    if (paused || complete) return;
    const timer = window.setInterval(() => updateSession((previous) => ({ ...previous, seconds: previous.seconds + 1 })), 1000);
    return () => window.clearInterval(timer);
  }, [paused, complete, updateSession]);
  useEffect(() => {
    if (messages.length === 1) { setDraft(''); setMuted(false); setHelp(false); }
  }, [messages]);
  const send = () => {
    if (paused || complete || !draft.trim() || draft.length > 4000) return;
    const text = draft;
    updateSession((previous) => previous.paused || previous.complete ? previous : {
      ...previous,
      messages: [...previous.messages, { who: 'You (demo)', text }, { who: 'Mock tutor', text: MOCK_REPLY }],
    });
    setDraft('');
  };
  const finish = () => {
    updateSession((previous) => ({ ...previous, complete: true }));
    setLocation('/notes');
  };
  const time = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`;
  return <div className={`fp-page min-h-[100dvh] ${isCoach ? 'bg-[#111821] text-[#f6f2ea]' : 'bg-[#171423] text-[#f6f2ea]'}`}>
    <div className="mx-auto flex min-h-[100dvh] max-w-3xl flex-col px-5 py-8 sm:px-10 lg:py-12">
      <h1 className="sr-only">Conversation · synthetic typing demo</h1>
      <div className="flex items-center justify-between"><div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${isCoach ? 'bg-accent' : 'bg-primary'}`} /><span className="text-[10px] font-semibold uppercase tracking-[.17em] text-[#a9a3b8]">Mock tutor · {mode === 'scenario' ? 'scenario demo' : mode === 'coach' ? 'coach demo' : 'free talk demo'}</span></div><span className="font-mono text-xs tabular-nums text-[#a9a3b8]" data-testid="text-session-clock" title="Active UI demo time, not speaking time">{time}</span></div>
      <p className="mt-4 rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xs leading-5 text-[#c9c2d8]">Typing prototype only. Responses are fixed mock text. Microphone controls and the animated orb are visual simulations; no audio is recorded.</p>
      {mode === 'scenario' && <div className="mt-7 flex flex-wrap justify-center gap-2"><span className="rounded-full border border-white/15 px-3 py-1.5 text-[11px] text-[#a9a3b8]">Explain the delay</span><span className="rounded-full border border-white/15 px-3 py-1.5 text-[11px] text-[#a9a3b8]">Offer a new date</span><span className="rounded-full border border-white/15 px-3 py-1.5 text-[11px] text-[#a9a3b8]">Keep it friendly</span></div>}
      <div className="flex flex-1 flex-col items-center justify-center py-8">
        <div className="mb-7 min-h-16 max-w-xl px-5 text-center font-serif text-[27px] leading-tight sm:text-3xl" data-testid="text-session-caption">{caption}</div>
        <div className="relative flex h-56 w-56 items-center justify-center" aria-hidden="true"><div className={`fp-orb-ring absolute inset-0 rounded-full border ${isCoach ? 'border-accent/45' : 'border-primary/45'}`} style={{ animationPlayState: paused || complete ? 'paused' : 'running' }} /><div className={`fp-orb-ring absolute inset-6 rounded-full border ${isCoach ? 'border-accent/25' : 'border-primary/25'}`} style={{ animationDelay: '.9s', animationPlayState: paused || complete ? 'paused' : 'running' }} /><div className={`fp-orb-pulse h-40 w-40 rounded-full ${isCoach ? 'bg-[radial-gradient(circle_at_32%_25%,#a7f0d0,#3eb98f_48%,#11634c)] shadow-[0_0_85px_rgba(63,191,149,.42)]' : 'bg-[radial-gradient(circle_at_32%_25%,#b99fff,#7948e8_48%,#421cae)] shadow-[0_0_85px_rgba(122,75,238,.48)]'}`} style={{ animationPlayState: paused || complete ? 'paused' : 'running' }}><div className="flex h-full items-center justify-center opacity-70">{muted ? <MicOff size={28} /> : <Mic size={28} />}</div></div></div>
        <div className="mt-5 flex h-9 items-end gap-1" aria-label={paused || complete ? 'Demo animation paused' : 'Simulated animation, not microphone activity'}>{Array.from({ length: 9 }).map((_, i) => <span key={i} className={`fp-bar w-1 rounded-full ${isCoach ? 'bg-accent' : 'bg-primary/90'}`} style={{ animationDelay: `${i * .09}s`, animationPlayState: paused || complete ? 'paused' : 'running' }} />)}</div>
        <p className="mt-4 text-center text-xs uppercase tracking-[.16em] text-[#a9a3b8]" data-testid="status-session">{complete ? 'Demo ended · choose Practice to start again' : paused ? 'Demo paused' : 'Typing demo · microphone not connected'}</p>
      </div>
      <div className="mb-5 max-h-80 overflow-y-auto border-t border-white/10 pt-5" aria-label="Synthetic conversation transcript" aria-live="polite"><div className="space-y-3">{messages.map(({ who, text }, i) => <div key={i} className={`flex gap-3 text-sm ${i === messages.length - 1 ? 'text-[#f6f2ea]' : 'text-[#b5aec7]'}`} data-testid={`text-transcript-${i}`}><span className="w-20 shrink-0 text-[10px] uppercase tracking-[.12em] text-[#a9a3b8]">{who}</span><span className="min-w-0 whitespace-pre-wrap break-words">{text}</span></div>)}</div></div>
      <form className="mb-5 rounded-2xl border border-white/15 bg-white/5 p-4" onSubmit={(event) => { event.preventDefault(); send(); }}>
        <label htmlFor="demo-message" className="mb-2 block text-xs font-medium text-[#c9c2d8]">Type an invented sentence · no real student information</label>
        <textarea id="demo-message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} maxLength={4000} rows={3} disabled={paused || complete} placeholder="I, um... yesterday I go to the office, and then—" data-testid="input-demo-message" className="w-full resize-y rounded-xl border border-white/20 bg-[#171423] px-3 py-3 text-sm text-[#f6f2ea] outline-none focus:ring-2 focus:ring-primary disabled:opacity-50" />
        <div className="mt-2 flex items-center justify-between gap-3"><span className="text-[10px] text-[#a9a3b8]">{draft.length}/4000 · Enter to send, Shift+Enter for a new line</span><button type="button" onClick={send} disabled={paused || complete || !draft.trim()} data-testid="button-send-demo-message" className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50">Send <ArrowRight size={14} /></button></div>
      </form>
      {help && <div className="mb-4 rounded-2xl border border-accent/30 bg-accent/10 p-4 text-sm text-[#d9f4e8]" data-testid="status-help"><p className="mb-1 text-[10px] font-semibold uppercase tracking-[.15em] text-accent">Synthetic phrase example · not personalised help</p>“I wanted to give you a quick update on where things stand.”</div>}
      <div className="grid grid-cols-3 gap-2"><button onClick={() => updateSession((previous) => ({ ...previous, paused: !previous.paused }))} disabled={complete} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 text-sm hover:bg-white/10 disabled:opacity-50" data-testid="button-toggle-pause">{paused ? <Play size={15} /> : <Pause size={15} />}{paused ? 'Resume' : 'Pause'}</button><button onClick={() => setHelp(!help)} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 text-sm hover:bg-white/10" data-testid="button-help"><CircleHelp size={15} /> Help example</button><button onClick={finish} disabled={complete} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-[#f6f2ea] text-sm font-semibold text-[#171423] hover:bg-white disabled:opacity-50" data-testid="button-end-session"><StopCircle size={15} /> End demo</button></div>
      <button onClick={() => setMuted(!muted)} disabled={complete} className="mx-auto mt-4 flex items-center gap-2 text-xs text-[#a9a3b8] hover:text-[#f6f2ea] disabled:opacity-50" data-testid="button-toggle-mute">{muted ? <MicOff size={14} /> : <Mic size={14} />}{muted ? 'Unmute visual demo' : 'Mute visual demo'}</button>
    </div>
  </div>;
}

function Notes() {
  const [, setLocation] = useLocation();
  const speaking = false;
  const [playbackNotice, setPlaybackNotice] = useState(false);
  const { begin, session } = useDemo();
  const duration = '7 minutes 40 seconds';
  return <div className="fp-page mx-auto max-w-3xl px-5 py-10 sm:px-10 lg:py-16">
    <PageHeader eyebrow="Synthetic session notes" title={<>An example recap.<br /><i>{duration}</i></>} />
    <p className="mb-6 rounded-2xl border border-primary/25 bg-primary/8 p-4 text-sm leading-6 text-muted-foreground" data-testid="banner-synthetic-notes">Synthetic session notes: all corrections, phrases, durations, and scores below are invented fixtures. They are not generated from your messages and are not saved to Juno. {session.complete && <span>Your typing demo ended; no learning report was created.</span>}</p>
    <div className="grid grid-cols-2 gap-3"><div className="rounded-2xl border border-border bg-card p-4" data-testid="metric-speaking-share"><p className="font-serif text-3xl">64%</p><p className="mt-1 text-xs leading-4 text-muted-foreground">example talking share · not measured</p></div><div className="rounded-2xl border border-border bg-card p-4" data-testid="metric-pauses"><p className="font-serif text-3xl">3</p><p className="mt-1 text-xs leading-4 text-muted-foreground">example pauses · not detected</p></div></div>
    <section className="mt-8 border-t border-border pt-6"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-primary">Synthetic example plan</p><h2 className="mt-2 font-serif text-3xl leading-tight">What an example recap could show next</h2></section>
    <SectionLabel>Three mistakes</SectionLabel>
    <div className="space-y-3">{corrections.map(([from, to, why], i) => <article key={from} className="rounded-[21px] border border-border bg-card p-5" data-testid={`card-correction-${i}`}><p className="text-[15px] leading-6 text-muted-foreground line-through">{from}</p><p className="mt-1 text-[15px] font-semibold leading-6">{to}</p><p className="mt-3 text-xs leading-5 text-muted-foreground">{why}</p></article>)}</div>
    <SectionLabel>Three better expressions</SectionLabel>
    <div className="rounded-[21px] bg-secondary px-5">{expressions.map(([term, explanation], i) => <div key={term} className={`py-4 ${i < expressions.length - 1 ? 'border-b border-border' : ''}`} data-testid={`text-expression-${i}`}><p className="text-[15px] font-semibold">{term}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{explanation}</p></div>)}</div>
    <SectionLabel>One pronunciation target</SectionLabel>
    <div className="flex items-center gap-4 rounded-[21px] border border-border bg-card p-5"><button onClick={() => setPlaybackNotice(true)} title="Pronunciation playback is not connected in this build demo" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary hover:bg-muted" aria-label="Pronunciation playback not connected" data-testid="button-play-pronunciation">{speaking ? <Volume2 size={18} className="text-primary" /> : <Play size={16} fill="currentColor" />}</button><div><p className="text-[16px] font-semibold">the /ʃ/ in <i>sure</i>, <i>should</i>, <i>shame</i></p><p className="mt-1 text-xs leading-5 text-muted-foreground">Example pronunciation guidance only: round the lips, no hard start. No pronunciation was assessed; playback is not connected.</p></div></div>
    {playbackNotice && <p className="mt-3 text-sm text-muted-foreground" role="status" data-testid="status-pronunciation-playback">Pronunciation playback is not connected in this Phase 1 demo. No audio was played.</p>}
    <section className="mt-7 rounded-[22px] bg-foreground p-5 text-background"><p className="text-[10px] font-semibold uppercase tracking-[.17em] text-background/55">Task for your next conversation</p><h2 className="mt-3 font-serif text-2xl leading-tight">Interrupt {partner} three times, politely, without apologising for it twice.</h2><button onClick={() => { begin('coach'); setLocation('/session?mode=coach'); }} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-semibold text-primary-foreground" data-testid="button-next-task">Start that conversation <ArrowRight size={16} /></button></section>
    <Link href="/" className="mt-7 block text-center text-sm text-muted-foreground hover:text-foreground" data-testid="link-notes-home">Back to today</Link>
  </div>;
}

function SectionLabel({ children }: { children: ReactNode }) { return <p className="mb-3 mt-8 text-[10px] font-semibold uppercase tracking-[.18em] text-muted-foreground">{children}</p>; }

function Progress() {
  const skills = [{ label: 'Speaking', value: 72, color: 'bg-primary' }, { label: 'Listening', value: 61, color: 'bg-accent' }, { label: 'Vocabulary', value: 48, color: 'bg-orange-400' }, { label: 'Pronunciation', value: 39, color: 'bg-sky-600' }];
  return <div className="fp-page mx-auto max-w-4xl px-5 py-10 sm:px-10 lg:py-16">
    <PageHeader eyebrow="Synthetic progress" title={<>Keep the thread.<br /><i>A design example.</i></>} />
    <p className="mb-6 rounded-2xl border border-primary/25 bg-primary/8 p-4 text-sm leading-6 text-muted-foreground" data-testid="banner-synthetic-progress">Synthetic progress: every level, chart, percentage, and activity count is synthetic. These are design placeholders, not proficiency scores or real learning progress.</p>
    <section className="rounded-[27px] bg-foreground p-6 text-background sm:p-8"><div className="flex items-end justify-between gap-5"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-background/55">Example level · not assessed</p><h2 className="mt-2 font-serif text-4xl">B1+</h2></div><p className="text-right text-sm text-background/65">Two thirds of the<br />way to <strong className="text-background">B2</strong></p></div><div className="mt-7 h-2 overflow-hidden rounded-full bg-background/15"><div className="h-full w-[67%] rounded-full bg-primary" /></div><div className="mt-2 flex justify-between text-[11px] text-background/55"><span>B1 · confident intermediate</span><span>B2</span></div></section>
    <div className="mt-4 grid gap-4 md:grid-cols-[1.05fr_.95fr]"><section className="rounded-[24px] border border-border bg-card p-6"><div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-muted-foreground">Example spoken minutes</p><p className="mt-2 font-serif text-4xl">18<span className="text-lg text-muted-foreground"> min</span></p></div><span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent">+6 this week</span></div><div className="mt-7 flex h-24 items-end gap-2">{[22, 34, 18, 52, 39, 72, 48].map((height, i) => <div key={i} className="flex flex-1 flex-col items-center gap-2"><div className={`w-full rounded-t-lg ${i === 5 ? 'bg-primary' : 'bg-secondary'}`} style={{ height: `${height}%` }} /><span className="text-[10px] text-muted-foreground">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</span></div>)}</div></section><section className="rounded-[24px] border border-border bg-card p-6"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-muted-foreground">A steady rhythm</p><p className="mt-3 font-serif text-2xl leading-tight">Three sessions this week is enough to move the needle.</p><div className="mt-6 flex items-center gap-2">{[true, true, true, false, true, false, false].map((active, i) => <span key={i} className={`h-7 flex-1 rounded-lg ${active ? 'bg-accent' : 'bg-secondary'}`} />)}</div><p className="mt-3 text-xs text-muted-foreground">3 of 5 practice days</p></section></div>
    <SectionLabel>Synthetic skill progress · not measured</SectionLabel>
    <section className="rounded-[24px] border border-border bg-card p-6">{skills.map(({ label, value, color }) => <div key={label} className="mb-5 last:mb-0" data-testid={`progress-skill-${label.toLowerCase()}`}><div className="mb-2 flex justify-between text-sm"><span className="font-medium">{label}</span><span className="text-muted-foreground">{value}%</span></div><div className="h-2 overflow-hidden rounded-full bg-secondary"><div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} /></div></div>)}</section>
  </div>;
}

function NotFound() { return <div className="mx-auto max-w-lg px-6 py-24 text-center"><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-muted-foreground">Page not found</p><h1 className="mt-3 font-serif text-5xl">A quiet dead end.</h1><Link href="/" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground" data-testid="link-not-found-home">Back to today <ArrowRight size={16} /></Link></div>; }

function Router() {
  return <Shell><ErrorBoundary resetKey={window.location.hash}><Switch><Route path="/" component={Home} /><Route path="/practice" component={Practice} /><Route path="/drill" component={Drill} /><Route path="/session" component={Session} /><Route path="/notes" component={Notes} /><Route path="/progress" component={Progress} /><Route component={NotFound} /></Switch></ErrorBoundary></Shell>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><DemoProvider><WouterRouter hook={usePreviewLocation}><Router /></WouterRouter></DemoProvider><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
