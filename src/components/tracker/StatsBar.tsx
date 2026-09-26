interface StatsBarProps {
  todayCompleted: number;
  activityCount: number;
  overallPercent: number;
  streakDays: number;
}

export function StatsBar({ todayCompleted, activityCount, overallPercent, streakDays }: StatsBarProps) {
  return (
    <section aria-label="Plan statistics" className="stats-bar">
      <article className="stat">
        <p className="stat-label"><span aria-hidden="true" className="stat-icon">◷</span> TODAY</p>
        <p className="stat-value"><span>{todayCompleted}</span><span className="stat-divider">/ {activityCount}</span><span className="stat-unit">completed</span></p>
      </article>
      <article className="stat">
        <p className="stat-label"><span aria-hidden="true" className="stat-icon">↗</span> OVERALL</p>
        <p className="stat-value"><span>{overallPercent}</span><span className="stat-unit">%</span></p>
      </article>
      <article className="stat">
        <p className="stat-label"><span aria-hidden="true" className="stat-icon">⌁</span> STREAK</p>
        <p className="stat-value"><span>{streakDays}</span><span className="stat-unit">DAYS</span></p>
      </article>
    </section>
  );
}
