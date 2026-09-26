"use client";
export default function AppError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="form-card" role="alert"><h1 className="page-title">Something went wrong</h1><p className="page-subtitle">The request could not be completed. Your data was not intentionally changed.</p><button className="btn btn-primary" style={{marginTop:16}} onClick={reset}>Try again</button></div>;
}
