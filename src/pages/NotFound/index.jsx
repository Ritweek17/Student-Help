import React from 'react';
import { Link } from 'react-router-dom';
import { Compass, Sparkles, ArrowLeft } from 'lucide-react';
import { Button } from '../../components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-6 ring-8 ring-indigo-500/10">
        <Compass className="w-8 h-8 animate-pulse" />
      </div>

      <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">
        404 ERROR • PAGE NOT FOUND
      </span>

      <h1 className="text-4xl sm:text-5xl font-extrabold text-white font-heading mt-2 mb-3">
        Lost in CareerOS Space?
      </h1>

      <p className="text-slate-400 text-sm sm:text-base max-w-md mx-auto mb-8 leading-relaxed">
        The route you are trying to reach does not exist or has been moved. Return to your student dashboard to stay on track.
      </p>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Link to="/dashboard">
          <Button size="lg" icon={Sparkles} className="shadow-lg shadow-indigo-600/30">
            Return to Dashboard
          </Button>
        </Link>
        <Link to="/">
          <Button size="lg" variant="outline" icon={ArrowLeft} className="border-slate-800 text-slate-300">
            Back to Landing Page
          </Button>
        </Link>
      </div>
    </div>
  );
}
