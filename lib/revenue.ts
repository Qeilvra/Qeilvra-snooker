export type PaidOrderRevenue = { total_amount: number | string; session_id: string | null; created_at: string };
export type CompletedSessionRevenue = { id: string; table_charge: number | string; end_time: string | null };

export function recognizedSessionIds(orders: PaidOrderRevenue[]) {
  return new Set(orders.flatMap((order) => order.session_id ? [order.session_id] : []));
}

export function totalRecognizedRevenue(orders: PaidOrderRevenue[], sessions: CompletedSessionRevenue[]) {
  const settledSessions = recognizedSessionIds(orders);
  const orderRevenue = orders.reduce((total, order) => total + Number(order.total_amount), 0);
  const standaloneSessionRevenue = sessions
    .filter((session) => !settledSessions.has(session.id))
    .reduce((total, session) => total + Number(session.table_charge), 0);
  return orderRevenue + standaloneSessionRevenue;
}
