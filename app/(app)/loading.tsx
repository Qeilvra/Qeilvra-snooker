export default function Loading() {
  return <div aria-label="Loading" aria-busy="true"><div className="skeleton skeleton-title"/><div className="metric-grid">{Array.from({length:4},(_,i)=><div className="skeleton skeleton-card" key={i}/>)}</div><div className="skeleton skeleton-panel"/></div>;
}
